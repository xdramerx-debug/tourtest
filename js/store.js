// Слой данных: Realtime Database + авто-переключение на демо,
// когда база пуста. Демо-правки живут в localStorage.
window.APP = (function () {
  "use strict";

  const db = firebase.initializeApp(firebaseConfig).database();
  const LS_KEY = "livescoring_demo_overlay";
  const listeners = new Set();
  const state = { connected: false, demo: false, id: null, data: null };

  function emit() {
    for (const fn of [...listeners]) {
      try { fn(state); } catch (e) { console.error("listener error:", e); }
    }
  }

  // ---------- util ----------
  function deepSet(obj, pathArr, value) {
    let cur = obj;
    for (let i = 0; i < pathArr.length - 1; i++) {
      const k = pathArr[i];
      if (typeof cur[k] !== "object" || cur[k] === null) cur[k] = {};
      cur = cur[k];
    }
    cur[pathArr[pathArr.length - 1]] = value;
  }
  function loadOverlay() {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || "null"); } catch (e) { return null; }
  }
  function saveOverlay(o) {
    localStorage.setItem(LS_KEY, JSON.stringify(o));
  }
  function withOverlay(base) {
    const o = loadOverlay();
    if (!o) return base;
    const clone = JSON.parse(JSON.stringify(base));
    for (const p of Object.keys(o)) deepSet(clone, p.split("/"), o[p]);
    return clone;
  }

  // ---------- загрузка ----------
  function pickTournamentId(val) {
    if (!val) return null;
    const ids = Object.keys(val);
    if (!ids.length) return null;
    const active = ids.find((k) => val[k] && val[k].config && val[k].config.active);
    return active || ids.slice().sort()[0];
  }

  function applyValue(val) {
    const id = pickTournamentId(val);
    if (id && val[id]) {
      state.demo = false;
      state.id = id;
      state.data = val[id];
    } else {
      state.demo = true;
      state.id = window.DEMO.id;
      state.data = withOverlay(window.DEMO.data);
    }
    emit();
  }

  db.ref(".info/connected").on("value", (s) => {
    state.connected = !!s.val();
    emit();
  });

  db.ref(SITE_CONFIG.tournamentsPath).on(
    "value",
    (s) => applyValue(s.val()),
    (err) => {
      console.error("Firebase read error:", err);
      applyValue(null);
    }
  );

  // ---------- запись ----------
  // relPath относительно узла турнира, напр. "scorecards/p01/round1/holes/3"
  function set(relPath, value) {
    if (state.demo) {
      const o = loadOverlay() || {};
      o[relPath] = value;
      saveOverlay(o);
      state.data = withOverlay(window.DEMO.data);
      emit();
    } else {
      db.ref(SITE_CONFIG.tournamentsPath + "/" + state.id + "/" + relPath).set(value);
    }
  }

  function push(relPath, value) {
    const key = "k" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    set(relPath + "/" + key, value);
    return key;
  }

  function resetDemo() {
    localStorage.removeItem(LS_KEY);
    applyValue(null);
  }

  // ---------- доступ к данным ----------
  const data = () => state.data;
  const meta = () => (state.data && state.data.meta) || null;
  const config = () => (state.data && state.data.config) || null;
  const players = () => (state.data ? Object.values(state.data.players || {}) : []);
  const player = (id) => ((state.data && state.data.players) || {})[id] || null;
  const groups = () =>
    state.data
      ? Object.keys(state.data.groups || {})
          .map((k) => Object.assign({ id: k }, state.data.groups[k]))
          .sort((a, b) => (a.number || 0) - (b.number || 0))
      : [];
  const group = (id) => ((state.data && state.data.groups) || {})[id] || null;
  const holes = () => (state.data && state.data.course && state.data.course.holes) || [];
  const tee = () => {
    const c = config(), m = meta();
    return m && c && m.tees ? m.tees[c.tee] || Object.values(m.tees)[0] : null;
  };
  const scorecard = (pid, round) =>
    (((state.data && state.data.scorecards) || {})[pid] || {})["round" + (round || 1)] || null;
  const roundOf = (pid, round) => GolfCalc.computeRound(state.data, pid, round);
  const board = (round) => (round ? GolfCalc.board(state.data, round) : GolfCalc.boardTotal(state.data));

  function base() {
    return SITE_CONFIG.siteBase === "auto" ? window.location.origin : SITE_CONFIG.siteBase;
  }
  function url(path, params) {
    let u = base() + (path.charAt(0) === "/" ? path : "/" + path);
    if (params) u += "?" + new URLSearchParams(params).toString();
    return u;
  }

  // ---------- подписки ----------
  function subscribe(fn) {
    listeners.add(fn);
    fn(state);
    return () => listeners.delete(fn);
  }

  return {
    state: state,
    subscribe: subscribe,
    set: set,
    push: push,
    resetDemo: resetDemo,
    data: data,
    meta: meta,
    config: config,
    players: players,
    player: player,
    groups: groups,
    group: group,
    holes: holes,
    tee: tee,
    scorecard: scorecard,
    roundOf: roundOf,
    board: board,
    base: base,
    url: url
  };
})();
