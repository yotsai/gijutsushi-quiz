/* 技術士第一次試験・基礎科目（群1〜群5）。単体で出すときは storagePrefix で履歴を分ける */
const SUBJECT = {
  id: "kiso",
  name: "基礎科目",
  groupLabel: "基礎",
  title: "技術士一次試験 基礎科目（群1〜5）クイズ",
  description: "技術士第一次試験・基礎科目（群1設計・計画／群2情報・論理／群3解析／群4材料・化学・バイオ／群5環境・エネルギー・技術）の学習ツール。過去問の出題論点にもとづく自作の4択クイズ。",
  eyebrow: "技術士第一次試験｜基礎科目",
  h1: "基礎科目クイズ",
  intro: "基礎科目の5つの群（設計・計画／情報・論理／解析／材料・化学・バイオ／環境・エネルギー・技術）の予想問題を4択にしました。過去8年の出題論点を数え、出る回数の多い論点から作っています（すべて自作）。選ぶと即座に正誤と解説が出ます。キーボードの 1〜4 と Enter でも進められます。問題ごとに<b>ブックマーク</b>と<b>メモ</b>を残せます（この端末に保存）。",
  ver: "版 2026-10-04",

  storagePrefix: "kiso_",

  sets: [
    { key: "kiso1", label: "群1 設計・計画", short: "基礎 群1 設計・計画", data: "KISO1_DATA" },
    { key: "kiso2", label: "群2 情報・論理", short: "基礎 群2 情報・論理", data: "KISO2_DATA" },
    { key: "kiso3", label: "群3 解析", short: "基礎 群3 解析", data: "KISO3_DATA" },
    { key: "kiso4", label: "群4 材料・化学・バイオ", short: "基礎 群4 材料・化学・バイオ", data: "KISO4_DATA" },
    { key: "kiso", label: "群5 環境・エネルギー", short: "基礎 群5 環境・エネルギー", data: "KISO_DATA", default: true }
  ],
  allSetLabel: "まとめて",
  examDayDefault: "2026-11-22",
  emptyMessage: "この科目の問題は準備中です。",

  files: ["kiso_g1.js", "kiso_g2.js", "kiso_g3.js", "kiso_g4.js", "kiso.js", "easy.js"]
};
