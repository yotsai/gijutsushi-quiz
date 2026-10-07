/* 技術士第一次試験・適性科目。tekisei.js＝法令・倫理綱領、tekisei2.js＝安全工学・技術者倫理・AI・SDGs・社会的責任など */
const SUBJECT = {
  id: "tekisei",
  name: "適性科目",
  groupLabel: "適性",
  title: "技術士一次試験 適性科目クイズ",
  description: "技術士第一次試験・適性科目（技術者倫理）の学習ツール。",
  eyebrow: "技術士第一次試験｜適性科目",
  h1: "適性科目クイズ",
  intro: "適性科目の予想問題を4択にしました（すべて自作）。法令・倫理綱領（技術士法第4章・技術士倫理綱領・製造物責任・知的財産・公益通報・ハラスメント・個人情報）と、安全・倫理・社会（安全工学とリスク・技術者倫理・研究倫理・AIと新技術・SDGs・社会的責任・BCPなど）の2つに分けています。過去問R1再〜R7で出た論点には解説に出題年を付けています。選ぶと即座に正誤と解説が出ます。",
  ver: "版 2026-10-07",

  storagePrefix: "tekisei_",

  sets: [
    { key: "tekisei", label: "法令・倫理綱領", short: "適性 法令・倫理綱領", data: "TEKISEI_DATA", default: true },
    { key: "tekisei2", label: "安全・倫理・社会", short: "適性 安全・倫理・社会", data: "TEKISEI2_DATA" }
  ],
  allSetLabel: "まとめて",
  examDayDefault: "2026-11-22",
  emptyMessage: "適性科目の問題は準備中です。",

  files: ["tekisei.js", "tekisei2.js"]
};
