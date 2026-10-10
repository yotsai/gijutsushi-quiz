#!/usr/bin/env node
/* engine/（共通の骨格・CSS・ロジック）と subjects/<id>/（科目ごとの設定とデータ）から、
   1ファイルで動く index.html を作る。Node 標準ライブラリだけで動く。

   node build.js                 全部（dist/ の4つ＋ルートの index.html）
   node build.js kiso            dist/kiso/ だけ
   node build.js all             dist/all/ だけ（専門＋基礎＋適性の全部入り）
   node build.js --root          all をビルドして、ルートの index.html にも書き出す（GitHub Pages 用）
   科目の id：senmon-kankyo / kiso / tekisei / all */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = __dirname;
const rd = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const IDS = ["senmon-kankyo", "kiso", "tekisei", "all"];

function loadSubject(id) {
  const file = path.join("subjects", id, "subject.js");
  if (!fs.existsSync(path.join(ROOT, file))) throw new Error("科目がありません: " + id);
  return new Function(rd(file) + "\nreturn SUBJECT;")();
}

/* 科目定義を、出力に必要な形（設定オブジェクト＋読み込むデータファイル）にまとめる */
function resolveSubject(id) {
  const s = loadSubject(id);
  const parts = s.combine ? s.combine.map((c) => loadSubject(c)) : [s];
  let cfg = s;
  if (s.combine) {
    const own = Object.assign({}, s);
    delete own.combine; delete own.base;
    cfg = Object.assign({}, loadSubject(s.base), own);
  }
  cfg = Object.assign({}, cfg);
  delete cfg.combine; delete cfg.base;
  cfg.sets = [].concat(...parts.map((p) => p.sets.map((d) => (s.combine ? Object.assign({ group: p.groupLabel || p.name }, d) : d))));
  cfg.topics = parts.some((p) => p.topics);
  cfg.fieldYears = Object.assign({}, ...parts.map((p) => p.fieldYears || {}));
  const files = [];
  parts.forEach((p) => {
    p.files.forEach((f) => files.push(path.join("subjects", p.id, f)));
    if (p.topics) files.push(path.join("subjects", p.id, "topics.js"));
  });
  delete cfg.files;
  return { cfg, files };
}

const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
/* <script> の中に埋め込んでも閉じタグや行区切りで壊れないようにする */
const safeJson = (o) => JSON.stringify(o).replace(/</g, "\\u003c").replace(new RegExp("\u2028", "g"), "\\u2028").replace(new RegExp("\u2029", "g"), "\\u2029");
function checkInline(name, src) {
  if (/<\/script|<!--/i.test(src)) throw new Error(name + " に </script または <!-- が含まれています（インライン化できません）");
  return src;
}
const fill = (tpl, key, val) => tpl.split("{{" + key + "}}").join(val);

function build(id, opts) {
  const { cfg, files } = resolveSubject(id);
  const dataSrc = files.map((f) => checkInline(f, rd(f)));

  // データ定数がすべて配列として存在するか確かめ、問題数を数える
  const names = [...new Set(cfg.sets.map((d) => d.data))];
  const counts = vm.runInNewContext(dataSrc.join("\n") + "\n;[" + names.map((n) => "Array.isArray(" + n + ") ? " + n + ".length : -1").join(",") + "]");
  names.forEach((n, k) => { if (counts[k] < 0) throw new Error(id + ": " + n + " が配列として定義されていません"); });

  const registry = "const SUBJECT = " + safeJson(cfg) + ";\nconst SUBJECT_DATA = { " + names.map((n) => n + ": " + n).join(", ") + " };";
  const scripts = dataSrc.map((src) => "<script>\n" + src.replace(/\n*$/, "\n") + "</script>").join("\n") +
    "\n<script>\n" + registry + "\n</script>";

  let html = rd("engine", "template.html");
  html = fill(html, "TITLE", esc(cfg.title));
  html = fill(html, "DESCRIPTION", esc(cfg.description));
  html = fill(html, "EYEBROW", esc(cfg.eyebrow));
  html = fill(html, "H1", esc(cfg.h1));
  html = fill(html, "INTRO", cfg.intro);
  html = fill(html, "VER", esc(cfg.ver));
  html = fill(html, "STYLE", checkInline("engine/style.css", rd("engine", "style.css").replace(/\n*$/, "")));
  html = fill(html, "DATA_SCRIPTS", scripts);
  html = fill(html, "APP", checkInline("engine/app.js", rd("engine", "app.js").replace(/\n*$/, "")));

  const note = opts.note;
  const out = "<!-- " + note + " -->\n" + html;
  const total = counts.reduce((a, b) => a + b, 0);
  return { out, total, cfg };
}

function writeDist(id) {
  const r = build(id, { note: "生成物です。直接編集しないでください。元は engine/ と subjects/ で、`node build.js " + id + "` で作り直します" });
  const dir = path.join(ROOT, "dist", id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "index.html"), r.out);
  fs.copyFileSync(path.join(ROOT, "_headers"), path.join(dir, "_headers"));
  console.log("dist/" + id + "/index.html  " + r.total + "問  " + Math.round(r.out.length / 1024) + "KB  storage=gq_" + (r.cfg.storagePrefix || ""));
  return r;
}

function writeRoot() {
  const r = build("all", { note: "生成物です。直接編集しないでください。元は engine/ と subjects/ で、`node build.js --root` で作り直します（GitHub Pages がこのファイルを配信します）" });
  // ルート版だけホーム画面に追加できるようにする（manifest・アイコン・オフライン用の sw.js）
  const pwaHead =
    '<link rel="manifest" href="manifest.webmanifest">\n' +
    '<link rel="apple-touch-icon" href="pwa/apple-touch-icon.png">\n' +
    '<meta name="apple-mobile-web-app-capable" content="yes">\n' +
    '<meta name="mobile-web-app-capable" content="yes">\n' +
    '<meta name="apple-mobile-web-app-title" content="技術士クイズ">\n' +
    '<meta name="apple-mobile-web-app-status-bar-style" content="default">\n' +
    '<meta name="theme-color" content="#0E5049">\n' +
    '<script>if ("serviceWorker" in navigator) window.addEventListener("load", function () { navigator.serviceWorker.register("sw.js").catch(function () {}); });</script>\n';
  fs.writeFileSync(path.join(ROOT, "index.html"), r.out.replace("</head>", pwaHead + "</head>"));
  console.log("index.html（ルート）  " + r.total + "問  " + Math.round(r.out.length / 1024) + "KB");
}

const arg = process.argv[2];
if (!arg) { IDS.forEach(writeDist); writeRoot(); }
else if (arg === "--root") { writeDist("all"); writeRoot(); }
else if (IDS.includes(arg)) writeDist(arg);
else { console.error("使い方: node build.js [" + IDS.join("|") + "|--root]"); process.exit(1); }
