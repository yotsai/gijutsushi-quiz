/* 技術士第二次試験（環境部門 19-1 環境保全計画）の暗記カード。
   一問一答：問いを見て思い出す →「思い出せた／思い出せなかった」を押す → 答えを確認する。
   元資料は career-master の材料カード（必須Ⅰ用・国の計画8つ）と用語カード（選択Ⅱ-1用・24個）で、どちらも一次資料で作成し別の照合役が照合済み */
const SUBJECT = {
  id: "nijishi",
  name: "第二次 暗記カード",
  groupLabel: "二次",
  title: "技術士第二次試験 環境部門 暗記カード",
  description: "技術士第二次試験（環境部門・環境保全計画）の暗記用一問一答。国の計画の目標・柱と、選択Ⅱ-1の用語の定義・制度・数字。",
  eyebrow: "技術士第二次試験｜環境部門",
  h1: "第二次 暗記カード",
  intro: "問いを見て答えを思い出し、「思い出せた／思い出せなかった」を押すと答えが出ます。思い出せなかったカードは翌日にまた出ます。",
  storagePrefix: "nijishi_",
  sets: [
    { key: "njplan", label: "国の計画（必須Ⅰ）", short: "二次 国の計画", data: "NJ_PLAN_DATA", default: true },
    { key: "njterm", label: "用語（選択Ⅱ-1）", short: "二次 用語", data: "NJ_TERM_DATA" }
  ],
  allSetLabel: "まとめて",
  examDayDefault: "2027-07-18",
  emptyMessage: "暗記カードは準備中です。",
  files: ["nijishi.js", "reading.js"]
};
