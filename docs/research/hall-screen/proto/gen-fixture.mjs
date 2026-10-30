// node gen-fixture.mjs <scenario> <out.json> [results.json]
// Синтетическое состояние экрана зала для проверки вёрстки на объёме,
// которого нет в демо-базе: 10 столов, 8 групп, сетка на 16 и 32.
// Это данные для макета, не реальные игроки.
//   groups8   — 32 игрока, 8 групп по 4, 10 столов, группы в процессе
//   ko16      — группы сыграны, сетка на 16 идёт (1/4)
//   ko32      — 32 в сетке без групп, идёт 1/8
//   final32   — всё сыграно, итоги и рейтинг (results.json)
import fs from 'node:fs';
import crypto from 'node:crypto';

const [, , scenario, out, resultsOut] = process.argv;
const NOW = Date.now();
const iso = (minAgo) => new Date(NOW - minAgo * 60_000).toISOString();
const id = () => crypto.randomUUID();
let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

const LAST = ['Абдрахманов', 'Байжанов', 'Жумабеков', 'Константинопольская', 'Организаторова', 'Сагындыков', 'Тлеубердиев', 'Нурмагамбетов', 'Ким', 'Цой', 'Ли', 'Пак', 'Иванов', 'Смирнова', 'Ахметов', 'Сатпаев', 'Касымова', 'Оспанов', 'Ермеков', 'Шайхутдинов', 'Галимжанов', 'Мухамедкалиев', 'Петров', 'Сериков', 'Аманбаев', 'Жумабаев', 'Нурланов', 'Исабекова', 'Утепбергенов', 'Беков', 'Хегай', 'Тен'];
const FIRST = ['Ерлан', 'Айгерим', 'Тимур', 'Анастасия', 'Ольга', 'Дархан', 'Нурсултан', 'Алмаз', 'Виктор', 'Роман', 'Денис', 'Максим', 'Иван', 'Дарья', 'Арман', 'Мирас', 'Асель', 'Айдос', 'Бауыржан', 'Ринат', 'Ержан', 'Бахытжан', 'Алексей', 'Даурен', 'Арлан', 'Санжар', 'Нурлан', 'Жанар', 'Кайрат', 'Нурсултан', 'Сергей', 'Павел'];

const tournamentId = id();
function player(index) {
  return {
    id: id(), userId: null, lastName: LAST[index % LAST.length], firstName: FIRST[index % FIRST.length],
    middleName: null, birthYear: 1990, gender: 'MALE', city: null, photoUrl: null, clubId: null,
    rating: String((250 + rnd() * 250).toFixed(2)), ratedMatches: 20, isProvisional: false, confirmed: true,
    createdAt: iso(100000),
  };
}

function match(stageId, extra) {
  return {
    id: id(), stageId, groupId: null, playerAId: null, playerBId: null, sourceA: null, sourceB: null,
    status: 'PENDING', tableNumber: null, setsA: null, setsB: null, resultType: 'NORMAL',
    bracketRound: 1, bracketSlot: null, startedAt: null, finishedAt: null, ...extra,
  };
}
function finish(m, minAgo, table = null) {
  const aWins = rnd() < 0.55;
  const loser = Math.floor(rnd() * 3);
  Object.assign(m, { status: 'FINISHED', setsA: aWins ? 3 : loser, setsB: aWins ? loser : 3, startedAt: iso(minAgo + 20), finishedAt: iso(minAgo), tableNumber: table });
  return m;
}
const winnerOf = (m) => (m.setsA > m.setsB ? m.playerAId : m.playerBId);
const loserOf = (m) => (m.setsA > m.setsB ? m.playerBId : m.playerAId);

function groupsStage(players, groupCount, playedShare) {
  const stageId = id();
  const groups = [];
  const matches = [];
  const per = players.length / groupCount;
  for (let g = 0; g < groupCount; g++) {
    const members = players.slice(g * per, (g + 1) * per).map((p) => p.id);
    const gid = id();
    groups.push({ id: gid, label: `гр. ${g + 1}`, order: g, participants: members });
    const pairs = [];
    for (let a = 0; a < members.length; a++) for (let b = a + 1; b < members.length; b++) pairs.push([members[a], members[b]]);
    pairs.forEach(([a, b], k) => matches.push(match(stageId, { groupId: gid, playerAId: a, playerBId: b, bracketRound: Math.floor(k / 2) + 1 })));
  }
  const toPlay = Math.round(matches.length * playedShare);
  matches.slice(0, toPlay).forEach((m, k) => finish(m, 90 - k, (k % 10) + 1));
  return { id: stageId, order: 0, type: 'GROUPS', name: 'Групповой этап', groups, matches };
}

function standingsOf(stage) {
  return stage.groups.map((group) => {
    const rows = group.participants.map((p) => ({ participant: p, played: 0, wins: 0, losses: 0, points: 0, setsWon: 0, setsLost: 0, setDiff: 0, ballsWon: 0, ballsLost: 0, ballDiff: 0, place: null }));
    const byId = new Map(rows.map((r) => [r.participant, r]));
    for (const m of stage.matches.filter((x) => x.groupId === group.id && x.status === 'FINISHED')) {
      const a = byId.get(m.playerAId), b = byId.get(m.playerBId);
      a.played++; b.played++; a.setsWon += m.setsA; a.setsLost += m.setsB; b.setsWon += m.setsB; b.setsLost += m.setsA;
      if (m.setsA > m.setsB) { a.wins++; b.losses++; a.points += 2; b.points += 1; } else { b.wins++; a.losses++; b.points += 2; a.points += 1; }
    }
    rows.forEach((r) => (r.setDiff = r.setsWon - r.setsLost));
    rows.sort((x, y) => y.points - x.points || y.setDiff - x.setDiff);
    rows.forEach((r, k) => (r.place = k + 1));
    return { stageId: stage.id, groupId: group.id, label: group.label, rows };
  });
}

function knockout(entrants, thirdPlace = true) {
  const stageId = id();
  const size = entrants.length;
  const rounds = Math.log2(size);
  const matches = [];
  const byRound = [];
  for (let r = 1; r <= rounds; r++) {
    const list = [];
    for (let s = 0; s < size / 2 ** r; s++) {
      const extra = { bracketRound: r, bracketSlot: s };
      if (r === 1) Object.assign(extra, { playerAId: entrants[s * 2] ?? null, playerBId: entrants[s * 2 + 1] ?? null });
      else {
        const prev = byRound[r - 2];
        Object.assign(extra, { sourceA: { kind: 'WINNER', matchId: prev[s * 2].id }, sourceB: { kind: 'WINNER', matchId: prev[s * 2 + 1].id } });
      }
      const m = match(stageId, extra);
      list.push(m); matches.push(m);
    }
    byRound.push(list);
  }
  if (thirdPlace) {
    const semis = byRound[rounds - 2];
    const m = match(stageId, { bracketRound: rounds, bracketSlot: 1, sourceA: { kind: 'LOSER', matchId: semis[0].id }, sourceB: { kind: 'LOSER', matchId: semis[1].id } });
    matches.push(m); byRound.push([m]);
  }
  return { stage: { id: stageId, order: 1, type: 'KNOCKOUT', name: 'Плей-офф', groups: [], matches }, byRound, rounds };
}

// Сыграть круги сетки до `upToRound` включительно (частично — `partial` встреч последнего).
function playKo(ko, fullRounds, partial = 0) {
  const fill = () => {
    for (const m of ko.stage.matches) {
      if (m.sourceA && m.playerAId === null) {
        const src = ko.stage.matches.find((x) => x.id === m.sourceA.matchId);
        if (src.status === 'FINISHED') m.playerAId = m.sourceA.kind === 'WINNER' ? winnerOf(src) : loserOf(src);
      }
      if (m.sourceB && m.playerBId === null) {
        const src = ko.stage.matches.find((x) => x.id === m.sourceB.matchId);
        if (src.status === 'FINISHED') m.playerBId = m.sourceB.kind === 'WINNER' ? winnerOf(src) : loserOf(src);
      }
    }
  };
  let ago = 60;
  for (let r = 1; r <= ko.rounds; r++) {
    const list = ko.stage.matches.filter((m) => m.bracketRound === r && !(m.sourceA?.kind === 'LOSER'));
    const placement = ko.stage.matches.filter((m) => m.bracketRound === r && m.sourceA?.kind === 'LOSER');
    const all = [...list, ...placement];
    const count = r <= fullRounds ? all.length : r === fullRounds + 1 ? partial : 0;
    all.slice(0, count).forEach((m, k) => { if (m.playerAId && m.playerBId) finish(m, (ago -= 2), (k % 10) + 1); });
    fill();
  }
}

// Посадить готовые встречи за столы; один стол — «только что сыграли».
function seat(stages, tables, playingCount) {
  const busy = new Set();
  const ready = stages.flatMap((s) => s.matches).filter((m) => m.status === 'PENDING' && m.playerAId && m.playerBId);
  let table = 1;
  const minutes = [2, 7, 12, 18, 25, 9, 4, 31, 15, 1];
  for (const m of ready) {
    if (table > playingCount) break;
    if (busy.has(m.playerAId) || busy.has(m.playerBId)) continue;
    busy.add(m.playerAId); busy.add(m.playerBId);
    Object.assign(m, { status: 'PLAYING', tableNumber: table, startedAt: iso(minutes[table - 1]) });
    table++;
  }
  // Свежий результат на следующем столе — 30 секунд назад.
  const last = stages.flatMap((s) => s.matches).filter((m) => m.status === 'FINISHED').sort((a, b) => b.finishedAt.localeCompare(a.finishedAt))[0];
  if (last && table <= tables) Object.assign(last, { tableNumber: table, finishedAt: new Date(NOW - 30_000).toISOString() });
}

let players, stages, standings = [], status = 'RUNNING', tableCount = 10, formatConfig;
if (scenario === 'groups8') {
  players = Array.from({ length: 32 }, (_, i) => player(i));
  const g = groupsStage(players, 8, 0.45);
  const ko = knockout(Array(16).fill(null));
  stages = [g, ko.stage];
  seat(stages, tableCount, 8);
  standings = standingsOf(g);
  formatConfig = { type: 'GROUPS_KNOCKOUT', groupSize: 4, advancePerGroup: 2, groupRounds: 1, groupSetsToWin: 3, koSetsToWin: 3, thirdPlace: true };
} else if (scenario === 'ko16') {
  players = Array.from({ length: 32 }, (_, i) => player(i));
  const g = groupsStage(players, 8, 1);
  standings = standingsOf(g);
  const adv = standings.flatMap((s) => s.rows.slice(0, 2).map((r) => r.participant));
  const ko = knockout(adv);
  playKo(ko, 1, 0);
  stages = [g, ko.stage];
  seat(stages, tableCount, 3);
  formatConfig = { type: 'GROUPS_KNOCKOUT', groupSize: 4, advancePerGroup: 2, groupRounds: 1, groupSetsToWin: 3, koSetsToWin: 3, thirdPlace: true };
} else if (scenario === 'ko32' || scenario === 'final32') {
  players = Array.from({ length: 32 }, (_, i) => player(i));
  const ko = knockout(players.map((p) => p.id));
  if (scenario === 'ko32') { playKo(ko, 0, 6); stages = [ko.stage]; seat(stages, tableCount, 7); }
  else { playKo(ko, 6); stages = [ko.stage]; status = 'RATED'; }
  formatConfig = { type: 'KNOCKOUT', koSetsToWin: 3, thirdPlace: true };
} else throw new Error('scenario?');

const all = stages.flatMap((s) => s.matches);
const view = {
  tournament: {
    id: tournamentId, clubId: null, name: `Макет: ${scenario}`, startsAt: iso(240), registrationEndsAt: null, status,
    entryFee: 0, maxParticipants: 64, ratingCapMax: null, ratingCapMin: null, reviewOutOfRating: false, birthYearFrom: null,
    birthYearTo: null, genderLimit: null, level: 'CLUB', tableCount, formatConfig, seedingConfig: { method: 'RATING', separateByClub: false },
    description: null, prizeInfo: null, publicToken: `fixture-${scenario}`, participantCount: players.length, createdAt: iso(5000),
    startedAt: iso(200), finishedAt: status === 'RUNNING' ? null : iso(1), ratedAt: status === 'RATED' ? iso(1) : null,
  },
  players, withdrawn: [], standings: { tournamentId, groups: standings }, stages, updatedAt: new Date(NOW).toISOString(),
};
fs.writeFileSync(out, JSON.stringify(view));

if (resultsOut) {
  // Места по сетке: 1–4 по финалу и матчу за 3-е, дальше — по кругу вылета.
  const ko = stages.at(-1).matches;
  const final = ko.find((m) => m.bracketRound === Math.log2(32) && !m.sourceA?.kind?.startsWith('L'));
  const third = ko.find((m) => m.sourceA?.kind === 'LOSER');
  const order = [winnerOf(final), loserOf(final), winnerOf(third), loserOf(third)];
  const rest = players.map((p) => p.id).filter((p) => !order.includes(p));
  const participants = [
    ...order.map((pid, k) => ({ place: k + 1, reason: 'BRACKET', pid })),
    ...rest.map((pid) => ({ place: null, reason: 'SHARED', pid })),
  ].map(({ place, reason, pid }) => ({ player: players.find((p) => p.id === pid), place, reason, status: 'PLAYING', isRated: true, seed: null, coach: null }));
  const ratings = players.map((p) => {
    const delta = (rnd() * 80 - 35).toFixed(2);
    return { playerId: p.id, ratingAtStart: p.rating, ratingAfter: (Number(p.rating) + Number(delta)).toFixed(2), totalDelta: delta, events: [] };
  });
  const results = { tournament: view.tournament, participants, shared: [{ participants: rest.slice(0, 4), places: [5, 6, 7, 8] }, { participants: rest.slice(4, 12), places: [9, 10, 11, 12, 13, 14, 15, 16] }, { participants: rest.slice(12), places: Array.from({ length: 16 }, (_, k) => k + 17) }], unresolved: [], standings: view.standings, stages, ratings };
  fs.writeFileSync(resultsOut, JSON.stringify(results));
}
console.log(scenario, 'players', players.length, 'matches', all.length, 'playing', all.filter((m) => m.status === 'PLAYING').length);
