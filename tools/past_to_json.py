"""非公開の過去問（問題文＋骨子＋解答例）を、アプリの「答案を読む」に端末内だけで読み込むJSONにする。
出力は公開リポジトリに置かない（Googleドライブへ）。問題文は技術士会の著作物。
使い方: python3 tools/past_to_json.py <career-master/.../practice> <出力.json> R8 R7"""
import sys, os, re, json
sys.path.insert(0, os.path.dirname(__file__))
import importlib.util
spec = importlib.util.spec_from_file_location("p2j", os.path.join(os.path.dirname(__file__), "practice_to_js.py"))
src, dst, years = sys.argv[1], sys.argv[2], sys.argv[3:]
# practice_to_js.py の md2html を使い回す（モジュール読込時に本体が走らないよう、関数部分だけ取り出す）
code = open(os.path.join(os.path.dirname(__file__), "practice_to_js.py"), encoding="utf-8").read().split("# 問題文：")[0]
ns = {"sys": sys}; sys_argv = sys.argv; sys.argv = ["x", src, dst]; exec(code, ns); sys.argv = sys_argv
md2html = ns["md2html"]
KIND = lambda k: '必須Ⅰ' if k.startswith('Ⅰ') else ('選択Ⅱ-1' if k.startswith('Ⅱ-1') else ('選択Ⅱ-2' if k.startswith('Ⅱ-2') else '選択Ⅲ'))
items = []
for y in years:
    pm = open(os.path.join(src, "past", y + ".md"), encoding="utf-8").read()
    probs = {m.group(1): m.group(2).strip() for m in re.finditer(r'^## ' + y + r' (\S+)\s*\n(.*?)(?=^## |\Z)', pm, re.S | re.M)}
    for k, q in probs.items():
        f = os.path.join(src, "past", "answers", "%s_%s.md" % (y, k))
        if not os.path.exists(f): print("no answer:", y, k); continue
        a = open(f, encoding="utf-8").read()
        title = re.match(r'#\s*\S+\s+\S+\s*(.*)', a).group(1).strip() if re.match(r'#\s*\S+\s+\S+\s*(.*)', a) else k
        sec = lambda name: (re.search(r'^## ' + name + r'\s*\n(.*?)(?=^## |\Z)', a, re.S | re.M) or [None, ""])[1].strip() if re.search(r'^## ' + name, a, re.M) else ""
        memo = re.sub(r'^- 事実の出典.*?(?=^- |\Z)', '', sec('欄外メモ'), flags=re.S | re.M).strip()
        ans = sec("答案") or ("## 調べる一次資料\n" + sec("調べる一次資料") if sec("調べる一次資料") else "")
        qh = md2html(q)
        # 問題用紙の図を切り出した画像があれば、［図：…］の説明の段落を画像に置き換える（説明は画像の代替テキストに）
        fig = os.path.join(src, "past", "fig", "%s_%s.png" % (y, k))
        if os.path.exists(fig):
            import base64, html as _h
            uri = "data:image/png;base64," + base64.b64encode(open(fig, "rb").read()).decode()
            m = re.search(r'<p>(［図：.*?］)</p>', qh, re.S)
            tag = '<img class="rdfig" src="' + uri + '" alt="' + (_h.escape(re.sub(r'<[^>]+>', '', m.group(1))) if m else "図") + '">'
            qh = qh.replace(m.group(0), tag) if m else qh + tag
        items.append({"id": y + " " + k, "kind": KIND(k), "title": title, "q": qh, "sk": md2html(sec('骨子')),
                      "ans": md2html(ans), "memo": md2html(memo)})
order = {"必須Ⅰ": 0, "選択Ⅱ-2": 1, "選択Ⅲ": 2, "選択Ⅱ-1": 3}
items.sort(key=lambda x: (-int(x["id"][1:].split()[0]), order[x["kind"]], x["id"]))
guides = []
for fn, t in (('本番の進め方.md', '本番の進め方・答案のルール・気をつけること'), ('書き方ガイド_環境保全計画.md', '書き方ガイド（答案の型）'), ('面接の要点.md', '面接（口頭試験）の要点')):
    gp = os.path.join(src, '..', fn)
    if os.path.exists(gp):
        body = open(gp, encoding='utf-8').read().split('\n## ', 1)
        guides.append({"title": t, "html": md2html('## ' + body[1]) if len(body) > 1 else md2html(body[0])})
json.dump({"type": "reading", "guides": guides, "id": "past_" + "_".join(years), "label": "過去問 " + "・".join(years) + "（問題文は日本技術士会）",
           "items": items}, open(dst, "w", encoding="utf-8"), ensure_ascii=False)
print(len(items), "items ->", dst)
