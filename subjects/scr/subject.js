/* GARP SCR（Sustainability and Climate Risk）の概念用語クイズ。問題文・選択肢は英語（本番と同じ）、解説は日本語。
   範囲は GARP 2026 SCR Study Guide & Learning Objectives の各章の学習目標。定義は公開の一次資料（IPCC・NGFS・ISSB・TCFD・PCAF・ICMA など）で裏取りし、GARP の教材本文は使わない */
const SUBJECT = {
  id: "scr",
  name: "SCR",
  groupLabel: "SCR",
  title: "GARP SCR 用語クイズ｜気候・サステナビリティ金融",
  description: "GARP SCR（Sustainability and Climate Risk）の概念用語を英語の4択で学ぶクイズ。解説は日本語。",
  eyebrow: "GARP SCR｜2027年4月受験",
  h1: "SCR 用語クイズ",
  intro: "SCR の全10章の学習目標から選んだ概念用語を、本番と同じ英語の4択にしました（すべて自作）。解説は日本語で、紛らわしい選択肢が何を指すかと出典を付けています。略語の正式名称は試験当日に一覧が配られるので、ここでは「何をするか・何が違うか」で問います。",
  ver: "版 2026-10-18",
  storagePrefix: "scr_",
  sets: [
    { key: "scr1", label: "1〜5章（気候・サステナビリティ・リスク・政策・グリーンファイナンス）", short: "SCR 1〜5章", data: "SCR_A_DATA", default: true },
    { key: "scr2", label: "6〜10章（計測・シナリオ・ネットゼロ・自然・移行計画）", short: "SCR 6〜10章", data: "SCR_B_DATA" }
  ],
  allSetLabel: "まとめて",
  examDayDefault: "2027-04-18",
  passLine: "公式の合格基準は非公表（80問・4時間）",
  emptyMessage: "SCR の問題は準備中です。",
  noWhyBox: true,
  autoNote: "まだ解いていない問題から出します",
  vlabel: { primary: "◎ IPCC・NGFS・ISSB・TCFD・PCAF・ICMA など発行元の公開文書で確認" },
  files: ["terms_a.js", "terms_b.js"]
};
