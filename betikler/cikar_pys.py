"""PYŞ finansal raporlarının kâr veya zarar tablosundan hasılat, giderler ve dönem kârını çeker.

PYŞ'ler TMS 29 uygular; tutarlar raporlandığı tarihin satın alma gücüyle yayımlanır.
Burak'ın kararıyla enflasyon düzeltmesi yapılmaz, rakamlar yayımlandığı gibi kullanılır.
4 sütunlu ara dönem tablolarında sıra: cari birikimli, cari 3 ay, önceki birikimli, önceki 3 ay.
Çıktı: veri/ham_pys/<kod>/<YYYY_QC>.json (tutarlar TL)
"""
import json
import re
import sys

from ortak import DONEMLER, KOK, PYS, PYS_KLASOR, pdf_sayfalar, sayi

HAM_PYS = KOK / "veri" / "ham_pys"
# metni çıkmayan ya da etiketi bölünmüş raporlar için elle okunan değerler (kaynak notuyla)
ELLE = json.loads((KOK / "veri" / "pys_elle.json").read_text())

KALIP = {
    "hasilat": re.compile(r"^\s*(finans sektörü faaliyetleri hasılatı|hasılat)\b", re.I),
    "genel_yonetim": re.compile(r"^\s*genel yönetim giderleri", re.I),
    "pazarlama": re.compile(r"^\s*pazarlama", re.I),
    # gelir tablosundaki son kâr satırı; vergi ve mutabakat satırları hariç
    "net_kar": re.compile(r"^\s*(sürdürülen faaliyetler\s+(net\s+)?dönem|dönem\s+net|net\s+dönem|dönem)\s+k[aâ]r"
                          r"(?!.*(vergi|öncesi|mutabakat|aktar))", re.I),
}


def sayilar(satir: str):
    govde = re.sub(r"^\s*\S.*?(?=\s{2,}|$)", "", satir, count=1)  # etiketi at
    toks = re.split(r"\s{2,}|\s(?=\(?\d)", govde.strip())
    nums = [v for v in (sayi(t) for t in toks if t) if v is not None]
    # "13", "18, 19" gibi dipnot numaraları: 4 haneden kısa tek sayılar başta olur
    while len(nums) in (3, 5) and abs(nums[0]) < 1000:
        nums = nums[1:]
    return nums


def satir_sayilari(satirlar, k):
    """k. satırın sayıları; etiket satırında sayı yoksa sayılar bir alt satıra düşmüş olabilir."""
    nums = sayilar(satirlar[k])
    if len(nums) not in (2, 4) and k + 1 < len(satirlar):
        alt = satirlar[k + 1].strip()
        if alt and re.fullmatch(r"[\d.,()\s-]+", alt):
            nums = sayilar("x  " + alt)
    return nums


def birim(sayfalar):
    m = re.search(r"(?is)(bin|milyon)\s+türk\s+lirası", "\n".join(sayfalar[:12]))
    return {"bin": 1_000, "milyon": 1_000_000}.get(m.group(1).lower(), 1) if m else 1


def ayir(nums):
    if len(nums) == 2:
        return {"cari": nums[0], "onceki": nums[1]}
    if len(nums) == 4:
        return {"cari": nums[0], "cari_3ay": nums[1], "onceki": nums[2], "onceki_3ay": nums[3]}
    return None


def cikar(kod: str, donem: str):
    _, klasor = PYS[kod]
    dosyalar = sorted((PYS_KLASOR / klasor).glob(f"{donem}_*.pdf"))
    if not dosyalar:
        return {"durum": "dosya_yok"}
    pdf = dosyalar[0]
    sayfalar = pdf_sayfalar(pdf)
    carpan = birim(sayfalar)
    for i, s in enumerate(sayfalar):
        satirlar = s.splitlines()
        h = next((k for k, l in enumerate(satirlar)
                  if KALIP["hasilat"].match(l) and len(satir_sayilari(satirlar, k)) in (2, 4)), None)
        if h is None or not re.search(r"(?i)genel yönetim giderleri", s):
            continue
        # gelir tablosu: hasılat satırından sonraki satırlar + bir sonraki sayfa
        devam = satirlar[h:] + (sayfalar[i + 1].splitlines() if i + 1 < len(sayfalar) else [])
        out, kaynak = {}, {}
        for alan, kalip in KALIP.items():
            for k, l in enumerate(devam):
                if kalip.match(l):
                    nums = satir_sayilari(devam, k)
                    if len(nums) in (2, 4):
                        out[alan] = ayir([v * carpan for v in nums])
                        kaynak[alan] = re.sub(r"\s{2,}", " | ", l.strip())
                        break
        if "hasilat" not in out or "net_kar" not in out:
            return {"durum": "satir_eksik", "dosya": pdf.name, "bulunan": list(out)}
        return {"durum": "ok", "kod": kod, "donem": donem, "dosya": pdf.name, "sayfa": i + 1,
                "birim": "TL", "kalemler": out, "satirlar": kaynak}
    return {"durum": "tablo_bulunamadi", "dosya": pdf.name}


def main(kodlar):
    hata = 0
    for kod in kodlar:
        (HAM_PYS / kod).mkdir(parents=True, exist_ok=True)
        for d in DONEMLER:
            r = ELLE.get(f"{kod}/{d}") or cikar(kod, d)
            (HAM_PYS / kod / f"{d}.json").write_text(json.dumps(r, ensure_ascii=False, indent=1))
            if r["durum"] != "ok":
                hata += 1
                print(f"{kod} {d}: {r['durum']} {r.get('bulunan', '')}")
    print(f"PYŞ çıkarımı, hata: {hata}")
    return hata


if __name__ == "__main__":
    sys.exit(1 if main(sys.argv[1:] or list(PYS)) else 0)
