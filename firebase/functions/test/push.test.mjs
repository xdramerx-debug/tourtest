/* Тесты push-слоя Cloud Functions (§6.1, §10). Запуск: node --test test/ */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { filterAudience, isGone, sendPushToAll } = require('../push.js');

test('filterAudience: all → всем; admin → только admin', () => {
  assert.equal(filterAudience('all', 'all'), true);
  assert.equal(filterAudience('players', 'all'), true);
  assert.equal(filterAudience('admin', 'admin'), true);
  assert.equal(filterAudience('all', 'admin'), false);
  assert.equal(filterAudience('players', 'players'), true);
  assert.equal(filterAudience('spectators', 'players'), false);
});

test('isGone: мёртвые коды 404/410', () => {
  assert.equal(isGone(404), true);
  assert.equal(isGone(410), true);
  assert.equal(isGone(500), false);
  assert.equal(isGone(undefined), false);
});

test('sendPushToAll: шлёт и помечает мёртвые подписки (stub web-push)', async () => {
  const sent = [];
  const stub = {
    setVapidDetails() {},
    async sendNotification(sub, payload) {
      sent.push({ sub, payload: JSON.parse(payload) });
      if (sub.endpoint.includes('dead')) { const e = new Error('gone'); e.statusCode = 410; throw e; }
    }
  };
  const subs = [
    ['s1', { endpoint: 'https://push/x1', keys: { p256dh: 'a', auth: 'b' } }],
    ['s2', { endpoint: 'https://push/dead2', keys: {} }],
    ['s3', {}] // без endpoint — считаем мёртвой сразу
  ];
  const res = await sendPushToAll(subs, { title: 'T', body: 'B' }, { publicKey: 'x', privateKey: 'y' }, stub);
  assert.equal(res.length, 3);
  assert.equal(res[0].ok, true);
  assert.equal(res[1].dead, true);
  assert.equal(res[2].dead, true);
  assert.equal(sent.length, 2);
  assert.equal(sent[0].payload.title, 'T');
});
