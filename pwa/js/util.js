/* Общие утилиты UI: форматирование, дебаунс, маскировка ФИО по privacy (§11). */
(function () {
  'use strict';

  function el(tag, attrs, html) {
    var e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'class') e.className = attrs[k];
      else if (k === 'text') e.textContent = attrs[k];
      else e.setAttribute(k, attrs[k]);
    });
    if (html != null) e.innerHTML = html;
    return e;
  }
  function debounce(fn, ms) { var t = null; return function () { var a = arguments, self = this; clearTimeout(t); t = setTimeout(function () { fn.apply(self, a); }, ms); }; }
  function escapeHtml(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }
  function qs(sel, root) { return (root || document).querySelector(sel); }
  function fmtDate(ts) {
    var d = new Date(ts);
    return d.toLocaleDateString(window.i18nLang ? i18nLang() : 'ru', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  }
  function fmtTime(ts) { return new Date(ts).toLocaleTimeString(window.i18nLang ? i18nLang() : 'ru', { hour: '2-digit', minute: '2-digit' }); }
  function id() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  window.Util = {
    el: el, debounce: debounce, escapeHtml: escapeHtml, qs: qs,
    fmtDate: fmtDate, fmtTime: fmtTime, uid: id,

    /** Параметр URL (QR/сponsорсьские страницы, ?v=… игнорируется). */
    param: function (name, fallback) {
      var v = new URLSearchParams(location.search).get(name);
      return v == null ? fallback : v;
    },

    /** Маскировка имён (§11). players: { <uid>: true } — точечно; иначе maskMode глобальный. */
    showName: function (name, uid, privacy, isAdmin) {
      if (isAdmin) return name;
      if (!privacy || !privacy.enabled) return name;
      var masked = privacy.maskMode === 'per-player' && uid && privacy.players && privacy.players[uid];
      var maskGlobal = privacy.maskMode !== 'per-player' || masked;
      if (!maskGlobal) return name;
      var parts = String(name || '').trim().split(/\s+/);
      return parts.slice(0, 2).map(function (p) { return (p[0] || '') + '.'; }).join(' ');
    },

    /** Бенд HCP → css-класс (§4.2). */
    hcpBadgeClass: function (field) {
      var b = window.WHS.hcpBand(field);
      return 'hcp-band--' + b.id;
    },

    /** Toast. */
    toast: function (html, type) {
      var root = qlToast();
      var t = Util.el('div', { class: 'toast ' + (type || '') }, html);
      root.appendChild(t);
      setTimeout(function () { t.classList.add('in'); }, 10);
      setTimeout(function () { t.classList.remove('in'); setTimeout(function () { t.remove(); }, 300); }, 2600);
    },

    /** Modal. */
    modal: function (contentHtml, opts) {
      opts = opts || {};
      var wrap = Util.el('div', { class: 'modal' });
      var box = Util.el('div', { class: 'modal__box' }, contentHtml);
      wrap.appendChild(box);
      if (opts.width) box.style.maxWidth = opts.width;
      wrap.addEventListener('click', function (e) { if (e.target === wrap || (e.target.closest && e.target.closest('[data-close]'))) close(); });
      document.body.appendChild(wrap);
      function close() { wrap.remove(); document.removeEventListener('keydown', esc); }
      function esc(e) { if (e.key === 'Escape') close(); }
      document.addEventListener('keydown', esc);
      return { el: wrap, close: close };
    }
  };
  function qlToast() { var r = document.getElementById('toasts'); if (!r) { r = util(el('div', { id: 'toasts' })); document.body.appendChild(r); } return r; }
  function util(x) { return x; }
})();
