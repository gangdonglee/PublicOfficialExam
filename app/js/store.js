/* ============ store.js — persistent state (localStorage) ============ */
const Store = (() => {
  const K = {
    settings: "gp_settings",
    progress: "gp_progress",   // { "computer/2025": {answers:{}, mode, score, total, completedAt, attempts:[]} }
    bookmarks: "gp_bookmarks", // ["computer/2025/3", ...]
    wrong: "gp_wrong",         // { "computer/2025/3": {subject,year,no,count,last} }
  };

  function read(key, def) {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : def; }
    catch (e) { return def; }
  }
  function write(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {}
  }

  /* ----- settings ----- */
  const defaults = { theme: "light", fontScale: 1 };
  let settings = Object.assign({}, defaults, read(K.settings, {}));
  function getSettings() { return settings; }
  function setSetting(k, v) { settings[k] = v; write(K.settings, settings); }

  /* ----- progress ----- */
  function getProgress() { return read(K.progress, {}); }
  function getExam(examId) { return getProgress()[examId] || null; }
  function saveAttempt(examId, data) {
    const p = getProgress();
    const prev = p[examId] || { attempts: [] };
    const attempts = prev.attempts || [];
    attempts.push({ score: data.score, total: data.total, date: data.completedAt });
    p[examId] = Object.assign({}, prev, data, { attempts });
    write(K.progress, p);
  }
  function saveInProgress(examId, partial) {
    const p = getProgress();
    p[examId] = Object.assign({}, p[examId] || {}, partial);
    write(K.progress, p);
  }
  function clearExam(examId) { const p = getProgress(); delete p[examId]; write(K.progress, p); }

  /* ----- bookmarks ----- */
  function getBookmarks() { return read(K.bookmarks, []); }
  function isBookmarked(qid) { return getBookmarks().includes(qid); }
  function toggleBookmark(qid) {
    let b = getBookmarks();
    if (b.includes(qid)) { b = b.filter(x => x !== qid); }
    else { b.unshift(qid); }
    write(K.bookmarks, b);
    return b.includes(qid);
  }

  /* ----- wrong notes ----- */
  function getWrong() { return read(K.wrong, {}); }
  function addWrong(qid, meta) {
    const w = getWrong();
    const prev = w[qid] || { count: 0 };
    w[qid] = Object.assign({}, meta, { count: prev.count + 1, last: Date.now() });
    write(K.wrong, w);
  }
  function removeWrong(qid) { const w = getWrong(); delete w[qid]; write(K.wrong, w); }
  function isWrong(qid) { return !!getWrong()[qid]; }

  /* ----- reset ----- */
  function resetAll() {
    [K.progress, K.bookmarks, K.wrong].forEach(k => localStorage.removeItem(k));
  }

  return {
    getSettings, setSetting,
    getProgress, getExam, saveAttempt, saveInProgress, clearExam,
    getBookmarks, isBookmarked, toggleBookmark,
    getWrong, addWrong, removeWrong, isWrong,
    resetAll,
  };
})();
