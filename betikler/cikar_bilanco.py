"""Konsolide bilançonun pasifinden mevduat satırını çeker (TP, YP, toplam).

Katılım bankasında (Kuveyt Türk) satır adı "TOPLANAN FONLAR", 2026/2Ç'den itibaren "KATILIM FONU".
Bilançoda önceki dönem sütunu bir önceki yıl sonudur (aynı çeyrek değil).
Çıktı: veri/ham_bilanco/<banka>/<YYYY_QC>.json
"""
import json
import re
import sys

from cikar_gelir_tablosu import birim_bul
from ortak import BANKALAR, DONEMLER, KOK, KONSOLIDE, pdf_sayfalar, sayi

HAM_BILANCO = KOK / "veri" / "ham_bilanco"
SATIR = re.compile(r"^\s*I\.?\s+(MEVDUAT|TOPLANAN FONLAR|KATILIM FONU)\b(.*)$", re.M)


def cikar(kod: str, donem: str):
    _, klasor, _ = BANKALAR[kod]
    dosyalar = sorted((KONSOLIDE / klasor).glob(f"{donem}_*.pdf"))
    if not dosyalar:
        return {"durum": "dosya_yok"}
    pdf = dosyalar[0]
    sayfalar = pdf_sayfalar(pdf)
    for i, s in enumerate(sayfalar):
        m = SATIR.search(s)
        if not m:
            continue
        toks = re.split(r"\s{2,}|\s(?=\(?\d)", m.group(2).strip())
        nums = [v for v in (sayi(t) for t in toks if t) if v is not None]
        if len(nums) < 6:
            continue  # içindekiler gibi sayısız satırlar
        nums = nums[-6:]  # baştaki "(1)" gibi dipnot referanslarını at
        carpan = birim_bul(sayfalar, i)
        if carpan is None:
            return {"durum": "birim_bulunamadi", "dosya": pdf.name}
        nums = [v * carpan for v in nums]
        return {
            "durum": "ok", "banka": kod, "donem": donem, "dosya": pdf.name, "sayfa": i + 1,
            "satir": m.group(0).strip(), "birim": "bin TL",
            "kaynak_birim": "milyon TL" if carpan == 1000 else "bin TL",
            "cari": dict(zip(("tp", "yp", "toplam"), nums[:3])),
            "onceki_yil_sonu": dict(zip(("tp", "yp", "toplam"), nums[3:])),
        }
    return {"durum": "satir_bulunamadi", "dosya": pdf.name}


def main(bankalar):
    hata = 0
    for kod in bankalar:
        (HAM_BILANCO / kod).mkdir(parents=True, exist_ok=True)
        for d in DONEMLER:
            r = cikar(kod, d)
            (HAM_BILANCO / kod / f"{d}.json").write_text(json.dumps(r, ensure_ascii=False, indent=1))
            if r["durum"] != "ok":
                hata += 1
                print(f"{kod} {d}: {r['durum']}")
    print(f"mevduat çıkarımı, hata: {hata}")
    return hata


if __name__ == "__main__":
    sys.exit(1 if main(sys.argv[1:] or list(BANKALAR)) else 0)
