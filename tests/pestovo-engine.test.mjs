/* Тесты чистого движка pwa/js/engine/whs.js + целостность pwa/js/config.js — node --test (§14).
   ВНИМ.: корень репозитория — "type":"module", поэтому require() грузит скрипты как ESM,
   и UMD/глобалы кладутся в globalThis. Стабим window = globalThis для config.js. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
globalThis.window = globalThis;
require('../pwa/js/config.js');
require('../pwa/js/engine/whs.js');
const C = globalThis.APP_CONFIG;
const WHS = globalThis.WHS;

const HOLES = C.course.holes; // [{p,hcp,bk,bl,wh,rd} × 18]
const PARS = HOLES.map(h => h.p);
const SIS = HOLES.map(h => h.hcp);
const RATINGS = C.course.ratings;
const PAR = C.course.par;

test('карточка поля: 18 лунок, par 72, SI = 1..18 без повторов', () => {
  assert.equal(HOLES.length, 18);
  assert.equal(PARS.reduce((s, x) => s + x, 0), PAR);
  assert.equal(PAR, 72);
  assert.deepEqual([...SIS].sort((a, b) => a - b), Array.from({ length: 18 }, (_, i) => i + 1));
  // тайминги есть на все 18
  for (let n = 1; n <= 18; n++) assert.ok(typeof C.course.timings[n] === 'number');
  // метражи монотонно убывают bk ≥ bl ≥ wh ≥ rd (где есть)
  HOLES.forEach(h => {
    assert.ok(h.bk >= h.bl && h.bl >= h.wh && h.wh >= h.rd);
  });
});

test('fieldHcp: round(exact×SR/113 + CR−Par)', () => {
  const r = RATINGS.men.bl; // cr 73.8 / sr 137
  assert.equal(WHS.fieldHcp(12.4, 'bl', 'men', RATINGS, PAR), Math.round(12.4 * 137 / 113 + (73.8 - 72)));
  assert.equal(WHS.fieldHcp(0, 'wh', 'men', RATINGS, PAR), Math.round(0 * 135 / 113 + (72 - 72)));
  assert.equal(WHS.fieldHcp(36, 'rd', 'women', RATINGS, PAR), Math.round(36 * 136 / 113 + (75.2 - 72)));
  assert.equal(WHS.fieldHcp(54, 'bl', 'men', RATINGS, PAR), Math.round(54 * 137 / 113 + 1.8));
  assert.equal(WHS.fieldHcp(12.4, 'wh', 'women', RATINGS, PAR), Math.round(12.4 * 143 / 113 + (78.6 - 72)));
});

test('fieldHcp: результат целый и в пределах ±70', () => {
  for (const hi of [0, 7.5, 18.5, 36, 54]) {
    const f = WHS.fieldHcp(hi, 'wh', 'women', RATINGS, PAR);
    assert.ok(Number.isInteger(f));
    assert.ok(f >= -20 && f <= 75);
  }
});

test('whsIndex: среднее лучших 8 из 20 дифференциалов (CR72/SR113 → дифф=гросс−72)', () => {
  const lookup = () => ({ cr: 72, sr: 113 });
  const history = Array.from({ length: 20 }, (_, i) => ({ gross: 82 + i, tee: 'x', gender: 'men', nHoles: 18 }));
  const idx = WHS.whsIndex(history, lookup);
  assert.equal(idx, 13.5); // диффы 10..29 → лучшие 8: 10..17 → 13.5
});

test('whsIndex: <20 раундов — правило «лучшие 40%»; пусто → null', () => {
  const lookup = () => ({ cr: 72, sr: 113 });
  const history = [
    { gross: 84, tee: 'x', gender: 'men', nHoles: 18 },
    { gross: 86, tee: 'x', gender: 'men', nHoles: 18 }
  ];
  assert.equal(WHS.whsIndex(history, lookup), 12);
  assert.equal(WHS.whsIndex([], lookup), null);
});

test('summarize: gross/played/toPar на первых 9 лунках (par+1)', () => {
  const scores = {}; HOLES.slice(0, 9).forEach((h, i) => { scores[String(i + 1)] = h.p + 1; });
  const s = WHS.summarize(scores, HOLES, 15);
  assert.equal(s.gross, PARS.slice(0, 9).reduce((a, b) => a + b, 0) + 9); // 45
  assert.equal(s.played, 9);
  assert.equal(s.thru, 9);
  assert.equal(s.toPar, 9);
});

test('summarize: stableNet от полевого 18 (по 1 удару на лунку), все «пять»', () => {
  const scores = {}; HOLES.forEach((h, i) => { scores[String(i + 1)] = 5; });
  const s = WHS.summarize(scores, HOLES, 18);
  const c3 = PARS.filter(p => p === 3).length, c4 = PARS.filter(p => p === 4).length, c5 = PARS.filter(p => p === 5).length;
  // p3 → netDiff 1 → 1pt; p4 → 0 → 2pt; p5 → −1 → 3pt
  assert.equal(s.stableNet, c3 * 1 + c4 * 2 + c5 * 3);
  assert.equal(s.gross, 90);
});

test('stableford: классическая шкала 6..0', () => {
  assert.equal(WHS.stablefordPoints(-5), 6);
  assert.equal(WHS.stablefordPoints(-4), 6);
  assert.equal(WHS.stablefordPoints(-3), 5);
  assert.equal(WHS.stablefordPoints(-2), 4);
  assert.equal(WHS.stablefordPoints(-1), 3);
  assert.equal(WHS.stablefordPoints(0), 2);
  assert.equal(WHS.stablefordPoints(1), 1);
  assert.equal(WHS.stablefordPoints(2), 0);
  assert.equal(WHS.stablefordPoints(7), 0);
});

test('modified stableford шкала 8/6/4/2/0/−1/−3', () => {
  const m = WHS.modifiedStablefordPoints;
  assert.equal(m(-4), 8); assert.equal(m(-5), 8);
  assert.equal(m(-3), 6); assert.equal(m(-2), 4); assert.equal(m(-1), 2);
  assert.equal(m(0), 0); assert.equal(m(1), -1); assert.equal(m(2), -3); assert.equal(m(9), -3);
});

test('strokesReceived: field 18 — по 1 удару; сумма = 18', () => {
  let total = 0;
  HOLES.forEach(h => { const r = WHS.strokesReceived(18, h, HOLES); assert.equal(r, 1); total += r; });
  assert.equal(total, 18);
});

test('strokesReceived: field 20 — SI1/2 по 2, SI3+ по 1', () => {
  assert.equal(WHS.strokesReceived(20, HOLES.find(h => h.hcp === 1), HOLES), 2);
  assert.equal(WHS.strokesReceived(20, HOLES.find(h => h.hcp === 2), HOLES), 2);
  assert.equal(WHS.strokesReceived(20, HOLES.find(h => h.hcp === 3), HOLES), 1);
  assert.equal(WHS.strokesReceived(0, HOLES[0], HOLES), 0);
  assert.equal(WHS.strokesReceived(null, HOLES[0], HOLES), 0);
});

test('strokesReceived: plus-игрок отдаёт на лёгких индексах (SI18 первым)', () => {
  assert.equal(WHS.strokesReceived(-2, HOLES.find(h => h.hcp === 18), HOLES), -1);
  assert.equal(WHS.strokesReceived(-2, HOLES.find(h => h.hcp === 17), HOLES), -1);
  assert.equal(WHS.strokesReceived(-2, HOLES.find(h => h.hcp === 16), HOLES), 0);
  assert.equal(WHS.strokesReceived(-2, HOLES.find(h => h.hcp === 10), HOLES), 0);
});

test('pace(): в темпе / отставание / запас по кумулятивному плану', () => {
  const timings = {}; HOLES.forEach((h, i) => { timings[i + 1] = 15; });
  const t0 = 10 * 3600e3;
  const on = WHS.pace(t0 + 45 * 60e3, t0, 1, [1, 2, 3], timings);
  assert.equal(on.status, 'ontime'); assert.equal(on.diffMin, 0);
  const behind = WHS.pace(t0 + 70 * 60e3, t0, 1, [1, 2, 3], timings);
  assert.equal(behind.status, 'behind'); assert.equal(behind.diffMin, 25);
  const ahead = WHS.pace(t0 + 25 * 60e3, t0, 1, [1, 2, 3], timings);
  assert.equal(ahead.status, 'ahead');
});

test('pace(): shotgun-старт с 10-й — порядок учтён', () => {
  const timings = {}; HOLES.forEach((h, i) => { timings[i + 1] = 10; });
  const t0 = 10 * 3600e3;
  const p = WHS.pace(t0 + 30 * 60e3, t0, 10, [10, 11, 12], timings);
  assert.equal(p.plannedMin, 30); assert.equal(p.status, 'ontime');
});

test('pace(): реальные тайминги Пестово — план 18 лунок ≈ сумме TIMINGS', () => {
  const sum = Object.values(C.course.timings).reduce((a, b) => a + b, 0);
  const t0 = 8 * 3600e3;
  const order = Array.from({ length: 18 }, (_, i) => i + 1);
  const p = WHS.pace(t0 + sum * 60e3, t0, 1, order, C.course.timings);
  assert.equal(p.diffMin, 0);
  assert.ok(sum > 200 && sum < 320, 'общее время круга разумное: ' + sum);
});

test('scoreName: метки итога на лунке', () => {
  assert.equal(WHS.scoreName(-4), 'Condor');
  assert.equal(WHS.scoreName(-3), 'Albatross');
  assert.equal(WHS.scoreName(-2), 'Eagle');
  assert.equal(WHS.scoreName(-1), 'Birdie');
  assert.equal(WHS.scoreName(0), 'Par');
  assert.equal(WHS.scoreName(1), 'Bogey');
  assert.equal(WHS.scoreName(2), 'Double');
  assert.equal(WHS.scoreName(4), '+4');
});

test('prognosis: линейная проекция ±par на 18', () => {
  const scores = {}; HOLES.slice(0, 9).forEach((h, i) => { scores[String(i + 1)] = h.p + 1; });
  const gross = PARS.slice(0, 9).reduce((a, b) => a + b, 0) + 9;
  const p = WHS.prognosis(9, gross, HOLES, scores);
  assert.ok(p && typeof p.grossProj === 'number');
  assert.equal(p.toParProj, 18); // +1/лунка × 18
});

test('hcpBand: границы бэндов', () => {
  assert.equal(WHS.hcpBand(0).id, 'plus');
  assert.equal(WHS.hcpBand(-5).id, 'plus');
  assert.equal(WHS.hcpBand(10).id, 'low');
  assert.equal(WHS.hcpBand(11).id, 'mid');
  assert.equal(WHS.hcpBand(20).id, 'mid');
  assert.equal(WHS.hcpBand(21).id, 'high');
  assert.equal(WHS.hcpBand(36).id, 'high');
  assert.equal(WHS.hcpBand(37).id, 'max');
});

test('simulator: keep/betterByOne из индекса и рейтинга ТИ', () => {
  const s = WHS.simulator(12.4, 20, 'bl', 'men', RATINGS, PAR);
  const r = RATINGS.men.bl;
  assert.equal(s.keep, Math.round(12.4 * r.sr / 113 + r.cr));
  assert.equal(s.betterByOne, Math.round(11.4 * r.sr / 113 + r.cr));
  assert.ok(s.keep > PAR);
});

test('fieldHcpTable: монотонная таблица порогов exact→field', () => {
  const rows = WHS.fieldHcpTable('wh', 'men', RATINGS, PAR, 0, 36);
  assert.ok(rows.length > 10);
  for (let i = 1; i < rows.length; i++) {
    assert.ok(rows[i].field >= rows[i - 1].field);
    assert.ok(rows[i].from > rows[i - 1].from);
    assert.equal(rows[i - 1].to, Math.round((rows[i].from - 0.5) * 10) / 10);
  }
  rows.forEach(r => {
    assert.equal(r.field, WHS.fieldHcp(r.from, 'wh', 'men', RATINGS, PAR));
  });
});
