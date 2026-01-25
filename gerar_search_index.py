import os, re, json

ROOT = "."  # pasta do projeto
OUT = "search-index.js"

IGNORAR = {
    "header.html", "footer.html", "aside.html",
    "404.html"
}

def extrair_title(html_text: str, fallback: str) -> str:
    m = re.search(r"<title>(.*?)</title>", html_text, flags=re.I|re.S)
    if m:
        return re.sub(r"\s+", " ", m.group(1)).strip()
    return fallback

items = []

for fname in sorted(os.listdir(ROOT)):
    if not fname.lower().endswith(".html"):
        continue
    if fname in IGNORAR:
        continue

    path = os.path.join(ROOT, fname)
    try:
        with open(path, "r", encoding="utf-8", errors="ignore") as f:
            html = f.read()
    except:
        continue

    title = extrair_title(html, fname.replace(".html", ""))
    # keywords simples: você pode melhorar isso depois (ex.: h1, metas, etc.)
    keywords = []

    items.append({
        "title": title,
        "url": fname,
        "keywords": keywords
    })

with open(OUT, "w", encoding="utf-8") as f:
    f.write("window.SEARCH_INDEX = ")
    json.dump(items, f, ensure_ascii=False, indent=2)
    f.write(";\n")

print(f"OK: gerado {OUT} com {len(items)} páginas.")
