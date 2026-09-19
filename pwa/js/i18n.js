/* i18n RU/EN (§12): единый словарь + data-i18n, localStorage, <html lang>. */
(function () {
  'use strict';
  var I18N = {
    ru: {
      'app.tag': 'Электронные счётные карточки вместо бумажных',
      'nav.home': 'Главная', 'nav.rounds': 'Все раунды', 'nav.tournaments': 'Турниры',
      'nav.stats': 'Статистика', 'nav.oom': 'Зачёт сезона', 'nav.handicap': 'Гандикапы',
      'nav.guide': 'Книга поля', 'nav.feed': 'Лента', 'nav.players': 'Игроки',
      'nav.predictor': 'Симулятор WHS', 'nav.assistant': 'Помощник', 'nav.admin': 'Админ',
      'nav.design': 'Дизайн', 'nav.auth': 'Вход', 'nav.setup': 'Начать раунд',
      'greet.guest': 'Вы смотрите гостевой режим', 'greet.sign': 'Войти',
      'home.my.title': 'Мои активные раунды', 'home.live.title': 'Сейчас на поле',
      'home.mine.empty': 'Нет активных раундов — начните за 3 тапа',
      'home.start': '▶ Начать раунд', 'home.continue': 'Продолжить ▸',
      'home.recent.title': 'Последние результаты', 'home.course.title': 'Поле клуба',
      'home.numbers.title': 'Клуб в цифрах', 'home.more': 'Меню инструментов',
      'weather.label': 'Погода в клубе', 'weather.wind': 'ветер',
      'setup.title': 'Начало раунда', 'setup.player': 'Игрок (поиск по имени)',
      'setup.guest.hint': 'или гость: ФИО полностью, пол, ТИ, точный HCP',
      'setup.tee': 'ТИ', 'setup.format': 'Формат', 'setup.startHole': 'Стартовая лунка',
      'setup.nHoles': 'Лунок', 'setup.startTime': 'Время начала',
      'setup.preview': 'Тайминг-тема (pace-таблица)', 'setup.create': 'Создать раунд',
      'setup.addPlayer': 'Добавить игрока в группу',
      'format.stroke': 'Строук (gross/net)', 'format.stableford': 'Стейблфорд',
      'format.match': 'Матч-плей', 'format.scramble': 'Скрембл', 'format.bestball': 'Бест болл', 'format.skins': 'Скины',
      'score.hole': 'Лунка', 'score.thru': 'Сыграно', 'score.toPar': '± пар', 'score.gross': 'Гросс',
      'score.stableford': 'Стейблфорд', 'score.pace': 'Темп', 'score.prev': 'Назад', 'score.next': 'Дальше',
      'score.pause': 'Пауза', 'score.resume': 'Продолжить', 'score.finish': 'Завершить раунд',
      'score.pickup': 'Pickup/X', 'score.clearTap': 'Кнопки', 'score.offlineQueued': 'Сохранено офлайн — досылка при сети',
      'pace.title': 'Pace-ассистент', 'pace.behind': 'отставание', 'pace.ahead': 'запас', 'pace.onTime': 'в темпе',
      'lb.title': 'Все раунды', 'lb.search': 'Поиск по ФИО/дате…', 'lb.active': 'Сейчас', 'lb.done': 'Завершены',
      'lb.thru': 'лунка', 'lb.empty': 'Раундов пока нет',
      'guide.title': 'Книга поля', 'guide.hole': 'Лунка', 'guide.par': 'Пар', 'guide.si': 'Индекс',
      'guide.out': 'OUT', 'guide.in': 'IN', 'guide.sum': 'Всего',
      'hcp.title': 'Гандикапы', 'hcp.exact': 'Точный HCP', 'hcp.field': 'Полевой HCP', 'hcp.calc': 'Калькулятор',
      'hcp.gender': 'Пол', 'hcp.men': 'Мужской', 'hcp.women': 'Женский', 'hcp.all': 'Все',
      'hcp.table.title': 'Таблица соответствия exact→field',
      'hcp.mass.search': 'Поиск…',
      'ui.lang': 'Язык', 'ui.theme': 'Тема', 'ui.save': 'Сохранить', 'ui.cancel': 'Отмена',
      'ui.version': 'Версия сайта', 'ui.online': 'онлайн', 'ui.offline': 'офлайн',
      'ui.newVersion': 'Доступна новая версия', 'ui.refresh': 'Обновить',
      'ui.install': 'Установить приложение', 'ui.qr.hole': 'лунка',
      'round.status.active': 'Сейчас на поле', 'round.status.done': 'Завершён', 'round.status.scheduled': 'Запланирован',
      'round.paused': 'Пауза', 'round.group': 'Групповой раунд', 'round.solo': 'Одиночный раунд',
      'newfeat.soon': 'Скоро (этап %s)', 'offline.title': 'Нет соединения',
      'offline.body': 'Интернет пропал. PWA работает офлайн: ранее открытые страницы доступны, счёт пишется в очередь и будет отправлен при появлении сети.',
      'offline.retry': 'Повторить',
      'offline.desc': 'Введённые очки сохранятся и отправятся, когда связь восстановится.',
      'guide.desc': 'Как проходить лунки, чтобы играть ровнее и быстрее.', 'guide.timings': 'Рекомендованное время:',
      'setup.men': 'Мужчина', 'setup.women': 'Девушка',
      'auth.title': 'Вход администратора', 'auth.username': 'Логин', 'auth.password': 'Пароль',
      'auth.login': 'Войти', 'auth.logout': 'Выйти', 'auth.error': 'Неверный логин или пароль',
      'auth.demoHint': 'Демо-режим: логин и пароль — «admin».'
    },
    en: {
      'app.tag': 'Electronic scorecards instead of paper',
      'nav.home': 'Home', 'nav.rounds': 'All rounds', 'nav.tournaments': 'Tournaments',
      'nav.stats': 'Stats', 'nav.oom': 'Order of Merit', 'nav.handicap': 'Handicaps',
      'nav.guide': 'Course Guide', 'nav.feed': 'Feed', 'nav.players': 'Players',
      'nav.predictor': 'WHS Simulator', 'nav.assistant': 'Assistant', 'nav.admin': 'Admin',
      'nav.design': 'Design', 'nav.auth': 'Sign in', 'nav.setup': 'Start round',
      'greet.guest': 'You are browsing as a guest', 'greet.sign': 'Sign in',
      'home.my.title': 'My active rounds', 'home.live.title': 'Live now on course',
      'home.mine.empty': 'No active rounds — start in 3 taps',
      'home.start': '▶ Start round', 'home.continue': 'Continue ▸',
      'home.recent.title': 'Recent results', 'home.course.title': 'Club course',
      'home.numbers.title': 'Club in numbers', 'home.more': 'Tools menu',
      'weather.label': 'Club weather', 'weather.wind': 'wind',
      'setup.title': 'Start a round', 'setup.player': 'Player (search by name)',
      'setup.guest.hint': 'or guest: full name, gender, tee, exact HI',
      'setup.tee': 'Tee', 'setup.format': 'Format', 'setup.startHole': 'Start hole',
      'setup.nHoles': 'Holes', 'setup.startTime': 'Start time',
      'setup.preview': 'Pace timing preview', 'setup.create': 'Create round',
      'setup.addPlayer': 'Add player to group',
      'format.stroke': 'Stroke (gross/net)', 'format.stableford': 'Stableford',
      'format.match': 'Match play', 'format.scramble': 'Scramble', 'format.bestball': 'Best ball', 'format.skins': 'Skins',
      'score.hole': 'Hole', 'score.thru': 'Thru', 'score.toPar': '± par', 'score.gross': 'Gross',
      'score.stableford': 'Stableford', 'score.pace': 'Pace', 'score.prev': 'Back', 'score.next': 'Next',
      'score.pause': 'Pause', 'score.resume': 'Resume', 'score.finish': 'Finish round',
      'score.pickup': 'Pickup/X', 'score.clearTap': 'Keypad', 'score.offlineQueued': 'Saved offline — will sync',
      'pace.title': 'Pace assistant', 'pace.behind': 'behind', 'pace.ahead': 'ahead', 'pace.onTime': 'on time',
      'lb.title': 'All rounds', 'lb.search': 'Search by name/date…', 'lb.active': 'Live', 'lb.done': 'Completed',
      'lb.thru': 'hole', 'lb.empty': 'No rounds yet',
      'guide.title': 'Course Guide', 'guide.hole': 'Hole', 'guide.par': 'Par', 'guide.si': 'SI',
      'guide.out': 'OUT', 'guide.in': 'IN', 'guide.sum': 'Total',
      'hcp.title': 'Handicaps', 'hcp.exact': 'Exact HI', 'hcp.field': 'Course HCP', 'hcp.calc': 'Calculator',
      'hcp.gender': 'Gender', 'hcp.men': 'Men', 'hcp.women': 'Women', 'hcp.all': 'All',
      'hcp.table.title': 'Exact→course HCP table',
      'hcp.mass.search': 'Search…',
      'ui.lang': 'Language', 'ui.theme': 'Theme', 'ui.save': 'Save', 'ui.cancel': 'Cancel',
      'ui.version': 'Site version', 'ui.online': 'online', 'ui.offline': 'offline',
      'ui.newVersion': 'New version available', 'ui.refresh': 'Refresh',
      'ui.install': 'Install the app', 'ui.qr.hole': 'hole',
      'round.status.active': 'Live', 'round.status.done': 'Completed', 'round.status.scheduled': 'Scheduled',
      'round.paused': 'Paused', 'round.group': 'Group round', 'round.solo': 'Solo round',
      'newfeat.soon': 'Soon (stage %s)', 'offline.title': 'Offline',
      'offline.body': 'Connection lost. The PWA works offline: previously opened pages are available, scores are queued and will be sent when back online.',
      'offline.retry': 'Retry',
      'offline.desc': 'Scores you enter are saved locally and will sync once you are back online.',
      'guide.desc': 'How to play each hole for better, faster golf.', 'guide.timings': 'Recommended pace:',
      'setup.men': 'Man', 'setup.women': 'Woman',
      'auth.title': 'Administrator sign in', 'auth.username': 'Username', 'auth.password': 'Password',
      'auth.login': 'Sign in', 'auth.logout': 'Sign out', 'auth.error': 'Invalid username or password',
      'auth.demoHint': 'Demo mode: both username and password are “admin”.'
    }
  };

  var cur = 'ru';
  function lang() { return cur; }
  function t(key, params) {
    var s = (I18N[cur] && I18N[cur][key]) || (I18N.ru && I18N.ru[key]) || key;
    if (params !== undefined) s = s.replace('%s', String(params));
    return s;
  }
  function apply(root) {
    (root || document).querySelectorAll('[data-i18n]').forEach(function (el) {
      var k = el.getAttribute('data-i18n');
      el.textContent = t(k);
    });
    (root || document).querySelectorAll('[data-i18n-ph]').forEach(function (el) {
      el.setAttribute('placeholder', t(el.getAttribute('data-i18n-ph')));
    });
    document.documentElement.lang = cur;
  }
  function setLang(l, persist) {
    if (!I18N[l]) return;
    cur = l;
    if (persist !== false) { try { localStorage.setItem('pc.lang', l); } catch (e) {} }
    apply();
    document.dispatchEvent(new CustomEvent('pc:lang'));
  }
  try { var saved = localStorage.getItem('pc.lang'); if (saved) cur = saved; } catch (e) {}
  window.I18N = I18N; window.t = t; window.setLang = setLang; window.applyI18n = apply; window.i18nLang = lang;
  apply();
})();
