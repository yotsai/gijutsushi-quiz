"""career-master の flash.json を subjects/nijishi/nijishi.js に変換する。
使い方: python3 tools/flash_to_js.py <flash.json> subjects/nijishi/nijishi.js"""
import json, html, sys
src, dst = sys.argv[1], sys.argv[2]
d = json.load(open(src, encoding='utf-8'))
plan, term = [], []
e = lambda s: html.escape(s or '', quote=False)
for x in d:
    deck = x['deck']; kind = '計画' if deck.startswith('計画') else '用語'
    name = deck.split('：', 1)[-1]
    n = '<b>答え</b>　' + e(x['a'])
    if x.get('hint'): n += '<br><br><b>使い方</b>　' + e(x['hint'])
    if x.get('src'): n += '<br><br>【出典】' + e(x['src'])
    item = {"f": "二次:" + kind, "q": "【" + e(name) + "】" + e(x['q']),
            "c": ["思い出せた（○）", "思い出せなかった（×）"], "a": 0, "n": n, "v": "primary", "keep": True}
    (plan if kind == '計画' else term).append(item)
with open(dst, 'w', encoding='utf-8') as f:
    f.write('/* 自動生成（tools/flash_to_js.py）。元＝career-master/research/gijutsushi-cards/flash/flash.json */\n')
    f.write('const NJ_PLAN_DATA = ' + json.dumps(plan, ensure_ascii=False) + ';\n')
    f.write('const NJ_TERM_DATA = ' + json.dumps(term, ensure_ascii=False) + ';\n')
print(len(plan), len(term))
