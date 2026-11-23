"""career-master の想定問題・骨子・解答例（Markdown）を、アプリの「答案を読む」用データ subjects/nijishi/reading.js に変換する。
使い方: python3 tools/practice_to_js.py <career-master/research/gijutsushi-cards/practice> subjects/nijishi/reading.js"""
import sys, os, re, json, html

src, dst = sys.argv[1], sys.argv[2]
rd = lambda p: open(os.path.join(src, p), encoding='utf-8').read()

def inline(s):
    s = html.escape(s, quote=False)
    s = re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', s)
    s = re.sub(r'`([^`]+)`', r'\1', s)
    s = re.sub(r'([^\s、。（）「」]+?)(?:_[^\s、。（）「」]*)?\.md', r'\1', s)   # ファイル名は拡張子と枝番を落とす（想定問題_10問.md→想定問題）
    return s

def md2html(md):
    """見出し・箇条書き（入れ子）・番号つき・段落・コードブロックだけを扱う簡易変換"""
    out, para, in_code, code = [], [], False, []
    def flush():
        if para: out.append('<p>' + '<br>'.join(inline(x) for x in para) + '</p>'); para.clear()
    for line in md.split('\n'):
        if line.startswith('```'):
            if in_code: out.append('<pre>' + html.escape('\n'.join(code)) + '</pre>'); code = []
            else: flush()
            in_code = not in_code; continue
        if in_code: code.append(line); continue
        m = re.match(r'^(#{2,4})\s+(.*)', line)
        if m: flush(); out.append('<h%d>%s</h%d>' % (len(m.group(1)) + 2, inline(m.group(2)), len(m.group(1)) + 2)); continue
        m = re.match(r'^(\s*)(?:[-*]|\d+\.)\s+(.*)', line)
        if m and not re.match(r'^\d+\.\s*\S', line.strip()) or (m and line.startswith(' ')):
            flush(); lvl = len(m.group(1)) // 2
            out.append('<div class="rl l%d">%s</div>' % (min(lvl, 3), inline(m.group(2)))); continue
        if not line.strip(): flush(); continue
        if line.strip() == '---': flush(); continue
        para.append(line.strip())
    flush()
    return ''.join(out)

# 問題文：### 見出しごと
qmd = rd('想定問題_10問.md')
city = re.search(r'## 答案で使い回す「架空の市」.*?\n(.*?)\n---', qmd, re.S).group(1)
qs = {}
for m in re.finditer(r'^### (\S+) (.*?)\n(.*?)(?=^### |^## |\Z)', qmd, re.S | re.M):
    qs[m.group(1)] = (m.group(2).strip(), m.group(3).strip())
# 骨子：## 見出しごと
smd = rd('骨子と解答例/00_Claudeの骨子_10問.md')
sk = {}
for m in re.finditer(r'^## (\S+) (.*?)\n(.*?)(?=^## |^---|\Z)', smd, re.S | re.M):
    sk[m.group(1)] = m.group(3).strip()
KIND = lambda k: '必須Ⅰ' if k.startswith('Ⅰ') else ('選択Ⅱ-2' if k.startswith('Ⅱ') else '選択Ⅲ')
items = []
for k, (title, body) in qs.items():
    a = rd('骨子と解答例/%s_解答例.md' % k)
    ans = a.split('## 答案', 1)[1].split('## 欄外メモ', 1)[0].strip()
    memo = a.split('## 欄外メモ', 1)[1]
    # 出典の列挙（カードのファイル名と項目）はアプリでは省く
    memo = re.sub(r'^- 使った事実と出典：.*?(?=^- )', '', memo, flags=re.S | re.M).strip()
    # 「Ⅰ-Aと同じ」の設問を展開しない（問題文はそのまま）
    items.append({"id": k, "kind": KIND(k), "title": title,
                  "q": md2html(body), "sk": md2html(sk.get(k, '')), "ans": md2html(ans), "memo": md2html(memo)})
order = ['Ⅱ-2-A', 'Ⅰ-D', 'Ⅲ-A']   # 仕事に近い順に先頭へ
items.sort(key=lambda x: (order.index(x['id']) if x['id'] in order else 9, x['id']))
with open(dst, 'w', encoding='utf-8') as f:
    f.write('/* 自動生成（tools/practice_to_js.py）。元＝career-master/research/gijutsushi-cards/practice/。Claude作成の想定問題・骨子・解答例 */\n')
    # 本番の進め方・書き方ガイドは市販書籍から学んだ内容を含むので公開版には入れない（past_to_json.py の非公開ファイルに入れる）
    f.write('const NJ_READ = ' + json.dumps({"city": md2html(city), "items": items}, ensure_ascii=False) + ';\n')
print(len(items), [i['id'] for i in items])
