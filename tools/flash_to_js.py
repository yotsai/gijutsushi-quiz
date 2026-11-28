"""career-master の flash.json を subjects/nijishi/nijishi.js に変換する。
使い方: python3 tools/flash_to_js.py <flash.json> subjects/nijishi/nijishi.js"""
import json, html, sys
src, dst = sys.argv[1], sys.argv[2]
d = json.load(open(src, encoding='utf-8'))
plan, term = [], []
pri = {"A": [], "B": [], "C": []}
# 優先度（2026-11-28）：A＝必須Ⅰの国の計画と、得意分野（気候・エネルギー・金融開示）・Ⅱ-1予測の上位、B＝循環・自然など書ける幅を広げるもの、C＝専門外の保険（4問から1問なので深追いしない）
TIER_C = ("クマ", "外来生物", "PFOS", "INC", "マイクロプラスチック", "底層溶存酸素")
TIER_B = ("CCS", "再資源化事業等高度化法", "プラスチック資源循環促進法", "食品ロス", "地域生物多様性増進法", "ネイチャーポジティブ", "廃棄物処理法", "COP17")
TIER_NOTE = {"A": "必須Ⅰの国の計画、または得意分野・Ⅱ-1予測の上位。中身まで答案に書けるように",
             "B": "書ける問題の幅を広げる分野。要点と数字を1つ",
             "C": "専門外の保険。何の話かと一番大事な数字だけでよい"}
def tier_of(deck):
    if deck.startswith("計画"): return "A"
    if any(k in deck for k in TIER_C): return "C"
    if any(k in deck for k in TIER_B): return "B"
    return "A"

e = lambda s: html.escape(s or '', quote=False)
# 出典はタップで開けるリンクにする。表示は発行元の名前（長いURLをそのまま見せない）
ORG = [("wbgt.env.go.jp", "環境省 熱中症予防情報サイト"), ("plastic-circulation.env.go.jp", "環境省 プラスチック資源循環"), ("env.go.jp", "環境省"),
       ("laws.e-gov.go.jp", "e-Gov法令検索"), ("cas.go.jp", "内閣官房"), ("ssb-j.jp", "SSBJ（サステナビリティ基準委員会）"),
       ("enecho.meti.go.jp", "資源エネルギー庁"), ("meti.go.jp", "経済産業省"), ("nedo.go.jp", "NEDO"), ("mlit.go.jp", "国土交通省"),
       ("fsa.go.jp", "金融庁"), ("caa.go.jp", "消費者庁")]
def src_link(u):
    if not u.startswith(("https://", "http://")): return e(u)
    host = u.split("/")[2]
    org = next((n for d, n in ORG if host == d or host.endswith("." + d)), host)
    kind = "（PDF）" if u.lower().split("?")[0].endswith(".pdf") else ""
    return '<a href="' + html.escape(u, quote=True) + '" target="_blank" rel="noopener">' + e(org) + kind + 'を開く ↗</a>'
for x in d:
    deck = x['deck']; kind = '計画' if deck.startswith('計画') else '用語'
    name = deck.split('：', 1)[-1]
    tier = tier_of(deck)
    n = '<span class="pri pri' + tier + '">優先度 ' + tier + '</span> <small>' + TIER_NOTE[tier] + '</small><br><br><b>答え</b>　' + e(x['a'])
    if x.get('x'):
        # 解説は「背景／答案例：…／関連：…」を「／」で区切って持つ。見出しをつけて段落に分ける
        segs = [t.strip() for t in x['x'].split('／') if t.strip()]
        out = []
        for t in segs:
            if t.startswith('答案例：'): out.append('<b>答案に書くなら</b>　' + e(t[4:]))
            elif t.startswith('関連：'): out.append('<b>関連</b>　' + e(t[3:]))
            else: out.append('<b>解説</b>　' + e(t[3:] if t.startswith('背景：') else t))
        n += '<br><br>' + '<br><br>'.join(out)
    if x.get('hint'): n += '<br><br><b>答案での使い方</b>　' + e(x['hint'])
    if x.get('src'): n += '<br><br>【出典】' + src_link(x['src'])
    # 役割（課題・解決策・目標など＝答案のどこで使うか）があれば見出しに出す
    tag = e(name) + ("｜" + e(x['role']) if x.get('role') else "")
    item = {"f": "二次:" + kind, "q": "【" + tag + "】" + e(x['q']),
            "c": ["思い出せた（○）", "思い出せなかった（×）"], "a": 0, "n": n, "v": "primary", "keep": True}
    (plan if kind == '計画' else term).append(item)
    pri[tier].append(item)
with open(dst, 'w', encoding='utf-8') as f:
    f.write('/* 自動生成（tools/flash_to_js.py）。元＝career-master/research/gijutsushi-cards/flash/flash.json */\n')
    f.write('const NJ_PLAN_DATA = ' + json.dumps(plan, ensure_ascii=False) + ';\n')
    f.write('const NJ_TERM_DATA = ' + json.dumps(term, ensure_ascii=False) + ';\n')
    for k in "ABC":
        f.write('const NJ_PRI_' + k + '_DATA = ' + json.dumps(pri[k], ensure_ascii=False) + ';\n')
print(len(plan), len(term), {k: len(v) for k, v in pri.items()})
