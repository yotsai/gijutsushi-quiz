/* 技術士第一次試験・適性科目。問題データは tekisei.js（技術士法・倫理綱領・PL・知財・公益通報・ハラスメント・個人情報） */
const SUBJECT = {
  id: "tekisei",
  name: "適性科目",
  groupLabel: "適性",
  title: "技術士一次試験 適性科目クイズ",
  description: "技術士第一次試験・適性科目（技術者倫理）の学習ツール。",
  eyebrow: "技術士第一次試験｜適性科目",
  h1: "適性科目クイズ",
  intro: "適性科目の予想問題（技術士法第4章・技術士倫理綱領・製造物責任・知的財産・公益通報・ハラスメント・個人情報。すべて自作で、条文・原文に当たって作成）を4択と組合せ形式にしました。選ぶと即座に正誤と解説が出ます。キーボードの 1〜4 と Enter でも進められます。問題ごとに<b>ブックマーク</b>と<b>メモ</b>を残せます（この端末に保存）。",
  ver: "版 2026-09-29",

  storagePrefix: "tekisei_",

  sets: [
    { key: "tekisei", label: "適性科目", data: "TEKISEI_DATA", default: true }
  ],
  allSetLabel: "まとめて",
  examDayDefault: "2026-11-22",
  emptyMessage: "適性科目の問題は準備中です。",

  files: ["tekisei.js"]
};
