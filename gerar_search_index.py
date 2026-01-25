import os, re, json, html
from collections import Counter

ROOT = "."          # pasta do projeto
OUT = "search-index.js"

IGNORAR = {
    "header.html", "footer.html", "aside.html"
}

STOPWORDS = set("""
a o os as um uma uns umas de da do das dos em no na nos nas por para com sem
e ou que como se ao aos à às sua seu suas seus
""".split())

def strip_tags(text: str) -> str:
    text = re.sub(r"<script\b[^>]*>.*?</script>", " ", text, flags=re.I|re.S)
    text = re.sub(r"<style\b[^>]*>.*?</style>", " ", text, flags=re.I|re.S)
    text = re.sub(r"<[^>]+>", " ", text)
    text = html.unescape(text)
    return re.sub(r"\s+", " ", text).strip()

def get_first(pattern: str, s: str) -> str:
    m = re.search(pattern, s, flags=re.I|re.S)
    return (m.group(1).strip() if m else "")

def extract_all(pattern: str, s: str):
    return [re.sub(r"\s+", " ", m.strip()) for m in re.findall(pattern, s, flags=re.I|re.S)]

def normalize_token(t: str) -> str:
    t = t.lower()
    # remove pontuação e mantém letras/números/acentos
    t = re.sub(r"[^\w\u00C0-\u017F]+", " ", t)
    t = re.sub(r"\s+", " ", t).strip()
    return t

def filename_keywords(fname: str):
    base = fname.replace(".html", "")
    base = base.replace("_", " ").replace("-", " ")
    base = normalize_token(base)
    parts = [p for p in base.split() if p and p not in STOPWORDS and len(p) > 2]
    return parts

def top_terms_from_text(text: str, limit=15):
    text = normalize_token(text)
    tokens = [t for t in text.split() if t not in STOPWORDS and len(t) > 3]
    cnt = Counter(tokens)
    return [w for (w, _) in cnt.most_common(limit)]

items = []

for fname in sorted(os.listdir(ROOT)):
    if not fname.lower().endswith(".html"):
        continue
    if fname in IGNORAR:
        continue

    path = os.path.join(ROOT, fname)
    try:
        with open(path, "r", encoding="utf-8", errors="ignore") as f:
            raw = f.read()
    except:
        continue

    title = get_first(r"<title>(.*?)</title>", raw) or fname.replace(".html", "")

    # headings
    h1 = extract_all(r"<h1[^>]*>(.*?)</h1>", raw)
    h2 = extract_all(r"<h2[^>]*>(.*?)</h2>", raw)
    h3 = extract_all(r"<h3[^>]*>(.*?)</h3>", raw)

    # meta keywords/description (se existirem)
    meta_keywords = get_first(r'<meta\s+name=["\']keywords["\']\s+content=["\'](.*?)["\']', raw)
    meta_desc = get_first(r'<meta\s+name=["\']description["\']\s+content=["\'](.*?)["\']', raw)

    # texto de apoio (para termos comuns)
    text_for_terms = strip_tags(" ".join(h1 + h2 + h3) + " " + meta_desc + " " + meta_keywords)

    kw = []
    kw += filename_keywords(fname)
    kw += top_terms_from_text(strip_tags(title), limit=6)
    kw += top_terms_from_text(text_for_terms, limit=20)

    # tira duplicados preservando ordem
    seen = set()
    keywords = []
    for k in kw:
        k = normalize_token(k)
        if not k or k in seen:
            continue
        seen.add(k)
        keywords.append(k)

    items.append({
        "title": strip_tags(title),
        "url": fname,
        "keywords": keywords
    })

with open(OUT, "w", encoding="utf-8") as f:
    f.write("window.SEARCH_INDEX = ")
    json.dump(items, f, ensure_ascii=False, indent=2)
    f.write(";\n")

print(f"OK: gerado {OUT} com {len(items)} páginas.")
