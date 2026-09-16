// Конфигурация Firebase (веб-приложение из консоли Firebase).
// Web-конфиг по дизайну Firebase публичный — безопасность обеспечивает Rules.
const firebaseConfig = {
  apiKey: "AIzaSyANDZMnorncgrKoT3h5eD5wynKHQCTjgG8",
  authDomain: "pestovo-livescoring.firebaseapp.com",
  databaseURL: "https://pestovo-livescoring-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "pestovo-livescoring",
  storageBucket: "pestovo-livescoring.firebasestorage.app",
  messagingSenderId: "812300292012",
  appId: "1:812300292012:web:cfde80a11a053499ec7409",
  measurementId: "G-X56JBFR30X"
};

const SITE_CONFIG = {
  // Базовый URL для QR-кодов. "auto" = текущий origin.
  // В продакшене — твой домен или Firebase Hosting (https://<project>.web.app).
  siteBase: "auto",
  // Путь к турнирам в Realtime Database
  tournamentsPath: "tournaments",
  // Раунд по умолчанию на лидерборде
  defaultRound: 1
};
