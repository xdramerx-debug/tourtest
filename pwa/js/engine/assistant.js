/* Assistant (§5.11): офлайн extractive RAG — BM25 поверх предложений документов
   (книга правил гольфа, гид клуба, FAQ). Источник текста: pdf.js (страница) вытаскивает
   текст из PDF и валит в buildIndex; без PDF — встроенный сид (guide + правила из config). */
(function (root, factory) {
  root.ASSISTANT = factory();
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this), function () {
  'use strict';

  var STOP = new Set(('и в на под по для не что это как к у с со из за до от о об или при им их мы вы он она они его её же бы же ли же же лунка лунке лунки это этот тот та то или are the a an in on of to and or is if you your ball hole stroke strokes par rules rule can may from at')
    .split(' '));
  function tokenize(text) {
    return (text || '').toLowerCase()
      .replace(/[^a-zа-яё0-9\s-]/giu, ' ')
      .split(/\s+/)
      .filter(function (w) { return w.length > 2 && !STOP.has(w); });
  }
  function splitSentences(text) {
    return (text || '').split(/(?<=[.!?])\s+|\n+/).map(function (s) { return s.trim(); }).filter(function (s) { return s.length > 30 && s.length < 600; });
  }

  /** docs: [{id,title,text}] → {sentences:[{id,title,sent,tokens}], df, N, avgdl} */
  function buildIndex(docs) {
    var sentences = [];
    docs.forEach(function (d) {
      splitSentences(d.text).forEach(function (s, i) {
        sentences.push({ did: d.id, title: d.title || d.id, sent: s, tokens: tokenize(s) });
      });
    });
    var df = {}, N = sentences.length, avg = 0;
    sentences.forEach(function (s) {
      avg += s.tokens.length;
      var seen = {};
      s.tokens.forEach(function (t) { if (!seen[t]) { seen[t] = 1; df[t] = (df[t] || 0) + 1; } });
    });
    return { sentences: sentences, df: df, N: N, avgdl: N ? avg / N : 1 };
  }

  /** BM25 top-k: строки [{title,sent,score}] */
  function ask(index, query, k) {
    k = k || 3;
    if (!index || !index.N) return [];
    var q = tokenize(query);
    var K1 = 1.5, b = 0.75;
    var scored = index.sentences.map(function (s) {
      var tf = {};
      s.tokens.forEach(function (t) { tf[t] = (tf[t] || 0) + 1; });
      var score = 0;
      q.forEach(function (term) {
        var f = tf[term] || 0;
        if (!f) return;
        var idf = Math.log(1 + (index.N - (index.df[term] || 0) + 0.5) / ((index.df[term] || 0) + 0.5));
        score += idf * (f * (K1 + 1)) / (f + K1 * (1 - b + b * (s.tokens.length / index.avgdl)));
      });
      return { title: s.title, did: s.did, sent: s.sent, score: score };
    }).filter(function (r) { return r.score > 0.3; });
    scored.sort(function (a, b2) { return b2.score - a.score; });
    // дедуп по did (не больше 2 предложений из документа) и склейка
    var out = []; var perDoc = {};
    for (var i = 0; i < scored.length && out.length < k; i++) {
      var r = scored[i];
      perDoc[r.did] = (perDoc[r.did] || 0) + 1;
      if (perDoc[r.did] > 2) continue;
      out.push({ title: r.title, text: r.sent, score: Math.round(r.score * 100) / 100 });
    }
    return out;
  }

  return { tokenize: tokenize, splitSentences: splitSentences, buildIndex: buildIndex, ask: ask };
});
