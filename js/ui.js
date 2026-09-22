// Общие UI-хелперы: DOM, форматирование, QR, индикаторы, печать.
window.UI = (function () {
  "use strict";

  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

  function el(tag, attrs, ...kids) {
    const n = document.createElement(tag);
    if (attrs) {
      for (const k of Object.keys(attrs)) {
        if (k === "class") n.className = attrs[k];
        else if (k === "html") n.innerHTML = attrs[k];
        else if (k.startsWith("on") && typeof attrs[k] === "function") n.addEventListener(k.slice(2), attrs[k]);
        else if (attrs[k] != null) n.setAttribute(k, attrs[k]);
      }
    }
    for (const kid of kids.flat()) {
      if (kid == null) continue;
      n.appendChild(typeof kid === "string" ? document.createTextNode(kid) : kid);
    }
    return n;
  }

  function esc(s) {
    const d = document.createElement("div");
    d.textContent = s == null ? "" : String(s);
    return d.innerHTML;
  }

  function fmtMoney(n) {
    if (n == null) return "—";
    return new Intl.NumberFormat("ru-RU").format(n) + " ₽";
  }

  function initials(p) {
    return ((p.firstName || "?").charAt(0) + (p.lastName || "").charAt(0)).toUpperCase();
  }

  function avatarHtml(p, cls) {
    if (p && p.photo) {
      return '<img class="avatar ' + (cls || "") + '" src="' + esc(p.photo) + '" alt="">';
    }
    return '<span class="avatar ' + (cls || "") + '">' + esc(initials(p || {})) + "</span>";
  }

  const CAT_COLORS = ["#c9a961", "#7fbf9a", "#b9a7d9", "#d4917a", "#8fb3c9", "#d9c07a", "#c98fa6", "#a3b98a"];
  function catIndex(catId) {
    const cats = (APP.meta() && APP.meta().categories) || [];
    const i = cats.findIndex((c) => c.id === catId);
    return i < 0 ? 0 : i;
  }
  function catColor(catId) {
    return CAT_COLORS[catIndex(catId) % CAT_COLORS.length];
  }
  function catLabel(catId) {
    const cats = (APP.meta() && APP.meta().categories) || [];
    const c = cats.find((x) => x.id === catId);
    return c ? c.label : catId || "—";
  }
  function catChip(catId) {
    if (!catId) return "";
    const c = catColor(catId);
    return '<span class="chip" style="--chip:' + c + '">' + esc(catLabel(catId)) + "</span>";
  }

  const STATUS_META = {
    registration: { label: "Регистрация открыта", cls: "ok" },
    closed: { label: "Регистрация закрыта", cls: "warn" },
    live: { label: "Турнир идёт", cls: "live" },
    finished: { label: "Результаты опубликованы", cls: "done" }
  };
  function statusPill(status) {
    const m = STATUS_META[status] || { label: status, cls: "ok" };
    return '<span class="pill pill-' + m.cls + '">' + esc(m.label) + "</span>";
  }

  const ROW_STATUS = {
    finished: { label: "F", cls: "st-f" },
    in_progress: { label: "на поле", cls: "st-ip" },
    not_started: { label: "ожидает", cls: "st-ns" },
    WD: { label: "WD", cls: "st-bad" },
    DQ: { label: "DQ", cls: "st-bad" },
    cut: { label: "CUT", cls: "st-bad" }
  };
  function rowStatusHtml(status) {
    const m = ROW_STATUS[status] || ROW_STATUS.not_started;
    return '<span class="st ' + m.cls + '">' + m.label + "</span>";
  }

  // ---------- индикаторы в шапке ----------
  function initChrome() {
    APP.subscribe((st) => {
      const conn = $("#conn");
      if (conn) {
        const cls = st.demo ? "demo" : st.connected ? "on" : "off";
        const txt = st.demo ? "demo" : st.connected ? "live" : "офлайн";
        conn.className = "conn " + cls;
        conn.querySelector("span").textContent = txt;
      }
      const badge = $("#demo-badge");
      if (badge) {
        badge.hidden = !st.demo;
        badge.title = st.demo
          ? "В базе пока нет данных — показано демо. Создай турнир в Realtime Database, и сайт переключится на реальные данные."
          : "";
      }
      const bar = $("#alert-bar");
      if (bar) {
        let html = "";
        const d = st.data;
        if (d && d.suspension && d.suspension.active) {
          const at = d.suspension.startedAt ? " · с " + new Date(d.suspension.startedAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }) : "";
          html = '<div class="alert alert-danger">⛔ ИГРА ПРИОСТАНОВЛЕНА · ' + esc(d.suspension.reason || "неблагоприятная погода") + esc(at) + " · Два коротких сигнала — возобновление</div>";
        } else if (d && d.meta && d.meta.announcement) {
          html = '<div class="alert">📣 ' + esc(d.meta.announcement) + "</div>";
        }
        bar.innerHTML = html;
      }
    });
  }

  // ---------- QR ----------
  function makeQR(container, text, size) {
    if (!container) return;
    container.innerHTML = "";
    if (typeof QRCode === "undefined") {
      container.innerHTML = '<span class="qr-fallback">' + esc(text) + "</span>";
      return;
    }
    new QRCode(container, {
      text: text,
      width: size || 120,
      height: size || 120,
      correctLevel: QRCode.CorrectLevel.M
    });
  }

  // ---------- обратный отсчёт ----------
  function countdownTo(iso, box) {
    function tick() {
      const diff = new Date(iso).getTime() - Date.now();
      if (diff <= 0) {
        box.innerHTML = '<span class="cd-zero">Старт состоялся</span>';
        return;
      }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor(diff / 3600000) % 24;
      const m = Math.floor(diff / 60000) % 60;
      const s = Math.floor(diff / 1000) % 60;
      box.innerHTML =
        cdCell(d, "дней") + cdCell(h, "часов") + cdCell(m, "минут") + cdCell(s, "секунд");
      if (diff > 0) setTimeout(tick, 1000);
    }
    function cdCell(v, label) {
      return (
        '<span class="cd-cell"><b>' + String(v).padStart(2, "0") + "</b><i>" + label + "</i></span>"
      );
    }
    tick();
  }

  // Ближайший будущий старт раунда
  function nextRoundStart(metaData) {
    const starts = (metaData && metaData.roundStarts) || {};
    const now = Date.now();
    for (const k of Object.keys(starts).sort()) {
      if (new Date(starts[k]).getTime() > now) return { no: k, at: starts[k] };
    }
    return null;
  }

  function fmtDate(iso) {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
  }

  function printPage() {
    window.print();
  }

  return {
    $: $, $$: $$, el: el, esc: esc,
    fmtMoney: fmtMoney, initials: initials, avatarHtml: avatarHtml,
    catColor: catColor, catLabel: catLabel, catChip: catChip,
    statusPill: statusPill, rowStatusHtml: rowStatusHtml,
    initChrome: initChrome, makeQR: makeQR,
    countdownTo: countdownTo, nextRoundStart: nextRoundStart,
    fmtDate: fmtDate, printPage: printPage,
    fmtToPar: (v) => GolfCalc.fmtToPar(v)
  };
})();
