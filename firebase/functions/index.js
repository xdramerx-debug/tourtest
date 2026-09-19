/* Cloud Functions для «Пестово Live Scoring» (этап 1+).
   - sendBroadcastPush: триггер на /broadcasts/{id} → Web Push всем подпискам по аудитории.
   - sendAlertPush: триггер на /alerts/{id} (новый вызов судьи) → пуш админам.
   - gcSubscriptions: вычистка мёртвых подписок (410/404 от push-сервиса).

   VAPID-ключи задаются через functions config:
     firebase functions:config:set vapid.public="B..." vapid.private="..."
   ПРИВАТНЫЙ КЛЮЧ ТОЛЬКО ЗДЕСЬ — никогда не коммитить, не слать в клиент.

   Тонкий слой на всякий случай вынесен в push.js — unit-тесты в test/. */
'use strict';
const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.database();

const { sendPushToAll, filterAudience, isGone } = require('./push');

function vapidKeys() {
  const cfg = functions.config().vapid || {};
  return { publicKey: cfg.public, privateKey: cfg.private, subject: cfg.subject || 'mailto:admin@pestovo.golf' };
}

exports.sendBroadcastPush = functions.database.ref('/broadcasts/{bid}').onCreate(async (snap, ctx) => {
  const b = snap.val() || {};
  const subsSnap = await db.ref('push_subscriptions').get();
  const all = subsSnap.exists() ? Object.entries(subsSnap.val()) : [];
  const targets = all.filter(([, s]) => filterAudience(s.audience || 'all', b.audience || 'all'));
  const payload = { title: b.title || 'Пестово Live', body: b.body || '', tag: 'bc-' + ctx.params.bid, data: { url: b.url || '/pwa/index.html' } };
  const res = await sendPushToAll(targets, payload, vapidKeys());
  await gcDead(res);
});

exports.sendAlertPush = functions.database.ref('/alerts/{aid}').onCreate(async (snap) => {
  const a = snap.val() || {};
  if (a.type !== 'referee' && a.type !== 'marshal') return;
  const subsSnap = await db.ref('push_subscriptions').get();
  const all = subsSnap.exists() ? Object.entries(subsSnap.val()) : [];
  const admins = all.filter(([, s]) => (s.audience || '') === 'admin' || s.role === 'admin');
  const payload = { title: '🚨 Вызов ' + (a.type === 'referee' ? 'судьи' : 'маршала'), body: `Лунка ${a.hole || '?'} · ${a.playerName || ''}`, tag: 'alert', data: { url: '/pwa/index.html' } };
  const res = await sendPushToAll(admins, payload, vapidKeys());
  await gcDead(res);
});

async function gcDead(results) {
  const dels = [];
  for (const r of results) {
    if (r.dead) dels.push(db.ref('push_subscriptions/' + r.id).remove());
  }
  await Promise.allSettled(dels);
}
