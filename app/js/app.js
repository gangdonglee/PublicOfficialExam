/* ============ app.js — 9급 기출 마스터 SPA ============ */
(() => {
  "use strict";

  const $ = (s, r = document) => r.querySelector(s);
  const view = $("#view");
  const tabbar = $("#tabbar");
  const sheetBack = $("#sheet");

  /* ---------------- data ---------------- */
  const Data = {
    index: null,
    cache: {},
    async getIndex() {
      if (!this.index) this.index = await fetch("data/index.json").then(r => r.json());
      return this.index;
    },
    async getExam(subject, year) {
      const id = `${subject}/${year}`;
      if (!this.cache[id]) this.cache[id] = await fetch(`data/${subject}/${year}.json`).then(r => r.json());
      return this.cache[id];
    },
    available(id) { return this.index && this.index.available.includes(id); },
    subject(id) { return this.index.subjects.find(s => s.id === id); },
  };

  const State = { session: null };

  /* ---------------- helpers ---------------- */
  const circled = ["①", "②", "③", "④", "⑤"];
  const qid = (subject, year, no) => `${subject}/${year}/${no}`;
  const esc = (s) => String(s).replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
  function vibrate(ms) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {} }

  let toastT;
  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg; t.classList.add("show");
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("show"), 1700);
  }

  function openSheet(html) {
    sheetBack.innerHTML = `<div class="sheet">${html}</div>`;
    sheetBack.hidden = false;
    sheetBack.onclick = (e) => { if (e.target === sheetBack) closeSheet(); };
  }
  function closeSheet() { sheetBack.hidden = true; sheetBack.innerHTML = ""; }

  function applySettings() {
    const s = Store.getSettings();
    document.documentElement.setAttribute("data-theme", s.theme);
    document.documentElement.style.setProperty("--fs", (16 * (s.fontScale || 1)) + "px");
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", s.theme === "dark" ? "#0f1216" : "#3b82f6");
  }

  function fmtTime(ms) {
    const s = Math.round(ms / 1000);
    const m = Math.floor(s / 60);
    return `${m}분 ${s % 60}초`;
  }

  /* ---------------- progress calc ---------------- */
  function bestAttempt(p) {
    if (!p || !p.attempts || !p.attempts.length) return null;
    return p.attempts.reduce((a, b) => (b.score > a.score ? b : a));
  }
  function subjectProgress(subjectId) {
    const subj = Data.subject(subjectId);
    const prog = Store.getProgress();
    let attempted = 0, scoreSum = 0, totalSum = 0;
    subj.years.forEach(y => {
      const p = prog[`${subjectId}/${y}`];
      const best = bestAttempt(p);
      if (best) { attempted++; scoreSum += best.score; totalSum += best.total; }
    });
    const availCount = subj.years.filter(y => Data.available(`${subjectId}/${y}`)).length;
    return {
      attempted,
      availCount,
      total: subj.years.length,
      avg: totalSum ? Math.round((scoreSum / totalSum) * 100) : 0,
      ratio: availCount ? attempted / availCount : 0,
    };
  }

  /* ---------------- router ---------------- */
  async function route() {
    await Data.getIndex();
    const hash = location.hash || "#/home";
    const seg = hash.replace(/^#\//, "").split("/");
    const page = seg[0] || "home";
    const tabRoutes = { home: 1, wrong: 1, bookmarks: 1, stats: 1, settings: 1 };
    tabbar.hidden = !tabRoutes[page];
    [...tabbar.children].forEach(b => b.classList.toggle("active", b.dataset.route === `#/${page}`));
    window.scrollTo(0, 0);

    try {
      if (page === "home") return renderHome();
      if (page === "subject") return renderSubject(seg[1]);
      if (page === "quiz") return startExam(seg[1], seg[2], seg[3] || "study");
      if (page === "result") return renderResult(seg[1], seg[2]);
      if (page === "practice") return renderQuiz();
      if (page === "wrong") return renderList("wrong");
      if (page === "bookmarks") return renderList("bookmarks");
      if (page === "stats") return renderStats();
      if (page === "settings") return renderSettings();
      renderHome();
    } catch (e) {
      console.error(e);
      view.innerHTML = errorBox(e);
    }
  }

  function errorBox(e) {
    const fileMode = location.protocol === "file:";
    return `<div class="empty"><div class="em">⚠️</div>
      <div class="ti">데이터를 불러오지 못했어요</div>
      <div class="ds">${fileMode
        ? "file://로 직접 열면 데이터 로딩이 막혀요.<br><b>로컬 서버</b>로 실행하세요:<br><code>python -m http.server</code> 후<br>http://localhost:8000 접속"
        : esc(e.message || e)}</div></div>`;
  }

  /* ---------------- HOME ---------------- */
  function renderHome() {
    const prog = Store.getProgress();
    const wrongCount = Object.keys(Store.getWrong()).length;
    const bmCount = Store.getBookmarks().length;

    // continue card: most recent in-progress
    let resume = null;
    for (const [id, p] of Object.entries(prog)) {
      if (p.inProgress) {
        if (!resume || (p.lastTouched || 0) > (resume.p.lastTouched || 0)) resume = { id, p };
      }
    }

    const subjCards = Data.index.subjects.map(s => {
      const sp = subjectProgress(s.id);
      return `<button class="subj-card" data-action="goto" data-route="#/subject/${s.id}">
        <div class="subj-emoji" style="background:${s.color}">${s.icon}</div>
        <div class="subj-meta">
          <div class="nm">${s.name}</div>
          <div class="ds">${sp.availCount}개년 · ${sp.attempted ? `${sp.attempted}회 응시 · 평균 ${sp.avg}점` : "아직 안 풀었어요"}</div>
          <div class="subj-prog">
            <div class="bar"><i style="width:${Math.round(sp.ratio * 100)}%;background:${s.color}"></i></div>
            <span class="pct">${Math.round(sp.ratio * 100)}%</span>
          </div>
        </div>
        <span class="chev">›</span>
      </button>`;
    }).join("");

    let resumeHtml = "";
    if (resume) {
      const [su, yr] = resume.id.split("/");
      const s = Data.subject(su);
      const done = Object.keys(resume.p.picks || {}).length;
      resumeHtml = `<button class="continue-card" data-action="resume" data-id="${resume.id}">
        <div style="flex:1">
          <div class="big">이어풀기 ▸ ${s.name} ${yr}</div>
          <div class="small">${resume.p.mode === "test" ? "실전 모드" : "학습 모드"} · ${done}/20 진행 중</div>
        </div>
        <div class="play">▶</div>
      </button>`;
    }

    view.className = "view";
    view.innerHTML = `
      <div class="hero">
        <h1>9급 기출 마스터 🎯</h1>
        <p>국가직 9급 컴퓨터직 기출문제 · 손안의 합격 도우미</p>
      </div>
      ${resumeHtml}
      <div class="section-title">과목 선택</div>
      <div class="subj-grid">${subjCards}</div>
      <div class="section-title">빠른 이동</div>
      <div class="quick-row">
        <button class="quick" data-action="goto" data-route="#/wrong"><div class="n">${wrongCount}</div><div class="l">📝 오답노트</div></button>
        <button class="quick" data-action="goto" data-route="#/bookmarks"><div class="n">${bmCount}</div><div class="l">⭐ 즐겨찾기</div></button>
        <button class="quick" data-action="goto" data-route="#/stats"><div class="n">📊</div><div class="l">학습 통계</div></button>
      </div>`;
  }

  /* ---------------- SUBJECT (year list) ---------------- */
  function renderSubject(subjectId) {
    const s = Data.subject(subjectId);
    if (!s) return renderHome();
    const prog = Store.getProgress();
    const cards = s.years.map(y => {
      const id = `${subjectId}/${y}`;
      const avail = Data.available(id);
      const p = prog[id];
      const best = bestAttempt(p);
      const inProg = p && p.inProgress;
      let badge = "";
      if (!avail) badge = `<span class="badge lock">준비중</span>`;
      else if (best) badge = `<span class="badge done">${best.score}/${best.total}</span>`;
      else if (inProg) badge = `<span class="badge done" style="background:var(--primary-soft);color:var(--primary-d)">진행중</span>`;
      const scoreLine = best
        ? `<div class="scoreline"><div class="bar"><i style="width:${Math.round(best.score / best.total * 100)}%;background:${s.color}"></i></div></div>`
        : `<div class="st">${avail ? (inProg ? "이어서 풀기" : "풀어보기") : "곧 추가됩니다"}</div>`;
      return `<button class="year-card ${avail ? "" : "locked"}" ${avail ? `data-action="open-exam" data-subject="${subjectId}" data-year="${y}"` : `data-action="locked"`}>
        ${badge}
        <div class="yr">${y}</div>
        ${scoreLine}
      </button>`;
    }).join("");

    view.className = "view noTab";
    view.innerHTML = `
      <div class="appbar">
        <button class="iconbtn" data-action="back">‹</button>
        <div style="flex:1"><div class="title">${s.icon} ${s.name}</div><div class="sub">국가직 9급 · 연도별 기출 (20문항)</div></div>
      </div>
      <div class="year-grid">${cards}</div>`;
  }

  /* ---------------- exam mode sheet ---------------- */
  function openModeSheet(subject, year) {
    const s = Data.subject(subject);
    const p = Store.getExam(`${subject}/${year}`);
    const best = bestAttempt(p);
    openSheet(`
      <div class="grab"></div>
      <h3>${s.name} ${year}</h3>
      <div class="sub">${best ? `최고 기록 ${best.score}/${best.total}점` : "20문항 · 첫 도전!"}</div>
      <button class="mode-btn" data-action="start" data-subject="${subject}" data-year="${year}" data-mode="study">
        <span class="e">📚</span>
        <div><div class="nm">학습 모드</div><div class="ds">한 문제씩 풀고 바로 정답·해설 확인</div></div>
      </button>
      <button class="mode-btn" data-action="start" data-subject="${subject}" data-year="${year}" data-mode="test">
        <span class="e">⏱️</span>
        <div><div class="nm">실전 모드</div><div class="ds">20문항 다 풀고 채점 (시험처럼)</div></div>
      </button>`);
  }

  /* ---------------- quiz engine ---------------- */
  function buildSession({ examId, exam, mode, questions, persist = true, resume = false, revealAll = false, startIdx = 0, title }) {
    const qs = (questions || exam.questions).map(q => Object.assign({}, q, {
      qid: q._qid || qid(exam.subject, exam.year, q.no),
      _subject: q._subject || exam.subject,
      _year: q._year || exam.year,
    }));
    const sess = {
      examId, exam, mode, title: title || (exam ? `${exam.subjectName} ${exam.year}` : "연습"),
      questions: qs, idx: startIdx, picks: {}, revealed: new Set(),
      startTime: Date.now(), persist,
    };
    if (resume && examId) {
      const sv = Store.getExam(examId);
      if (sv && sv.inProgress) {
        sess.picks = Object.assign({}, sv.picks || {});
        sess.idx = Math.min(sv.idx || 0, qs.length - 1);
        if (mode === "study") Object.keys(sess.picks).forEach(no => sess.revealed.add(+no));
      }
    }
    if (revealAll) qs.forEach(q => sess.revealed.add(q.no));
    State.session = sess;
    return sess;
  }

  async function startExam(subject, year, mode) {
    const examId = `${subject}/${year}`;
    if (!Data.available(examId)) { toast("아직 준비 중인 회차예요"); location.hash = "#/subject/" + subject; return; }
    view.className = "view"; view.innerHTML = skeletonQuiz();
    let exam;
    try { exam = await Data.getExam(subject, year); }
    catch (e) { view.innerHTML = errorBox(e); return; }
    const s = State.session;
    if (!s || s.examId !== examId || s.mode !== mode || s._navInternal !== true) {
      buildSession({ examId, exam, mode, resume: true });
    }
    // __DEMO__ (screenshot helper; remove in production)
    const dp = new URLSearchParams(location.search);
    if (dp.has("reveal") && State.session) {
      const n = parseInt(dp.get("reveal"), 10) || 1;
      const q = State.session.questions.find(x => x.no === n) || State.session.questions[0];
      State.session.idx = State.session.questions.indexOf(q);
      State.session.picks[q.no] = dp.get("pick") ? +dp.get("pick") : q.answer;
      State.session.revealed.add(q.no);
    }
    // __ENDDEMO__
    renderQuiz();
  }

  function persistSession() {
    const s = State.session;
    if (!s || !s.persist || !s.examId) return;
    Store.saveInProgress(s.examId, { mode: s.mode, idx: s.idx, picks: s.picks, inProgress: true, lastTouched: Date.now() });
  }

  function curScore() {
    const s = State.session;
    return s.questions.reduce((n, q) => n + (s.picks[q.no] === q.answer ? 1 : 0), 0);
  }

  function renderQuiz() {
    const s = State.session;
    if (!s) { location.hash = "#/home"; return; }
    const q = s.questions[s.idx];
    const total = s.questions.length;
    const isStudy = s.mode === "study";
    const revealed = s.revealed.has(q.no);
    const pick = s.picks[q.no];
    const bookmarked = Store.isBookmarked(q.qid);

    const assets = (q.assets || []).map(a => {
      if (a.type === "box") return `<div class="asset"><div class="asset-box">${a.html}</div></div>`;
      if (a.type === "code") return `<div class="asset"><pre class="asset-code">${esc(a.text)}</pre></div>`;
      if (a.type === "table") return `<div class="asset"><div class="asset-table">${a.html}</div></div>`;
      if (a.type === "image") return `<div class="asset"><img class="asset-img" src="${a.src}" alt="${esc(a.alt || "")}" loading="lazy"></div>`;
      if (a.type === "note") return `<div class="asset-note">${a.html}</div>`;
      return "";
    }).join("");

    const choices = q.choices.map((c, i) => {
      const n = i + 1;
      let cls = "choice";
      if (revealed) {
        if (n === q.answer) cls += " correct";
        else if (pick === n) cls += " wrong";
      } else if (pick === n) cls += " selected";
      const dis = (isStudy && revealed) ? "disabled" : "";
      return `<button class="${cls}" ${dis} data-action="choose" data-no="${q.no}" data-choice="${n}">
        <span class="mk">${revealed && n === q.answer ? "✓" : (revealed && pick === n ? "✕" : circled[i])}</span>
        <span class="tx">${c}</span>
      </button>`;
    }).join("");

    let explainHtml = "";
    if (revealed) {
      const ok = pick === q.answer;
      explainHtml = `<div class="explain">
        <div class="head ${ok ? "ok" : "no"}">${ok ? "✅ 정답입니다!" : `❌ 오답 · 정답은 ${circled[q.answer - 1]}`}</div>
        <div class="body">${q.explanation || "해설 준비 중입니다."}</div>
      </div>`;
    }

    // actions
    let actions = "";
    if (isStudy) {
      const last = s.idx === total - 1;
      actions = `<div class="quiz-actions">
        ${s.idx > 0 ? `<button class="btn ghost" style="flex:0 0 92px" data-action="prev">이전</button>` : ""}
        ${revealed
          ? (last
            ? `<button class="btn" data-action="finish-study">${s.persist ? "결과 보기" : "완료"}</button>`
            : `<button class="btn" data-action="next">다음 문제 ›</button>`)
          : `<button class="btn secondary" data-action="reveal" data-no="${q.no}">정답·해설 보기</button>`}
      </div>`;
    } else {
      const last = s.idx === total - 1;
      const answered = Object.keys(s.picks).length;
      actions = `<div class="quiz-actions">
        ${s.idx > 0 ? `<button class="btn ghost" style="flex:0 0 92px" data-action="prev">이전</button>` : ""}
        ${last
          ? `<button class="btn" data-action="submit">제출하기 (${answered}/${total})</button>`
          : `<button class="btn" data-action="next">다음 ›</button>`}
      </div>
      <div class="section-title" style="margin-top:22px">문제 이동</div>
      <div class="palette">${s.questions.map((qq, i) => {
        let pcls = "pal";
        if (s.picks[qq.no]) pcls += " answered";
        if (i === s.idx) pcls += " cur";
        return `<button class="${pcls}" data-action="jump" data-idx="${i}">${qq.no}</button>`;
      }).join("")}</div>`;
    }

    view.className = "view";
    view.innerHTML = `
      <div class="quiz-top">
        <div class="row">
          <button class="iconbtn" data-action="quit-quiz">‹</button>
          <div class="info"><div class="nm">${s.title}</div><div class="ct">${s.idx + 1} / ${total} · ${isStudy ? "학습" : "실전"}</div></div>
          <button class="iconbtn fab-bm" data-action="bookmark" data-qid="${q.qid}"><span class="bmk ${bookmarked ? "on" : ""}">${bookmarked ? "★" : "☆"}</span></button>
        </div>
        <div class="qbar"><i style="width:${((s.idx + 1) / total) * 100}%"></i></div>
      </div>
      <div class="qcard">
        <div class="qnum">문 ${q.no}</div>
        <div class="qstem">${q.stem}</div>
        ${assets}
        <div class="choices">${choices}</div>
        ${explainHtml}
      </div>
      ${actions}`;
  }

  function skeletonQuiz() {
    return `<div class="quiz-top"><div class="qbar"></div></div>
      <div class="qcard"><div class="skel" style="height:18px;width:40%"></div>
      <div class="skel" style="height:60px;margin-top:14px"></div>
      ${[0,0,0,0].map(() => `<div class="skel" style="height:50px;margin-top:10px"></div>`).join("")}</div>`;
  }

  /* ---------------- quiz actions ---------------- */
  function choose(no, choice) {
    const s = State.session;
    const q = s.questions.find(x => x.no === no);
    if (s.mode === "study") {
      if (s.revealed.has(no)) return;
      s.picks[no] = choice;
      s.revealed.add(no);
      vibrate(choice === q.answer ? 12 : [8, 40, 8]);
      if (choice !== q.answer) Store.addWrong(q.qid, { subject: q._subject, year: q._year, no });
      else if (Store.isWrong(q.qid)) Store.removeWrong(q.qid); // mastered
      persistSession();
      renderQuiz();
    } else {
      s.picks[no] = choice;
      vibrate(8);
      persistSession();
      renderQuiz();
    }
  }

  function nextQ() { const s = State.session; if (s.idx < s.questions.length - 1) { s.idx++; persistSession(); renderQuiz(); } }
  function prevQ() { const s = State.session; if (s.idx > 0) { s.idx--; persistSession(); renderQuiz(); } }
  function jumpQ(i) { const s = State.session; s.idx = i; persistSession(); renderQuiz(); }
  function revealQ(no) {
    const s = State.session; s.revealed.add(no);
    if (s.picks[no] == null) s.picks[no] = 0; // viewed without answering
    renderQuiz();
  }

  function finishStudy() {
    const s = State.session;
    if (!s.persist) { history.back(); return; }
    completeExam();
  }
  function submitTest() {
    const s = State.session;
    const answered = Object.keys(s.picks).length;
    if (answered < s.questions.length) {
      if (!confirm(`아직 ${s.questions.length - answered}문제를 안 풀었어요. 그래도 제출할까요?`)) return;
    }
    completeExam();
  }
  function completeExam() {
    const s = State.session;
    const score = curScore();
    const total = s.questions.length;
    // record wrong notes for test mode
    if (s.mode === "test") {
      s.questions.forEach(q => {
        if (s.picks[q.no] === q.answer) { if (Store.isWrong(q.qid)) Store.removeWrong(q.qid); }
        else Store.addWrong(q.qid, { subject: q._subject, year: q._year, no: q.no });
      });
    }
    const completedAt = Date.now();
    if (s.persist && s.examId) {
      Store.saveAttempt(s.examId, {
        score, total, mode: s.mode, completedAt,
        durationMs: completedAt - s.startTime, inProgress: false, picks: s.picks, idx: s.idx,
      });
      s._lastResult = { score, total, durationMs: completedAt - s.startTime };
      location.hash = `#/result/${s.exam.subject}/${s.exam.year}`;
    } else {
      toast(`완료! ${score}/${total}`);
      history.back();
    }
  }

  function quitQuiz() {
    const s = State.session;
    if (s && s.mode === "test" && Object.keys(s.picks).length > 0 && s.persist) {
      // already persisted as in-progress; just leave
    }
    if (s && s.examId) location.hash = "#/subject/" + s.exam.subject;
    else history.back();
  }

  /* ---------------- RESULT ---------------- */
  async function renderResult(subject, year) {
    const exam = await Data.getExam(subject, year);
    const p = Store.getExam(`${subject}/${year}`);
    const last = p && p.attempts ? p.attempts[p.attempts.length - 1] : null;
    const sess = State.session;
    const result = (sess && sess._lastResult) ? sess._lastResult : (last ? { score: last.score, total: last.total, durationMs: last.durationMs || 0 } : null);
    if (!result) { location.hash = "#/subject/" + subject; return; }
    const picks = (p && p.picks) || (sess ? sess.picks : {});
    const pct = Math.round(result.score / result.total * 100);
    const C = 2 * Math.PI * 76;
    const off = C * (1 - pct / 100);
    const color = pct >= 80 ? "var(--correct)" : pct >= 50 ? "var(--gold)" : "var(--wrong)";
    const msg = pct >= 90 ? "🏆 완벽해요!" : pct >= 70 ? "👍 잘했어요!" : pct >= 50 ? "💪 조금만 더!" : "📖 복습이 필요해요";

    const reviews = exam.questions.map((q, i) => {
      const ok = picks[q.no] === q.answer;
      return `<button class="review-item" data-action="review-q" data-subject="${subject}" data-year="${year}" data-idx="${i}">
        <div class="ic ${ok ? "o" : "x"}">${ok ? "○" : "✕"}</div>
        <div class="q"><div class="t">${q.no}. ${esc(q.stem)}</div>
          <div class="s">${ok ? "정답" : `내 답 ${picks[q.no] ? circled[picks[q.no] - 1] : "—"} · 정답 ${circled[q.answer - 1]}`}</div></div>
        <span class="chev">›</span>
      </button>`;
    }).join("");

    view.className = "view noTab";
    view.innerHTML = `
      <div class="appbar"><button class="iconbtn" data-action="goto" data-route="#/subject/${subject}">‹</button>
        <div class="title">채점 결과</div></div>
      <div class="result-hero">
        <div class="ring">
          <svg width="168" height="168"><circle cx="84" cy="84" r="76" stroke="var(--surface-2)" stroke-width="14" fill="none"/>
          <circle cx="84" cy="84" r="76" stroke="${color}" stroke-width="14" fill="none" stroke-linecap="round"
            stroke-dasharray="${C}" stroke-dashoffset="${off}"/></svg>
          <div class="ctr"><div><div class="sc" style="color:${color}">${pct}<span style="font-size:1.2rem">점</span></div><div class="of">${result.score} / ${result.total} 정답</div></div></div>
        </div>
        <div class="result-msg">${msg}</div>
      </div>
      <div class="result-stats">
        <div class="rstat"><div class="n" style="color:var(--correct)">${result.score}</div><div class="l">맞은 문제</div></div>
        <div class="rstat"><div class="n" style="color:var(--wrong)">${result.total - result.score}</div><div class="l">틀린 문제</div></div>
        <div class="rstat"><div class="n">${result.durationMs ? Math.round(result.durationMs / 60000) + "분" : "—"}</div><div class="l">소요 시간</div></div>
      </div>
      <div class="btn-row" style="margin-top:18px">
        <button class="btn secondary" data-action="open-exam" data-subject="${subject}" data-year="${year}">다시 풀기</button>
        <button class="btn" data-action="review-wrong" data-subject="${subject}" data-year="${year}">틀린 문제 복습</button>
      </div>
      <div class="section-title">문항별 결과</div>
      ${reviews}`;
  }

  /* ---------------- LIST (wrong / bookmarks) ---------------- */
  async function renderList(kind) {
    const isWrong = kind === "wrong";
    const map = isWrong ? Store.getWrong() : null;
    const ids = isWrong ? Object.keys(map) : Store.getBookmarks();
    view.className = "view";

    if (!ids.length) {
      view.innerHTML = `
        <div class="hero"><h1>${isWrong ? "📝 오답노트" : "⭐ 즐겨찾기"}</h1></div>
        <div class="empty"><div class="em">${isWrong ? "🎉" : "⭐"}</div>
          <div class="ti">${isWrong ? "틀린 문제가 없어요" : "저장한 문제가 없어요"}</div>
          <div class="ds">${isWrong ? "문제를 풀면 틀린 문제가 여기 모여요" : "문제 풀이 중 ☆를 눌러 저장하세요"}</div></div>`;
      return;
    }

    // load needed exams
    const need = [...new Set(ids.map(id => id.split("/").slice(0, 2).join("/")))];
    await Promise.all(need.map(e => { const [su, yr] = e.split("/"); return Data.getExam(su, yr).catch(() => null); }));

    const rows = ids.map(id => {
      const [su, yr, no] = id.split("/");
      const exam = Data.cache[`${su}/${yr}`];
      if (!exam) return "";
      const q = exam.questions.find(x => x.no == no);
      if (!q) return "";
      const s = Data.subject(su);
      const w = isWrong ? map[id] : null;
      return `<button class="list-row" data-action="practice-one" data-id="${id}">
        <span class="tag" style="color:${s.color}">${s.short} ${yr}</span>
        <div class="q"><div class="t">${q.no}. ${esc(q.stem)}</div>
          <div class="s">${isWrong ? `${w.count}번 틀림` : "저장됨"} · ${circled[q.answer - 1]} 정답</div></div>
        <span class="chev">›</span>
      </button>`;
    }).join("");

    view.innerHTML = `
      <div class="hero"><h1>${isWrong ? "📝 오답노트" : "⭐ 즐겨찾기"}</h1>
        <p>${ids.length}문제 ${isWrong ? "· 맞히면 자동으로 사라져요" : "저장됨"}</p></div>
      <button class="btn" data-action="practice-set" data-kind="${kind}">전체 다시 풀기 (${ids.length}문제)</button>
      <div style="margin-top:6px">${rows}</div>`;
  }

  async function practiceSet(kind) {
    const ids = kind === "wrong" ? Object.keys(Store.getWrong()) : Store.getBookmarks();
    const qs = await collectQuestions(ids);
    if (!qs.length) { toast("문제가 없어요"); return; }
    State.session = null;
    buildSession({ examId: null, exam: null, mode: "study", questions: qs, persist: false, title: kind === "wrong" ? "오답 복습" : "즐겨찾기 복습" });
    location.hash = "#/practice";
  }
  async function practiceOne(id) {
    const qs = await collectQuestions([id]);
    if (!qs.length) { toast("문제를 찾을 수 없어요"); return; }
    buildSession({ examId: null, exam: null, mode: "study", questions: qs, persist: false, title: "복습" });
    location.hash = "#/practice";
  }
  async function collectQuestions(ids) {
    const need = [...new Set(ids.map(id => id.split("/").slice(0, 2).join("/")))];
    await Promise.all(need.map(e => { const [su, yr] = e.split("/"); return Data.getExam(su, yr).catch(() => null); }));
    const out = [];
    ids.forEach(id => {
      const [su, yr, no] = id.split("/");
      const exam = Data.cache[`${su}/${yr}`];
      if (!exam) return;
      const q = exam.questions.find(x => x.no == no);
      if (q) out.push(Object.assign({}, q, { _qid: id, _subject: su, _year: +yr }));
    });
    return out;
  }

  /* ---------------- STATS ---------------- */
  function renderStats() {
    const prog = Store.getProgress();
    let exams = 0, totalQ = 0, correct = 0;
    const bySubj = {};
    Data.index.subjects.forEach(s => bySubj[s.id] = { exams: 0, q: 0, c: 0 });
    for (const [id, p] of Object.entries(prog)) {
      const best = bestAttempt(p);
      if (!best) continue;
      const su = id.split("/")[0];
      if (!bySubj[su]) continue;
      exams++; totalQ += best.total; correct += best.score;
      bySubj[su].exams++; bySubj[su].q += best.total; bySubj[su].c += best.score;
    }
    const acc = totalQ ? Math.round(correct / totalQ * 100) : 0;
    const wrongCount = Object.keys(Store.getWrong()).length;
    const bmCount = Store.getBookmarks().length;

    const subjRows = Data.index.subjects.map(s => {
      const b = bySubj[s.id];
      const a = b.q ? Math.round(b.c / b.q * 100) : 0;
      return `<div class="subj-stat">
        <div class="nm">${s.icon} ${s.name}</div>
        <div class="bar"><i style="width:${a}%;background:${s.color}"></i></div>
        <span class="pct">${b.exams ? a + "%" : "—"}</span>
      </div>`;
    }).join("");

    view.className = "view";
    view.innerHTML = `
      <div class="hero"><h1>📊 학습 통계</h1></div>
      <div class="stat-card">
        <div class="stat-big">
          <div class="cell"><div class="n">${exams}</div><div class="l">응시 회차</div></div>
          <div class="cell"><div class="n" style="color:var(--primary)">${acc}%</div><div class="l">평균 정답률</div></div>
          <div class="cell"><div class="n">${correct}</div><div class="l">맞힌 문제</div></div>
        </div>
      </div>
      <div class="section-title">과목별 정답률</div>
      <div class="stat-card">${subjRows}</div>
      <div class="quick-row" style="margin-top:16px">
        <button class="quick" data-action="goto" data-route="#/wrong"><div class="n" style="color:var(--wrong)">${wrongCount}</div><div class="l">오답 문제</div></button>
        <button class="quick" data-action="goto" data-route="#/bookmarks"><div class="n" style="color:var(--gold)">${bmCount}</div><div class="l">즐겨찾기</div></button>
      </div>`;
  }

  /* ---------------- SETTINGS ---------------- */
  function renderSettings() {
    const s = Store.getSettings();
    const scales = [["작게", 0.92], ["보통", 1], ["크게", 1.12], ["아주 크게", 1.25]];
    view.className = "view";
    view.innerHTML = `
      <div class="hero"><h1>⚙️ 설정</h1></div>
      <div class="set-row">
        <div class="lb"><div class="t">🌙 다크 모드</div><div class="d">어두운 화면으로 눈 편하게</div></div>
        <button class="switch ${s.theme === "dark" ? "on" : ""}" data-action="toggle-theme"><i></i></button>
      </div>
      <div class="set-row">
        <div class="lb"><div class="t">🔤 글자 크기</div><div class="d">읽기 편한 크기로 조절</div></div>
      </div>
      <div class="seg" style="width:100%;margin-top:-4px">
        ${scales.map(([nm, v]) => `<button class="${Math.abs((s.fontScale || 1) - v) < 0.01 ? "active" : ""}" style="flex:1" data-action="font" data-v="${v}">${nm}</button>`).join("")}
      </div>
      <div class="section-title">데이터</div>
      <div class="set-row" data-action="export">
        <div class="lb"><div class="t">⬇️ 학습 기록 내보내기</div><div class="d">진도·오답노트 백업 (JSON)</div></div>
        <span class="chev">›</span>
      </div>
      <div class="set-row" data-action="reset">
        <div class="lb"><div class="t" style="color:var(--wrong)">🗑️ 학습 기록 초기화</div><div class="d">모든 진도·오답·즐겨찾기 삭제</div></div>
        <span class="chev">›</span>
      </div>
      <div class="empty" style="padding:30px 10px 10px"><div class="ds">9급 기출 마스터 · v1.0<br>국가직 9급 컴퓨터직 기출 (2016~2025)<br>정답: 인사혁신처 공식 정답표 기준</div></div>`;
  }

  /* ---------------- action delegation ---------------- */
  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-action]");
    if (!el) return;
    const a = el.dataset.action;
    const d = el.dataset;
    switch (a) {
      case "goto": location.hash = d.route; break;
      case "back": history.length > 1 ? history.back() : (location.hash = "#/home"); break;
      case "open-exam": closeSheet(); openModeSheet(d.subject, d.year); break;
      case "locked": toast("아직 준비 중인 회차예요 🙏"); break;
      case "start":
        closeSheet();
        State.session = null;
        location.hash = `#/quiz/${d.subject}/${d.year}/${d.mode}`;
        break;
      case "resume": {
        const [su, yr] = d.id.split("/");
        const p = Store.getExam(d.id);
        State.session = null;
        location.hash = `#/quiz/${su}/${yr}/${(p && p.mode) || "study"}`;
        break;
      }
      case "choose": choose(+d.no, +d.choice); break;
      case "reveal": revealQ(+d.no); break;
      case "next": nextQ(); break;
      case "prev": prevQ(); break;
      case "jump": jumpQ(+d.idx); break;
      case "finish-study": finishStudy(); break;
      case "submit": submitTest(); break;
      case "quit-quiz": quitQuiz(); break;
      case "bookmark": {
        const on = Store.toggleBookmark(d.qid);
        const star = el.querySelector(".bmk");
        if (star) { star.textContent = on ? "★" : "☆"; star.classList.toggle("on", on); }
        toast(on ? "즐겨찾기에 추가했어요 ⭐" : "즐겨찾기에서 뺐어요");
        vibrate(10);
        break;
      }
      case "review-q": {
        Data.getExam(d.subject, d.year).then(exam => {
          buildSession({ examId: null, exam, mode: "study", persist: false, revealAll: true, startIdx: +d.idx, title: `${exam.subjectName} ${exam.year} 복습` });
          location.hash = "#/practice";
        });
        break;
      }
      case "review-wrong": {
        Data.getExam(d.subject, d.year).then(exam => {
          const p = Store.getExam(`${d.subject}/${d.year}`);
          const picks = (p && p.picks) || {};
          const wrongQs = exam.questions.filter(q => picks[q.no] !== q.answer);
          if (!wrongQs.length) { toast("틀린 문제가 없어요 🎉"); return; }
          buildSession({ examId: null, exam, mode: "study", questions: wrongQs, persist: false, title: `${exam.subjectName} ${exam.year} 오답복습` });
          location.hash = "#/practice";
        });
        break;
      }
      case "practice-set": practiceSet(d.kind); break;
      case "practice-one": practiceOne(d.id); break;
      case "toggle-theme": {
        const cur = Store.getSettings().theme;
        Store.setSetting("theme", cur === "dark" ? "light" : "dark");
        applySettings(); renderSettings(); break;
      }
      case "font": Store.setSetting("fontScale", +d.v); applySettings(); renderSettings(); break;
      case "export": exportData(); break;
      case "reset":
        if (confirm("정말 모든 학습 기록을 삭제할까요?\n(진도·오답노트·즐겨찾기가 모두 지워집니다)")) {
          Store.resetAll(); toast("초기화되었습니다"); renderSettings();
        }
        break;
    }
  });

  function exportData() {
    const data = {
      progress: Store.getProgress(), bookmarks: Store.getBookmarks(),
      wrong: Store.getWrong(), exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const aTag = document.createElement("a");
    aTag.href = url; aTag.download = "9급기출_학습기록.json"; aTag.click();
    URL.revokeObjectURL(url);
    toast("백업 파일을 저장했어요");
  }

  /* ---------------- swipe (quiz nav) ---------------- */
  let tsx = 0, tsy = 0;
  document.addEventListener("touchstart", (e) => { if (!State.session) return; tsx = e.touches[0].clientX; tsy = e.touches[0].clientY; }, { passive: true });
  document.addEventListener("touchend", (e) => {
    if (!State.session || !location.hash.startsWith("#/")) return;
    if (!location.hash.includes("quiz") && !location.hash.includes("practice")) return;
    const dx = e.changedTouches[0].clientX - tsx;
    const dy = e.changedTouches[0].clientY - tsy;
    if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.8) {
      if (dx < 0) nextQ(); else prevQ();
    }
  }, { passive: true });

  /* ---------------- boot ---------------- */
  applySettings();
  window.addEventListener("hashchange", route);
  route();

  // service worker
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
  }
})();
