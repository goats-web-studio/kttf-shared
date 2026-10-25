# 00. KTTF tournament management — inventory as of 18.10.2026

_Read-only audit for comparison with the desktop "RTTF Tournament Manager". Legend: ✅ implemented back+front · 🟡 partial (what's missing, which side) · ❌ absent._
_Paths: `shared/` = `kttf-shared/src`, `back/` = `kttf-back/src/features`, `front/` = `kttf-front/src`._

---

## 1. Data model

Source: `kttf-back/prisma/schema.prisma` (19 tables), mirrored in `docs/03-tech-spec.md` §4.

| Entity                                                                                                                                                                                                                                                                                                                                                                                                         | State                                                                                           |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| **Tournament** — one category per tournament: name, club, `startsAt`, `registrationEndsAt`, `entryFee` (₸), `maxParticipants`, `ratingCapMin/Max`, `reviewOutOfRating`, `birthYearFrom/To`, `genderLimit`, `level` (CLUB/REGIONAL/NATIONAL = T factor), `tableCount`, `formatConfig` (JSON, Zod), `seedingConfig`, `description`, `prizeInfo` (free text), `publicToken` (TV screen), `version` (offline sync) | ✅                                                                                              |
| **Status machine** `DRAFT → PUBLISHED → REG_OPEN → REG_CLOSED → RUNNING → FINISHED → RATED`, `CANCELLED` from anything except RATED. `back/tournaments/tournament-lifecycle.ts`; the front copy that picks the buttons is `front/features/tournaments/lifecycle.ts` (duplicated rule, tech debt §8 of 05-state)                                                                                                | ✅ No way back (for example REG_CLOSED → REG_OPEN), no "results published" status from spec 4.1 |
| **Stage** (`order`, `type` GROUPS/KNOCKOUT/ROUND_ROBIN/CONSOLATION, `config` JSON) → **Group** (`label`, `order`; members are derived from its matches, not stored) → **Match**                                                                                                                                                                                                                                | ✅                                                                                              |
| **Match**: `playerAId/BId` (nullable), `sourceA/B` `{WINNER\|LOSER, matchId}` (the whole bracket is created up front, ADR-019), `status` PENDING/PLAYING/FINISHED (QUEUED and CANCELLED exist but are unused), `tableNumber`, `setsA/B`, `setScores` JSON `[[11,9],…]`, `resultType` NORMAL/WALKOVER/RETIRED, `bracketRound/Slot`, `startedAt/finishedAt`                                                      | ✅                                                                                              |
| **TieDecision** (referee's order for an unresolved tie, per group)                                                                                                                                                                                                                                                                                                                                             | ✅                                                                                              |
| **Registration**: status REGISTERED/PENDING/WAITLIST/CONFIRMED/PLAYING/WITHDRAWN/NO_SHOW/REJECTED, `seed`, `isRated` (out of competition), `ratingAtStart`/`matchesAtStart` (taken at start), `paidAt/paymentId` (unused)                                                                                                                                                                                      | ✅                                                                                              |
| **Player** — single players only, no pair or team entity. Fields: rating projection (`rating`, `ratedMatches`, `isProvisional`), `trustScore` (unused), hand/grip/equipment, coach                                                                                                                                                                                                                             | ✅ singles · ❌ doubles/teams                                                                   |
| **Club** + **ClubMember** role OWNER/ORGANIZER/REFEREE; `User.isAdmin` (ADR-046); City/Country directory                                                                                                                                                                                                                                                                                                       | ✅                                                                                              |
| **RatingEvent** (event journal; the projection lives on Player), **AuditLog**, **SyncOperation**                                                                                                                                                                                                                                                                                                               | ✅                                                                                              |
| `Transaction`, `Tariff`, `RatingAnomaly`; RatingEvent types `MANUAL_ADJUST`/`RECALC`                                                                                                                                                                                                                                                                                                                           | ❌ Schema only, no code writes them                                                             |

**Roles in practice.** Owner and organizer run the tournament: lifecycle, draw, participants, tie decisions (`assertClubStaff`). Any club member, the referee included, may enter scores (`back/tournaments/console-access.ts`). Known permissions defect from 05-state: the referee can enter a score but gets `FORBIDDEN` on `TIE_DECISION`, which contradicts ADR-008. The owner's current goal defers the referee role.

---

## 2. Formats and algorithms

**Schemes** (`shared/types/tournament-format.ts`, engine `shared/brackets/*`, draw `back/tournaments/draw.ts`):

| Format                                                                                                                                                   | State                                                                                                       |
| -------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Round robin, 1 or 2 cycles (`rounds`; the second cycle swaps sides)                                                                                      | ✅                                                                                                          |
| Single elimination with seeding and byes                                                                                                                 | ✅                                                                                                          |
| 3rd-place match (`thirdPlace`)                                                                                                                           | ✅                                                                                                          |
| Groups → knockout (`GROUPS_KNOCKOUT`, N advance per group, `groupRounds` 1/2)                                                                            | ✅                                                                                                          |
| Groups → final groups by place (`GROUPS_FINAL_GROUPS`; the k-th final group is everyone who finished k-th)                                               | ✅                                                                                                          |
| Final groups with carried-over results ("с зачётом")                                                                                                     | ❌ Final groups replay everyone from scratch (`planFinalGroups`)                                            |
| Placement bracket for non-advancers (`exitBracket`, stage CONSOLATION; places 9+ go straight after the main bracket, ADR-045)                            | ✅ only for GROUPS_KNOCKOUT                                                                                 |
| All places played out (classification for 5–8, 3–4 inside the bracket, and so on)                                                                        | ❌ Losers of the same round share a place range (`SHARED`). Only 3rd place is separated                     |
| Consolation / double elimination / lower bracket                                                                                                         | ❌ The schema rejects `consolation: true`. Open question ОВ-15 (who drops into the lower bracket) blocks it |
| Multiple brackets after groups (A/B finals by place)                                                                                                     | ❌ Only one main bracket + one exit bracket                                                                 |
| Fill up to bracket size with the best 3rd places (cross-group ratios, spec 6.7)                                                                          | ❌ Blocked by ОВ-16                                                                                         |
| Main bracket size cap ("128 entered, 64 play")                                                                                                           | ❌                                                                                                          |
| Elimination after N losses, Swiss, team events, doubles                                                                                                  | ❌ None of them                                                                                             |
| Per-round match length (final, 3rd place, semifinal … 1/64, counted back from the final; `playoffSetsToWin`, `shared/brackets/match-length.ts`, ADR-044) | ✅ Best of 3/5/7 only (`setsToWin` 2/3/4)                                                                   |
| Saved scheme templates, import/export of schemes                                                                                                         | ❌ Spec 5.3 marks this V2                                                                                   |

**Algorithms in `shared/brackets`** (pure, 100% covered):

- **Seeding** (`back/tournaments/draw.ts` `seedParticipants`):
  - RATING: by rating descending, ties broken by id
  - RANDOM: crypto shuffle before the engine
  - MANUAL: organizer's seed numbers first, everyone else by rating after them
- **Groups** (`groups.ts` `splitIntoGroups`). Snake across bands of size `groupCount`: even bands go left→right, odd bands right→left. Group count comes from `groupCount`, or from `ceil(n/groupSize)`.
- **Club separation.** Greedy, and only by permutation inside a band, so seeding beats club separation (ADR-011). Collisions that remain are returned in `clubCollisions` and shown by name after the draw. `findClubCollisions` is reused after a swap.
- **Group match order** (`round-robin.ts`). Circle method with the first seed fixed. A dummy player gives a bye round for odd counts. Sides alternate on odd rounds. `bracketRound` stores the round number.
- **Knockout** (`knockout.ts`). Bracket size is the next power of 2. Canonical seed order by doubling (8 → `1 8 4 5 2 7 3 6`). Byes go to the top seeds, and no match is created for a bye. The 3rd-place match is `THIRD`, last round, slot 1.
- **Advancement** (`advancement.ts` `resolveBracketSlots`). Slots are recomputed from their sources every time, so the same code handles entering, editing and cancelling a result.
- **Group exit** (`group-advance.ts` `selectAdvancing`):
  - Playoff seeds: all 1st places in group order, then all 2nd places, and so on
  - Exit-bracket seeds: the next places in the same order
  - Only a tie that touches the exit zone blocks the next stage
- **Group standings tiebreak** (`standings.ts`):
  - Points: win 2, normal loss 1, walkover or retirement loss 0
  - Players level on points are separated in this order:
    1. Head-to-head points in the mini-table of those tied
    2. Set difference among those tied
    3. Ball difference among those tied
    4. Overall set difference
    5. Overall ball difference
    6. Lot — **the referee decides** (`tieDecisions`, ADR-008)
  - Recursion: when a rule splits the tie only partly, each remaining sub-tie restarts from rule 1
  - Balls count only if set scores were entered
- **Withdrawals** (`withdrawals.ts` `applyWithdrawals`). A withdrawn player's unplayed group matches count as `setsToWin:0` walkovers for the opponent (ADR-009, temporary). If both players withdrew, the match is dropped.
- **Score validation** (`result.ts` `validateMatchResult`). The winner must have exactly `setsToWin` sets. A walkover must be `setsToWin:0` with no set scores. A retirement may be short of `setsToWin`. Set scores must agree with the set totals. The points inside a set (11, win by 2) are **not** checked.
- **Final places** (`placement*.ts`, one strategy per scheme, ADR-023). Knockout places are taken from the round a player lost in. Non-advancers in GROUPS_KNOCKOUT without an exit bracket get `place: null` with reason `GROUP_EXIT`.
- **When the next stage is built** (`back/tournaments/advance.ts`). The playoff, final groups and exit bracket are built automatically, in the same transaction as the result that completes **the whole** group stage. They cannot start early group by group.

**Issues noticed**

- 🐞 **Same-group players can meet in the semifinal.** With 4 groups × 2 advancing, `byPlace.flat()` plus the canonical order puts A1 and A2 in the same half (A1–D2 and D1–A2 in R1, winners meet in R2). ADR-020 only claims separation "in the first round". ITTF/RTTF practice puts same-group players in opposite halves, so they can meet only in the final.
- 🐞 **Eliminated players in GROUPS_FINAL_GROUPS get the wrong reason.** When `advancePerGroup` is smaller than the group size, the players below the exit zone are marked `UNDECIDED` instead of `GROUP_EXIT` (`placement-table.ts`, `finalGroupsPlacement` "missed").

---

## 3. Registration

| Feature                                                                                                                                                                                             | State                                                                                                                                                                  |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Self-registration with an eligibility check shared by screen and server (`shared/eligibility`, ADR-029): rating caps (bounds inclusive), birth year range, gender. All reasons are returned at once | ✅                                                                                                                                                                     |
| Organizer adds a player by surname search (`front/features/tournaments/add-participant.tsx`)                                                                                                        | ✅                                                                                                                                                                     |
| Creating a new player inline from the tournament form                                                                                                                                               | 🟡 Back: `POST /players` exists. Front: not built in the tournament form (commented in `add-participant.tsx`); players are created elsewhere                           |
| Bulk paste / import of a player list                                                                                                                                                                | ❌                                                                                                                                                                     |
| Unrated or guest players                                                                                                                                                                            | 🟡 Every player gets a start rating of 250 and is provisional for 20 matches. There is no "guest without a profile", and organizers can't assign a start rating (ОВ-2) |
| Out of competition (`isRated=false`, toggle in the participants panel; the whole match is excluded from rating for both players)                                                                    | ✅                                                                                                                                                                     |
| Out-of-rating-cap applications (`reviewOutOfRating` → PENDING → accept/reject; ADR-044)                                                                                                             | ✅                                                                                                                                                                     |
| Waitlist with automatic promotion                                                                                                                                                                   | ✅ No manual promote button                                                                                                                                            |
| Manual seed numbers                                                                                                                                                                                 | ✅                                                                                                                                                                     |
| Withdrawal: self-cancel until the deadline; organizer delete before start; WITHDRAWN at any time                                                                                                    | ✅                                                                                                                                                                     |
| NO_SHOW                                                                                                                                                                                             | 🟡 Back: accepted. Front: no button, display label only                                                                                                                |
| Late entries after registration closes                                                                                                                                                              | ❌ `register` needs `REG_OPEN` and a deadline that hasn't passed, organizer included. Nobody can be added after the draw                                               |
| Repeat the draw on withdrawal before start                                                                                                                                                          | ✅ The redraw wipes the previous one                                                                                                                                   |
| Entry fee                                                                                                                                                                                           | 🟡 A stored number only. No payment (V2), no "paid" mark (ОВ-6), no prize fund calculation (`prizeInfo` is free text)                                                  |
| Non-playing hand, etc.                                                                                                                                                                              | ✅ Hand and grip live on the player profile (ADR-035). Not used by tournament logic                                                                                    |

🐞 **Waitlist promoted mid-tournament.** Withdrawing a `PLAYING` participant runs `promoteFromWaitlist` (`back/tournaments/tournaments.service.ts` `updateRegistration`). With `maxParticipants` set and a waitlist present, a waitlisted player becomes CONFIRMED in the middle of a running tournament without being in the draw.

---

## 4. Console (live control)

Code: `front/routes/console/$tournamentId.tsx`, `front/features/console/*`, `back/matches/*`, `back/sync/*`.

| Feature                                                                                                                                                                                                                                                                | State                                                                      |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| One-page layout: tables, queue, standings, latest results; actions in dialogs; mobile 390×844 verified                                                                                                                                                                 | ✅                                                                         |
| Tables numbered 1..`tableCount`, three states (free / playing / awaiting next) (`queue.ts buildTables`)                                                                                                                                                                | ✅ The server does not check `tableNumber ≤ tableCount` or table occupancy |
| Calling a pair: one-tap "На стол N" (lowest free table suggested), pick from the queue for a free table, or move to another table                                                                                                                                      | ✅ Manual only                                                             |
| Auto-assign when a table frees (spec 6.2 MVP)                                                                                                                                                                                                                          | ❌                                                                         |
| Queue order: pairs with a player still at a table go last; never-played first; then waiting time; then round/slot                                                                                                                                                      | ✅                                                                         |
| Hints "ждёт дольше всех" and "последняя игра у обоих"                                                                                                                                                                                                                  | ✅                                                                         |
| Hint "решающая встреча группы"                                                                                                                                                                                                                                         | ❌                                                                         |
| Match timer on the table card, highlighted at 30+ minutes; "played X of Y"                                                                                                                                                                                             | ✅                                                                         |
| Tournament duration or time estimate                                                                                                                                                                                                                                   | ❌                                                                         |
| Quick results (3:0 … 2:3 derived from `setsToWin`) plus walkover ("Неявка") per side                                                                                                                                                                                   | ✅                                                                         |
| Set-by-set entry (optional toggle, `score-pad.tsx`)                                                                                                                                                                                                                    | ✅ Set scores are not shown on the public results page                     |
| RETIRED (retirement during the match)                                                                                                                                                                                                                                  | 🟡 Back and engine support it. Front has no input for it                   |
| Edit a finished result (MATCH_EDIT, AuditLog before/after). Rejected if a later match that depends on it was played; an unplayed later playoff is silently rebuilt                                                                                                     | ✅                                                                         |
| Cancel: back to the queue, result and table cleared                                                                                                                                                                                                                    | ✅                                                                         |
| Undo: snackbar "Отменить" after assigning; after a score only "Исправить" (reopen)                                                                                                                                                                                     | 🟡 No general undo                                                         |
| Tie resolution panel (only for fully played groups, ↑/↓ reorder)                                                                                                                                                                                                       | ✅                                                                         |
| Withdrawal mid-tournament                                                                                                                                                                                                                                              | 🟡 See notes below                                                         |
| Late player insertion or swap during RUNNING                                                                                                                                                                                                                           | ❌ Swap (`POST /draw/swap`, ADR-033) only in REG_CLOSED                    |
| Change the scheme after the draw                                                                                                                                                                                                                                       | 🟡 Editing before start resets the draw (ADR-044). After start: ❌         |
| Manual redistribution into finals or the playoff                                                                                                                                                                                                                       | ❌ The next stage is built automatically and has no editor                 |
| Start finals before all groups end                                                                                                                                                                                                                                     | ❌                                                                         |
| Offline: Dexie `kttf-console` (`snapshots`, `outbox`); sync every 15 s, on `online`, or by button; badge shows SYNCED/SYNCING/OFFLINE; rejected operations stay visible; finish needs network. Server applies by `seq` and is idempotent by `clientOpId` (ADR-026/027) | ✅ Not yet field-tested with Wi-Fi off                                     |
| Audit log                                                                                                                                                                                                                                                              | 🟡 Result edits and finishing only                                         |
| Multiple operators (any club member; order of operations resolves conflicts)                                                                                                                                                                                           | ✅                                                                         |
| Several tournaments at once                                                                                                                                                                                                                                            | 🟡 One per route or tab. No combined hall view, no shared table pool       |
| Keyboard shortcuts                                                                                                                                                                                                                                                     | ❌ Touch-first; no hotkeys                                                 |
| Finish button (only when all matches are FINISHED/CANCELLED and the outbox is empty)                                                                                                                                                                                   | ✅                                                                         |

**Withdrawal mid-tournament, in detail**

- Back: `PATCH registration {status: WITHDRAWN}` is accepted in any status. The engine then counts the player's unplayed group matches as walkovers, and the server does not wait for them before finishing or advancing (`stage-completion.ts`).
- Knockout: the organizer must enter W:L by hand.
- Front: the button is in the tournament-page participants panel, not in the console. The `PLAYER_WITHDRAW` sync operation exists in the contract, but nothing in the UI sends it.

🐞 **The console ignores withdrawals.** It knows nothing about WITHDRAWN/NO_SHOW (no reference in `features/console`). The withdrawn player's group matches stay in the queue. The tie panel (`group-matches.ts isPlayedOut`) and the finish bar both require every match to be FINISHED, so they never appear unless the organizer types a walkover for each match. Meanwhile the server has already advanced the stage. The console's rule has drifted from the engine's (breaks rule №2 of the agent brief).

---

## 5. Public side

| Feature                                                                                                                                                                                                                                                         | State                                                                                             |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Hall TV screen `/screen/:token`, no login. Shows tables with timers and a "Вызов" mark for 2 minutes, next pairs, latest results, rotating group matrices and brackets, progress and clock. Live via SSE; the last state stays on screen when offline (ADR-025) | ✅ Event bus is in-memory, single instance only. Local mode without internet (ОВ-4) ❌            |
| Results page `/tournaments/:id`: places (shared and unresolved shown), group tables, brackets (CONSOLATION included), matches, rating deltas                                                                                                                    | ✅ No live updates (refetch on focus, 10 s staleTime); no set scores; no links to player profiles |
| Calendar (city, club, dates, status in the URL)                                                                                                                                                                                                                 | 🟡 No rating-cap or age filters (ОВ-18)                                                           |
| Country rating list (search, city, club)                                                                                                                                                                                                                        | 🟡 No gender or age filters (ОВ-18)                                                               |
| Player profile: SVG rating curve, tournament history, paginated matches, head-to-head                                                                                                                                                                           | 🟡 No stats or match filters (ОВ-19)                                                              |
| Club list and club page                                                                                                                                                                                                                                         | ✅                                                                                                |
| Home page news feed generated from results                                                                                                                                                                                                                      | ✅                                                                                                |
| Notifications (push, Telegram, WhatsApp autopost)                                                                                                                                                                                                               | ❌ V2, ОВ-5                                                                                       |
| i18n ru and kk (689 keys each, type-checked)                                                                                                                                                                                                                    | 🟡 No English. No language switcher in the UI; the language is taken from the browser             |

---

## 6. Rating

`shared/rating`, ADR-003, spec §7.

- **Formula 2.0.** `Δ = K × T × M × G × (1 − E_winner)`. The winner gains `round2(K_w·base)` and the loser drops `round2(K_l·base)`.
  - `E` is Elo-logistic with SCALE 200
  - `G = max(0, 1 − max(0, gap)/100)`: a favourite who wins by a 100+ rating gap changes nothing
  - `M` = 0.8 / 1.0 / 1.2 for a set difference of 1 / 2 / 3+; 0 for a walkover or retirement
  - `T` = 0.8 / 1.0 / 1.2 by the **declared** level (ОВ-1: RTTF derives T from the average rating instead)
  - `K` = 20; a provisional player (fewer than 20 rated matches) gets 40 when winning and 20 when losing
  - Start rating 250, minimum 1 (clamping is recorded)
  - Constants are not calibrated (ОВ-3)
- **When it runs.** Against ratings taken at `start`, applied by `POST /finish` (`back/tournaments/tournaments.service.ts`): one transaction closes the tournament (FINISHED), a second writes the rating (RATED). A retry is safe, and RATED acts as the lock.
- **What is excluded.** Matches involving an out-of-competition player count for neither side. Walkovers and retirements create no event. A zero delta from the 100-gap rule still creates an event and counts toward the provisional threshold.
- **Rating types.** One rating (no separate men/women, age, or official FNTRK).
- **Recalculation or rollback.** ❌ No endpoint for history recalculation, manual adjustment, or un-rating. Cancelling a RATED tournament is forbidden. Editing results after FINISHED: ❌.
- **Friendly or out-of-tournament rated matches.** ❌ A match always belongs to a tournament.
- **Inflation metric.** 🟡 `imbalance` is recorded, but there is no aggregate or alert. Anomaly detection: ❌.

---

## 7. Export, import, printing

❌ None:

- no PDF, CSV or XLSX
- no `@media print`, no `window.print`
- no protocol or bracket printouts
- no tournament file save/open (RTTF's `.rttf`)
- no player-list import
- no scheme import/export

The only "export" is the public results page and the TV link (copy to clipboard).

---

## 8. Gaps, debts and next steps (from `docs/05-state.md` plus this audit)

**Next steps per 05-state §5.** Feature-by-feature parity check against RTTF (needs a live organizer account or screenshots). Brute-force protection for `/auth/login` (no throttler; spec 8.3 also asks for 100 requests per minute). Offline field test. Sprint 5 "rating in production".

**Open questions blocking tournament features**

| Question     | Blocks                                                |
| ------------ | ----------------------------------------------------- |
| ОВ-15        | Lower bracket                                         |
| ОВ-16        | Cross-group comparison and filling up to bracket size |
| ОВ-1         | Computed vs declared T                                |
| ОВ-2         | Start rating                                          |
| ОВ-3         | Constant calibration                                  |
| ОВ-4         | Local TV mode                                         |
| ОВ-6         | Cash "paid" mark                                      |
| ОВ-18, ОВ-19 | Public filters and stats                              |

**Half-implemented or stubbed**

- `consolation` flag: in the schema, rejected
- `QUEUED` / `CANCELLED` match statuses: in the schema, unused
- `Transaction`, `Tariff`, `RatingAnomaly`, `trustScore`, `MANUAL_ADJUST`/`RECALC`: schema only
- `PLAYER_WITHDRAW` sync op: no UI sends it
- RETIRED: no UI input
- NO_SHOW: no UI
- `Caddyfile` `/ws/*` rule: unused
- Session cleanup: no background jobs

There are no TODO or FIXME markers in back, front or shared.

**Bugs found by this audit**

1. Console ignores withdrawn players. The finish bar and tie panel are blocked; the queue shows dead matches (§4).
2. Group playoff seeding lets same-group players meet in the semifinal (§2).
3. Withdrawal during RUNNING promotes the waitlist (§3).
4. GROUPS_FINAL_GROUPS gives eliminated players `UNDECIDED` instead of `GROUP_EXIT` (§2).
5. The server doesn't validate the table number against `tableCount` or check table occupancy (§4).

**Known defects from 05-state**

- Referee gets FORBIDDEN on tie decisions
- Lifecycle transition table duplicated in front and back
- Rating journal has no intrinsic order (same `createdAt` for every event)
- Single-instance SSE bus
- Club tournaments capped at 100 per request
- 8 Dependabot alerts in front
- No CI

**Largest gaps vs a desktop TM**

1. Format breadth: double elimination / consolation, all places played out, A/B finals, carried-over final groups, Swiss, teams, doubles, bracket-size cap and filling.
2. Mid-tournament flexibility: late entry, swap or replace after start, manual edits to the next stage, early finals.
3. Printing and export.
4. Bulk player entry.
5. Rating corrections and recalculation.
6. Auto-assignment and time estimation.
