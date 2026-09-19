/* Тонкая обёртка web-push + фильтры аудиторий — Node-тестируемо (test/push.test.mjs). */
'use strict';

function filterAudience(subAudience, broadcastAudience) {
  if (!broadcastAudience || broadcastAudience === 'all') return true;
  if (broadcastAudience === 'admin') return subAudience === 'admin';
  return subAudience === broadcastAudience || subAudience === 'all';
}

function isGone(statusCode) { return statusCode === 404 || statusCode === 410; }

async function sendPushToAll(subs, payload, keys, webpushImpl) {
  const webpush = webpushImpl || require('web-push');
  if (webpush.setVapidDetails && keys && keys.publicKey && keys.privateKey) {
    webpush.setVapidDetails(keys.subject, keys.publicKey, keys.privateKey);
  }
  const out = [];
  for (const [id, sub] of subs) {
    try {
      const endpoint = (sub && (sub.endpoint || (sub.subscription && sub.subscription.endpoint))) || null;
      const keysSub = (sub && (sub.keys || (sub.subscription && sub.subscription.keys))) || {};
      if (!endpoint) { out.push({ id, ok: false, dead: true }); continue; }
      await webpush.sendNotification({ endpoint, keys: keysSub }, JSON.stringify(payload), { TTL: 60 });
      out.push({ id, ok: true, dead: false });
    } catch (e) {
      out.push({ id, ok: false, dead: isGone(e && e.statusCode) });
    }
  }
  return out;
}

module.exports = { filterAudience, isGone, sendPushToAll };
