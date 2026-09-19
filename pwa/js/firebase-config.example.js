/* Скопируйте в js/firebase-config.js (в .gitignore — ключи не уходят в git).
   Без этого файла приложение работает на demo-backend (localStorage + BroadcastChannel)
   с тем же внутренним контрактом DB.on/get/set/update/push/remove. */
window.FIREBASE_CONFIG = {
  apiKey: 'AIza…',
  authDomain: 'pestovo-live.firebaseapp.com',
  databaseURL: 'https://pestovo-live-default-rtdb.europe-west1.firebasedatabase.app',
  projectId: 'pestovo-live',
  messagingSenderId: '…',
  appId: '1:…:web:…'
};
// Публичный VAPID-ключ (из functions config / settings/vapid) — для подписки на push:
window.FIREBASE_VAPID_PUBLIC = 'B…';
