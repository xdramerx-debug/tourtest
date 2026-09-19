/* Тесты турнирного движка pwa/js/engine/tour.js + assistant.js — node --test (§7, §5.11). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
globalThis.window = globalThis;
require('../pwa/js/config.js');
require('../pwa/js/engine/whs.js');
require('../pwa/js/engine/tour.js');
require('../pwa/js/engine/assistant.js');
const C = globalThis.APP_CONFIG;
const WHS = globalThis.WHS;
const TOUR = globalThis.TOUR || require('../pwa/js/engine/tour.js');
const ASSISTANT = globalThis.ASSISTANT;
const HOLES = C.course.holes;

function sc(all) { // all: массив из 18 чисел → {n: v}
  const o = {}; all.forEach((v, i) => { o[String(i + 1)] = v; }); return o;
}
const PARS = HOLES.map(h => h.p);

/* ---------- countback ---------- */
test('countback: отличие задних 9 пробивает равенство', () => {
  const a = sc([...PARS.slice(0, 9), ...PARS.slice(9).map(p => p + 1).slice(0, 8), PARS[17]]); // +1 хуже на 10..17
  const b = sc([...PARS.slice(0, 9), ...PARS.slice(9).map((p, i) => i === 8 ? p + 8 : p)]);   // +8 на 18
  const ca = TOUR.countback(a, HOLES), cb = TOUR.countback(b, HOLES);
  assert.equal(ca.total, 8); assert.equal(cb.total, 8);
  assert.ok(TOUR.cmpCountback(ca, cb) !== 0);
  // у a задние 9: +8 распределены на 10..17 (по 1) → back9 сумма 8-8=... проверка порядка
  assert.ok(TOUR.cmpCountback(ca, cb) < 0); // a ровнее на задних → лучше
});

/* ---------- leaderboard ---------- */
test('leaderboard stroke: toPar asc, тай = =N, DQ внизу', () => {
  const players = [
    { pid: 'a', name: 'A', gender: 'men', scores: sc(PARS), fieldHcp: 10 },
    { pid: 'b', name: 'B', gender: 'men', scores: sc(PARS.map(p => p + 1)), fieldHcp: 10 },
    { pid: 'c', name: 'C', gender: 'men', scores: sc(PARS.map(p => p - 1)), fieldHcp: 10 },
    { pid: 'd', name: 'D', gender: 'men', scores: {}, fieldHcp: 10, status: 'DQ' }
  ];
  const rows = TOUR.leaderboard(players, HOLES, { format: 'stroke', division: 'all' });
  assert.equal(rows.length, 4);
  assert.equal(rows[0].pid, 'c'); assert.equal(rows[3].status, 'DQ');
  assert.equal(rows[1].place, '2');
});

test('leaderboard: деление по полу (gender split)', () => {
  const players = [
    { pid: 'm1', name: 'M1', gender: 'men', scores: sc(PARS), fieldHcp: 5 },
    { pid: 'w1', name: 'W1', gender: 'women', scores: sc(PARS.map(p => p - 1)), fieldHcp: 5 }
  ];
  const men = TOUR.leaderboard(players, HOLES, { format: 'stroke', division: 'men' });
  const women = TOUR.leaderboard(players, HOLES, { format: 'stroke', division: 'women' });
  assert.equal(men.length, 1); assert.equal(men[0].pid, 'm1');
  assert.equal(women.length, 1); assert.equal(women[0].pid, 'w1');
});

test('leaderboard stableford: очки desc', () => {
  const players = [
    { pid: 'a', name: 'A', gender: 'men', scores: sc(PARS.map(p => p + 2)), fieldHcp: 0 },
    { pid: 'b', name: 'B', gender: 'men', scores: sc(PARS), fieldHcp: 0 }
  ];
  const rows = TOUR.leaderboard(players, HOLES, { format: 'stableford' });
  assert.equal(rows[0].pid, 'b');
  assert.equal(rows[0].points, 36); // по пару: 2pt × 18
  assert.equal(rows[1].points, 0);
});

test('leaderboard: tiebreak countback при равном toPar', () => {
  const a = { pid: 'a', gender: 'men', name: 'A', scores: null, fieldHcp: 0 };
  const b = { pid: 'b', gender: 'men', name: 'B', scores: null, fieldHcp: 0 };
  // оба +4: A сделал +4 на лунке 18, B — по +1 на 1..4 (задние девять в пару)
  a.scores = sc(PARS.map((p, i) => i === 17 ? p + 4 : p));
  b.scores = sc(PARS.map((p, i) => i < 4 ? p + 1 : p));
  const rows = TOUR.leaderboard([a, b], HOLES, { format: 'stroke', tiebreak: 'countback' });
  assert.equal(rows[0].pid, 'b');
});

/* ---------- pairings ---------- */
test('pairings: размер флетов 4, хвост добирается', () => {
  const players = Array.from({ length: 13 }, (_, i) => ({ pid: 'p' + i, fieldHcp: i }));
  const fl = TOUR.pairings(players, { by: 'index', size: 4 });
  assert.ok(fl.every(f => f.length >= 2 && f.length <= 4));
  assert.equal(fl.reduce((s, f) => s + f.length, 0), 13);
  assert.deepEqual(fl[0].map(p => p.pid), ['p0', 'p1', 'p2', 'p3']); // по индексу sorted
});

/* ---------- cut ---------- */
test('cut: top-N', () => {
  const players = Array.from({ length: 10 }, (_, i) => ({ pid: 'p' + i, gender: 'men', fieldHcp: 0, scores: sc(PARS.map(p => p + i)) }));
  const lb = TOUR.leaderboard(players, HOLES, { format: 'stroke' });
  const res = TOUR.cut(lb, { kind: 'top', n: 5 });
  assert.equal(res.pass.length, 5);
  assert.equal(res.fail.length, 5);
  assert.equal(res.pass[0].pid, 'p0');
});

/* ---------- skins ---------- */
test('skinsWinners: clean win + carry после тай', () => {
  const p1 = { pid: 'p1', scores: {} }, p2 = { pid: 'p2', scores: {} };
  // +1 all except: hole1 — оба по пару (tie), hole2 — p1 берёт (два скина), hole3 — p2
  p1.scores = sc(PARS.map((p, i) => i === 1 ? p - 1 : p));
  p2.scores = sc(PARS.map((p, i) => i === 2 ? p - 1 : p));
  const skins = TOUR.skinsWinners([p1, p2], HOLES);
  assert.equal(skins.p1, 2); // hole2 + перенос с hole1
  assert.equal(skins.p2, 1);
});

/* ---------- bestball ---------- */
test('bestBallBoard: берёт лучший мяч флета', () => {
  const f = [
    { pid: 'x', name: 'X A', scores: sc(PARS.map((p, i) => i % 2 ? p + 1 : p)), fieldHcp: null },
    { pid: 'y', name: 'Y B', scores: sc(PARS.map((p, i) => i % 2 ? p : p + 1)), fieldHcp: null }
  ];
  const board = TOUR.bestBallBoard([f], HOLES);
  assert.equal(board.length, 1);
  assert.equal(board[0].toPar, 0); // на каждой лунке кто-то играет в пару
});

/* ---------- OoM ---------- */
test('oomPoints: таблица 100/80/70 + 5 за участие', () => {
  assert.equal(TOUR.oomPoints(1), 100);
  assert.equal(TOUR.oomPoints(2), 80);
  assert.equal(TOUR.oomPoints(3), 70);
  assert.equal(TOUR.oomPoints(20), 10);
  assert.equal(TOUR.oomPoints(21), 5);
  assert.equal(TOUR.oomPoints(99), 5);
});

test('computeOoM: агрегация по сезону', () => {
  const acc = TOUR.computeOoM([
    { id: 't1', name: 'Кубок', standings: [{ pid: 'a', name: 'A', place: 1 }, { pid: 'b', name: 'B', place: 3 }] },
    { id: 't2', name: 'Открытый', standings: [{ pid: 'a', name: 'A', place: 25 }, { pid: 'b', name: 'B', place: 2 }] }
  ]);
  assert.equal(acc[0].pid, 'b'); assert.equal(acc[0].points, 150); // 70 тр.1 + 80 тр.2
  assert.equal(acc[1].pid, 'a'); assert.equal(acc[1].points, 105); // 100 + 5 участие
  assert.equal(acc[0].events, 2);
});

/* ---------- protocol v2 ---------- */
test('protocol: структура v2, hash, неперезаписываемость', () => {
  const t = { id: 't1', name: 'Кубок', format: 'stroke', date: '2026-06-01' };
  const lbs = { all: TOUR.leaderboard([{ pid: 'a', name: 'A', gender: 'men', scores: sc(PARS), fieldHcp: 5 }], HOLES, { format: 'stroke' }), men: [], women: [] };
  const doc = TOUR.protocol(t, lbs, {});
  assert.equal(doc.version, 2);
  assert.equal(doc.sealed, true);
  assert.ok(/^[0-9a-f]{8}$/.test(doc.hash));
  assert.equal(doc.tables.all.length, 1);
  assert.equal(TOUR.protocolDiff(null, doc).allowed, true);
  assert.equal(TOUR.protocolDiff(doc, doc).allowed, false); // sealed-immutable/identical
  assert.equal(TOUR.protocolDiff(doc, { ...doc, tables: { all: [], men: [], women: [] } }).allowed, false);
});

/* ---------- parseCsv ---------- */
test('parseCsv: кавычки, разделители, заголовки', () => {
  const csv = 'Имя;HCP;Пол\nПетров Иван;"12,4";M\nИгнатьева Анна;18.5;Ж';
  const r = TOUR.parseCsv(csv);
  assert.equal(r.headers.length, 3);
  assert.equal(r.rows.length, 2);
  assert.equal(r.rows[0]['Имя'], 'Петров Иван');
  assert.equal(r.rows[0]['HCP'], '12,4');
});

test('parseCsv: табуляция и запятая', () => {
  const t = TOUR.parseCsv('a,b\n1,2');
  assert.equal(t.headers.join('|'), 'a|b');
  const t2 = TOUR.parseCsv('a\tb\n1\t2');
  assert.equal(t2.rows[0].b, '2');
});

/* ---------- assistant BM25 ---------- */
test('assistant: индекс + extractive answer (RU)', () => {
  const docs = [
    { id: 'rules', title: 'Правила гольфа', text: 'Мяч считается в лунке, если он касается внутренней поверхности лунки или остановился внутри неё. Игрок не должен касаться линии своего патта, за исключением случаев, предусмотренных правилами. Время на поиск мяча составляет не более трёх минут.' },
    { id: 'guide', title: 'Книга поля Пестово', text: 'Лунка 4 — длинный пар-5 с водой справа от фервея на втором ударе. Лучше лейап до бункера, оставляя сотню метров до грина.' },
    { id: 'faq', title: 'FAQ клуба', text: 'Миллиган "гимми" — неформальная практика. В официальных турнирах все патты должны быть ударены до лунки.' }
  ];
  const idx = ASSISTANT.buildIndex(docs);
  assert.ok(idx.N > 3);
  const ans = ASSISTANT.ask(idx, 'сколько минут можно искать мяч?', 2);
  assert.ok(ans.length >= 1);
  assert.ok(ans[0].text.includes('трёх минут'), 'ответ содержит «трёх минут»: ' + (ans[0] || {}).text);
  assert.equal(ans[0].title, 'Правила гольфа');
});

test('assistant: пустой запрос и пустой индекс', () => {
  const idx = ASSISTANT.buildIndex([]);
  assert.deepEqual(ASSISTANT.ask(idx, 'вопрос', 3), []);
  const idx2 = ASSISTANT.buildIndex([{ id: 'x', title: 'X', text: 'Короткий.' }]);
  assert.deepEqual(ASSISTANT.ask(idx2, 'undefined', 3), []);
});
