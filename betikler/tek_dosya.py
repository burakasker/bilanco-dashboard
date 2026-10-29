"""web/ altındaki sayfayı veri gömülü tek HTML dosyasına çevirir (claude.ai artifact için).
Kullanım: python3 betikler/tek_dosya.py <çıktı.html>"""
import base64
import json
import pathlib
import re
import sys

w = pathlib.Path(__file__).resolve().parent.parent / "web"
html = (w / "index.html").read_text()
css = (w / "style.css").read_text().replace(
    "position: sticky; top: 0;", "position: sticky; top: env(safe-area-inset-top, 0px);")
js = (w / "app.js").read_text().replace(
    'fetch("data/panel.json").then((r) => r.json())',
    'Promise.resolve(JSON.parse(document.getElementById("veri").textContent))')
assert "Promise.resolve" in js
data = (w / "data" / "panel.json").read_text()
def analiz_oku(tur):
    yol = w / "data" / f"analiz_{tur}.json"
    a = json.loads(yol.read_text()) if yol.exists() else None
    if a:
        a.pop("olgular", None)  # sayfada gösterilmiyor, boyut için atılır
        a.pop("kullanim", None)
    return a


analiz, analiz_portfoy = analiz_oku("banka"), analiz_oku("portfoy")
logolar = {f.stem: "data:image/png;base64," + base64.b64encode(f.read_bytes()).decode()
           for f in sorted((w / "logolar").glob("*.png"))}
logolar_pys = {f.stem: "data:image/png;base64," + base64.b64encode(f.read_bytes()).decode()
               for f in sorted((w / "logolar" / "pys").glob("*.png"))}
head = re.search(r"<head>(.*?)</head>", html, re.S).group(1)
head = re.sub(r'<meta charset[^>]*>\s*|<meta name="viewport"[^>]*>\s*|<link rel="stylesheet" href="style.css">', "", head)
body = re.search(r"<body>(.*?)</body>", html, re.S).group(1).replace('<script src="app.js"></script>', "")
pathlib.Path(sys.argv[1]).write_text(
    f'{head.strip()}\n<style>\n{css}</style>\n{body.strip()}\n'
    f'<script type="application/json" id="veri">{data}</script>\n'
    f'<script>window.ANALIZ_BANKA = {json.dumps(analiz, ensure_ascii=False)};\n'
    f'window.ANALIZ_PORTFOY = {json.dumps(analiz_portfoy, ensure_ascii=False)};</script>\n'
    f'<script>window.LOGOLAR = {json.dumps(logolar)};\nwindow.LOGOLAR_PYS = {json.dumps(logolar_pys)};</script>\n<script>\n{js}</script>\n')
