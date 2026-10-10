/* SUBJECT（科目ごとの設定）と SUBJECT_DATA（問題データの束）は build.js が先に埋め込む */
const SPFX = "gq_" + (SUBJECT.storagePrefix || "");   // localStorage キーの接頭辞
const HAS_TOPICS = !!SUBJECT.topics;
const FIELD_WEIGHTS = SUBJECT.fieldWeights || null;
const DEFAULT_SET = (SUBJECT.sets.filter(function (d) { return d.default; })[0] || SUBJECT.sets[0]).key;
const Q = [];

const LETTERS = ["1","2","3","4","5"];
/* 解説の根拠の質。誤った知識を覚えないよう、どこまで裏を取ったかを明示する */
const VLABEL = {
  primary:   "◎ 白書・法令・告示など一次資料で確認",
  answer:    "○ 公開正答表との突合により確定",
  calc:      "○ 計算で検算済み（式・定義は教科書・規格どおり）",
  textbook:  "△ 教科書の基本事項（独立した解き直しで正解を確認。規格・一次資料の本文は未確認）",
  knowledge: "△ 教科書的知識にもとづく記述（一次資料は未確認。テキストでの確認を推奨）"
};
let i = 0, correct = 0, answered = false;
const log = [];
const answers = [];
/* 回の最後に、間違えた問題をもう一度出す（記録はしない）。RETRY_FROM はその開始位置。-1 は未追加 */
let RETRY_FROM = -1;
function inRetry() { return RETRY_FROM >= 0 && i >= RETRY_FROM; }
function origCount() { return RETRY_FROM >= 0 ? RETRY_FROM : Q.length; }
function wrongOriginals() {
  const out = [];
  for (let k = 0; k < origCount(); k++) if (answers[k] && !answers[k].hit) out.push(Q[k]);
  return out;
}
function appendRetries() {
  if (RETRY_FROM >= 0) return;
  const w = wrongOriginals();
  if (!w.length) return;
  RETRY_FROM = Q.length;
  w.forEach(function (q) { Q.push(q); });
}

const stage = document.getElementById("stage");
const elField = document.getElementById("field");
const elCount = document.getElementById("count");
const elScore = document.getElementById("score");
const elBar = document.getElementById("bar");

function shuffle(n, seed) {
  // 決定論的シャッフル（問題ごとに選択肢の並びを変える）
  // 掛け算は Math.imul で32bitに収める。普通の * だと2^53を超えて下位ビットが消え、
  // 4択の正答がすべて④に固定されていた（2026-09-25 修正）
  const idx = [...Array(n).keys()];
  for (let k = n - 1; k > 0; k--) {
    seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
    const j = Math.floor(seed / 4294967296 * (k + 1));
    [idx[k], idx[j]] = [idx[j], idx[k]];
  }
  return idx;
}

function render() {
  AT_HOME = false;
  setQuizChrome(true);
  document.body.classList.remove("home-mode");
  const hb = document.getElementById("homeBottom");
  if (hb) hb.innerHTML = "";
  if (i >= Q.length) return renderResult();
  const q = Q[i];
  let seed = 0;
  for (let k = 0; k < q.q.length; k++) seed = (seed * 31 + q.q.charCodeAt(k)) & 0x7fffffff;
  const order = shuffle(q.c.length, seed);
  const prev = answers[i];
  answered = !!prev;

  elField.textContent = q.f;
  elCount.textContent = inRetry() ? "もう一度 " + (i - RETRY_FROM + 1) + " / " + (Q.length - RETRY_FROM) : (i + 1) + " / " + origCount();
  elScore.innerHTML = "正解 <b>" + correct + "</b>";
  elBar.style.width = (i / Q.length * 100) + "%";

  const card = document.createElement("div");
  card.className = "card";
  const h = histOf(q);
  let badge = '';
  if (h) {
    badge = '<span class="hist">これまで ' + h.n + '回中 ' + h.ok + '回正解</span>';
    if (h.last === 0) badge += '<span class="flagmark">前回まちがえた</span>';
    else badge += '<span class="mst m' + mastery(q) + '">' + MASTERY[mastery(q)] + '</span>';
  }
  const bm = isBookmarked(q);
  card.innerHTML =
    '<div class="qmeta"><span class="qn">Q' + (i + 1) + '</span>' + badge +
      '<span class="qtools">' +
        '<button type="button" class="qtool" id="bmTog" aria-pressed="' + bm + '">' + bmLabel(bm) + '</button>' +
        '<button type="button" class="qtool" id="memoTog" aria-expanded="false" aria-controls="memoBox"></button>' +
      '</span></div>' +
    whyChips(whyOf(q)) +
    '<p class="qt"></p><p class="qh"></p><div class="choices"></div>' +
    '<div class="memo" id="memoBox" hidden>' +
      '<label for="memoTa">メモ（この端末に自動で保存されます）</label>' +
      '<textarea id="memoTa" rows="3" placeholder="覚え方、間違えた理由など"></textarea>' +
      '<div class="saved" aria-live="polite"></div>' +
    '</div>';
  card.querySelector(".qt").textContent = q.q.replace(/<br>/g, "\n");
  card.querySelector(".qh").textContent = q.h;
  wireNoteTools(card, q);

  const box = card.querySelector(".choices");
  order.forEach((origIdx, pos) => {
    const b = document.createElement("button");
    b.className = "ch";
    b.type = "button";
    b.innerHTML = '<span class="key">' + LETTERS[pos] + '</span><span></span>';
    b.lastChild.textContent = q.c[origIdx];
    b.dataset.orig = origIdx;
    b.addEventListener("click", () => choose(card, b, origIdx));
    box.appendChild(b);
  });
  // 1つも消去できないときだけ使う。当てずっぽうの正解で「覚えた」扱いにならないよう、不正解として記録する
  const dk = document.createElement("button");
  dk.className = "dk";
  dk.type = "button";
  dk.textContent = "わからない";
  dk.addEventListener("click", () => choose(card, dk, -1));
  box.appendChild(dk);

  stage.replaceChildren(card);

  if (prev) {
    // 解答済みの問題に戻ってきた場合は、そのときの状態を復元する
    const btn = prev.pick === -1 ? card.querySelector(".dk") : Array.prototype.find.call(card.querySelectorAll(".ch"),
      b => Number(b.dataset.orig) === prev.pick);
    showVerdict(card, btn, prev.hit, false);
  } else {
    renderNav(card);
  }
  window.scrollTo({ top: 0, behavior: "instant" });
}

/* 前へ／次へのナビゲーション。解答前でも「前へ」で戻れる */
/* 解答前も解答後も「← 前の問題／ホーム／次の問題 →」を同じ位置に出す */
/* 解答前は「とばす」扱い（控えめな見た目・Enterでは押されない）、解答後は通常の「次へ」 */
function navHtml(answeredNow) {
  const label = i + 1 < Q.length ? "次の問題 →" : (RETRY_FROM < 0 && wrongOriginals().length ? "間違えた問題をもう一度 →" : "結果を見る");
  return '<div class="navrow one">' +
      (answeredNow
        ? '<button class="btn" id="next">' + label + '</button>'
        : '<button class="btn ghost" id="skip">' + label + '</button>') +
    '</div>' +
    '<div class="navrow two">' +
      '<button class="btn ghost" id="prev"' + (i > 0 ? '' : ' disabled') + '>← 前の問題</button>' +
      '<button class="btn ghost" id="home">ホーム</button>' +
    '</div>';
}
function wireNav(el) {
  el.querySelector("#prev").addEventListener("click", goPrev);
  el.querySelector("#home").addEventListener("click", goHome);
  const nb = el.querySelector("#next");
  if (nb) nb.addEventListener("click", goNext);
  const sk = el.querySelector("#skip");
  if (sk) sk.addEventListener("click", goNext);
  return nb;
}
function renderNav(card) {
  const old = card.querySelector(".nav");
  if (old) old.remove();
  const nav = document.createElement("div");
  nav.className = "qnav nav";
  nav.innerHTML = navHtml(false);
  card.insertBefore(nav, card.querySelector(".memo"));
  wireNav(nav);
}
function goPrev() { if (i > 0) { i--; saveSession(); render(); } }
function goNext() { i++; if (i >= Q.length) appendRetries(); saveSession(); render(); }
/* 科目が resultJudge を持たないときの結果コメント（正答率の下限ごと） */
const DEFAULT_JUDGE = [
  { min: 90, text: "仕上がっています。間違えた問題だけ見直して、定着させてください。" },
  { min: 70, text: "あと一歩です。間違えた問題だけ回し直せば固まります。" },
  { min: 50, text: "曖昧なところが残っています。解説を読み直してから、もう一度解いてください。" },
  { min: 0,  text: "まず解説を読んで、正解の根拠を確認してから解き直しましょう。" }
];
/* ---------- 合格までの道のり（本番日と期日の目安） ---------- */
/* 受験日はホーム画面から変更でき、この端末に保存する。未設定・壊れた値は既定日にフォールバック */
const EKEY = SPFX + "exam_day";
function pad2(x) { return String(x).padStart(2, "0"); }
function ymd(d) { return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()); }
function mdLabel(d) { return (d.getMonth() + 1) + "/" + d.getDate(); }
function mdJp(d) { return (d.getMonth() + 1) + "月" + d.getDate() + "日"; }
function addDays(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
/* "YYYY-MM-DD" 以外・2/30のような存在しない日付はnullを返す（new Dateは繰り上げて解釈してしまうため） */
function parseYmd(s) {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const parts = s.split("-").map(Number);
  const y = parts[0], m = parts[1], dd = parts[2];
  const d = new Date(y, m - 1, dd);
  if (d.getFullYear() !== y || d.getMonth() !== m - 1 || d.getDate() !== dd) return null;
  return d;
}
const EXAM_DAY_DEFAULT = parseYmd(SUBJECT.examDayDefault);
function loadExamDay() {
  try {
    const d = parseYmd(localStorage.getItem(EKEY));
    if (d) return d;
  } catch (e) {}
  return new Date(EXAM_DAY_DEFAULT);
}
let EXAM_DAY = loadExamDay();
let RM_ROUND1, RM_RATE, RM_FINAL;
function computeRoadmapDates() {
  RM_ROUND1 = addDays(EXAM_DAY, -38);  // 全問1周
  RM_RATE = addDays(EXAM_DAY, -21);    // 正答率70%・測定分析の見直し
  RM_FINAL = addDays(EXAM_DAY, -14);   // 以降は苦手とブックマークだけ
}
computeRoadmapDates();
function setExamDay(s) {
  const d = parseYmd(s);
  if (!d) return false;
  EXAM_DAY = d;
  computeRoadmapDates();
  try { localStorage.setItem(EKEY, s); } catch (e) {}
  return true;
}
function todayMid() { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function daysLeft() { return Math.round((EXAM_DAY - todayMid()) / 86400000); }
/* 正答率は「直近の解答で正解している問題の割合」。累計だと最初の失点をいつまでも引きずるため */
function progressNow() {
  const all = verifiedOnly(SETS.all);
  let done = 0, ok = 0, md = 0, mo = 0;
  all.forEach(function (q) {
    const h = histOf(q);
    if (!h) return;
    done++; if (h.last === 1) ok++;
    if (SUBJECT.focusField && q.f === SUBJECT.focusField) { md++; if (h.last === 1) mo++; }
  });
  return { total: all.length, done: done, rate: done ? ok / done : null, mRate: md ? mo / md : null };
}
function pct(x) { return x === null ? "—" : Math.round(x * 100) + "%"; }
let RM_ACTIONS = [];
/* 科目ごとの「迷ったときの絞り込み方」。設定がない科目には出さない */
function renderRoadmapTips() {
  const T = SUBJECT.roadmapTips;
  if (!T) return "";
  let steps = "";
  T.steps.forEach(function (x) {
    steps += '<li class=""><span class="d">' + x[0] + '</span><span class="t">' + x[1] + '</span><span class="v">' + x[2] + '</span></li>';
  });
  return '<details><summary>' + T.summary + '</summary><ol class="rm-steps">' + steps + '</ol>' +
    (T.note ? '<p class="rm-note">' + T.note + '</p>' : '') + '</details>';
}
function renderRoadmap() {
  const today = todayMid(), p = progressNow(), left = daysLeft();
  if (left < 0) return "";
  const allDone = p.done >= p.total;
  const st = function (cls, word) { return { c: cls, w: word }; };
  const s1 = allDone ? st("done", "達成") : today > RM_ROUND1 ? st("late", "遅れ") : st("now", "いまここ");
  const s2 = (allDone && p.rate >= 0.7) ? st("done", "達成") : today > RM_RATE ? st("late", "遅れ") : allDone ? st("now", "いまここ") : st("todo", "");
  const s3 = today < RM_RATE ? st("todo", "")
    : (p.mRate !== null && p.mRate < 0.5) ? st("now", "絞る") : st("done", "不要");
  const s4 = today >= RM_FINAL ? st("now", "いまここ") : st("todo", "");
  const li = function (s, d, t, v) {
    return '<li class="' + s.c + '"><span class="d">' + d + '</span><span class="t">' + t +
      (s.w ? '<span class="st">' + s.w + '</span>' : '') + '</span>' + (v ? '<span class="v">' + v + '</span>' : '') + '</li>';
  };
  const tip = function (d, t, v) { return li({ c: "", w: "" }, d, t, v); };

  // 次にやること
  const weak = weakList(), freq = verifiedOnly(SETS.all).filter(function (q) { return whyOf(q).tier >= 2; });
  RM_ACTIONS = [];
  if (today >= RM_FINAL && weak.length) {
    RM_ACTIONS.push({ label: "苦手を解く", sub: weak.length + "問・直近でまちがえた／正答率6割未満", list: weak });
  } else if (!allDone) {
    const un = verifiedOnly(SETS.all).filter(function (q) { return !histOf(q); });
    RM_ACTIONS.push({ label: "まだ解いていない問題を解く", sub: "残り " + un.length + "問（頻出論点から先に出します）", list: un, limit: 20 });
  } else if (p.rate < 0.7) {
    const top = fieldStats().filter(function (r) { return r.loss !== null; })[0];
    if (top) RM_ACTIONS.push({ label: top.f + " を解く", sub: "いちばん点を落としている分野（正答率" + pct(top.rate) + "・" + (FIELD_WEIGHTS ? "本番で年" + top.weight + "問" : "収録の" + Math.round(top.weight * 100) + "%") + "）",
      list: verifiedOnly(SETS.all).filter(function (q) { return q.f === top.f; }) });
  } else if (weak.length) {
    RM_ACTIONS.push({ label: "苦手を解く", sub: weak.length + "問", list: weak });
  }
  if (freq.length) RM_ACTIONS.push({ label: "★ 頻出論点だけ解く", sub: freq.length + "問・過去7年で2回以上出た論点。まずここを固める", list: freq, ghost: true });

  let btns = "";
  RM_ACTIONS.forEach(function (a, k) {
    btns += '<button class="btn' + (a.ghost ? ' ghost' : '') + '" data-rm="' + k + '">' + a.label + '<span class="sub">' + a.sub + '</span></button>';
  });

  return '<div class="roadmap"><h3>合格までの道のり</h3>' +
    '<p class="rm-lead">本番まであと<b>' + left + '日</b>。' + (SUBJECT.roadmapLead || "") + '</p>' +
    '<details><summary>期日ごとの目安を見る</summary><ol class="rm-steps">' +
      li(s1, "〜" + mdLabel(RM_ROUND1), "全問を1周する", "解いた問題 " + p.done + " / " + p.total) +
      li(s2, "〜" + mdLabel(RM_RATE), "正答率を70%以上にする", "いま " + pct(p.rate) + "（直近の解答で正解している割合）") +
      (SUBJECT.focusField ? li(s3, mdLabel(RM_RATE), SUBJECT.focusField + "が50%未満なら、頻出論点だけに絞る", SUBJECT.focusField + " いま " + pct(p.mRate)) : "") +
      li(s4, mdLabel(RM_FINAL) + "〜", "新しい範囲は増やさず、苦手とブックマークだけを回す", "") +
      li(st(left === 0 ? "now" : "todo", left === 0 ? "今日" : ""), mdLabel(EXAM_DAY), "本番", "") +
    '</ol></details>' +
    renderRoadmapTips() +
    '<div class="rm-next"><p class="lab">次にやること</p>' + btns + '</div></div>';
}
function wireRoadmap(card) {
  card.querySelectorAll("[data-rm]").forEach(function (b) {
    b.addEventListener("click", function () {
      const a = RM_ACTIONS[Number(b.dataset.rm)];
      if (!a || !a.list.length) return;
      // 頻出論点から先に出す（同じ段の中は毎回シャッフル）
      const byTier = [5, 4, 3, 2, 1].map(function (r) { return shuffled(a.list.filter(function (q) { return whyOf(q).rank === r; })); });
      let list = [].concat.apply([], byTier);
      if (a.limit) list = list.slice(0, a.limit);
      Q.length = 0; RETRY_FROM = -1; list.forEach(function (q) { Q.push(q); });
      CUSTOM_LIST = list.slice(); CURRENT_SET = "custom";
      i = 0; correct = 0; log.length = 0; answers.length = 0;
      applySetButtons("__none__");
      document.getElementById("pickinfo").textContent = "";
      saveSession(); render();
    });
  });
}
function passLineHtml() {
  return SUBJECT.passLine ? '<br><span class="cd2">合格ライン：' + SUBJECT.passLine + '</span>' : "";
}
function renderCountdown() {
  const el = document.getElementById("countdown");
  if (!el) return;
  const left = daysLeft();
  const editBtn =
    '<button type="button" class="examEditBtn" id="examEditBtn" aria-expanded="false">' +
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20l1-4L16 5l3 3L8 19l-4 1z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/></svg>' +
      '変更' +
    '</button>';
  let textHtml;
  if (left > 0) {
    textHtml = '本番（' + mdJp(EXAM_DAY) + '）まで あと <span class="cd-days"><b>' + left + '</b>日</span>' + passLineHtml();
  } else if (left === 0) {
    textHtml = '<b>本番は今日です</b>' + passLineHtml();
  } else {
    textHtml = '<b>試験日を過ぎました</b>';
  }
  el.innerHTML =
    '<div class="countdown-row"><div class="countdown-text">' + textHtml + '</div>' + editBtn + '</div>' +
    '<div class="examEdit" id="examEdit" hidden>' +
      '<input type="date" id="examDate" value="' + ymd(EXAM_DAY) + '">' +
      '<button type="button" class="btn" id="examSave">保存</button>' +
      '<button type="button" class="btn ghost" id="examCancel">キャンセル</button>' +
    '</div>';
  wireExamEdit(el);
}
function wireExamEdit(el) {
  const editBtn = el.querySelector("#examEditBtn");
  const editRow = el.querySelector("#examEdit");
  const dateInput = el.querySelector("#examDate");
  const saveBtn = el.querySelector("#examSave");
  const cancelBtn = el.querySelector("#examCancel");
  editBtn.addEventListener("click", function () {
    const opening = editRow.hidden;
    editRow.hidden = !opening;
    editBtn.setAttribute("aria-expanded", String(opening));
    if (opening) dateInput.focus();
  });
  cancelBtn.addEventListener("click", function () {
    editRow.hidden = true;
    editBtn.setAttribute("aria-expanded", "false");
    dateInput.value = ymd(EXAM_DAY);
  });
  saveBtn.addEventListener("click", function () {
    const v = dateInput.value;
    if (!v || !setExamDay(v)) return;
    renderCountdown();
    if (AT_HOME) goHome();   // ホーム表示中は道のりの期日も描き直す（回を中断するだけなので壊れない）
  });
}

/* ---------- ホーム（出題範囲を選ぶ画面） ---------- */
/* いまの回は中断するだけで消さない。「続きから」で同じ問題に戻れる */
let AT_HOME = false;
const SET_LABEL = { all: SUBJECT.allSetLabel || "まとめて", imported: "過去問", weak: "苦手", bm: "ブックマーク", custom: "選んだ問題", auto: "おまかせ" };
SUBJECT.sets.forEach(function (d) { SET_LABEL[d.key] = d.short || d.label; });
/* 問題が1問もない科目（準備中）では、出題操作を隠して案内だけを出す */
function isEmptyApp() { return SETS.all.length === 0; }
function setQuizChrome(show) {
  document.querySelector(".status").hidden = !show;
  document.querySelector(".bar").hidden = !show;
}
function goHome() {
  const inProgress = Q.length > 0 && i < Q.length;
  if (inProgress) saveSession();
  AT_HOME = true;
  setQuizChrome(false);
  document.getElementById("resumeHost").innerHTML = "";
  applySetButtons("__none__");
  const pi = document.getElementById("pickinfo");
  if (pi) pi.textContent = "";

  const L = lifetimeStats();
  const card = document.createElement("div");
  card.className = "card homecard";
  const EMPTY = isEmptyApp();
  document.body.classList.toggle("empty-mode", EMPTY);
  card.innerHTML = EMPTY ? '<p class="empty-note"></p>' :
    renderAutoBlock() +
    (inProgress
      ? '<button class="btn wide" id="cont">続きから解く<span class="sub">' +
          (SET_LABEL[CURRENT_SET] || "前回の回") + '　' + (i + 1) + ' / ' + Q.length + '問目・正解 ' + correct + '</span></button>'
      : '') +
    renderTiles();
  const hb = document.getElementById("homeBottom");
  hb.innerHTML = EMPTY ? "" : '<div class="card homecard">' + renderRoadmap() + '</div>';
  stage.replaceChildren(card);
  if (EMPTY) card.querySelector(".empty-note").textContent = SUBJECT.emptyMessage || "問題を準備中です。";
  document.body.classList.add("home-mode");
  if (!EMPTY) {
    wireAutoBlock(card);
    wireRoadmap(hb);
  }
  const tw = card.querySelector("#tileWeak"), tb = card.querySelector("#tileBm");
  if (tw) tw.addEventListener("click", function () { document.getElementById("weakBtn").click(); });
  if (tb) tb.addEventListener("click", function () { document.getElementById("bmBtn").click(); });
  const c = card.querySelector("#cont");
  if (c) c.addEventListener("click", function () {
    applySetButtons(SETS[CURRENT_SET] || CURRENT_SET === "weak" || CURRENT_SET === "bm" || CURRENT_SET === "auto" ? CURRENT_SET : "__none__");
    updatePickInfo();
    render();
  });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function choose(card, btn, origIdx) {
  if (answered) return;
  answered = true;
  const q = Q[i];
  const hit = origIdx === q.a;
  if (!inRetry()) {
    if (hit) correct++;
    recordAnswer(q, hit);
    log.push({ f: q.f, hit: hit, q: q.q, a: q.c[q.a] });
  }
  answers[i] = { pick: origIdx, hit: hit };
  saveSession();
  showVerdict(card, btn, hit, true);
}

/* 専門外の人向けの「やさしい解説」。問題文をキーに別ファイル（easy.js の EASY_NOTES）から引く */
function easyHtml(q) {
  const t = ((window.EASY_NOTES && window.EASY_NOTES[q.q]) || "").replace(/<b>(ひとことで|用語|考え方|覚え方)<\/b>\s*/g, '<span class="ezh">$1</span>');
  return t ? '<div class="easy"><div class="easyh">やさしい解説</div><div class="easyb">' + t + '</div></div><div class="vnoteh">詳しい解説（出典つき）</div>' : "";
}
function showVerdict(card, btn, hit, focusNext) {
  const q = Q[i];
  card.querySelectorAll(".ch").forEach(b => {
    b.disabled = true;
    const oi = Number(b.dataset.orig);
    if (oi === q.a) b.classList.add("ok");
    else if (b === btn) b.classList.add("ng");
    else b.classList.add("dim");
  });
  const dkb = card.querySelector(".dk");
  const unknown = !!btn && btn === dkb;
  if (dkb) { dkb.disabled = true; if (unknown) dkb.classList.add("on"); else dkb.hidden = true; }

  const oldNav = card.querySelector(".nav");
  if (oldNav) oldNav.remove();

  const v = document.createElement("div");
  v.className = "verdict";
  v.innerHTML =
    '<div class="vtag ' + (hit ? "ok" : "ng") + '">' + (inRetry() ? (hit ? "もう一度：正解（記録はしません）" : "もう一度：不正解（明日の復習で出ます）") : hit ? "正解" : unknown ? "わからない（不正解として記録し、復習に回します）" : "不正解") + '</div>' +
    easyHtml(q) +
    '<p class="vnote">' + q.n + '</p>' +
    whyBox(q, whyOf(q)) +
    (q.v ? '<p class="vsrc' + (q.v === "knowledge" ? " k" : "") + '">' + VLABEL[q.v] + '</p>' : '') +
    '<div class="qnav">' + navHtml(true) + '</div>' +
    '<p class="hintkey">← → キーでも移動できます</p>';
  card.insertBefore(v, card.querySelector(".memo"));
  // 解答前はメモを閉じておく（答えを書いたメモが先に見えないように）。解答後に開く
  if (memoOf(q)) showMemo(card, true);
  const nb = wireNav(v);
  if (focusNext) nb.focus();
  elScore.innerHTML = "正解 <b>" + correct + "</b>";
}

function renderResult() {
  clearSession();
  elField.textContent = "結果";
  const N = origCount();
  elCount.textContent = N + " / " + N;
  elBar.style.width = "100%";

  const pct = Math.round(correct / N * 100);
  const byField = {};
  log.forEach(r => {
    byField[r.f] = byField[r.f] || { n: 0, ok: 0 };
    byField[r.f].n++;
    if (r.hit) byField[r.f].ok++;
  });

  let judge = "";
  (SUBJECT.resultJudge || DEFAULT_JUDGE).some(function (r) { if (pct >= r.min) { judge = r.text; return true; } return false; });

  let rows = "";
  Object.keys(byField).forEach(f => {
    const d = byField[f];
    const p = Math.round(d.ok / d.n * 100);
    rows += '<tr><td>' + f + '</td><td>' + d.ok + ' / ' + d.n +
      '<span class="mini"><i style="width:' + p + '%"></i></span></td><td>' + p + '%</td></tr>';
  });

  const missed = log.filter(r => !r.hit);
  const skipped = Q.slice(0, N).filter((q, k) => !answers[k]);
  let missedHtml = "";
  if (missed.length) {
    missedHtml = '<div class="missed"><h3>間違えた ' + missed.length + ' 問</h3><ol>';
    missed.forEach(r => { missedHtml += '<li>' + r.q + ' → <b>' + r.a + '</b></li>'; });
    missedHtml += '</ol></div>';
  }

  const card = document.createElement("div");
  card.className = "card result";
  card.innerHTML =
    '<h2>採点結果</h2>' +
    '<div class="big">' + correct + '<small> / ' + N + '　（' + pct + '%）</small></div>' +
    '<p class="judge">' + judge + '</p>' +
    (skipped.length ? '<p class="judge">とばして答えていない問題が <b>' + skipped.length + '問</b> あります（未解答は不正解として計算）。</p>' : '') +
    '<table><thead><tr><th>分野</th><th>正答</th><th>率</th></tr></thead><tbody>' + rows + '</tbody></table>' +
    missedHtml +
    (function () {
      const L = lifetimeStats();
      if (!L.answers) return '';
      return '<div class="lifetime"><span>累計 <b>' + L.answers + '</b>回解答・正答率 <b>' +
        Math.round(L.correct / L.answers * 100) + '%</b></span><span>苦手 <b>' + weakList().length +
        '</b>問</span><button class="reset" id="resetHist">履歴をリセット</button></div>';
    })() +
    '<div class="actions">' +
      (LIMIT && baseList().length > N ? '<button class="btn" id="nextBatch">次の ' + LIMIT + '問へ</button>' : '') +
      (missed.length ? '<button class="btn' + (LIMIT ? ' ghost' : '') + '" id="again">間違えた ' + missed.length + ' 問をやり直す</button>' : '') +
      (skipped.length ? '<button class="btn ghost" id="doSkipped">とばした ' + skipped.length + ' 問を解く</button>' : '') +
      '<button class="btn ghost" id="home">ホーム</button>' +
    '</div>';
  stage.replaceChildren(card);

  const ag = card.querySelector("#again");
  if (ag) ag.addEventListener("click", () => {
    const keep = new Set(missed.map(m => m.q));
    const subset = Q.slice(0, N).filter(q => keep.has(q.q));
    Q.length = 0; RETRY_FROM = -1; subset.forEach(q => Q.push(q));
    i = 0; correct = 0; log.length = 0; answers.length = 0; render();
  });
  const ds = card.querySelector("#doSkipped");
  if (ds) ds.addEventListener("click", () => {
    Q.length = 0; RETRY_FROM = -1; skipped.forEach(q => Q.push(q));
    i = 0; correct = 0; log.length = 0; answers.length = 0; saveSession(); render();
  });
  const nb2 = card.querySelector("#nextBatch");
  if (nb2) nb2.addEventListener("click", function () { rebuild(); });
  card.querySelector("#home").addEventListener("click", goHome);
  const rh = card.querySelector("#resetHist");
  if (rh) rh.addEventListener("click", function () {
    if (!confirm("これまでの解答履歴をすべて削除します。よろしいですか。")) return;
    HIST = {}; saveHist(); refreshWeakBtn(); location.reload();
  });
  refreshWeakBtn();
  window.scrollTo({ top: 0, behavior: "instant" });
}

document.addEventListener("keydown", e => {
  if (document.getElementById("pane-quiz").hidden) return;
  if (AT_HOME) return;
  const tg = e.target;
  // メモ入力中の矢印・数字・Enterで問題が進んだり選択肢が押されたりしないように
  if (tg && (tg.tagName === "TEXTAREA" || tg.tagName === "INPUT")) return;
  // フォーカス中のボタン（ホーム・前の問題・ブックマーク等）は Enter でそのボタン自身を押す
  if (tg && tg.tagName === "BUTTON" && tg.id !== "next" && (e.key === "Enter" || e.key === " ")) return;
  if (e.key === "ArrowLeft") { if (i > 0) { e.preventDefault(); goPrev(); } return; }
  if (e.key === "ArrowRight") { if (i < Q.length) { e.preventDefault(); goNext(); } return; }
  if (e.key === "Enter") {
    const n = document.getElementById("next");
    if (n) { e.preventDefault(); n.click(); }
    return;
  }
  const k = LETTERS.indexOf(e.key);
  if (k >= 0 && !answered) {
    const btns = stage.querySelectorAll(".ch");
    if (btns[k]) { e.preventDefault(); btns[k].click(); }
  }
});

/* ---------- 解答履歴（localStorage） ---------- */
const HKEY = SPFX + "history_v1";
let HIST = {};
try { HIST = JSON.parse(localStorage.getItem(HKEY) || "{}") || {}; } catch (e) { HIST = {}; }
/* 問題文を書き直した問題は、古い問題文で保存された記録を新しい問題文へ付け替える */
const KEY_RENAMES = {
  "その2013年度比の削減率は？": "2024年度の日本の温室効果ガス純排出量（排出−吸収）は、2013年度比で何%減った？",
  "同じく2040年度の削減目標は？（2013年度比）": "日本のNDC（2025年2月提出）における2040年度の削減目標は？（2013年度比）"
};
function renameKeys(obj) {
  let changed = false;
  Object.keys(KEY_RENAMES).forEach(function (o) {
    if (obj[o] && !obj[KEY_RENAMES[o]]) { obj[KEY_RENAMES[o]] = obj[o]; delete obj[o]; changed = true; }
  });
  return changed;
}
if (renameKeys(HIST)) { try { localStorage.setItem(HKEY, JSON.stringify(HIST)); } catch (e) {} }
function saveHist() { try { localStorage.setItem(HKEY, JSON.stringify(HIST)); } catch (e) {} }
function hkey(q) { return q.q; }
function histOf(q) { return HIST[hkey(q)] || null; }
function recordAnswer(q, hit) {
  const k = hkey(q);
  const h = HIST[k] || { n: 0, ok: 0, last: null };
  h.n++; if (hit) h.ok++;
  h.last = hit ? 1 : 0;
  h.st = hit ? (h.st || 0) + 1 : 0;
  srSchedule(h, Date.now());
  HIST[k] = h; saveHist();
  refreshWeakBtn();   // 結果画面まで待たずに「苦手 N問」を更新する
}

/* ---------- おまかせ出題（忘却曲線にもとづく復習日の管理） ---------- */
const DAY = 86400000;
// 連続正解数ごとの、次の復習までの日数。まちがえたら翌日。本番まで約2か月なので最長30日
const SR_DAYS = [1, 2, 4, 7, 14, 30];
const MASTERY = ["未学習", "要復習", "学習中", "定着", "完璧"];
function dayStart(t) { const d = new Date(t); return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); }
function srSchedule(h, now) {
  h.ts = now;
  let d = SR_DAYS[Math.min(h.st || 0, SR_DAYS.length - 1)];
  // 本番の2日前までに必ず一度は復習が回るよう、間隔を本番までの残り日数で頭打ちにする
  const left = Math.round((EXAM_DAY - dayStart(now)) / DAY);
  if (left > 2) d = Math.min(d, left - 2);
  h.due = dayStart(now) + d * DAY;
}
/* 解いた日時を持たない古い履歴：まちがえた問題は今日が復習日、正解した問題は今日解いたものとして扱う */
function migrateSR() {
  let changed = false;
  const now = Date.now();
  Object.keys(HIST).forEach(function (k) {
    const h = HIST[k];
    if (typeof h.due === "number") return;
    h.st = h.last === 1 ? (h.ok === h.n ? Math.min(h.ok, 2) : 1) : 0;
    if (h.last === 1) srSchedule(h, now); else { h.ts = now; h.due = dayStart(now); }
    changed = true;
  });
  if (changed) saveHist();
}
migrateSR();
function isDue(h, today) { return !!h && typeof h.due === "number" && h.due <= today; }
function dueList() {
  const t = dayStart(Date.now());
  return verifiedOnly(SETS.all).filter(function (q) { return isDue(histOf(q), t); });
}
/* 習熟度：0未学習 1要復習（直近まちがえた／正答率6割未満） 2学習中 3定着（3回連続正解） 4完璧（5回連続正解） */
function mastery(q) {
  const h = histOf(q);
  if (!h) return 0;
  if (h.last === 0 || h.ok / h.n < 0.6) return 1;
  const st = h.st || 0;
  return st >= 5 ? 4 : st >= 3 ? 3 : 2;
}
/* 出題の順：①復習日を過ぎた問題（古い順・習熟度の低い順） ②まだ解いていない問題（頻出論点から） ③期限前でも習熟度の低い問題 */
function autoPick(n) {
  const today = dayStart(Date.now());
  const all = verifiedOnly(SETS.all);
  let pick = all.filter(function (q) { return isDue(histOf(q), today); }).sort(function (a, b) {
    return histOf(a).due - histOf(b).due || mastery(a) - mastery(b) || whyOf(b).rank - whyOf(a).rank;
  }).slice(0, n);
  if (pick.length < n) {
    const fresh = [];
    [5, 4, 3, 2, 1].forEach(function (r) {
      fresh.push.apply(fresh, shuffled(all.filter(function (q) { return !histOf(q) && whyOf(q).rank === r; })));
    });
    pick = pick.concat(fresh.slice(0, n - pick.length));
  }
  if (pick.length < n) {
    const ahead = all.filter(function (q) { const h = histOf(q); return h && !isDue(h, today); }).sort(function (a, b) {
      return mastery(a) - mastery(b) || histOf(a).due - histOf(b).due;
    });
    pick = pick.concat(ahead.slice(0, n - pick.length));
  }
  return shuffled(pick);
}
let AUTO_N = 20;
try { AUTO_N = Number(localStorage.getItem(SPFX + "auto_n")) || 20; } catch (e) {}
function startAuto() {
  const list = autoPick(AUTO_N);
  if (!list.length) return;
  Q.length = 0; RETRY_FROM = -1; list.forEach(function (q) { Q.push(q); });
  CUSTOM_LIST = list.slice(); CURRENT_SET = "auto";
  i = 0; correct = 0; log.length = 0; answers.length = 0;
  applySetButtons("auto");
  const pi = document.getElementById("pickinfo");
  if (pi) pi.textContent = "";
  saveSession(); render();
}
function refreshAutoBtn() {
  const b = document.getElementById("autoBtn");
  if (!b) return;
  const n = dueList().length;
  b.innerHTML = "おまかせ" + (n ? '<span class="badge">' + n + '</span>' : "");
  const nb = document.getElementById("navBadge");
  if (nb) { nb.textContent = n > 99 ? "99+" : String(n); nb.hidden = !n; }
}
function renderAutoBlock() {
  const due = dueList().length;
  const m = [0, 0, 0, 0, 0];
  verifiedOnly(SETS.all).forEach(function (q) { m[mastery(q)]++; });
  return '<div class="auto hero"><h3>おまかせ出題</h3>' +
    '<p class="due">' + (due ? '今日の復習 <b>' + due + '</b>問' : '今日の復習はありません。<br>まだ解いていない頻出論点から出します') + '</p>' +
    '<div class="auto-n"><label for="autoN">出題数</label><output id="autoNv">' + AUTO_N + '問</output></div>' +
    '<input type="range" id="autoN" min="5" max="100" step="5" value="' + AUTO_N + '">' +
    '<div class="auto-scale"><span>5問</span><span>100問</span></div>' +
    '<button class="btn wide" id="autoGo">スタート</button>' +
    '<details><summary>おまかせ出題とは</summary>' +
      '<p>忘れかけたころに復習が回ってくるよう、問題ごとに次の復習日を決めて出題します。' +
      'まちがえた問題は翌日、続けて正解するほど間隔を空けます（2日→4日→7日→14日→30日）。' +
      '復習日の問題が足りないときは、まだ解いていない頻出論点から出します。</p>' +
      '<div class="mastery">' + MASTERY.map(function (l, k) { return '<span class="m' + k + '">' + l + ' <b>' + m[k] + '</b></span>'; }).join("") + '</div>' +
    '</details>' +
  '</div>';
}
function renderTiles() {
  const p = progressNow(), weak = weakList().length, bm = bookmarkList().length;
  return '<div class="tiles">' +
    '<div class="tile">解いた問題<b>' + p.done + '<small>/ ' + p.total + '</small></b></div>' +
    '<div class="tile">直近の正答率<b>' + pct(p.rate) + '</b></div>' +
    '<button type="button" class="tile' + (weak ? ' warn' : '') + '" id="tileWeak"' + (weak ? '' : ' disabled') + '>苦手<b>' + weak + '<small>問</small></b></button>' +
    '<button type="button" class="tile" id="tileBm"' + (bm ? '' : ' disabled') + '>ブックマーク<b>' + bm + '<small>問</small></b></button>' +
  '</div>';
}
function wireAutoBlock(card) {
  const r = card.querySelector("#autoN"), v = card.querySelector("#autoNv"), go = card.querySelector("#autoGo");
  if (!r) return;
  r.addEventListener("input", function () {
    AUTO_N = Number(r.value);
    v.textContent = AUTO_N + "問";
    try { localStorage.setItem(SPFX + "auto_n", String(AUTO_N)); } catch (e) {}
  });
  go.addEventListener("click", startAuto);
}
/* 苦手＝直近で誤答した問題、または正答率6割未満の問題 */
function weakList() {
  return SETS.all.filter(function (q) {
    if (!INCLUDE_UNVERIFIED && q.v === "knowledge") return false;
    return true;
  }).filter(function (q) {
    const h = histOf(q);
    return h && (h.last === 0 || h.ok / h.n < 0.6);
  });
}
function refreshWeakBtn() {
  const b = document.getElementById("weakBtn");
  const n = weakList().length;
  b.textContent = "苦手 " + n + "問";
  b.disabled = n === 0;
  if (n === 0 && b.getAttribute("aria-pressed") === "true") b.setAttribute("aria-pressed", "false");
  refreshBmBtn();
  refreshAutoBtn();
}
function lifetimeStats() {
  let n = 0, ok = 0, q = 0;
  Object.keys(HIST).forEach(function (k) { n += HIST[k].n; ok += HIST[k].ok; q++; });
  return { answers: n, correct: ok, questions: q };
}

/* ---------- ブックマーク・メモ（localStorage） ---------- */
const NKEY = SPFX + "notes_v1";
let NOTES = {};
try { NOTES = JSON.parse(localStorage.getItem(NKEY) || "{}") || {}; } catch (e) { NOTES = {}; }
if (renameKeys(NOTES)) { try { localStorage.setItem(NKEY, JSON.stringify(NOTES)); } catch (e) {} }
function saveNotes() { try { localStorage.setItem(NKEY, JSON.stringify(NOTES)); } catch (e) {} }
function noteOf(q) { return NOTES[hkey(q)] || null; }
function setNote(q, patch) {
  const k = hkey(q);
  const n = Object.assign({ bm: false, memo: "" }, NOTES[k] || {}, patch, { t: Date.now() });
  if (!n.bm && !n.memo) delete NOTES[k]; else NOTES[k] = n;
  saveNotes();
}
function isBookmarked(q) { const n = noteOf(q); return !!(n && n.bm); }
function memoOf(q) { const n = noteOf(q); return (n && n.memo) || ""; }
function bmLabel(on) { return on ? "★ ブックマーク済み" : "☆ ブックマーク"; }
function bookmarkList() {
  return verifiedOnly(SETS.all.filter(isBookmarked));
}
function refreshBmBtn() {
  const b = document.getElementById("bmBtn");
  if (!b) return;
  const n = bookmarkList().length;
  b.textContent = "★ ブックマーク " + n + "問";
  b.disabled = n === 0;
  if (n === 0 && b.getAttribute("aria-pressed") === "true") b.setAttribute("aria-pressed", "false");
}
function showMemo(card, open) {
  card.querySelector(".memo").hidden = !open;
  card.querySelector("#memoTog").setAttribute("aria-expanded", String(open));
}
function wireNoteTools(card, q) {
  const bt = card.querySelector("#bmTog");
  bt.addEventListener("click", function () {
    const on = !isBookmarked(q);
    setNote(q, { bm: on });
    bt.setAttribute("aria-pressed", String(on));
    bt.textContent = bmLabel(on);
    refreshBmBtn();
  });

  const mt = card.querySelector("#memoTog");
  const ta = card.querySelector("#memoTa");
  const saved = card.querySelector(".memo .saved");
  function labelMemo() {
    const has = !!ta.value.trim();
    mt.textContent = has ? "メモあり" : "メモ";
    mt.classList.toggle("has", has);
  }
  ta.value = memoOf(q);
  labelMemo();

  let timer = null;
  function commit() {
    clearTimeout(timer); timer = null;
    setNote(q, { memo: ta.value.trim() ? ta.value : "" });
    labelMemo();
    saved.textContent = "保存しました";
  }
  ta.addEventListener("input", function () {
    saved.textContent = "";
    clearTimeout(timer); timer = setTimeout(commit, 600);
  });
  ta.addEventListener("blur", function () { if (timer) commit(); });
  mt.addEventListener("click", function () {
    const open = card.querySelector(".memo").hidden;
    showMemo(card, open);
    if (open) ta.focus();
  });
}

/* ---------- 過去問データの読み込み（端末内のみ） ---------- */
/* 著作権のため、過去問本文はリポジトリに置かず利用者の端末にだけ保存する */
const IKEY = SPFX + "imported_v1";
let IMPORTED = {};
try { IMPORTED = JSON.parse(localStorage.getItem(IKEY) || "{}") || {}; } catch (e) { IMPORTED = {}; }
function saveImported() {
  try { localStorage.setItem(IKEY, JSON.stringify(IMPORTED)); return true; }
  catch (e) { return false; }
}
function importedQuestions() {
  const out = [];
  Object.keys(IMPORTED).sort().forEach(function (k) {
    (IMPORTED[k].questions || []).forEach(function (q) { out.push(q); });
  });
  return out;
}
function validateImport(d) {
  if (!d || typeof d !== "object") return "JSONとして読めません";
  if (!d.id || !d.label) return "id / label がありません";
  if (!Array.isArray(d.questions) || !d.questions.length) return "questions が空です";
  for (let i = 0; i < d.questions.length; i++) {
    const q = d.questions[i];
    if (!q.q || !Array.isArray(q.c) || q.c.length < 2 || typeof q.a !== "number") {
      return (i + 1) + "問目の形式が不正です（q / c / a が必要）";
    }
    if (q.a < 0 || q.a >= q.c.length) return (i + 1) + "問目の正答番号が範囲外です";
  }
  return null;
}
function applyImport(d) {
  IMPORTED[d.id] = { label: d.label, count: d.questions.length, questions: d.questions };
  if (!saveImported()) return "端末の保存領域が足りません";
  refreshImportedSet();
  return null;
}
function refreshImportedSet() {
  const list = importedQuestions();
  SETS.imported = list;
  SETS.all = baseAll().concat(list);
  const btn = document.getElementById("impBtn");
  if (btn) {
    btn.textContent = "過去問 " + list.length + "問";
    btn.hidden = list.length === 0;
  }
  refreshWeakBtn();
}

/* ---------- 出題数の絞り込み ---------- */
let LIMIT = 0;              // 0 = 全問
let CUSTOM_LIST = null;     // 履歴タブから渡された任意の問題群

/* 未検証（確度△）の問題は既定で出題しない。誤った知識を覚えないための安全側の既定値 */
let INCLUDE_UNVERIFIED = false;
try { INCLUDE_UNVERIFIED = localStorage.getItem(SPFX + "inc_unverified") === "1"; } catch (e) {}
function verifiedOnly(list) {
  return INCLUDE_UNVERIFIED ? list : list.filter(function (q) { return q.v !== "knowledge"; });
}
function baseList() {
  if (CURRENT_SET === "weak") return verifiedOnly(weakList());
  if (CURRENT_SET === "bm") return bookmarkList();
  if (CURRENT_SET === "auto") return verifiedOnly(CUSTOM_LIST || []);
  if (CURRENT_SET === "custom") return verifiedOnly(CUSTOM_LIST || []);
  return verifiedOnly(SETS[CURRENT_SET] || SETS[DEFAULT_SET]);
}
function updateUnvUI() {
  const all = SETS.all;
  const unv = all.filter(function (q) { return q.v === "knowledge"; }).length;
  const cnt = document.getElementById("unvCnt");
  const note = document.getElementById("unvNote");
  if (cnt) cnt.textContent = "（" + unv + "問）";
  const wrap = document.querySelector(".unvwrap");
  if (wrap) wrap.hidden = (unv === 0);
  if (note) {
    note.hidden = (unv === 0);
    note.className = "unvnote" + (INCLUDE_UNVERIFIED ? " on" : "");
    note.innerHTML = INCLUDE_UNVERIFIED
      ? "<b>未検証の" + unv + "問を含めて出題しています。</b>解説末尾が△の問題は一次資料での裏取りが済んでいません。これまでの検証で実際に5問の誤りが見つかっているため、△の内容はテキストで確認してから覚えてください。"
      : "一次資料または公開正答表で裏を取った <b>" + (all.length - unv) + "問</b> だけを出題しています（未検証の" + unv + "問は除外）。";
  }
}
/* その場でシャッフル（Fisher-Yates）。同じ並びで覚えてしまうのを防ぐ */
function shuffled(list) {
  const a = list.slice();
  for (let k = a.length - 1; k > 0; k--) {
    const j = Math.floor(Math.random() * (k + 1));
    const t = a[k]; a[k] = a[j]; a[j] = t;
  }
  return a;
}
/* 絞り込むときは「未回答 → 直近誤答 → 正答率が低い順」で拾い、拾ったあとに順番を混ぜる */
function pickQuestions(list) {
  if (!LIMIT || list.length <= LIMIT) return shuffled(list);
  const base = shuffled(list);                     // 同点のときの並びも毎回変える
  const scored = base.map(function (q, idx) {
    const h = histOf(q);
    let s;
    if (!h) s = 0;
    else if (h.last === 0) s = 1;
    else s = 2 + (h.ok / h.n);
    return { q: q, s: s, idx: idx };
  });
  // 同じ優先度（未回答どうし等）なら、出題実績のある論点から拾う
  scored.sort(function (a, b) { return a.s - b.s || whyOf(b.q).rank - whyOf(a.q).rank || a.idx - b.idx; });
  return shuffled(scored.slice(0, LIMIT).map(function (x) { return x.q; }));
}
function rebuild() {
  const picked = pickQuestions(baseList());
  if (!picked.length) return false;
  Q.length = 0; RETRY_FROM = -1; picked.forEach(function (q) { Q.push(q); });
  i = 0; correct = 0; log.length = 0; answers.length = 0;
  const host = document.getElementById("resumeHost");
  if (host) host.innerHTML = "";
  clearSession();
  updatePickInfo();
  updateUnvUI();
  render();
  return true;
}
function updatePickInfo() {
  const el = document.getElementById("pickinfo");
  if (!el) return;
  const total = baseList().length;
  el.textContent = (LIMIT && total > LIMIT)
    ? "（" + total + "問中、未回答と苦手を優先して" + LIMIT + "問）" : "";
}

/* ---------- 進捗の保存と再開 ---------- */
const SKEY = SPFX + "session_v1";
let CURRENT_SET = DEFAULT_SET;
let STORAGE_OK = true;
try {
  localStorage.setItem("__gq_test", "1");
  localStorage.removeItem("__gq_test");
} catch (e) { STORAGE_OK = false; }

function saveSession() {
  if (!STORAGE_OK) return;
  try {
    localStorage.setItem(SKEY, JSON.stringify({
      set: CURRENT_SET, limit: LIMIT,
      keys: Q.map(function (q) { return q.q; }),
      i: i, correct: correct, answers: answers, retry: RETRY_FROM
    }));
  } catch (e) {}
}
function clearSession() { try { localStorage.removeItem(SKEY); } catch (e) {} }
function loadSession() {
  if (!STORAGE_OK) return null;
  try {
    const d = JSON.parse(localStorage.getItem(SKEY) || "null");
    if (!d || !d.keys || !d.keys.length) return null;
    if (typeof d.i !== "number" || d.i >= d.keys.length) return null;
    if (!d.i) return null;                                   // 1問目なら再開扱いにしない
    const byKey = {};
    SETS.all.forEach(function (q) { byKey[q.q] = q; });
    const list = d.keys.map(function (k) { return byKey[k]; });
    if (list.some(function (q) { return !q; })) return null;  // 問題が入れ替わっていたら破棄
    return { set: d.set, limit: d.limit || 0, list: list, i: d.i, correct: d.correct || 0, answers: d.answers || [], retry: typeof d.retry === "number" ? d.retry : -1 };
  } catch (e) { return null; }
}
function applySetButtons(key) {
  document.querySelectorAll(".set").forEach(function (o) {
    o.setAttribute("aria-pressed", String(o.dataset.set === key));
    if (o.dataset.set === key && o.dataset.grp) showGroup(o.dataset.grp);
  });
}
function showResume(n, total) {
  const host = document.getElementById("resumeHost");
  host.innerHTML = '<div class="resume">前回の続き（<b>' + (n + 1) + ' / ' + total +
    '問目</b>）から再開しました<button id="restart">最初から解き直す</button></div>';
  host.querySelector("#restart").addEventListener("click", function () {
    i = 0; correct = 0; log.length = 0; answers.length = 0;
    clearSession(); host.innerHTML = ""; render();
  });
}

/* ---------- 出題範囲の切替 ---------- */

const SETS = {};
SUBJECT.sets.forEach(function (d) { SETS[d.key] = SUBJECT_DATA[d.data]; });
SETS.imported = [];
function baseAll() {
  return [].concat.apply([], SUBJECT.sets.map(function (d) { return SETS[d.key]; }));
}
SETS.all = baseAll();
/* 全部入りでは専門・基礎・適性の大項目で絞ってからセットを選ぶ */
const GROUPS = [];
SUBJECT.sets.forEach(function (d) { if (d.group && GROUPS.indexOf(d.group) < 0) GROUPS.push(d.group); });
const GROUPED = GROUPS.length > 1;
const GROUP_KEY = "gq_" + (SUBJECT.storagePrefix || "") + "homeGroup";
if (GROUPED) GROUPS.forEach(function (g) {
  const ds = SUBJECT.sets.filter(function (d) { return d.group === g; });
  if (ds.length < 2) return;
  SETS["grp:" + g] = [].concat.apply([], ds.map(function (d) { return SETS[d.key]; }));
  SET_LABEL["grp:" + g] = g + " まとめて";
});
function showGroup(g) {
  if (!GROUPED) return;
  document.querySelectorAll(".grp").forEach(function (t) { t.setAttribute("aria-selected", String(t.dataset.grp === g)); });
  document.querySelectorAll(".set[data-grp]").forEach(function (b) { b.classList.toggle("offgrp", b.dataset.grp !== g); });
  try { localStorage.setItem(GROUP_KEY, g); } catch (e) {}
}
/* 集合ボタンは SUBJECT.sets から作る。問題数はデータから数える（HTMLに書いた数字は追加のたびに古くなるため） */
(function buildSetButtons() {
  const box = document.getElementById("setsBox");
  const multi = SUBJECT.sets.length > 1;
  function add(cls, key, text, attrs, grp) {
    const b = document.createElement("button");
    b.className = cls;
    b.dataset.set = key;
    if (grp) b.dataset.grp = grp;
    b.setAttribute("aria-pressed", String(key === DEFAULT_SET));
    b.textContent = text;
    Object.keys(attrs || {}).forEach(function (k) { b[k] = attrs[k]; });
    box.appendChild(b);
  }
  add("set auto", "auto", "おまかせ", { id: "autoBtn" });
  if (GROUPED) {
    const tabs = document.createElement("div");
    tabs.className = "grptabs";
    tabs.setAttribute("role", "tablist");
    GROUPS.forEach(function (g) {
      const t = document.createElement("button");
      t.className = "grp";
      t.dataset.grp = g;
      t.setAttribute("role", "tab");
      t.textContent = g;
      t.addEventListener("click", function () { showGroup(g); });
      tabs.appendChild(t);
    });
    box.appendChild(tabs);
  }
  SUBJECT.sets.forEach(function (d) {
    const n = SETS[d.key].length;
    // 複数セットのうち問題がまだ0件のもの（準備中の科目）はボタンを出さない
    add("set", d.key, d.label + " " + n + "問", { hidden: multi && n === 0 }, GROUPED ? d.group : "");
  });
  if (GROUPED) GROUPS.forEach(function (g) {
    if (SETS["grp:" + g]) add("set", "grp:" + g, g + " まとめて " + SETS["grp:" + g].length + "問", {}, g);
    add("set freq", "freq:" + g, "★ 頻出だけ", { hidden: true }, g);
  });
  else {
    if (multi) add("set", "all", (SUBJECT.allSetLabel || "まとめて") + " 全問");
    add("set freq", "freq:all", "★ 頻出だけ", { hidden: true });
  }
  add("set", "imported", "過去問 0問", { id: "impBtn", hidden: true });
  add("set weak", "weak", "苦手 0問", { id: "weakBtn" });
  add("set bm", "bm", "★ ブックマーク 0問", { id: "bmBtn" });
  if (GROUPED) {
    let g0 = null;
    try { g0 = localStorage.getItem(GROUP_KEY); } catch (e) {}
    const def = SUBJECT.sets.filter(function (d) { return d.key === DEFAULT_SET; })[0];
    showGroup(GROUPS.indexOf(g0) >= 0 ? g0 : (def && def.group) || GROUPS[0]);
  }
})();
document.querySelectorAll(".set").forEach(function (b) {
  b.addEventListener("click", function () {
    if (b.dataset.set === "auto") { startAuto(); return; }
    document.querySelectorAll(".set").forEach(function (o) { o.setAttribute("aria-pressed", String(o === b)); });
    const prevSet = CURRENT_SET;
    CURRENT_SET = b.dataset.set;
    if (!rebuild()) { CURRENT_SET = prevSet; return; }
  });
});



(function () {
  const cb = document.getElementById("incUnv");
  cb.checked = INCLUDE_UNVERIFIED;
  cb.addEventListener("change", function () {
    INCLUDE_UNVERIFIED = cb.checked;
    try { localStorage.setItem(SPFX + "inc_unverified", cb.checked ? "1" : "0"); } catch (e) {}
    updateUnvUI(); refreshWeakBtn();
    if (!AT_HOME) rebuild();
  });
})();

document.querySelectorAll(".lim").forEach(function (b) {
  b.addEventListener("click", function () {
    document.querySelectorAll(".lim").forEach(function (o) { o.setAttribute("aria-pressed", String(o === b)); });
    LIMIT = Number(b.dataset.lim);
    if (!AT_HOME) rebuild();   // ホームでは出題範囲を選んだときに始める
  });
});

/* ---------- 学習診断 ---------- */
/* ---------- 覚える理由：過去問の出題実績から自動で付ける ---------- */
/* 「頻出」は出題年が2年以上ある論点だけ。同じ年に2問出ただけのものは数えない */
function yearsOf(t) {
  const s = {};
  t.cites.forEach(function (c) { s[c.split("-")[0]] = 1; });
  return Object.keys(s).length;
}
/* 頻出テーマ（topics.js）を持たない科目では空のまま。過去問番号による「覚える理由」も付かない */
const TOPIC_LIST = HAS_TOPICS ? TOPICS : [];
const TOPIC_BY_CITE = {};
TOPIC_LIST.forEach(function (t) {
  if (yearsOf(t) < 2) return;
  t.cites.forEach(function (c) {
    if (!TOPIC_BY_CITE[c] || yearsOf(TOPIC_BY_CITE[c]) < yearsOf(t)) TOPIC_BY_CITE[c] = t;
  });
});
// 白書・統計の数値問題は解説に過去問番号を持たないので、分野名で毎年出る廃棄物テーマに結びつける
const WASTE_TOPIC = {};
TOPIC_LIST.forEach(function (t) {
  const m = SUBJECT.wasteTopics || {};
  Object.keys(m).forEach(function (f) { if (t.t === m[f]) WASTE_TOPIC[f] = t; });
});
const WHY_CACHE = new Map();
function whyOf(q) {
  if (WHY_CACHE.has(q)) return WHY_CACHE.get(q);
  const cs = ((q.n || "") + " " + (q.h || "")).match(/R[1-7]-Ⅲ-\d+/g) || [];
  let t = null;
  cs.forEach(function (c) {
    const x = TOPIC_BY_CITE[c];
    if (x && (!t || yearsOf(x) > yearsOf(t))) t = x;
  });
  if (!t && SUBJECT.wasteSet && SETS[SUBJECT.wasteSet].indexOf(q) >= 0 && WASTE_TOPIC[q.f]) t = WASTE_TOPIC[q.f];
  const jm = (q.n || "").match(/〔出題実績:\s*([^〕]*)〕/);
  const jis = jm ? jm[1].split("、").map(function (c) { return c.trim(); }).filter(function (c) { return /^R\d/.test(c); }) : [];
  // 論点単位の記録が薄い分野（適性など）は、分野としての出題年数で頻出を判定する（4年以上＝毎年の過半）
  const fy = (SUBJECT.fieldYears || {})[q.f] || [];
  const fieldHot = fy.length >= 4;
  // rank：出題の確かさで並べる順（頻出3回以上 > 2回 > 1回出た > 今年の予想 > 実績なし）
  let w;
  if (t) {
    const y = yearsOf(t);
    w = { tier: y >= 3 ? 3 : 2, rank: y >= 3 ? 5 : 4, years: y, topic: t, same: t.flag === "選択肢が同一", label: "過去7年で" + y + "回出題" };
  } else if (cs.length) {
    const uniq = cs.filter(function (c, k) { return cs.indexOf(c) === k; });
    w = { tier: 0, rank: 3, once: uniq, label: "" };
  } else if (jis.length || fieldHot) {
    const ys = {};
    jis.forEach(function (c) { ys[c.split(/\s+/)[0]] = 1; });
    const y = Object.keys(ys).length;
    if (y >= 2 && y >= fy.length) w = { tier: y >= 3 ? 3 : 2, rank: y >= 3 ? 5 : 4, years: y, topic: { cites: jis, note: "" }, same: false, label: "過去7年で" + y + "回出題" };
    else if (fieldHot) w = { tier: 3, rank: 5, years: fy.length, topic: { cites: fy, note: "分野としての出題年数です。この論点そのものが出たとは限りません。" + (jis.length ? "論点が近い過去問: " + jis.join("・") + "。" : "") }, same: false, label: "分野は過去7年で" + fy.length + "回出題" };
    else w = { tier: 0, rank: 3, once: jis, label: "" };
  } else if (SUBJECT.forecastField && q.f === SUBJECT.forecastField) {
    w = { tier: 1, rank: 2, label: "今年の新論点（出題実績なし・予想）" };
  } else {
    w = { tier: 0, rank: 1, label: "" };
  }
  WHY_CACHE.set(q, w);
  return w;
}
/* 「★ 頻出だけ」：過去7年で2年以上出た論点（適性は分野で4年以上）の問題だけを科目ごとに集める */
(function fillFreqSets() {
  document.querySelectorAll('.set[data-set^="freq:"]').forEach(function (b) {
    const g = b.dataset.set.slice(5);
    const base = g === "all" ? baseAll() : [].concat.apply([], SUBJECT.sets.filter(function (d) { return d.group === g; }).map(function (d) { return SETS[d.key]; }));
    const list = base.filter(function (q) { return whyOf(q).tier >= 2; });
    SETS[b.dataset.set] = list;
    SET_LABEL[b.dataset.set] = g === "all" ? "頻出だけ" : g + " 頻出だけ";
    b.textContent = "★ 頻出だけ " + list.length + "問";
    b.hidden = !list.length;
  });
})();
function whyChips(w) {
  let s = "";
  if (w.tier >= 2) s += '<span class="why t' + w.tier + '">★ ' + w.label + '</span>';
  if (w.same) s += '<span class="why same">選択肢まで同じ再出題</span>';
  if (w.tier === 1) s += '<span class="why t1">' + w.label + '</span>';
  return s ? '<div class="whys">' + s + '</div>' : "";
}
function whyBox(q, w) {
  let body;
  if (w.tier >= 2) {
    body = '過去7年で<b>' + w.years + '回</b>出題（' + w.topic.cites.join("・") + '）。' +
      (w.same ? '過去問では、<b>同じ内容の選択肢が並び順だけ変えて繰り返し出ています</b>。' : '') + w.topic.note;
  } else if (w.tier === 1) {
    // 予想の根拠が問題ごとに違うものは、データ側の y に理由を書く
    body = q.y || SUBJECT.forecastNote || "";
  } else {
    const head = w.once
      ? '過去問で<b>1回</b>出題（' + w.once.join("・") + '）。同じ論点が繰り返し出た記録はまだありません。'
      : 'この論点そのものの出題実績は確認できていません。';
    const wt = FIELD_WEIGHTS && FIELD_WEIGHTS[q.f];
    const fnote = (SUBJECT.fieldNotes || {})[q.f];
    body = head + (fnote
      ? fnote
      : (wt ? q.f + 'の分野全体では年' + wt + '問前後出ます。' : '') + '頻出論点を優先し、余力で押さえる問題です。');
  }
  return '<div class="whybox t' + (w.tier >= 2 ? 3 : w.tier) + '"><span class="wh">' +
    (w.tier >= 2 ? '★ 絶対に覚える理由' : w.tier === 1 ? '覚える理由（予想）' : 'この問題の位置づけ') + '</span>' + body + '</div>';
}

function fieldStats() {
  const m = {};
  const totalQ = SETS.all.length;
  SETS.all.forEach(function (q) {
    const h = histOf(q);
    if (!m[q.f]) m[q.f] = { n: 0, ok: 0, q: 0, done: 0 };
    m[q.f].q++;
    if (h) { m[q.f].n += h.n; m[q.f].ok += h.ok; m[q.f].done++; }
  });
  return Object.keys(m).map(function (f) {
    const d = m[f];
    const rate = d.n ? d.ok / d.n : null;
    // 年間出題数の設定がない科目は、収録に占める割合（0〜1）を重みにする
    const w = FIELD_WEIGHTS ? (FIELD_WEIGHTS[f] || 1) : d.q / totalQ;
    return { f: f, rate: rate, n: d.n, done: d.done, total: d.q, weight: w,
             loss: (rate === null || w === 0) ? null : w * (1 - rate) };
  }).sort(function (a, b) {
    if (a.loss === null && b.loss === null) return b.weight - a.weight;
    if (a.loss === null) return 1;
    if (b.loss === null) return -1;
    return b.loss - a.loss;
  });
}
function lossText(loss) { return FIELD_WEIGHTS ? loss.toFixed(1) : (loss * 100).toFixed(1); }
function weightText(r) {
  if (!FIELD_WEIGHTS) return '収録の ' + Math.round(r.weight * 100) + '%';
  return r.weight ? '本試験で年 ' + r.weight + '問前後' : '専門科目とは別の科目';
}
function renderDiagnosis() {
  const fs = fieldStats();
  const scored = fs.filter(function (r) { return r.loss !== null; });
  if (!scored.length) {
    return '<div class="diag"><h3>学習診断</h3><p class="note2">何問か解くと、分野ごとの正答率から' + (FIELD_WEIGHTS ? '「本番で何問落とす計算になるか」' : '「どの分野が全体の正答率を押し下げているか」') + 'を出します。</p></div>';
  }
  let rows = "";
  fs.forEach(function (r, idx) {
    const cls = r.loss === null ? "p3" : (idx === 0 ? "p1" : idx <= 2 ? "p2" : "p3");
    rows += '<div class="drow ' + cls + '">' +
      '<div class="dn">' + r.f + '</div>' +
      '<div class="dv">' + (r.rate === null ? '未着手' : Math.round(r.rate * 100) + '%') + '</div>' +
      '<div class="dloss">' + (r.loss === null ? '—' : '▲' + lossText(r.loss)) + '</div>' +
      '<div class="dsub">' + weightText(r) + ' ／ 収録 ' + r.total + '問中 ' + r.done + '問に解答' +
        (r.n ? '（延べ' + r.n + '回）' : '') + '</div>' +
    '</div>';
  });
  const top = scored.slice(0, 3);
  const totalLoss = scored.reduce(function (a, r) { return a + r.loss; }, 0);
  let rx = '<div class="rx"><b>いまの正答率のままなら、' + (FIELD_WEIGHTS && SUBJECT.diagLoss
    ? SUBJECT.diagLoss.replace("{n}", totalLoss.toFixed(1))
    : '全体の正答率は約' + Math.round((1 - totalLoss) * 100) + '%の見込み</b>') + '。効く順に並べるとこうなります。<ol>';
  top.forEach(function (r) {
    rx += '<li><b>' + r.f + '</b>（正答率' + Math.round(r.rate * 100) + '%・' + (FIELD_WEIGHTS ? '年' + r.weight + '問' : '収録の' + Math.round(r.weight * 100) + '%') + '）— ' +
      (r.rate < 0.5 ? '基礎から。用語の定義と数値をまず1周' :
       r.rate < 0.75 ? '取りこぼしを潰す段階。間違えた問題だけ回す' :
       '仕上がりつつある。維持で十分') + '</li>';
  });
  rx += '</ol></div>';
  return '<div class="diag"><h3>学習診断</h3>' +
    (FIELD_WEIGHTS
      ? '<p class="note2">▲は「本試験でその分野から落とす問題数の見込み」＝ 年間出題数 ×（1 − 正答率）。出題が多い分野ほど、同じ正答率でも損失が大きくなります。</p>'
      : '<p class="note2">▲は「その分野が全体の正答率を押し下げている分（％ポイント）」＝ 収録に占める割合 ×（1 − 正答率）。収録が多い分野ほど、同じ正答率でも影響が大きくなります。</p>') +
    rows + rx +
    '<div class="exp"><button class="btn ghost" id="copyDiag">診断結果をコピー</button>' +
    '<span class="msg" id="copyMsg"></span></div></div>';
}
function diagnosisText() {
  const fs = fieldStats(), L = lifetimeStats();
  let t = "【" + (SUBJECT.shareTitle || "技術士一次試験 学習状況") + "】\n";
  t += "累計 " + L.answers + "回解答／正答率 " + (L.answers ? Math.round(L.correct / L.answers * 100) : 0) + "%／苦手 " + weakList().length + "問\n\n";
  t += FIELD_WEIGHTS ? "分野別（正答率 / 本試験の年間出題数 / 落とす見込み）\n" : "分野別（正答率 / 収録に占める割合 / 全体を押し下げる分）\n";
  fs.forEach(function (r) {
    t += "- " + r.f + "：" + (r.rate === null ? "未着手" : Math.round(r.rate * 100) + "%") +
      " / " + (FIELD_WEIGHTS ? "年" + r.weight + "問" : Math.round(r.weight * 100) + "%") + " / " + (r.loss === null ? "—" : "▲" + lossText(r.loss)) +
      "（収録" + r.total + "問中" + r.done + "問に解答）\n";
  });
  const miss = SETS.all.filter(function (q) { const h = histOf(q); return h && h.last === 0; });
  if (miss.length) {
    t += "\n直近で間違えた問題（" + miss.length + "問）\n";
    miss.forEach(function (q) { t += "- [" + q.f + "] " + q.q.replace(/<br>/g, " ") + "\n"; });
  }
  t += "\n※このテキストをClaudeに貼ると、次に何をやるべきか分析してもらえます。";
  return t;
}


/* ---------- 学習データのバックアップ（機種変更・URL移行用） ---------- */
function exportStudyData() {
  const nh = Object.keys(HIST).length, nn = Object.keys(NOTES).length;
  if (!nh && !nn) return null;
  const d = { app: "gijutsushi-quiz", kind: "study-data", v: 1,
              exported: new Date().toISOString(), history: HIST, notes: NOTES, examDay: ymd(EXAM_DAY) };
  const t = new Date();
  const pad = function (x) { return String(x).padStart(2, "0"); };
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([JSON.stringify(d)], { type: "application/json" }));
  a.download = "gijutsushi-study-" + t.getFullYear() + pad(t.getMonth() + 1) + pad(t.getDate()) + ".json";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(function () { URL.revokeObjectURL(a.href); }, 10000);
  return { h: nh, n: nn };
}
function mergeStudyData(d) {
  if (!d || d.app !== "gijutsushi-quiz" || d.kind !== "study-data" ||
      !d.history || typeof d.history !== "object" || !d.notes || typeof d.notes !== "object") {
    return { err: "このアプリの学習データのファイルではありません" };
  }
  let h = 0, n = 0;
  Object.keys(d.history).forEach(function (k) {
    const r = d.history[k];
    if (!r || typeof r.n !== "number" || typeof r.ok !== "number" || r.n < 1 || r.ok < 0 || r.ok > r.n) return;
    const cur = HIST[k];
    // 合算すると同じファイルを2回読んだとき回数が倍になるので、解答回数の多い方を残す
    if (!cur || r.n > cur.n) {
      HIST[k] = { n: r.n, ok: r.ok, last: (r.last === 0 || r.last === 1) ? r.last : null };
      if (typeof r.st === "number" && r.st >= 0) HIST[k].st = r.st;
      if (typeof r.ts === "number") HIST[k].ts = r.ts;
      if (typeof r.due === "number") HIST[k].due = r.due;
      h++;
    }
  });
  Object.keys(d.notes).forEach(function (k) {
    const r = d.notes[k];
    if (!r || typeof r !== "object") return;
    const memo = typeof r.memo === "string" ? r.memo : "";
    const bm = r.bm === true;
    if (!memo && !bm) return;
    const t = typeof r.t === "number" ? r.t : 0;
    const cur = NOTES[k];
    if (!cur || t > (cur.t || 0)) { NOTES[k] = { bm: bm, memo: memo, t: t || Date.now() }; n++; }
  });
  saveHist(); saveNotes();
  migrateSR();   // 復習日を持たない古い形式のファイルにも復習日を付ける
  // 受験日はこの端末が既定日のままのときだけ取り込む（すでに変更済みの設定を上書きしないため）
  let examTaken = false;
  if (typeof d.examDay === "string" && ymd(EXAM_DAY) === ymd(EXAM_DAY_DEFAULT) && setExamDay(d.examDay)) {
    examTaken = true;
  }
  return { h: h, n: n, e: examTaken };
}
function renderBackup() {
  return '<div class="datamgr"><h3>学習データのバックアップ</h3>' +
    '<p>解答履歴・ブックマーク・メモは<b>この端末の、このURLにだけ</b>保存されています。' +
    '機種変更や、アプリのURLが変わる前に書き出し、新しい方で読み込んでください。</p>' +
    '<div class="imp">' +
      '<button class="impfile" id="expStudy" type="button">書き出す</button>' +
      '<label class="impfile ghost" for="impStudy">読み込む</label>' +
      '<input type="file" id="impStudy" accept="application/json,.json">' +
      '<span class="impmsg" id="studyMsg"></span>' +
    '</div>' +
    '<p class="privacy">同じ問題の記録が両方にあるときは、解答回数の多い方と、あとから書いたメモの方を残します。' +
    '同じファイルを2回読み込んでも回数は増えません。</p></div>';
}
function wireBackup(p) {
  function say(cls, text) {
    const m = document.getElementById("studyMsg");
    if (m) { m.className = "impmsg " + cls; m.textContent = text; }
  }
  const ex = p.querySelector("#expStudy");
  if (ex) ex.addEventListener("click", function () {
    const r = exportStudyData();
    if (!r) say("ng", "まだ保存された学習データがありません");
    else say("ok", "書き出しました（履歴 " + r.h + "問・ブックマーク/メモ " + r.n + "問）");
  });
  const f = p.querySelector("#impStudy");
  if (f) f.addEventListener("change", function () {
    const file = f.files && f.files[0];
    if (!file) return;
    const rd = new FileReader();
    rd.onload = function () {
      let d = null;
      try { d = JSON.parse(rd.result); } catch (e) { say("ng", "JSONとして読めませんでした"); return; }
      const res = mergeStudyData(d);
      if (res.err) { say("ng", res.err); return; }
      refreshWeakBtn();
      if (res.e) { renderCountdown(); if (AT_HOME) goHome(); }
      renderHistory();   // 画面を描き直してから結果を出す（先に出すと描き直しで消える）
      say("ok", "読み込みました（履歴 " + res.h + "問・ブックマーク/メモ " + res.n + "問を反映" + (res.e ? "・受験日も反映" : "") + "）");
    };
    rd.readAsText(file);
    f.value = "";
  });
}

function renderDataManager() {
  let items = "";
  Object.keys(IMPORTED).sort().forEach(function (k) {
    const d = IMPORTED[k];
    items += '<div class="impitem"><span>' + d.label + '</span><span class="n2">' +
      (d.questions ? d.questions.length : 0) + '問</span>' +
      '<button data-del="' + k + '">削除</button></div>';
  });
  return '<div class="datamgr"><h3>過去問データの読み込み</h3>' +
    '<p>過去問の本文は<b>この端末の中だけ</b>に保存されます。' +
    'アプリを置いているGitHubには問題文を一切含めていないため、' +
    '読み込みは端末ごとに1回だけ必要です。</p>' +
    '<div class="imp">' +
      '<label class="impfile" for="impFile">JSONファイルを選ぶ</label>' +
      '<input type="file" id="impFile" accept="application/json,.json">' +
      '<span class="impmsg" id="impMsg"></span>' +
    '</div>' +
    (items ? '<div style="margin-top:1rem">' + items + '</div>' : '') +
    '<p class="privacy">保存先はブラウザのローカル領域です。他人には見えません。' +
    'ブラウザのデータを消すと再読み込みが必要になります。</p></div>';
}
function wireDataManager(p) {
  const f = p.querySelector("#impFile");
  const msg = p.querySelector("#impMsg");
  if (f) f.addEventListener("change", function () {
    const file = f.files && f.files[0];
    if (!file) return;
    const r = new FileReader();
    r.onload = function () {
      let d = null;
      try { d = JSON.parse(r.result); } catch (e) {
        msg.className = "impmsg ng"; msg.textContent = "JSONとして読めませんでした"; return;
      }
      const err = validateImport(d) || applyImport(d);
      if (err) { msg.className = "impmsg ng"; msg.textContent = err; return; }
      renderHistory();   // 描き直しで古いメッセージ欄は消えるので、新しい方に出す
      const m2 = document.getElementById("impMsg");
      if (m2) { m2.className = "impmsg ok"; m2.textContent = d.label + " を " + d.questions.length + "問 読み込みました"; }
    };
    r.readAsText(file);
  });
  p.querySelectorAll("[data-del]").forEach(function (b) {
    b.addEventListener("click", function () {
      if (!confirm(IMPORTED[b.dataset.del].label + " を削除します。よろしいですか。")) return;
      delete IMPORTED[b.dataset.del];
      saveImported(); refreshImportedSet(); renderHistory();
    });
  });
}

/* ---------- 履歴タブ ---------- */
let HFILTER = "miss";
/* 科目・セットごとの取り組み状況。正答率は「解いた問題のうち、直近の解答が正解の割合」（累計だと最初の失点を引きずるため） */
function segTableHtml() {
  const weakSet = new Set(weakList());
  function row(label, list, head) {
    const ans = list.filter(function (q) { return histOf(q); });
    const ok = ans.filter(function (q) { return histOf(q).last === 1; }).length;
    const rate = ans.length ? Math.round(ok / ans.length * 100) : null;
    const done = list.length ? Math.round(ans.length / list.length * 100) : 0;
    const w = list.filter(function (q) { return weakSet.has(q); }).length;
    const rc = rate === null ? "" : rate >= 70 ? " good" : rate < 50 ? " bad" : "";
    return '<tr class="' + (head ? "gh" : "") + '"><td>' + label + '</td>' +
      '<td>' + ans.length + '/' + list.length + '<span class="segbar"><i style="width:' + done + '%"></i></span></td>' +
      '<td class="rate' + rc + '">' + (rate === null ? "—" : rate + "%") + '</td>' +
      '<td>' + (w || "") + '</td></tr>';
  }
  let rows = "", fields = "";
  SEG_FIELDS = [];
  (GROUPED ? GROUPS : [null]).forEach(function (g) {
    const sets = SUBJECT.sets.filter(function (d) { return !g || d.group === g; });
    const all = [].concat.apply([], sets.map(function (d) { return SETS[d.key]; }));
    if (g) rows += row(g, all, true);
    sets.forEach(function (d) { rows += row(d.label, SETS[d.key], false); });
    // 分野（f）ごと：手をつけていない割合が大きい順、同じなら正答率が低い順
    const byF = {};
    all.forEach(function (q) { (byF[q.f] = byF[q.f] || []).push(q); });
    const fl = Object.keys(byF).map(function (f) {
      const list = byF[f];
      const ans = list.filter(function (q) { return histOf(q); });
      const ok = ans.filter(function (q) { return histOf(q).last === 1; }).length;
      return { f: f, list: list, un: 1 - ans.length / list.length, rate: ans.length ? ok / ans.length : -1 };
    }).sort(function (a, b) { return (b.un - a.un) || (a.rate - b.rate); });
    let fr = "";
    fl.forEach(function (x) {
      const k = SEG_FIELDS.push(x.list) - 1;
      fr += row(x.f.replace(/^(基礎|適性):/, ""), x.list, false).replace("</tr>", '<td><button class="segrun" data-seg="' + k + '">解く</button></td></tr>');
    });
    const nUn = fl.filter(function (x) { return x.un === 1; }).length;
    const nLow = fl.filter(function (x) { return x.rate >= 0 && x.rate < 0.5; }).length;
    const gk = g || "all";
    fields += '<details class="segf" data-g="' + gk + '"' + (SEGF_OPEN[gk] ? " open" : "") + '><summary>' + (g ? g + "の" : "") + '分野別　<span class="segsum">' + fl.length + '分野中 手つかず' + nUn + '・50%未満' + nLow + '</span></summary>' +
      '<table class="seg"><thead><tr><th></th><th>着手</th><th>正答率</th><th>苦手</th><th></th></tr></thead><tbody>' + fr + '</tbody></table></details>';
  });
  return '<h3 class="segh">科目・セットごとの取り組み</h3>' +
    '<table class="seg"><thead><tr><th></th><th>着手</th><th>正答率</th><th>苦手</th></tr></thead><tbody>' + rows + '</tbody></table>' +
    '<p class="segnote">正答率＝解いた問題のうち直近の解答が正解の割合。緑は70%以上（アプリの目標）、赤は50%未満。</p>' +
    fields +
    '<p class="segnote">「解く」はその分野だけで出題します（まだ解いていない問題と苦手を優先）。</p>';
}
let SEG_FIELDS = [];
const SEGF_OPEN = {};
let HLIST_OPEN = false;
function renderHistory() {
  const p = document.getElementById("pane-hist");
  const all = SETS.all;
  const L = lifetimeStats();
  const answered = all.filter(function (q) { return histOf(q); });
  const weak = weakList();

  let list = all.map(function (q) { return { q: q, h: histOf(q) }; });
  if (HFILTER === "miss") list = list.filter(function (r) { return r.h && (r.h.last === 0 || r.h.ok / r.h.n < 0.6); });
  else if (HFILTER === "none") list = list.filter(function (r) { return !r.h; });
  else if (HFILTER === "bm") list = list.filter(function (r) { return isBookmarked(r.q); });
  else if (HFILTER === "memo") list = list.filter(function (r) { return !!memoOf(r.q); });
  const nBm = all.filter(isBookmarked).length;
  const nMemo = all.filter(function (q) { return !!memoOf(q); }).length;
  // 正答率が低い順、未回答は末尾
  list.sort(function (a, b) {
    if (!a.h && !b.h) return 0;
    if (!a.h) return 1;
    if (!b.h) return -1;
    return (a.h.ok / a.h.n) - (b.h.ok / b.h.n);
  });

  let rows = "";
  list.forEach(function (r) {
    const h = r.h;
    const cls = !h ? "none" : (h.last === 0 ? "miss" : "");
    const pct = h ? Math.round(h.ok / h.n * 100) : 0;
    const bad = h && pct < 60 ? " bad" : "";
    rows += '<div class="hrow ' + cls + '">' +
      '<div><div class="hf">' + (isBookmarked(r.q) ? '<span class="bmk" aria-label="ブックマーク">★</span>' : '') +
        r.q.f + '</div><div class="hq"></div></div>' +
      '<div class="hn">' + (h ? '<b>' + h.ok + '</b> / ' + h.n + '　' + pct + '%' : '未回答') +
        (h ? '<span class="hbar' + bad + '"><i style="width:' + pct + '%"></i></span>' : '') + '</div>' +
      '</div>';
  });

  p.innerHTML =
    '<div class="hsum">' +
      '<div>累計解答<b>' + L.answers + '</b></div>' +
      '<div>累計正答率<b>' + (L.answers ? Math.round(L.correct / L.answers * 100) + '%' : '—') + '</b></div>' +
      '<div>着手<b>' + answered.length + ' / ' + all.length + '</b></div>' +
      '<div class="warn">苦手<b>' + weak.length + '</b></div>' +
    '</div>' +
    segTableHtml() +
    '<details class="hlist"' + (HLIST_OPEN ? " open" : "") + '><summary>問題ごとの一覧を見る（間違えた問題・未回答・ブックマーク）</summary>' +
    '<div class="filters">' +
      '<button class="flt" data-f="miss" aria-pressed="' + (HFILTER === "miss") + '">間違えた問題</button>' +
      '<button class="flt" data-f="all" aria-pressed="' + (HFILTER === "all") + '">すべて</button>' +
      '<button class="flt" data-f="none" aria-pressed="' + (HFILTER === "none") + '">未回答</button>' +
      '<button class="flt" data-f="bm" aria-pressed="' + (HFILTER === "bm") + '">★ ブックマーク ' + nBm + '</button>' +
      '<button class="flt" data-f="memo" aria-pressed="' + (HFILTER === "memo") + '">メモあり ' + nMemo + '</button>' +
    '</div>' +
    (list.length
      ? '<div class="hact"><button class="btn" id="solveThese">この ' + list.length + '問を解く</button>' +
        (L.answers ? '<button class="reset" id="resetHist2">履歴をリセット</button>' : '') + '</div>' + rows
      : '<p class="empty">' + (HFILTER === "miss"
          ? "間違えた問題はありません。まだ解いていない場合は「未回答」から始めてください。"
          : HFILTER === "none" ? "すべての問題に一度は解答済みです。"
          : HFILTER === "bm" ? "ブックマークした問題はありません。クイズ画面で問題の右上の「☆ ブックマーク」を押すと、ここに集まります。"
          : HFILTER === "memo" ? "メモを書いた問題はありません。クイズ画面で問題の右上の「メモ」から書けます。"
          : "履歴がありません。") + '</p>')
    + '</details>'
    + renderDiagnosis() + renderBackup() + renderDataManager();

  // 問題文・メモは利用者の入力を含むので textContent で入れる
  p.querySelectorAll(".hrow").forEach(function (row, idx) {
    const r = list[idx];
    if (!r) return;
    row.querySelector(".hq").textContent = r.q.q.replace(/<br>/g, "\n");
    const m = memoOf(r.q);
    if (m) {
      const d = document.createElement("div");
      d.className = "hmemo";
      d.textContent = m;
      row.appendChild(d);
    }
  });

  p.querySelectorAll(".flt").forEach(function (b) {
    b.addEventListener("click", function () { HFILTER = b.dataset.f; HLIST_OPEN = true; renderHistory(); });
  });
  const hl = p.querySelector(".hlist");
  if (hl) hl.addEventListener("toggle", function () { HLIST_OPEN = hl.open; });
  p.querySelectorAll(".segf").forEach(function (d) {
    d.addEventListener("toggle", function () { SEGF_OPEN[d.dataset.g] = d.open; });
  });
  p.querySelectorAll(".segrun").forEach(function (b) {
    b.addEventListener("click", function () {
      const list = SEG_FIELDS[Number(b.dataset.seg)];
      if (!list || !list.length) return;
      CUSTOM_LIST = list.slice();
      CURRENT_SET = "custom";
      document.querySelectorAll(".set").forEach(function (o) { o.setAttribute("aria-pressed", "false"); });
      selectTab("quiz");
      rebuild();
    });
  });
  const st = p.querySelector("#solveThese");
  if (st) st.addEventListener("click", function () {
    CUSTOM_LIST = list.map(function (r) { return r.q; });
    CURRENT_SET = "custom";
    document.querySelectorAll(".set").forEach(function (o) { o.setAttribute("aria-pressed", "false"); });
    selectTab("quiz");
    rebuild();
  });
  wireBackup(p);
  wireDataManager(p);
  const cd = p.querySelector("#copyDiag");
  if (cd) cd.addEventListener("click", function () {
    const txt = diagnosisText();
    const msg = p.querySelector("#copyMsg");
    function done() { msg.textContent = "コピーしました。Claudeに貼れます"; setTimeout(function () { msg.textContent = ""; }, 4000); }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt).then(done, function () { fallback(); });
    } else { fallback(); }
    function fallback() {
      const ta = document.createElement("textarea");
      ta.value = txt; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); done(); } catch (e) { msg.textContent = "コピーできませんでした"; }
      document.body.removeChild(ta);
    }
  });
  const rh2 = p.querySelector("#resetHist2");
  if (rh2) rh2.addEventListener("click", function () {
    if (!confirm("これまでの解答履歴をすべて削除します。よろしいですか。")) return;
    HIST = {}; saveHist(); refreshWeakBtn(); renderHistory();
  });
}

/* ---------- 頻出テーマ ---------- */
const YEARS = ["R1","R2","R3","R4","R5","R6","R7"];
function renderTopics() {
  const p = document.getElementById("pane-topics");
  if (p.dataset.done) return;
  const TP = SUBJECT.topicsPane;

  let stats = '<div class="scroll"><table class="stats"><thead><tr><th>出典・分野</th>' +
    YEARS.map(y => '<th>' + y + '</th>').join('') + '<th>7年計</th><th>比率</th></tr></thead><tbody>';
  FIELD_STATS.forEach(f => {
    const hi = TP.highlight.indexOf(f.name) >= 0 ? ' class="hi"' : '';
    stats += '<tr' + hi + '><td><span class="nm">' + f.name + '</span><span class="sb">' + f.sub + '</span></td>' +
      f.y.map(v => '<td>' + v + '</td>').join('') +
      '<td><b>' + f.total + '</b></td><td>' + Math.round(f.total / TP.total * 100) + '%</td></tr>';
  });
  stats += '</tbody></table></div>';

  let list = '';
  TOPIC_LIST.forEach(t => {
    list += '<div class="topic">' +
      '<div class="cnt">' + t.n + '<small>回</small></div>' +
      '<div class="ti">' + t.t + '</div>' +
      '<div class="meta"><span class="f">' + t.f + '</span>　' + t.cites.join('・') +
      (t.flag ? '　<span class="flag">' + t.flag + '</span>' : '') + '</div>' +
      '<div class="nt">' + t.note + '</div>' +
    '</div>';
  });

  p.innerHTML =
    '<p class="lede">' + TP.lede + '</p>' +
    stats +
    '<p class="lede">' + TP.passNote + '</p>' +
    '<h2 style="font-family:\'Hiragino Mincho ProN\',\'Yu Mincho\',serif;font-size:1.05rem;margin:1.6rem 0 .2rem">' + TP.listHead + '</h2>' +
    '<p class="lede" style="margin-top:.2rem">' + TP.listLede + '</p>' +
    list +
    '<div class="foot">' + TP.foot + '</div>';
  p.dataset.done = "1";
}

/* ---------- タブ ---------- */
const PANES = { quiz: "pane-quiz", topics: "pane-topics", hist: "pane-hist" };
const TABS  = { quiz: "tab-quiz",  topics: "tab-topics",  hist: "tab-hist"  };
if (!HAS_TOPICS) {
  document.getElementById(TABS.topics).remove();
  document.getElementById(PANES.topics).remove();
  delete PANES.topics; delete TABS.topics;
}
function selectTab(which) {
  Object.keys(PANES).forEach(function (k) {
    document.getElementById(PANES[k]).hidden = (k !== which);
    document.getElementById(TABS[k]).setAttribute("aria-selected", String(k === which));
  });
  if (which === "topics") renderTopics();
  if (which === "hist") renderHistory();
  window.scrollTo({ top: 0, behavior: "instant" });
}
Object.keys(TABS).forEach(function (k) {
  document.getElementById(TABS[k]).addEventListener("click", function () {
    if (k === "quiz" && !document.getElementById("pane-quiz").hidden && !AT_HOME) { goHome(); return; }
    selectTab(k);
  });
});

refreshImportedSet();
renderCountdown();
updateUnvUI();
refreshWeakBtn();
(function boot() {
  if (!STORAGE_OK) {
    document.getElementById("resumeHost").innerHTML =
      '<div class="nostore"><b>この端末では学習履歴を保存できません。</b>' +
      'プライベートブラウズを使っている場合は通常のウィンドウで開いてください。' +
      '履歴・進捗ともにページを閉じると消えます。</div>';
  }
  const sv = loadSession();
  if (sv) {
    CURRENT_SET = sv.set;
    LIMIT = sv.limit;
    document.querySelectorAll(".lim").forEach(function (o) {
      o.setAttribute("aria-pressed", String(Number(o.dataset.lim) === LIMIT));
    });
    Q.length = 0; RETRY_FROM = -1; sv.list.forEach(function (q) { Q.push(q); });
    i = sv.i; correct = sv.correct; RETRY_FROM = sv.retry;
    answers.length = 0; sv.answers.forEach(function (a, idx) { answers[idx] = a; });
    if (SETS[sv.set] || sv.set === "weak" || sv.set === "bm" || sv.set === "auto") applySetButtons(sv.set); else applySetButtons("__none__");
    updatePickInfo();
    showResume(sv.i, Q.length);
    render();
  } else {
    Q.length = 0; RETRY_FROM = -1;   // 初期値のまま「続きから」が出ないように
    goHome();       // 解きかけの回がないときは、道のりと出題範囲を選ぶ画面から始める
  }
})();
