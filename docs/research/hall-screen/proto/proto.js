// Прототип экрана зала: варианты A/B/C на синтетических данных (fx-*.js).
// ?v=A|B|C &s=groups|bracket|tables|final|final-bracket &fx=groups8|ko16|ko32|final32
const V = window.FX;
const R = window.FXR;
const v = Q.get('v') ?? 'A';
const screen = Q.get('s') ?? 'groups';
const NOW = Date.parse(V.updatedAt);
const P = new Map(V.players.map((p) => [p.id, p]));
const ALL = V.stages.flatMap((s) => s.matches);
const OUT = new Set(V.withdrawn);
const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);

// ---- имена: «Фамилия И.», при совпадении — «Фамилия Имя» --------------------
const initials = new Map();
for (const p of V.players) {
  const key = `${p.lastName} ${p.firstName[0]}`;
  initials.set(key, (initials.get(key) ?? 0) + 1);
}
function short(id) {
  const p = P.get(id);
  if (!p) return '—';
  return initials.get(`${p.lastName} ${p.firstName[0]}`) > 1 ? `${p.lastName} ${p.firstName}` : `${p.lastName} ${p.firstName[0]}.`;
}
const full = (id) => (P.get(id) ? `${P.get(id).lastName} ${P.get(id).firstName}` : '—');
const rating = (id) => (P.get(id) ? String(Math.round(Number(P.get(id).rating))) : '');
// Длинное имя сжимается по ширине (ось wdth Roboto Flex), а не обрезается.
const fit = (text, max) => (text.length > max ? `<span style="font-stretch:${Math.max(60, Math.round((max / text.length) * 100))}%">${esc(text)}</span>` : esc(text));

// ---- правила столов и очереди (как предлагается в ADR) ------------------------
const settled = (m) => m.status === 'FINISHED' || m.status === 'CANCELLED' || OUT.has(m.playerAId) || OUT.has(m.playerBId);
const playing = ALL.filter((m) => m.status === 'PLAYING' && !settled(m));
const busy = new Map();
for (const m of playing) { busy.set(m.playerAId, m.tableNumber); busy.set(m.playerBId, m.tableNumber); }
const CALL_MS = 150_000;
const SHOW_DONE_MS = 60_000;
function tables() {
  return Array.from({ length: V.tournament.tableCount }, (_, i) => {
    const n = i + 1;
    const m = playing.find((x) => x.tableNumber === n);
    if (m) return { n, kind: NOW - Date.parse(m.startedAt) < CALL_MS ? 'call' : 'play', m };
    const done = ALL.filter((x) => x.status === 'FINISHED' && x.tableNumber === n).sort((a, b) => b.finishedAt.localeCompare(a.finishedAt))[0];
    // Результат висит минуту и только пока оба не ушли за другой стол.
    if (done && NOW - Date.parse(done.finishedAt) < SHOW_DONE_MS && !busy.has(done.playerAId) && !busy.has(done.playerBId)) return { n, kind: 'done', m: done };
    return { n, kind: 'free', m: null };
  });
}
function queue() {
  const ready = ALL.filter((m) => m.playerAId && m.playerBId && (m.status === 'PENDING' || m.status === 'QUEUED') && !settled(m));
  return ready.map((m) => ({ m, wait: busy.get(m.playerAId) ?? busy.get(m.playerBId) ?? null })).sort((a, b) => (a.wait === null ? 0 : 1) - (b.wait === null ? 0 : 1));
}
function roundName(fromFinal) {
  return fromFinal === 0 ? 'Финал' : fromFinal === 1 ? 'Полуфинал' : fromFinal === 2 ? '1/4 финала' : `1/${2 ** fromFinal} финала`;
}
const isPlacement = (m) => m.sourceA?.kind === 'LOSER';
function label(m) {
  const st = V.stages.find((s) => s.id === m.stageId);
  if (st.groups.length) return `${st.groups.find((g) => g.id === m.groupId)?.label ?? ''}`;
  if (isPlacement(m)) return 'За 3-е место';
  const last = Math.max(...st.matches.filter((x) => !isPlacement(x)).map((x) => x.bracketRound));
  return roundName(last - m.bracketRound);
}
const minutes = (m) => Math.floor((NOW - Date.parse(m.startedAt)) / 60000);
const stageNow = (V.stages.find((s) => s.matches.some((m) => m.status === 'PLAYING')) ?? V.stages.find((s) => s.matches.some((m) => !settled(m))) ?? V.stages.at(-1)).name;
const done = ALL.filter((m) => m.status !== 'CANCELLED' && settled(m)).length;
const total = ALL.filter((m) => m.status !== 'CANCELLED').length;
const closed = V.tournament.status === 'FINISHED' || V.tournament.status === 'RATED';

// ---- блоки -------------------------------------------------------------------
function header() {
  const clock = new Date(NOW).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' });
  return `<header><div style="min-width:0"><h1>${esc(V.tournament.name.replace('Макет: ', 'Кубок клуба KTTF — '))}</h1>
  <div class="meta"><span class="badge ${closed ? 'ok' : ''}">${closed ? 'Турнир завершён' : esc(stageNow)}</span>
  <span class="bar"><i style="width:${Math.round((done / total) * 100)}%"></i></span><span class="num">Сыграно ${done} из ${total}</span></div></div>
  <div style="display:flex;align-items:center"><img class="brand" src="logo-wordmark.png" alt="KTTF"><div class="clock"><b>${clock}</b><small>В эфире</small></div></div></header>`;
}

function sideClass(m, side) {
  if (m.setsA === null) return '';
  const mine = side === 'A' ? m.setsA : m.setsB;
  const other = side === 'A' ? m.setsB : m.setsA;
  return mine > other ? 'win' : 'lose';
}
function status(t) {
  const lab = `<div>${esc(label(t.m))}</div>`;
  if (t.kind === 'call') return `${lab}<b style="font-family:inherit">Вызов</b>`;
  if (t.kind === 'done') return `${lab}<b style="font-family:inherit;color:var(--ok-text)">Сыграли</b>`;
  const min = minutes(t.m);
  return min >= 90 ? `${lab}<b style="font-family:inherit">идёт</b>` : `${lab}<b>${min} мин</b>`;
}

// A: строки столов
function tableRows(list) {
  const busyT = list.filter((t) => t.kind !== 'free');
  const free = list.filter((t) => t.kind === 'free').map((t) => t.n);
  return `<section><h2>Столы <small>${busyT.length} заняты · ${free.length} свободны</small></h2><div class="trows">
  ${busyT.map((t) => `<div class="card trow ${t.kind}"><div class="no">${t.n}</div><div class="pair">
    <div class="${sideClass(t.m, 'A')}">${fit(short(t.m.playerAId), 22)}${t.m.setsA !== null ? ` <span class="num">${t.m.setsA}</span>` : ''}</div><div class="${sideClass(t.m, 'B')}">${fit(short(t.m.playerBId), 22)}${t.m.setsB !== null ? ` <span class="num">${t.m.setsB}</span>` : ''}</div></div>
    <div class="st">${status(t)}</div></div>`).join('')}
  </div>${free.length ? `<div class="free" style="margin-top:12px">Свободны ${free.map((n) => `<span>${n}</span>`).join('')}</div>` : ''}</section>`;
}

// B/C: плитки столов
function tableTiles(list, cols, big, nameMax) {
  const busyT = list.filter((t) => t.kind !== 'free');
  const free = list.filter((t) => t.kind === 'free').map((t) => t.n);
  return `<div class="tiles" style="grid-template-columns:repeat(${cols},minmax(0,1fr))">
  ${busyT.map((t) => `<div class="card tile ${big ? 'big' : ''} ${t.kind}"><div class="no">${t.n}</div><div class="body">
    <div class="lbl"><span>${esc(label(t.m))}</span><b>${t.kind === 'call' ? 'Вызов' : t.kind === 'done' ? 'Сыграли' : minutes(t.m) >= 90 ? 'идёт' : `${minutes(t.m)} мин`}</b></div>
    ${['A', 'B'].map((s) => `<div class="side ${sideClass(t.m, s)}"><span>${fit(short(s === 'A' ? t.m.playerAId : t.m.playerBId), nameMax)}</span>${t.m.setsA !== null ? `<span class="num">${s === 'A' ? t.m.setsA : t.m.setsB}</span>` : ''}</div>`).join('')}
  </div></div>`).join('')}
  </div>${free.length ? `<div class="free" style="margin-top:10px">Свободны ${free.map((n) => `<span>${n}</span>`).join('')}</div>` : ''}`;
}

function queueBlock(n, title = 'Следующие') {
  const q = queue();
  if (q.length === 0) {
    const tablesBusy = playing.map((m) => m.tableNumber).sort((a, b) => a - b);
    return `<section><h2>${title}</h2><div class="empty">${done === total ? 'Все встречи сыграны' : `Следующие пары появятся после встреч на столах ${tablesBusy.join(', ')}`}</div></section>`;
  }
  return `<section><h2>${title} <small>${q.length > n ? `ещё ${q.length - n} в очереди` : ''}</small></h2><div class="qrows">
  ${q.slice(0, n).map((x, i) => `<div class="card q ${i === 0 && x.wait === null ? 'first' : ''} ${x.wait !== null ? 'wait' : ''}"><div class="n">${i + 1}</div>
   <div class="p">${fit(short(x.m.playerAId), 20)} — ${fit(short(x.m.playerBId), 20)}<small>${esc(label(x.m))}${x.wait !== null ? ` · ждёт: игрок за столом ${x.wait}` : ''}</small></div></div>`).join('')}
  </div></section>`;
}

function recentBlock(n) {
  const list = ALL.filter((m) => m.setsA !== null).sort((a, b) => b.finishedAt.localeCompare(a.finishedAt)).slice(0, n);
  return `<section class="recent"><h2>Последние результаты</h2>${list.map((m) => `<div class="card r"><div class="p">
   <span class="${m.setsA > m.setsB ? 'w' : ''}">${esc(short(m.playerAId))}</span> — <span class="${m.setsB > m.setsA ? 'w' : ''}">${esc(short(m.playerBId))}</span><small>${esc(label(m))}</small></div>
   <div class="num">${m.setsA}:${m.setsB}</div></div>`).join('')}</section>`;
}

// ---- группы с автоподбором сетки карточек -------------------------------------
function groupCard(g) {
  const stage = V.stages.find((s) => s.id === g.stageId);
  const order = stage.groups.find((x) => x.id === g.groupId).participants;
  const rows = g.rows;
  const adv = V.tournament.formatConfig.advancePerGroup ?? 0;
  const ms = stage.matches.filter((m) => m.groupId === g.groupId);
  const byPlace = rows.map((r) => r.participant);
  const cell = (a, b) => {
    if (a === b) return '<span class="cell self"></span>';
    const m = ms.find((x) => (x.playerAId === a && x.playerBId === b) || (x.playerAId === b && x.playerBId === a));
    if (!m) return '<span class="cell none">·</span>';
    if (m.status === 'PLAYING') return `<span class="cell live">ст.${m.tableNumber}</span>`;
    if (m.setsA === null) return '<span class="cell none">·</span>';
    const mine = m.playerAId === a ? m.setsA : m.setsB;
    const other = m.playerAId === a ? m.setsB : m.setsA;
    return `<span class="cell ${mine > other ? 'won' : 'lost'}">${mine}:${other}</span>`;
  };
  return `<div class="card g"><h3>${esc(g.label)} <small>▌ выходят ${adv}</small></h3><table>
   <tr><th style="width:44px">#</th><th class="l">Игрок</th>${byPlace.map((_, i) => `<th style="width:54px">${i + 1}</th>`).join('')}<th style="width:44px">О</th><th style="width:60px">Сеты</th></tr>
   ${rows.map((r, i) => `<tr class="${i < adv && r.played > 0 ? 'thru' : ''}"><td class="pl">${r.place}</td><td class="nm">${fit(short(r.participant), 13)}<small>${rating(r.participant)}</small></td>
     ${byPlace.map((o) => `<td>${cell(r.participant, o)}</td>`).join('')}<td class="pts">${r.points}</td><td class="sets">${r.setsWon}:${r.setsLost}</td></tr>`).join('')}
   </table></div>`;
}
function groupsLayout(groups, w, h) {
  const players = Math.max(...groups.map((g) => g.rows.length));
  const minW = 36 + 200 + players * 54 + 44 + 60 + 24;
  const cardH = 30 + 26 + players * 33 + 20;
  for (let cols = 1; cols <= 4; cols++) {
    const cw = (w - (cols - 1) * 16) / cols;
    if (cw < minW) break;
    const rows = Math.ceil(groups.length / cols);
    if (rows * cardH + (rows - 1) * 16 <= h) return { cols, perPage: groups.length };
  }
  // Не влезли все — страницами по столько, сколько влезает.
  const cols = Math.max(1, Math.floor((w + 16) / (minW + 16)));
  const rows = Math.max(1, Math.floor((h + 16) / (cardH + 16)));
  return { cols, perPage: cols * rows };
}
// Подбор по живому измерению: сколько групп и в сколько колонок помещается без обрезки.
function fitGroups(el, title) {
  const groups = V.standings.groups;
  const H = el.clientHeight;
  const W = el.clientWidth;
  const head = (pages) => (title ? `<h2>Группы <small>${pages > 1 ? `страница 1 из ${pages}` : `все ${groups.length} на одном экране`}</small></h2>` : '');
  for (let per = groups.length; per >= 1; per--) {
    for (let cols = 1; cols <= 4; cols++) {
      if (Math.ceil(per / cols) > Math.ceil(per / Math.max(1, cols - 1)) && cols > 1 && false) continue;
      el.innerHTML = `${head(Math.ceil(groups.length / per))}<div class="groups" style="grid-template-columns:repeat(${cols},minmax(0,1fr))">${groups.slice(0, per).map(groupCard).join('')}</div>`;
      const grid = el.querySelector('.groups');
      const cut = [...grid.querySelectorAll('td.nm')].some((td) => td.scrollWidth > td.clientWidth + 52);
      if (el.scrollHeight <= H + 1 && grid.scrollWidth <= W + 1 && !cut) return;
    }
  }
}
// ---- сетка: прямая или зеркальная, вписанная в область -------------------------
const koStage = V.stages.filter((s) => s.type === 'KNOCKOUT').at(-1);
function matchBox(m) {
  if (!m) return '';
  const side = (s) => {
    const id = s === 'A' ? m.playerAId : m.playerBId;
    const sets = s === 'A' ? m.setsA : m.setsB;
    return `<div class="s ${id ? sideClass(m, s) : 'tbd'}"><span class="nm">${id ? fit(short(id), 17) : '—'}</span><span class="rt">${id ? rating(id) : ''}</span><span class="sc">${sets ?? ''}</span></div>`;
  };
  return `<div class="card m ${m.status === 'PLAYING' ? 'live' : ''}">${m.status === 'PLAYING' ? `<span class="tag">стол ${m.tableNumber}</span>` : ''}${side('A')}${side('B')}</div>`;
}
function bracketHtml(mirror) {
  const main = koStage.matches.filter((m) => !isPlacement(m));
  const third = koStage.matches.find(isPlacement);
  const rounds = Math.max(...main.map((m) => m.bracketRound));
  const get = (r, s) => main.find((m) => m.bracketRound === r && m.bracketSlot === s);
  const col = (r, slots, offset, dir, isFinal) => {
    const cap = roundName(rounds - r);
    const cells = Array.from({ length: slots }, (_, k) => {
      const m = get(r, offset + k);
      const lines = [];
      // Выход — в сторону следующего круга, вход — с противоположной.
      const outSide = dir === 'R' ? 'left' : 'right';
      const inSide = dir === 'R' ? 'right' : 'left';
      if (!isFinal && m) {
        if (slots > 1) {
          // Выход к следующему кругу и вертикаль к соседу по паре.
          lines.push(`<i class="ln" style="${outSide}:calc(-1 * var(--gx) / 2);width:calc(var(--gx) / 2);top:50%;border-top-width:1px"></i>`);
          lines.push(`<i class="ln" style="${outSide}:calc(-1 * var(--gx) / 2);${(offset + k) % 2 === 0 ? 'top:50%;bottom:0' : 'top:0;bottom:50%'};border-left-width:1px"></i>`);
        } else {
          // Полуфинал зеркальной сетки — прямо в финал.
          lines.push(`<i class="ln" style="${outSide}:calc(-1 * var(--gx));width:var(--gx);top:50%;border-top-width:1px"></i>`);
        }
      }
      if (r > 1 && m && (!isFinal || !mirror)) lines.push(`<i class="ln" style="${inSide}:calc(-1 * var(--gx) / 2);width:calc(var(--gx) / 2);top:50%;border-top-width:1px"></i>`);
      return `<div class="slot">${matchBox(m)}${lines.join('')}</div>`;
    }).join('');
    const extra = isFinal && third ? `<div class="third" style="position:absolute;left:0;right:0;top:calc(50% + var(--rh) + 40px)"><div class="cap">Матч за 3-е место</div>${matchBox(third)}</div>` : '';
    return `<div class="round" style="position:relative"><div class="cap ${isFinal ? 'fin' : ''}">${cap}</div><div class="slots">${cells}</div>${extra}</div>`;
  };
  const first = 2 ** (rounds - 1);
  if (!mirror) {
    const cols = [];
    for (let r = 1; r <= rounds; r++) cols.push(col(r, 2 ** (rounds - r), 0, 'L', r === rounds));
    return { html: cols.join(''), slotsH: first, ncols: rounds };
  }
  const left = [];
  const right = [];
  for (let r = 1; r < rounds; r++) {
    const n = 2 ** (rounds - r);
    left.push(col(r, n / 2, 0, 'L', false));
    right.unshift(col(r, n / 2, n / 2, 'R', false));
  }
  return { html: [...left, col(rounds, 1, 0, 'L', true), ...right].join(''), slotsH: first / 2, ncols: 2 * rounds - 1 };
}
function bracketBlock(id) {
  return `<div class="bwrap" id="${id}"></div>`;
}
function layoutBracket(id) {
  const wrap = document.getElementById(id);
  if (!wrap) return;
  const W = wrap.clientWidth;
  const H = wrap.clientHeight;
  const RH = 30, GAP = 14, CW = 236, GX = 40, CAP = 28;
  const opts = [false, true].map((mirror) => {
    const b = bracketHtml(mirror);
    const cw = mirror ? CW - 36 : CW;
    const gx = mirror ? 28 : GX;
    const nh = CAP + b.slotsH * (2 * RH + 2 + GAP) + (mirror ? 0 : 0);
    const nw = b.ncols * cw + (b.ncols - 1) * gx;
    const third = mirror ? 0 : 0;
    return { mirror, b, cw, gx, nw, nh: nh + third, scale: Math.min(1.35, W / nw, H / nh) };
  });
  // Прямая сетка привычнее: зеркальная — только если она заметно крупнее.
  const pick = Q.get('mirror') === '1' ? opts[1] : Q.get('mirror') === '0' ? opts[0] : opts[1].scale > opts[0].scale * 1.12 ? opts[1] : opts[0];
  wrap.innerHTML = `<div class="bracket" style="--rh:${RH}px;--bf:17px;--cw:${pick.cw}px;--gx:${pick.gx}px;width:${pick.nw}px;height:${Math.max(pick.nh, H / pick.scale)}px;transform:translateX(${Math.max(0, (W - pick.nw * pick.scale) / 2)}px) scale(${pick.scale})">${pick.b.html}</div>
   <div class="lbl-v">${pick.mirror ? 'зеркальная' : 'прямая'} сетка · масштаб ${Math.round(pick.scale * 100)}% · кегль имени ${Math.round(17 * pick.scale)} px при 1920</div>`;
}

// ---- итоги ---------------------------------------------------------------------
const fmtDelta = (d) => {
  const n = Number(d);
  const s = Math.abs(n).toFixed(2);
  return n > 0 ? `+${s}` : n < 0 ? `−${s}` : '0.00';
};
function finale() {
  const rating = new Map(R.ratings.map((r) => [r.playerId, r]));
  const range = new Map();
  for (const sh of R.shared) for (const p of sh.participants) range.set(p, `${sh.places[0]}–${sh.places.at(-1)}`);
  const rows = R.participants.map((p) => ({ id: p.player.id, place: p.place ?? range.get(p.player.id) ?? '—', r: rating.get(p.player.id) }));
  const medal = { 1: ['--gold', '--gold-50', '--gold-text'], 2: ['--silver', '--silver-50', '--silver-text'], 3: ['--bronze', '--bronze-50', '--bronze-text'] };
  const pod = [1, 2, 3].map((n) => {
    const row = rows.find((x) => x.place === n);
    const [f, t, tx] = medal[n];
    return `<div class="card pd" style="border-top:6px solid var(${f});background:var(${t})"><div class="pn" style="color:var(${tx})">${n}</div>
     <div class="who">${esc(full(row.id))}</div><div class="rt">рейтинг<b>${Math.round(Number(row.r.ratingAfter))}</b><span class="${Number(row.r.totalDelta) > 0 ? 'up' : 'down'}">${fmtDelta(row.r.totalDelta)}</span></div></div>`;
  }).join('');
  const rest = rows;
  const perCol = 14;
  const cols = Math.ceil(rest.length / perCol);
  const head = `<div class="pl plhead"><span class="p">Место</span><span>Игрок</span><span class="ra">Рейтинг</span><span class="de">±</span></div>`;
  const colsHtml = Array.from({ length: cols }, (_, c) => `<div>${head}${rest.slice(c * perCol, (c + 1) * perCol).map((x) => {
    const d = Number(x.r.totalDelta);
    return `<div class="pl"><span class="p">${x.place}</span><span class="nm">${fit(full(x.id), 24)}</span><span class="ra">${Math.round(Number(x.r.ratingAfter))}</span><span class="de ${d > 0 ? 'up' : d < 0 ? 'down' : 'zero'}">${fmtDelta(x.r.totalDelta)}</span></div>`;
  }).join('')}</div>`).join('');
  const best = [...R.ratings].sort((a, b) => Number(b.totalDelta) - Number(a.totalDelta))[0];
  return `<div class="podium">${pod}</div>
   <div style="display:flex;justify-content:space-between;align-items:baseline"><h2 style="margin:0">Итоговые места</h2><span class="note">Больше всех вырос: <b>${esc(full(best.playerId))}</b> <b class="up num">${fmtDelta(best.totalDelta)}</b> · рейтинг после турнира, ± — за турнир</span></div>
   <div class="places" style="grid-template-columns:repeat(${cols},minmax(0,1fr))">${colsHtml}</div>`;
}

// ---- сборка вариантов ------------------------------------------------------------
const stage = document.getElementById('stage');
const dots = (n, on) => `<div class="dots">${Array.from({ length: n }, (_, i) => `<i class="${i === on ? 'on' : ''}"></i>`).join('')}</div>`;
const T = tables();
const boardTitle = (t, extra) => `<h2>${t} ${extra ?? ''}</h2>`;
let html = header();
const afterLayout = [];

if (screen.startsWith('final')) {
  const tabs = `<div class="tabs"><span class="${screen === 'final' ? 'on' : ''}">Итоги</span><span class="${screen === 'final-bracket' ? 'on' : ''}">Сетка</span>${V.standings.groups.length ? '<span>Группы</span>' : ''}</div>`;
  html += `<div class="main" style="grid-template-rows:auto minmax(0,1fr)">${tabs}<div class="col" style="gap:16px">${screen === 'final' ? finale() : bracketBlock('br')}</div></div>`;
  if (screen === 'final-bracket') afterLayout.push('br');
} else if (v === 'A') {
  const pages = Q.get('pages') ?? 2;
  html += `<div class="main" style="grid-template-columns:560px minmax(0,1fr)">
   <div class="col">${tableRows(T)}${queueBlock(T.filter((t) => t.kind === 'free').length > 3 ? 5 : 3)}</div>
   <div class="col" style="gap:8px"><div style="display:flex;justify-content:space-between;align-items:center"><h2 style="margin:0">${screen === 'bracket' ? 'Плей-офф' : 'Группы'}</h2>${dots(+pages, screen === 'bracket' ? 1 : 0)}</div>
   ${screen === 'bracket' ? bracketBlock('br') : `<div id="gr" style="flex:1;min-height:0;overflow:hidden"></div>`}</div></div>`;
  if (screen === 'bracket') afterLayout.push('br');
  else afterLayout.push(() => fitGroups(document.getElementById('gr'), false));
} else if (v === 'B') {
  const tabs = `<div class="tabs"><span class="${screen === 'tables' ? 'on' : ''}">1 · Столы</span><span class="${screen === 'groups' ? 'on' : ''}">2 · Группы</span><span class="${screen === 'bracket' ? 'on' : ''}">3 · Сетка</span></div>`;
  const calls = T.filter((t) => t.kind === 'call');
  const free = T.filter((t) => t.kind === 'free').map((t) => t.n);
  const strip = `<div class="card strip" style="border-color:var(--warn)"><span class="lab">Вызов</span><span class="calls">${calls.length ? calls.map((t) => `<span><b>${t.n}</b>${esc(short(t.m.playerAId))} — ${esc(short(t.m.playerBId))}</span>`).join('') : '<span style="color:var(--ink-500)">новых вызовов нет</span>'}</span><span class="free">Свободны ${free.map((n) => `<span>${n}</span>`).join('') || '—'}</span></div>`;
  if (screen === 'tables') {
    html += `<div class="main" style="grid-template-rows:auto minmax(0,1fr)">${tabs}<div style="display:grid;grid-template-columns:minmax(0,1fr) 600px;gap:24px;min-height:0">
     <div class="col"><h2 style="margin:0">Столы</h2>${tableTiles(T, 2, true, 20)}</div><div class="col">${queueBlock(6)}${recentBlock(3)}</div></div></div>`;
  } else {
    html += `<div class="main" style="grid-template-rows:auto minmax(0,1fr) auto">${tabs}<div class="col" style="gap:8px" id="board">${screen === 'bracket' ? bracketBlock('br') : '<div id="gr" style="flex:1;min-height:0;overflow:hidden"></div>'}</div>${strip}</div>`;
    if (screen === 'bracket') afterLayout.push('br');
    else afterLayout.push(() => fitGroups(document.getElementById('gr'), false));
  }
} else if (v === 'C') {
  html += `<div class="main" style="grid-template-rows:auto minmax(0,1fr)">
   <div style="display:grid;grid-template-columns:minmax(0,1fr) 440px;gap:24px">
    <section><h2>Столы</h2>${tableTiles(T, 5, false, 14)}</section>${queueBlock(3)}</div>
   <div class="col" style="gap:8px"><div style="display:flex;justify-content:space-between;align-items:center"><h2 style="margin:0">${screen === 'bracket' ? 'Плей-офф' : 'Группы'}</h2>${dots(3, screen === 'bracket' ? 2 : 0)}</div>
   ${screen === 'bracket' ? bracketBlock('br') : '<div id="gr" style="flex:1;min-height:0;overflow:hidden"></div>'}</div></div>`;
  if (screen === 'bracket') afterLayout.push('br');
  else afterLayout.push(() => fitGroups(document.getElementById('gr'), false));
}
html += `<div class="lbl-v" style="bottom:4px;right:auto;left:32px">Прототип ${screen.startsWith('final') ? 'итогов' : `варианта ${v}`} · синтетические данные для проверки объёма</div>`;
stage.innerHTML = html;

function fitStage() {
  const s = Math.min(innerWidth / 1920, innerHeight / 1080);
  stage.style.transform = `translate(${(innerWidth - 1920 * s) / 2}px, ${(innerHeight - 1080 * s) / 2}px) scale(${s})`;
}
fitStage();
document.fonts.ready.then(() => {
  for (const job of afterLayout) typeof job === 'string' ? layoutBracket(job) : job();
  document.body.dataset.ready = '1';
});
