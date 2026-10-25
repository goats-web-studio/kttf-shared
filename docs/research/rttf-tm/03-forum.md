# 03. RTTF forum: pain points, requests, bugs and praise (as of 18.10.2026)

_Source: the rttf.ru forum (boards 1, 2, 3, 5, plus a title scan of 4 and 6), read through the r.jina.ai reader proxy, plus Wayback Machine snapshots and a light web search. Goal: what RTTF players and organizers actually complain about, ask for and like, so KTTF can beat the RTTF website + desktop "RTTF Tournament Manager" (TM) combo._

_Thread URL format: `https://rttf.ru/topics/NNNN` (abbreviated below as **t NNNN**). Quotes are verbatim Russian, trimmed. Frequency labels: **very high** = recurring across many threads / 500+ comment threads; **high** = 10+ distinct users or a 100+ comment thread; **medium** = 4-9 users; **low** = 1-3 users. "[ADMIN]" = RTTF site staff (Никитос, abel, editorRTTF), "[ORG]" = a club organizer._

---

## 0. Coverage and method (read this before trusting frequencies)

| Board   | Name                                  | Topics listed                                                     | Pages (100/page) | Threads opened                                                                                                                   |
| ------- | ------------------------------------- | ----------------------------------------------------------------- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| forum/3 | Пожелания и замечания по работе сайта | **219 (all)**                                                     | 3                | **202** (13 off-topic skipped; 4 return "Страница не найдена", incl. t 16543 "Настройка программы рассчёта турнира", 2026-10-12) |
| forum/1 | Настольный теннис                     | 2,843 (all)                                                       | 29               | 117 selected by keyword (rating, слив, турнир, сетка, посев, организатор, взнос, трансляция, судья...)                           |
| forum/2 | Всякое разное                         | 489 (all)                                                         | 6                | 27 selected                                                                                                                      |
| forum/5 | Новости клубов                        | 1,363 (all)                                                       | 14               | 13 selected (fees, cashback, formats, referees)                                                                                  |
| forum/4 | Темы из старого форума (архив)        | 3,856+ titles (40 pages, back to 03.2016; older pages not listed) | 40+              | 3 (rating-dumping threads)                                                                                                       |
| forum/6 | Платные объявления                    | 26                                                                | 1                | 0 (ads)                                                                                                                          |

- **Total: 362 threads read, plus 13 Wayback snapshots of 10 mega-threads** (older comment windows of t 11189, 11341, 12069, 12493, 12810, 13257, 14498, 14813, 15536, 16040).
- **Big limitation:** a thread page renders only the **opening post + the 20 newest comments**. Older comments load through a `POST /?ajax` call the reader proxy can't make. So for an 850-comment thread we saw about 5-10% (plus a Wayback window when one existed). Frequencies are therefore lower-bound estimates, weighted by the real comment counts shown on the board.
- **Pagination format:** board pages have no page links. The board is sorted by last post and filtered with `?date_from=&date_to=DD.MM.YYYY&title=`. We paged by setting `date_to` to the last row's date.
- **No dedicated TM forum board exists.** We probed forum/0-12: 4 = archive, 6 = paid ads, 7-12 and 0 = 404. The "раздел RTTF Tournament Manager" mentioned in content/32 is the **articles section content/25**, not a forum board. The video pinned in its header is YouTube `kvP1TpdroG8`, "Подробная инструкция к программе Tournament Manager RTTF" (channel @RTTF-ru, 24:03, published 2019-11-01, about 6.1k views). Its description says organizers get the program by emailing info@rttf.ru, and that RTTF then "расскажем как проводить турниры онлайн, рассчитывать рейтинг и публиковать результаты". We couldn't watch the video. Its scope matches content/25 chapters 1-8 (get/install, run a tournament, schemes, registration, settings, process, troubles). TM bugs therefore surface in board 3 and in board 1 format/tie-break threads.
- **Not covered:** per-tournament comment pages (`rttf.ru/tournaments/N`), the comments feed (`/comments/`), photo and video sections.
- **Web search** found almost nothing outside rttf.ru about the TM. One useful outside source: Habr "Сравнение рейтинговых систем Эло и RTTF" (habr.com/ru/articles/725708, 2023). Its author says the RTTF formula assumes the tournament format, needs a manually set starting rating, and "если разница... более 100 очков, то рейтинг не меняется", so ratings "застревают". He switched to Elo. Forum users cite **Challonge** as the free alternative for one-off brackets (t 14442).

---

## 1. Context worth knowing first

**RTTF's scale.** Figures come from users quoting site statistics:

- July 2024 (t 11189): 2,601 tournaments, 30,004 entries, 10,842 unique players. Rival TTW in the same month: 938 / 15,035.
- February 2024 (t 14617): 2,755 tournaments, 36,419 entries, 14,964 unique players, 69,484 profiles in the database. TTW: 1,286 / 23,426.
- About 45,000 players take part per year (t 15384). Regions outside Moscow already exceed Moscow in total entries.

**Kazakhstan is already on RTTF.**

- Duplicate-profile requests come from Усть-Каменогорск, Семей and Астана (t 12493).
- Almaty and Astana tournaments appear under "Moscow" in the tournament list (t 15212).
- User tiendi "rolled RTTF out to 3 clubs in Kazakhstan" (t 12482). In Astana, monthly official leagues seeded by RTTF rating draw "300+ people a month" (t 14382).
- **This is KTTF's home turf. Those users already know RTTF's flaws.**

**How RTTF runs, as described by the admins.**

- RTTF doesn't run tournaments and has "почти никаких рычагов влияния на организаторов" (t 11245).
- Clubs pay RTTF per tournament (t 11239, t 11245). By user accounts, the free tier is results by email published in 1-3 days; the paid tier adds online registration and live results (t 14617).
- The TM was a third-party program. In January 2019 the admins said it "не принадлежит нам юридически". By April 2019: "теперь программа официально наша" (t 11425).
- The admins have repeatedly promised to "организовать систему проведения турниров прямо на сайте" with live deltas (t 11425, 2019). It hasn't shipped.
- In October 2020: "доработки программы пока приостановлены" (t 12465).
- The program's delta formula is out of date: "в программе в формулу подсчета дельты рейтинга не внесены последние изменения. Поэтому вся актуальная информация только на сайте" (t 12659, 2021).

**The rating formula as users quote it** (t 13666, t 15292, t 11991, t 14984):

- **Δ = [(100 − (Pв − Pп)) / 10] · k · D.** Pв is the winner's rating, Pп the loser's.
- Δ = 0 if the winner is rated 100 or more above the loser. Rating can't drop below 1.
- k (tournament coefficient) is 0.2-0.4, set by the field's average rating.
- D (score coefficient) is 1.2 for 3:0, 1.0 for 3:1, 0.8 for 3:2.
- In a newcomer's first 5 tournaments, fixed values apply: D=1, k=1 for a win and 0.5 for a loss.
- Prize-place bonus applies only with 16+ players: 2.5% falling to 1% depending on the top-12 average, zero if they average 200 or more below.
- In 2018 every player got +100 (t 11191).
- There are separate rating pools: non-playing hand, ping-pong, shah-pong, racketlon, mini-tennis.
- Doubles have no rating. Pair seeding uses A+B, (A+B)/2 or (A+2B)/3 (t 11618). Handicap ("фора") games are not rated.

---

## 2. How organizers actually run tournaments (from the threads)

**Staffing.** Usually one club admin per session, often also selling sparring at about 2,000₽/h during the event (t 15714). Calls and results are typed into the TM on a laptop, and a TV monitor shows groups and brackets (t 13294, t 12465, t 16231).

**Registration.**

- Players register online on RTTF. Admins also add players offline, which bypasses the site's checks: "чтобы участвовать в турнире, не обязательно регистрироваться здесь" (t 11984).
- Over-limit and phone-in registrations are allowed per club (t 14014).
- Before the start the admin should press "загрузить актуальный рейтинг". Many don't (t 12460, t 16142).
- Newcomers get a rating the admin picks: often 50, 100 or 150 "по наитию", sometimes by a receptionist (t 15492, t 15608). Rating operators later correct it.

**Formats.**

- Groups of 3-5, then a full-placement bracket. Also two finals, round robin for 3-8 players, long or short brackets, "classes" (players split by level), ladders, handicap doubles and team cups.
- A rule of thumb from an experienced player (t 13225, SERGONY):
  - 3-8 players: round robin.
  - 10-28: groups + long bracket.
  - 28-40: long bracket only.
  - 40+: short bracket.
- Usual weekday slot is 19:30 to about 23:00 (t 16310, t 15198). Clubs have 4-15 tables, sometimes renting some out mid-event (t 15198).

**Refereeing.** None at commercial events. Players count their own score and report it to the admin, who types whatever is dictated: "пошел к админу и сказал: запишите мне 0:3. Записали" (t 13257). Liga Pro uses paid referees with tablets (t 15479). One club gives a free entry for scoring 4 matches (t 13233).

**Fees and prizes.**

- Fees run 200-800₽, 1,000+ for strong or open events, and about 450-500₽ is typical (t 15468, t 14384, t 16481).
- Prize funds are usually conditional, e.g. "при условии участия 16 и более человек... 15 и меньше – приз получает только победитель" (t 15743). Fili offers 50% of fees for Max-800+ (t 13281).
- Models clubs have tried (t 11710, t 11744, t 13794, t 11653, t 13110):
  - fee = 2₽ × rating;
  - pay-what-you-want tiers of 250/350/500;
  - 10 tournaments for 4,500₽;
  - 50₽ cashback for not withdrawing;
  - pensioner and time-of-day pricing.

**After the tournament.**

- Results upload online, or files are emailed and an operator enters them: "обрабатываются людьми, причем на двух сторонах" (t 14217).
- Extra "rating games" are often recorded after the event (t 15556, t 15608).
- Corrections go through the "Нашли ошибку" form or the info@ inbox.

**Rules and communication.** Each club has its own rules, announced in Telegram or VK. Regulations sit in VK files (t 15186). Blacklists are informal and per club.

---

## 3. Catalog by theme

Each item: what people say → where (thread, date) → frequency. Items marked **[BUG]** are defects; **[REQ]** are feature requests; **[PRAISE]** are things people like; **[ADMIN]** are RTTF's official answers.

### 3.1 Tournament Manager: usability and logic

1. **Desktop only; no web, phone or tablet result entry. [REQ] High** (the most important structural item).
   - "приходится на турнир нести ноутбук, монитор" and "можно было с планшета (телефона) заполнять результаты" (t 13294, 2022, Таганрог club). The workaround offered was TeamViewer or AnyDesk.
   - "когда уже реально появится web-версия программы для клубов" (t 11662, 2019).
   - "Компьютера или ноутбука в клубе нет... Нету мобильного приложения. Это гигантский минус" (t 14442, 2023).
   - Counter-requirement from an organizer: "При отказе интернета турнир встанет колом". Results should push in real time and re-sync after an outage (t 11425). Offline capability is praised: you only need "ноутбук (накрайняк листок бумаги)" (t 12482).
2. **The program is gated and hard to obtain. [REQ] Medium.**
   - "Завести раздел на сайте, откуда можно скачать официальную последнюю версию программы. Хватить барыжить ей из-под полы" (t 11425, 2019).
   - "Эта программа стоит денег" (t 11296).
   - An individual organizing a pensioners' event was refused: "он спросил, какой клуб я представляю. А никого не представляю". He used Challonge instead (t 14442).
   - New clubs ask how to get the program and are answered by other users, not staff (t 15869, t 15506).
3. **Program-to-server sync failures; manual fallback. [BUG] Medium.**
   - "стала выдавать разрыв с сервером". Files were sent by hand, results hung for days, some tournaments never appeared. RTTF's advice was to buy a new laptop (t 14217, 2023).
4. **In-venue deltas differ from site deltas. [BUG] Medium.**
   - The program ignores D and the newcomer rule, so the printed "ИТОГИ ТУРНИРА" sheet is wrong (t 12659).
   - "Программа в зале считает без учёта 'международной обстановки'" (t 15405).
5. **Tie-break algorithm is opaque, and organizers describe it differently. [BUG/REQ] High** (t 15185, t 14961, t 13989, t 13484, t 14218; about 15 users).
   - One organizer: "по умолчанию программа при равном количестве очков расставляет места по рейтингу".
   - Another: for a 3-way tie it "подсвечивает всех троих, предлагая вручную расставить места".
   - TTL-Savel: "не даёт дальше двигаться финалу, пока места не расставлены".
   - Players: "очень хочется верить, что места определяются не рандомно (кусок кода тоже устроит)".
   - Manual overrides show as coloured cells nobody can interpret.
   - A W:L walkover scores 0 points versus 1 for a real loss, so a player with zero real wins finished above someone he lost to (t 14218).
   - [ADMIN] agreed that a group-wide set ratio could be "последний параметр перед жребием" (t 14961). There's no sign it shipped.
6. **Set and point score entry exists but is hidden.** "Галочка:) Супер, я ее за год не нашла" (t 13989). Another organizer believes the program can't record points at all. **Medium.**
7. **Seeding breaks FNTR rules by default for some organizers. [BUG] Medium.**
   - A player's first 3 bracket matches were against his own group-mates (t 12677, 2021).
   - [ADMIN]: "В нашей программе прописано несколько правил посева... В указанном турнире был другой посев". Nothing warns the organizer.
   - Group-to-bracket logic is misunderstood and can be gamed: "дает возможность манипулирования поражениями в группе, чтобы выбрать себе более удобную сетку" (t 16156).
8. **Can't queue a match on a busy table. [REQ] Medium** (t 15213, 2024).
   - "абсолютно во всех клубах ждут, пока игроки сообщат счет, прежде чем кого-нибудь на него вызвать". Workaround: fake extra tables.
   - The match timer runs until the score is entered, so match durations are unreliable. Implausible durations are silently dropped from the site (t 14154).
   - Organizers disagree on whether it's even possible ("физически программа позволяет...").
9. **No early or incremental bracket start. [REQ] High** (t 13225).
   - "не имеет опции 'ранний посев'... понять какая часть сетки будет неизменна... вообще не бином Ньютона". Users also want a "прогноз ожидания следующей игры".
   - Tables sit idle "over an hour" while one group of 5 finishes.
10. **Withdrawn-player removal can't be undone. [BUG] Medium.**
    - A player was removed from Max-501 by mistake: "пытались исправить ситуацию, система не позволяет... Сетка далеко ушла" (t 13451, TTL-Савёл). He was compensated with a free entry.
    - Adding a latecomer to a running bracket: "схема ломается" (t 13225).
11. **L/W per single match is allowed, which enables cherry-picking. [REQ] High** (t 15772, t 16231, t 13451).
    - "программа rttf позволяет поставить L/W игроку и продолжить турнир дальше".
    - "выбрал удобных... по неудобным — пошел к судье, записал всем технические" (no rating loss).
12. **Hard limits and dead UI. [BUG/REQ] Medium.**
    - A 12-player group cap, "кнопки пустышки" in schemes, no combined totals over several rounds, unclear doubles and hardbat scoring, no proper help (t 11425).
    - In a double round robin "Прога ставит места только по результату 2го круга" (t 15880).
13. **Missing formats. [REQ] Medium-high.**
    - Groups followed by ranked groups with carry-over of head-to-head results. Praised in the rival TTW program (t 15880).
    - **Swiss**: "Это наши мечты" (t 16310). Shah-pong/Swiss exists but is undiscoverable ("где эта волшебная кнопка swiss chess manager... Ищу, ищу") and late arrivals can't be added once it starts (t 15567).
    - Double elimination proposed (t 11463), mostly opposed.
14. **No format guidance by headcount and tables, and no minimum-games logic. [REQ] High** (t 16310, 54 comments; t 14739; t 15400).
    - "2 игры сыграл и мне сообщили что у меня больше игр нет??? (Участников турнира более 20 человек)".
    - Proposed: the software restricts formats by participant count so that everyone gets "не менее 5-6 матчей". Or flag "кто из участников сыграл меньше N встреч" and suggest extra matches.
    - "такие сетки должны быть выпилены из программы" (t 15198, groups of 2).
15. **Out-of-competition handling is wrong or opaque. [BUG/REQ] Medium-high.**
    - A newcomer won every group match, was pushed down into the 17-20 playoffs and finished 20/20, with no explanation in the UI (t 15492, 39 comments).
    - Out-of-competition players seeded #1 "вся сетка идёт пожопе". Request: "В идеале это должно учитываться в программе автоматически" (t 16142).
16. **Newcomer rating is locked at the first online upload. [BUG] Medium.**
    - "рейтинг для нового игрока вводится единожды, а дальнейшее редактирование отображается только на мониторе... Весь турнир он проведет как 100" (t 13574).
    - Request: a "предварительный рейтинг" (provisional rating) flag that is finalized at the end.
17. **Manual rating and name override is an integrity hole.** [ADMIN]: "Технически в программе можно поставить игроку любой рейтинг и любое имя для отображения на картинках" (t 12460). The eligibility rating can't be audited. **Medium.**
18. **"Display rating in bracket" is an organizer checkbox that is often off.** "организатор не поставил галку... 'Отображать рейтинг в сетке'" (t 11853). Final tables shared as screenshots lack the rating (t 15877). **Low.**
19. **One person can be entered twice (left and right hand) because admins add players offline** (t 11984, 57 comments). **Medium.**

### 3.2 Registration and entry

1. **No-shows and fake or parallel registrations. Very high** (t 12810 108 comments, t 15714 **150**, t 11804 41, t 14499 61, t 11500, t 14014, t 13245).
   - "тратишь время больше часа на дорогу... из девяти зарегистрированных пришло 3".
   - People register for several events to see where the crowd goes: "Регистрируюсь на 2-3 турнира, где больше народа будет, туда и иду".
   - [ADMIN]: "Если игрок зарегистрирован на несколько турниров в один день +- n часов — это 100% недостоверная рега". RTTF has the data but never shipped it: "Разговор об этом идёт давно... очень ждём".
   - Requests:
     - a show-up ratio or reliability badge, e.g. "10 турниров подряд без снятий";
     - a green or yellow dot for players holding overlapping registrations;
     - an automatic reminder a few hours before the start;
     - auto-drop of duplicate registrations 1.5 h before;
     - a "Точно приеду" ("definitely coming") button;
     - organizer-side surcharges or discounts;
     - a stop-list (play only out of competition);
     - a deposit.
   - Counter-arguments: "реги — это как реклама турнира"; "Клубу нужна прибыль. Какой черный список?"; early-registration discounts themselves drive speculative sign-ups.
2. **Users build their own tools to work around missing notifications.** A Telegram bot, @rttf_observer_bot, alerts on participant-count changes from 2 hours before the start, because "игроки за час-полтора начинают массово снимать регистрацию... уже в дороге обнаруживаешь, что турнира не будет" (t 15796, 8 thank-yous). **High signal.**
3. **Waitlist. [REQ] Medium.** Users want automatic promotion when someone withdraws (t 14014). The workaround is phoning the club. Waitlisted players get mixed into the main list when sorted (t 16189).
4. **"Where am I registered?" is invisible. [REQ] High** (t 15068, t 15299, t 15831, t 16058, t 12309; about 10 users).
   - The only cue is bold text in the left sidebar: "вообще незаметно... сайтом с мобилки минимум 50%".
   - Wanted: a badge, colour, a profile block of upcoming registrations, one-click "+" register.
5. **Rating cap not enforced by the platform. Very high** (t 16142, t 14001 63, t 14225 102, t 11820, t 12460, t 11245).
   - [ADMIN]: "Мы не можем и не хотим указывать владельцам клубов, кого и как допускать"; "каждый клуб устанавливает свои правила".
   - "Если турнир 150 ограничение, то сколько можно выше - 1, 5, 10? И кто решает?"
   - Admission "с согласия некоторых участников" causes conflict.
   - Caps get raised 30 min before the start for chosen players (t 11245).
   - Tolerances clubs actually use: 3-5% (t 14225), or a 1-point handicap per 10 rating points over the cap (t 16142).
6. **Hidden decimals and stale ratings at the cap. [BUG] Medium-high.**
   - "у обоих в профиле 300, но одного система пускает в борьбу за призы а второго отправляет Вне зачета... 299.8... 300.3. Но этого нигде не видно" (t 16050).
   - A previous evening's tournament not yet uploaded puts a 156 player into a Max-150 (t 16142).
   - Retroactive recalculation of old tournaments pushed a player 1 point over the cap the day before an event (t 11982).
   - Requests: show the exact rating, show "Вы имеете право участвовать в 'Макс294 и выше'", freeze eligibility at the registration date.
7. **Tournament discovery: filters don't persist and are weak. [REQ] Medium-high** (t 11866, t 11974, t 12149, t 11667, t 13242, t 14796, t 15319, t 15212).
   - "Доступные мне" resets on every navigation.
   - Wanted: weekday and time-of-day filters, doubles/singles, "без лиги про" (Liga Pro is "50% выборки" and closed), hide dead clubs, a default city, a map filtered by rating.
8. **Wrong person registered or attributed. [BUG] Medium.** A namesake's games appeared in a player's history (t 15955). Email to staff went unanswered for 8 days. The opt-out setting blocks doubles partners from registering you.
9. **[PRAISE]** Doubles pair registration by either partner: "Это круто, реально молодцы!" (t 11618).

### 3.3 Formats, brackets, seeding and places

1. **Too few games for the fee, and format changes without warning. High** (t 15400, t 14739, t 16310, t 14486, t 16102).
   - "Реально 4 игры за турнир. Это очень мало".
   - "я не ожидал, что вас столько придет, поэтому играем короткую сетку".
   - "17 место из 17" after 4 games.
   - Players compute games per tournament by club from their own stats: ArtTT/Hurricane 6.9, Savel 6.8, Lucentr 6.4, Point 5.6 (t 14739). ArtTT is praised because it "всегда объявляет... сколько игр гарантируется".
2. **"Appendix" brackets with odd counts confuse players.** "не понятно почему после 1го поражения мы оказались в отдельной сетке" (t 16102, t 14486). **Medium.**
3. **Latecomers and mid-group withdrawals distort seeding and tie-breaks.** A late #2 seed takes technical defeats, then knocks out #1 (t 14374). Withdrawals give others "халявные 3:0" (t 13989). **Medium.**
4. **Splitting prizes instead of playing finals** is common and contested (t 15220, 39 comments; a scandal at Fili). Proposed payout 45/35/20, with no prize after a W/L. **Medium.**
5. **Tie-break rule disputes.** ITTF 4.2.3 head-to-head versus Liga Pro's sets-won ("Позорище", t 15479). Users want configurable chains (t 13989, t 14961). **Medium-high.**
6. **Formats people like:** "classes" ("Лига Про в миниатюре когда все игры только с равными", t 15384); full-placement brackets; groups of 3 then a full bracket on 5-6 tables, 18:30-23:00, "Все наигрываются" (t 16310, Vladivostok organizer). **[PRAISE]**
7. **Team and league events need their own engine** (t 15186 Draft-CUP, t 14957, t 15574, t 13803, t 12762). Rules organizers use:
   - team rating cap growing +10 per tour, plus per-player bounds;
   - rating frozen 6 months back;
   - at least 6 tournaments in 6 months;
   - winner cooldown;
   - limits on re-entering after qualifying for the final;
   - lottery versus first-come registration ("в час икс сайт работал не слишком исправно... большинство оказалось за бортом").
   - The frozen rating "в профиле отдельной строкой отражен не будет". Regulations live in VK files.
   - Doubles-only team members get no medal and don't appear in the roster: "не сыграл ни одной личной встречи... ему не выдалась виртуальная медаль" ([ADMIN], t 14957). **High.**
8. **Doubles: handicap design is crude.** "Фора через простую разницу в очках в принципе ущербна" (t 16461). Negative handicap is seen as fairer. "тупо нет в Москве нефоровых турниров" (no non-handicap doubles events). **High.**

### 3.4 Rating formula and fairness

1. **Sandbagging ("слив рейтинга") to fit capped events. Very high**: the single biggest topic. Threads: t 11341 884 comments, t 13257 862, t 15536 766, t 12042 518, t 14498 397, t 5238 280, t 13914 135, t 15283 175, t 15300, t 15785 144, t 16219 105.
   - [ADMIN] 2018: "Мы, как администрация сайта, не в силах повлиять... придумать какой-то автоматический алгоритм... довольно сложно". They push it to organizers' blacklists and offer to exclude games if the organizer flags them.
   - Users: "Админы, закройте пожалуйста тему... раз всем насрать".
   - Patterns described:
     - dump 5-12 points the day before a Max event;
     - lose all group games, then win the bracket;
     - lose to the 4th seed nine times;
     - record rating games after the tournament, sometimes backdated: "записанные задним числом без отображения времени";
     - throw an out-of-competition game "под ноль";
     - left-hand profiles;
     - second accounts ("Было 440-480" on the "left" account);
     - dump to enter doubles or RTTF Cup.
   - Proposed fixes:
     - admission by **max rating over 3-6 months, ignoring the last month**;
     - rating floors ("неснижаемый");
     - lower weight for group, out-of-competition and extra games;
     - outlier flags;
     - a "Стена почёта" of the month's biggest rises and drops;
     - cross-club strikes enforced by blocking the player from being loaded into the program.
   - Counter: "пол-промилле", don't burden the 99.95%. Any fix must be automatic.
2. **Zero credit for close losses or wins across a 100+ gap. High** (t 14736, 93 comments).
   - "теряется смысл борьбы с сильными... отдать игру и не тратить силы попусту".
   - "за выигрыш у человека с +200 рейтинга дают всего 11 очков" (t 11997). The Habr article makes the same point.
3. **Starting rating for newcomers is arbitrary. Very high** (t 11623, t 13574, t 13454, t 15142, t 15608, t 14846, t 14469, t 15492).
   - Values of 1, 50, 100, 150 or 2,500 are picked by admins: "Есть жадные клубы в смысле стартового рейтинга".
   - Strong newcomers "наронял честных тружеников" (knock honest regulars down), with deltas like +80 for them.
   - Retroactive re-rating "350, потом около 250, потом 200... хаос".
   - No mapping from TTW or FNTR ("рейтинг ttw у игрока всегда ниже... Просите 600").
   - [ADMIN]: the operator sets it, minimum 100; organizers can suggest a value "в комментариях к письму с результатами".
4. **Retroactive recalculations make ratings jump. High** (t 14722 43 comments, March 2024; t 14984; t 11191; t 11245).
   - "мои 514 рейтинга превратились в 101"; "Рейтинг rttf, как биткойн. Курс скачет".
   - A point "сняли... без оснований".
   - No changelog and no notification.
5. **Bonus points: inflation, deflation and gaming. Medium-high** (t 16040 551 comments, t 11920, t 15384, t 14984, t 12482).
   - "classes" events split 40 entrants into 5 groups of 8, each awarding 16+ bonuses, so 5× the bonus.
   - "Бонус 1,6 очков рейтинга за первое место — это издевка".
   - Small cities deflate ("в Нижнем Новгороде 300 играют на 400 по московским меркам").
   - Bonus parameters are "правило 3п (пол-палец-потолок)".
6. **Inactive players and stale ratings. High** (t 14535, t 15226 247 comments, t 15764, t 11945, t 14319).
   - Wanted: rank among active players ("#19 913 → #9 167"), decay or "?" for inactivity, an archive.
   - "унылой пятизначной цифирью... не стимулирует участие".
   - Coaches "набьют круглую цифру 600-800 очков и годами не играют".
   - Counter: rare players in remote regions (the nearest rated event is 1,100 km away).
7. **Reliability or deviation (Glicko/Elo) proposals. Medium** (t 16319, t 15764, t 14449, t 14049).
   - "система работает на костылях" (manual fixes).
   - A full rating-deviation (RD) proposal that keeps the base formula, answered with "держатели рейтинга РТТФ ничего менять не будут".
   - Others defend the linear formula as "прозрачна и понятна".
8. **Doubles rating is the most-requested missing rating. High** (t 15292 128 comments, t 16281 115, t 15891, t 16461, t 13274).
   - "Админы, дорогие наши, ну когда уже это случится?"; "Многочисленные призывы... остаются без ответа".
   - A user built one himself by scraping `rttf.ru/gamesd` ("нет нормального способа скачать базу игр").
9. **Separate ratings per grip, style or hand: contested. Medium** (t 14269, t 13944, t 15146, t 11862).
   - For: experimenting without "боязни просесть".
   - Against: "цирк и бардак", and a 1,200+ player on his left-hand rating "отбирает призовые у ребят из макс-300".
10. **Liga Pro** (a closed, betting-linked league) is rated on RTTF. Some say this inflates or deflates ratings and want it excluded (t 14812, 64 comments). **Medium.**
11. **The formula is hard to find and understand.** "в рейтинге только через пол года разобрался"; users ask for an English version (t 11991) and for "настоящую формулу которую можно вбить в Экселе" (t 12482). **Medium.**

### 3.5 Results publication and data errors

1. **Duplicate profiles: RTTF's largest operational cost. Very high** (t 12493, **849 comments**, about 102k views, active today).
   - [ADMIN] causes: "ошибки организаторов... не находят нужного игрока в базе и создают новичка", FNTR import mismatches, and players using different surnames or patronymics.
   - Players can't claim organizer-created profiles: "Дубль, к которому у меня нет доступа".
   - Results get attached to the wrong person: "Отыграл два турнира под чужим именем"; a Kuzbass namesake (born 1989) instead of a Moscow player (born 1959) (t 14469).
   - Merges have gone wrong ("объединили к профилю к которому он отношения не имеет").
   - Every fix requires a forum post or an email.
2. **Corrections are a black box. High.** "Нашли ошибку" plus info@: "Реакция... обычно не сразу. 1-2 дня... исправляют 'молча'"; "писал, ответ не получил" (t 13977, t 14469, t 15955, t 13086). A fraudulent score was accepted and never corrected (t 13130, 147 comments).
3. **Publication delays. Medium.** "время ожидания от часа, до суток и больше... Сейчас хаос" (t 11245). Ratings unchanged after 4 tournaments (t 11191). Manual uploads hang "до следующего дня" (t 16142).
4. **Mass incidents.**
   - History collapsed ("было 152 стало 6", t 14469, 2023-11), fixed the same day.
   - The March 2024 recalculation scrambled ratings and best-wins tables (t 14722).
   - Pre-2018 doubles history lost: "Верните украденное" (t 13538).
5. **Who may upload under which club is uncontrolled.** Tournaments posted under a defunct "Мастер-тур": "кто добавлял и какое он тогда имел право?" (t 15955). A visitor's upload created a duplicate club (t 15878). Club renames break medal history (t 11597). **Medium.**
6. **Account vs. rating-player split.** A result shows on the tournament page but not in the account (t 14336). **Low.**
7. **[PRAISE]** Central support is responsive compared with TTW: "В TTW о таком сервисе можно только мечтать"; RTTF publishes in 1-3 days versus TTW's "ожидание результатов в месяц охоту отбило" (t 14617).

### 3.6 Online broadcast and in-club monitor

1. **[PRAISE]** Live results: "Как же здорово стало, что можно видеть результаты турнира он-лайн" (t 11853). "есть система онлайн-регистрации и возможность получать текущие результаты, чего у других рейтингов нет в принципе" (t 13247).
2. **The club monitor is poorly designed. [REQ] Medium** (t 12465, t 12311).
   - The delta column is a "бессмысленный... список из десятков фамилий неотсортированных".
   - Wanted: sort by surname, table number, each player's possible places ("3-12"), next opponent, who is still in contention for prizes, and big readable "стол N: A – B" call-outs.
   - Request refused: "доработки программы пока приостановлены".
3. **Video.** Clubs stream on VK or RuTube after YouTube slowed. "Есть ссылка на трансляцию. Но самой трансляции нет"; "слайд шоу" playback; coaches ask for recordings (t 15149, t 15001, t 12764, t 15875). RTTF didn't support a third-party streaming service: "своё типа мутят. Монополисты" (t 12192). **High** (about 10 users).
4. **Consent conflicts over filming.** "убери видео со мной". Users want consent handled in the public offer or at registration (t 11696, 119 comments). **Medium.**
5. **Electronic scoreboards are user-built.** A single-file web scoreboard (with a service-switch bug), an ESP8266 Bluetooth remote, an iPhone scoreboard driven from a watch ("score disputes came back when removed", t 13132). Liga Pro point-by-point logs were removed, and users saw them as an anti-fixing tool (t 12376). **Medium.**
6. **[REQ]** Next-match notifications instead of "можно поспать, пока тебя вызовут" (t 14030).

### 3.7 Club and organizer tools

1. **Club data is stale and unverified. [REQ] Medium** (t 12015, t 12270, t 13089, t 15212).
   - "Клуб одного турнира в 2017 году, без телефона, без адреса".
   - Wanted: closed-club archive, "confirm active" pings, map refresh. The club map covers only Moscow and the Moscow region (t 14302).
2. **Structured club reviews and conditions: big demand. High.**
   - "Некомфортный TTL-Савеловский" (t 12069) has 426 comments and about 63k views; t 14286 has 140.
   - Complaints: cramped tables, constant "стоп", light measured at 380-420 lux against 600 advertised, no dividing nets, heat, tables rented out during tournaments.
   - The user-built club rating (t 14030) has 41 comments.
   - The hall-rating feature (t 11216) was manipulated by anonymous revenge votes. Asks: only players who played there may vote, text reviews, and a criterion for "соблюдение условий проведения турниров и вознаграждения".
3. **Table allocation and overbooking. High** (t 15198 155 comments, t 14804 113, t 13248).
   - "19 players, 4 tables, the rest rented"; "40+ min to first game"; "over 4 hours".
   - Wanted norms: 3-4 entries per table, no rentals during the first 1.5-2 h, a published end time.
   - **[PRAISE]** clubs that state their table count up front.
   - [ADMIN] closed the TENIX thread: "Будем считать, что все... были услышаны".
4. **No API, export or embeddable widgets. [REQ] Medium, recurring for 5 years** (t 12192).
   - [ADMIN] 2020: "Пока нет и в ближайшее время не планируется".
   - Users write parsers, a Chrome extension for the rating chart (t 14179), their own doubles rating (t 15891) and their own "active players" ranking (t 14535).
5. **Calendar clashes and gaps.** "Four Max-150s at the same time on Sunday" (t 8409). No weekend-morning events for 400-500. A shared grid of caps × time slots was proposed and rejected by regulars (t 16481, t 16274). **Medium.**
6. **Recurring tournaments.** "повторять бесконечно" requested. [ADMIN] refused: templates are enough (t 11239). Duplicate tournaments got billed. **Low.**
7. **Organizer onboarding and know-how.** "я учусь проводить турниры": what % of fees goes to prizes? (t 15743). Answered only by forum users. **Low-medium.**
8. **Cross-club sanctions are impossible.** An attempt by 8-10 Moscow clubs at a shared ban list "БЫЛ ПОЛНЫЙ ПРОВАЛ". RTTF can't discipline clubs because clubs are paying customers who could leave for TTW (t 16393). "администратор = царь". **Medium.**
9. **[PRAISE]** RTTF onboarding is fast compared with TTW: "На след день программа RTTF была уже у меня", while TTW took 1.5 months (t 14617).

### 3.8 Player profiles and stats

1. **Rating chart has no time axis, no export and no custom range. [REQ] High** (t 14179 19 comments, t 11749, about 12 users).
   - A user posted ready Chart.js code and a Chrome extension. [ADMIN] "Обязательно покрутим". Never shipped: "Уже 5 лет ждем"; "готовое решение приложили, и тишина".
2. **Best wins and medals. High** (t 11222, t 11327, t 11190 72 comments, t 14160).
   - Unique opponents ("10 разных скальпов"), last-year or custom range, notable losses, "исключить из побед" for sandbaggers.
   - Medals without tier are misleading: "Медаль на турнире 200 и на турнире 450 все-таки разные медали"; "вернул: цифры на медальках".
   - Group trophies by competition, not venue: "Никто ж у футбольных клубов не считает победы на каждом стадионе".
   - Cup medals don't display on mobile.
3. **Head-to-head.** Requests for a button with a count ("История встреч (N)" or "встреч не было"), the H2H score in registration lists, and highlighting past opponents (t 12257, t 13223, t 11955, t 14257). The current rating in the opponents list took more than 2 years. **Medium-high.**
4. **[PRAISE]** Private opponent notes, highlighted in registration and live lists: "О, таки сделали! Слава админам!" (t 11957). Many users don't know they exist (t 14257, t 16342).
5. **Global rank, rank among active players, percentile, city and age ranks. [REQ] Medium-high** (t 11945, t 14535, t 14319, t 15226).
   - The rank had a bug: sorted by registration date (t 13767), fixed after 4 months.
   - Useful framing: "Если вы выросли... со 100 до 200, вы обошли 27 тыс. чел".
6. **Equipment database** (t 12089, 226 comments): blades and rubbers are added by staff on request. Wanted: several saved setups. **High engagement, manual bottleneck.**
7. **Coach field, sports ranks, "О себе", reviews of players** (t 12672 about 24k views, t 15700, t 14636 90 comments, contested).
8. **Exact rating and eligibility in the profile.** "Вы имеете право участвовать в..." (t 16050). Show the frozen Cup or league rating as its own line (t 15186, t 14957). **Medium.**
9. **[PRAISE]** "легко найти место для игры по определённому уровню...; видеть свою кривую роста...; писать в лс" (t 11189, 2024).

### 3.9 Mobile

1. **Desktop-first, with a separate m.rttf.ru.** [ADMIN]: "мы шли от десктопной версии, а мобильная создавалась как попытка запихнуть большую часть информации... в экран телефона" (t 12159). Users: "На 80% использую мобильную версию"; "почему у вас до сих пор дизайн не Responsive?" (t 11471). **High.**
2. **Long-running bugs. High.**
   - Profile auto-scroll on mobile Chrome, open about 2 years: "вторую годовщину проблемы", blamed on the ad block (t 14010, 54 comments).
   - iPhone blank tournament page, so nobody could register (t 11686, fixed the same day).
   - iOS: "undefined" messages, no keyboard in player search.
   - Android: login loop.
   - Cookie button invisible.
   - Timezone set to Kamchatka, so tournaments show at 4:00 (t 16258).
   - Medals missing on mobile (t 14160).
   - Tables too small: "при масштабировании все расползается".
3. **Mobile lacks some features:** average-rating stats, equipment, the list/card view toggle (t 15949, t 12159). **Medium.**

### 3.10 Payments, fees and prizes

1. **Fees vs. value. High** (t 15468, 355 comments).
   - "800+ RUB for 5-6 matches"; "should be a token 200-300".
   - A Lyublino Max-225 got 0 entrants and was cancelled.
   - "приз на турнире нт это грамота, медалька и кубок".
2. **Prize rules change mid-event. [REQ] Medium** (t 16360, 32 comments).
   - A withdrawal was refunded, the field dropped to 8, and the 1,200₽ prize became a medal: "чувствую себя обворованным"; "Менять условия в процессе моветон".
   - Need: freeze thresholds at the start.
3. **Price shown vs. price charged.** "на странице одна цена, а по факту другая" (t 13110). Cash-only clubs with no change (t 16152). **No online payment** anywhere. **Medium.**
4. **Pricing experiments organizers want supported:** rating-proportional fees, pay-what-you-want tiers, subscriptions with exclusions, cashback for finishing, pensioner and time-slot prices, 50% prize funds, certificates and merchandise as prizes, team fees (3,000₽ per team) (t 11710, t 11744, t 13794, t 11653, t 13281, t 15186). **Medium.**
5. **Willingness to pay exists.** "за полтора года потратил порядка 150тыс" (t 13247). A premium account (no-show stats, early registration) got positive replies (t 12810). Official sports ranks: "первый в очереди... даже по цене значительно превышающей стандартный взнос" (t 14384).

### 3.11 Moderation, anti-cheating and duplicates

1. **Sandbagging** (3.4.1). **Very high.**
2. **Identity fraud. High** (t 15351 72 comments, t 15300, t 13534, t 13939, t 11735).
   - Playing under another person's name in a Max-180 and reaching the final.
   - Second accounts to dodge caps ("Имел три аккаунта... 190, 300 и 480").
   - "любой может под чужим именем испортить всю статистику".
   - Proposals: ID check, paid verification (100-300₽/year), required surname.
3. **Score cheating with no referees. High** (t 13130 147 comments, t 16062 95, t 12472 74, t 15301 58).
   - "убедил администраторов поставить ему победу со счетом 3:2. Камер... нет".
   - "Старые игроки ходят с блокнотом".
   - Wanted: both players confirm the score, complaint flags on profiles, a "call a referee" button.
4. **Withdrawals as rating protection and selective refusals** (3.1.11, t 12510, t 13248, t 12973, t 12481). Wanted: a published per-club withdrawal policy ("какие правила... у клуба"), partial-score recording, auto-forfeit 0:3. **High.**
5. **Conduct.** Swearing and shouting with no club reaction: "Очень многие не ходят или перестают ходить именно изза таких истерических концертов" (t 16214). An organizer playing in and running his own event: "кому жаловаться, если нарушает сам организатор?" (t 16393). **Medium-high.**
6. **Forum moderation.** Sock-puppet downvoting, political flame wars, opaque topic deletion, an ignore list that only hides text (t 12171, t 12023, t 13945, t 13157, t 13923, t 11189). **High** (community).
7. **Off-hand registration abuse.** Register the non-playing hand in low caps, then switch hands when losing (t 13534, t 13939, t 15785). **Medium.**

### 3.12 Site performance, UX and other

1. **Stagnation and no feedback loop. High, cross-cutting.**
   - [ADMIN]: "не можем называть сроки исполнения даже одобренных предложений" (t 13197).
   - Users: "писать сюда пожелания кажется бесполезным... многие доработки — единицы часов программирования" (t 13241); "когда тут вообще последний раз было обновление?" (2026); "гнать надо админов... не реагируют на глас народа" (t 12810).
2. **Performance.** "Страницы грузятся по 10-15 секунд" (t 12401, 2020; improved later). A detailed performance audit was "внимательно изучим", and half a year later "никаких изменений" (t 11888). **Medium.**
3. **No site search; no reply or mention notifications.** "о том, что снялся человек... тебя оповестят, а о том, что... тебе ответили — нет" (t 11723, t 12078, t 13196, t 12973). **Medium-high.**
4. **Editor and messaging bugs.** Forced numbered lists, lost drafts, no partial quote, can't edit or delete your own comment, DM sorting, screenshots need external hosting (t 11217, t 12466, t 13196, t 14476, t 16396). **Medium.**
5. **Access.** The site is blocked through VPN ("похоже вы бот"), some ISP subnets are blocked, and there are personal-data (152-ФЗ) concerns because full names are readable without login (t 16099 47 comments, t 14997, t 15804, t 15881). **Medium.**
6. **Dark theme** requested (t 15395). **Low.**
7. **[PRAISE]** The overall ecosystem: "Система любительских турниров... это русское чудо света... вы чертовы гении" (t 13247). Players value many tournaments, cheap entry and opponents at their level.

---

## 4. Praised features (keep parity or beat them)

| Feature                                                                                            | Evidence                                                                                  |
| -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Online registration + live results on the site                                                     | "чего у других рейтингов нет в принципе" (t 13247), "Как же здорово... он-лайн" (t 11853) |
| Density and visibility of tournaments (left column "Ближайшие турниры": time, status, club, count) | t 11238 "абсолютный плюс", t 11189                                                        |
| Private opponent notes highlighted in registration and live lists                                  | t 11957, t 14257, t 16342                                                                 |
| Rating chart, "лучшие победы" (all time / year / quarter), place in ranking                        | t 11749, t 11945, t 15764, t 14449                                                        |
| Offline-capable TM (laptop, even paper)                                                            | t 12482                                                                                   |
| Fast results (1-3 days) and responsive central corrections compared with TTW                       | t 14617                                                                                   |
| Fast club onboarding compared with TTW                                                             | t 14617                                                                                   |
| Doubles pair registration by either partner                                                        | t 11618                                                                                   |
| Head-to-head button (added on request)                                                             | t 12257                                                                                   |
| Out-of-competition mode, separate non-playing-hand rating                                          | many threads (also abused)                                                                |

---

## 5. Recurring meta-pattern

1. RTTF pushes enforcement onto clubs ("каждый клуб устанавливает свои правила"). Clubs won't enforce anything that costs them entries.
2. So rating integrity (caps, sandbagging, identity, no-shows) degrades. The forum fills with vigilante threads, and RTTF closes them ("На том и остановимся").
3. Fixes are manual (operators, merge requests, "Нашли ошибку"), slow and silent.
4. The TM has been frozen since about 2020, is desktop-only and partly out of sync with the site formula. Organizers rely on folklore about how it decides places and seeds.
5. **A competitor wins by making the platform enforce sensible defaults automatically, transparently and configurably, without asking clubs to give up flexibility.**

---

## 6. Top-20 opportunities for a competitor (ranked)

Ranking is evidence volume × pain × how directly a web platform can beat RTTF. The "KTTF note" refers to 00-kttf-inventory.md where relevant.

1. **Browser/tablet/phone tournament runner, offline-first with sync, where live results are the final results.** No laptop, TeamViewer, file emailing or operator queue. Same delta in the hall and on the site. (t 13294, t 11425, t 11662, t 14217, t 12659, t 14442.) _KTTF note: offline sync and the TV token already exist. Make "no laptop needed" and "published instantly" the headline._
2. **Identity done right.** Fuzzy "did you mean" search (Ё, patronymic, birth year, city, photo) before an organizer can create a player; players claim organizer-created profiles; self-service merge requests with an audit trail; namesake-safe picker. Removes RTTF's 849-comment pain. (t 12493, t 15955, t 14469, t 15351.)
3. **Anti-sandbagging admission rating plus anomaly flags.** Per-event admission rule (peak over N months excluding the last month, activity minimum); flags for pre-cap drops, lose-groups/win-bracket, backdated extra games, out-of-competition throws; organizer dashboard and a shared watchlist. (About 3,500+ comments across t 11341, t 13257, t 15536, t 12042, t 14498.) _KTTF note: `RatingAnomaly` exists in the schema only._
4. **Reliability and no-show system.** Attendance ratio badge in entry lists; warning on overlapping registrations; a "confirm attendance" ping; cancellation deadline; auto-promoting waitlist with push; organizer-set surcharges or discounts. (t 12810, t 15714, t 11804, t 14499, t 15796.) _KTTF note: `WAITLIST`/`NO_SHOW` statuses and `trustScore` exist but trustScore is unused._
5. **Eligibility enforced and explained.** Rating snapshot frozen at registration close; exact decimals; configurable tolerance or handicap-for-overage; "you qualify for Max X" at sign-up; logged overrides; out-of-competition players excluded from seeding and prizes, with a visible badge. (t 16050, t 16142, t 14001, t 14225, t 12460, t 15492.)
6. **Configurable withdrawal and walkover policy.** Per event: can a withdrawn player continue, walkover score versus score at withdrawal, partial-match rating, optional missed-match fee, "leaving after stage X" pre-declaration, **safe undo/reinstate** and **auto make-up games** to keep a minimum. (t 13451, t 12481, t 15772, t 16231, t 12510, t 12973.)
7. **Explainable standings.** A step-by-step tie-break view per group ("why 2nd"); configurable chain (strict ITTF / club rule / rating / extra game); logged built-in lottery; audit of manual overrides; walkover points handled correctly. (t 15185, t 14961, t 13989, t 13484, t 14218.) _KTTF note: `TieDecision` exists; add the explainer._
8. **Format planner with a minimum-games guarantee.** Players × tables × the club's average match length → suggested formats, predicted end time, games per player, wait forecast; block degenerate formats such as groups of 2; publish "if 17+ entrants then X" on the event page. (t 16310, t 15400, t 14739, t 15198, t 14804, t 13225.)
9. **Transparent rating ledger.** Per-match delta with k, D, bonus and newcomer factor; public formula with a simulator; changelog and notification on any retroactive recalculation; percentile framing. (t 14722, t 14736, t 14984, t 12659, t 12482.) _KTTF note: the `RatingEvent` journal is the right base._
10. **Algorithmic provisional ratings.** Uncertainty-based (Glicko-style RD) instead of an admin guessing 1/50/100/150; import or mapping from TTW, FNTR or national federations; provisional status editable during the first event; inactivity → uncertainty rather than point decay; provisional players excluded from "best wins". (t 11623, t 13574, t 13454, t 15142, t 16319, t 15764.) _KTTF note: `isProvisional` exists._
11. **Doubles and team competitions as first-class objects.** A real per-person doubles rating; configurable handicap (positive, negative, non-linear, none); team/league/season engine (team cap with increments, per-player bounds, frozen rating, winner cooldown, finalist re-entry limits, lottery registration, free-agent board, doubles-only members credited). (t 15292, t 16281, t 16461, t 15186, t 14957, t 15574.) _KTTF note: no doubles or team entity today; this is the biggest functional gap against RTTF's content._
12. **Bracket and queue engine for real halls.** Queue the next match on a busy table; close the timer when players are called and attach the score later; incremental bracket start as slots become certain; latecomer policies (auto technical defeat, or final-stage only); next-match ETA per player. (t 15213, t 13225, t 14374, t 14154.)
13. **More formats, discoverable.** Swiss with late entry; groups → ranked groups with carry-over; double round robin with combined places; "classes"; full-placement brackets without confusing "appendix" dead ends; a visual "your path" explainer. (t 15880, t 15567, t 16310, t 16102, t 16156.)
14. **Notifications everywhere.** Rating changed, results posted, registration count or cancellation risk, waitlist moves, called to table, forum replies and mentions; opt-in by channel (push, Telegram, email). (t 11662, t 15796, t 13196, t 12973.)
15. **Score integrity.** Both players confirm on their phones; dispute flag; organizer override with an audit trail; correction workflow with an SLA and automatic recalculation; optional point-by-point logging and scoreboard mode. (t 13130, t 16062, t 12472, t 13977, t 13132.)
16. **Mobile-first player UX.** Persistent "Доступные мне" filters; a "registered" badge and an "upcoming" block; one-tap register or cancel; correct timezone; readable brackets on a phone; full feature parity (medals, stats). (t 14010, t 12159, t 16058, t 15831, t 16258.)
17. **Structured club profiles and verified reviews.** Tables, nets, lux, ceiling, showers, ball model, metro, prizes, filming; only participants can review; data-freshness pings; public club metrics (average games and waits per player, overruns, cancellations, fee per game). (t 12069, t 14286, t 14030, t 11216, t 12015, t 14739.)
18. **Fee and prize rules engine plus online payment.** Prepaid entry with refund rules; prize thresholds frozen at start; payout presets; rating-proportional or tiered fees; subscriptions; finish-cashback; the shown price is the charged price. (t 16360, t 15743, t 11710, t 13794, t 13110, t 16152.) _KTTF note: `paidAt`/`paymentId`/`Transaction` are unused today._
19. **Open access, onboarding and data.** Free self-serve organizer signup (an individual or a pensioners' centre can run an event, as with Challonge); built-in docs instead of a 24-minute video; clear pricing page; public API, embeddable club widgets and CSV export; a public roadmap and changelog. (t 14442, t 15869, t 15506, t 12192, t 15891, t 13197, t 14617.)
20. **Rich profile analytics and community safety.** Time-scaled zoomable rating chart; rank among active players, by city or age, percentile; head-to-head counts everywhere (entry lists, bracket); best wins by unique opponents or period; medals by competition and tier; opponent notes (keep them); conduct reports to clubs; personal mute; published moderation rules. (t 14179, t 11749, t 14535, t 14319, t 11190, t 14160, t 13223, t 16214, t 13157.)

**Regional angle for KTTF.** RTTF is seen as "местечковый" and Moscow-centric (club map is Moscow only; Kazakhstan cities are filed under Moscow). TTW's Java desktop program is "то база не обновляется, то грузится долго, то версия JAVA не та". Regional players won't "начинать все сначала" without their history. **Importing history and ratings from RTTF and TTW, and a local-first experience (KZT, Kazakh cities, local clubs on the map), are the switching levers** (t 13247, t 14617, t 14382, t 15212).
