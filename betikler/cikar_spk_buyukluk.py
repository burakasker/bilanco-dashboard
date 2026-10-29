"""SPK'nın yayımladığı yönetilen toplam portföy büyüklüğünü çeyrek sonları için çeker.

- 2024 Ekim öncesi: SPK yıl sayfalarındaki aylık .xls dosyaları (yalnız toplam).
- 2024 Ekim ve sonrası: "Kasım 2024 Sonrası Portföy Değerleri" sayfasının API'si.
Ham dosyalar veri/ham_spk/ altında saklanır, varsa yeniden indirilmez.
xlrd gerektirir: `npm run buyukluk` (uv ile çalışır).
Çıktı: veri/pys_buyukluk.csv
"""
import csv
import json
import urllib.request

import xlrd

from ortak import KOK, PYS

HAM = KOK / "veri" / "ham_spk"
XLS_KLASOR = {2023: "63e34c2e8f95db22d8dcc123", 2024: "65c482de8f95db0d3c109e0d"}
API = "https://ws.spk.gov.tr/SeryetPortfoyDegerleri/api/GetPortfoyDegerleri?yil={y}&ay={a}"
# SPK listesindeki ad parçası; Kuveyt Türk Portföy 2023/3Ç'ye kadar "KT PORTFÖY" adıyla geçer
AD = {
    "yapikredi": ["YAPI KREDİ PORTFÖY"],
    "akbank": ["AK PORTFÖY"],
    "isbank": ["İŞ PORTFÖY"],
    "garanti": ["GARANTİ PORTFÖY"],
    "teb": ["TEB PORTFÖY"],
    "qnb": ["QNB PORTFÖY", "QNB FİNANS PORTFÖY"],
    "denizbank": ["DENİZ PORTFÖY"],
    "kuveytturk": ["KUVEYT TÜRK PORTFÖY", "KUVEYT TURK PORTFÖY", "KT PORTFÖY"],
}
DONEMLER = [(y, q) for y in (2023, 2024, 2025, 2026) for q in (1, 2, 3, 4) if not (y == 2026 and q > 2)]


def indir(url, yol):
    if not yol.exists():
        yol.parent.mkdir(parents=True, exist_ok=True)
        with urllib.request.urlopen(url, timeout=60) as r:
            yol.write_bytes(r.read())
    return yol


def ay_verisi(y, a):
    """ad -> TL; kaynak etiketi ve adresiyle."""
    if (y, a) >= (2024, 10):
        url = API.format(y=y, a=a)
        yol = indir(url, HAM / f"{y}{a:02d}.json")
        return {r["sirketAdi"]: r["yonetilenToplamPortfoyBuyuklugu"] for r in json.loads(yol.read_text())}, f"SPK API {y}/{a:02d}", url
    dosya = f"{y % 100}{a:02d}.xls"
    url = f"https://spk.gov.tr/data/{XLS_KLASOR[y]}/{dosya}"
    yol = indir(url, HAM / dosya)
    sh = xlrd.open_workbook(yol).sheet_by_index(0)
    return {str(r[0]).strip(): r[1] for r in (sh.row_values(i) for i in range(sh.nrows))
            if len(r) > 1 and isinstance(r[1], float)}, f"SPK {dosya}", url


def main():
    satirlar = []
    for y, q in DONEMLER:
        veri, kaynak, url = ay_verisi(y, 3 * q)
        for kod in PYS:
            eslesen = [(ad, v) for ad, v in veri.items() if any(ad.upper().startswith(p) for p in AD[kod])]
            assert len(eslesen) == 1, (kod, y, q, eslesen)
            ad, tl = eslesen[0]
            assert tl > 0, (kod, y, q)
            satirlar.append({"pys": kod, "donem": f"{y}_{q}C", "toplam_tl": round(tl, 2), "spk_ad": ad, "kaynak": kaynak, "url": url})
    with open(KOK / "veri" / "pys_buyukluk.csv", "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(satirlar[0]))
        w.writeheader()
        w.writerows(satirlar)
    print(f"{len(satirlar)} satır -> veri/pys_buyukluk.csv")


if __name__ == "__main__":
    main()
