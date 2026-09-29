/* 専門・基礎・適性の全部入り（GitHub Pages のルートに出す版）。文言と設定は base の科目から引き継ぎ、セットとデータは combine の科目を束ねる。
   storagePrefix は空のまま＝既存の利用者の localStorage を引き継ぐ */
const SUBJECT = {
  id: "all",
  base: "senmon-kankyo",
  combine: ["senmon-kankyo", "kiso", "tekisei"],
  storagePrefix: ""
};
