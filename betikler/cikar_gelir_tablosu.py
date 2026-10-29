"""Konsolide raporların gelir tablosundan net faiz ve net ücret-komisyon satırlarını çeker.

Satırlar etiketle değil BDDK satır koduyla bulunur (bazı PDF'lerde etiket metni çıkmıyor).
Çıktı: veri/ham/<banka>/<YYYY_QC>.json
"""
import json
import re
import sys

from ortak import BANKALAR, DONEMLER, HAM, KONSOLIDE, pdf_sayfalar, sayi

KALEMLER = {  # satır kodu -> alan adı
    "I": "faiz_geliri",
    "II": "faiz_gideri",
    "III": "net_faiz",
    "IV": "net_ucret_komisyon",
    "4.1": "alinan_ucret_komisyon",
    "4.1.1": "alinan_gayrinakdi",
    "4.1.2": "alinan_diger",
    "4.2": "verilen_ucret_komisyon",
}

# 4 sütunlu ara dönem tablolarında sütun sırası
#   A: cari birikimli, cari çeyrek, önceki birikimli, önceki çeyrek
#   B: cari birikimli, önceki birikimli, cari çeyrek, önceki çeyrek
SIRA_A = {"akbank", "qnb", "kuveytturk"}

SATIR = re.compile(r"^\s*([IVX]+|\d(?:\.\d){1,2})\.?\s+(.*)$")
ZORUNLU = {"I", "II", "III", "IV", "4.1", "4.1.1", "4.2"}
BIRIM = re.compile(r"(?i)\b(b[iİı]\u0307?n|m[iİı]\u0307?lyon)\s+(türk lirası|tl)")


def birim_bul(sayfalar, i):
    """Tablo sayfasından geriye doğru ilk birim ifadesi; çarpan (bin TL'ye)."""
    for j in range(i, max(-1, i - 4), -1):
        m = BIRIM.search(sayfalar[j])
        if m:
            return 1000 if m.group(1).lower().startswith("m") else 1
    # yedek: belgenin genel "aksi belirtilmedikçe ... ifade edilmiştir" notu
    m = re.search(r"(?is)aksi\s+belirtilmedik[çc]e\s+(bin|milyon)", "\n".join(sayfalar))
    if m:
        return 1000 if m.group(1).lower() == "milyon" else 1
    return None


def satirlar(sayfa: str) -> dict:
    """Satır kodu -> (ham satır, sayılar). Kod başına sayı içeren ilk satır
    (bölüm başlıkları da 'III.' gibi kodla başlayabiliyor)."""
    out = {}
    for ham in sayfa.splitlines():
        m = SATIR.match(ham)
        if not m:
            continue
        kod = m.group(1)
        if kod in out and out[kod][1]:
            continue
        toks = re.split(r"\s{2,}|\s(?=\(?\d)", m.group(2).strip())
        nums = [v for v in (sayi(t) for t in toks if t) if v is not None]
        out[kod] = (ham.strip(), nums)
    return out


def gelir_tablosu_bul(sayfalar):
    for i, s in enumerate(sayfalar):
        st = satirlar(s)
        if ZORUNLU <= st.keys() and "4.1.2" in st and len(st["III"][1]) >= 2:
            # bilanço ve nazım hesaplar XIX'a kadar gitmez; yine de faiz satırı kontrolü
            if ("XX" in st or "XXV" in st
                    or re.search(r"NET (FAİZ|K[AÂ]R PAYI) GELİRİ", s)):
                return i, st
    return None, None


def cikar(kod: str, donem: str):
    _, klasor, _ = BANKALAR[kod]
    dosyalar = sorted((KONSOLIDE / klasor).glob(f"{donem}_*.pdf"))
    if not dosyalar:
        return {"durum": "dosya_yok"}
    pdf = dosyalar[0]
    sayfalar = pdf_sayfalar(pdf)
    i, st = gelir_tablosu_bul(sayfalar)
    if st is None:
        return {"durum": "tablo_bulunamadi", "dosya": pdf.name}
    carpan = birim_bul(sayfalar, i)
    if carpan is None:
        return {"durum": "birim_bulunamadi", "dosya": pdf.name}
    cari, onceki, cari_c, onceki_c, satir_metin = {}, {}, {}, {}, {}
    for rk, alan in KALEMLER.items():
        ham, nums = st[rk]
        if len(nums) in (3, 5) and re.search(r"\s\(\d{1,2}\)\s", ham):
            nums = nums[1:]  # QNB: "(1)" dipnot referansı
        nums = [v * carpan for v in nums]
        satir_metin[alan] = ham
        if len(nums) == 2:
            cari[alan], onceki[alan] = nums
        elif len(nums) == 4:
            if kod in SIRA_A:
                cari[alan], cari_c[alan], onceki[alan], onceki_c[alan] = nums
            else:
                cari[alan], onceki[alan], cari_c[alan], onceki_c[alan] = nums
        else:
            return {"durum": f"sutun_sayisi_{len(nums)}", "dosya": pdf.name,
                    "satir": ham}
    return {
        "durum": "ok",
        "banka": kod,
        "donem": donem,
        "dosya": pdf.name,
        "sayfa": i + 1,
        "birim": "bin TL",
        "kaynak_birim": "milyon TL" if carpan == 1000 else "bin TL",
        "cari_birikimli": cari,
        "onceki_yil_birikimli": onceki,
        "cari_ceyrek": cari_c or None,
        "onceki_yil_ceyrek": onceki_c or None,
        "satirlar": satir_metin,
    }


def main(bankalar):
    hata = 0
    for kod in bankalar:
        (HAM / kod).mkdir(parents=True, exist_ok=True)
        for d in DONEMLER:
            r = cikar(kod, d)
            (HAM / kod / f"{d}.json").write_text(
                json.dumps(r, ensure_ascii=False, indent=1))
            if r["durum"] != "ok":
                hata += 1
                print(f"{kod} {d}: {r['durum']} {r.get('satir', '')}")
            else:
                c = r["cari_birikimli"]
                print(f"{kod} {d} s{r['sayfa']}: net faiz {c['net_faiz']:,} "
                      f"net ücret-kom {c['net_ucret_komisyon']:,}")
    print(f"hata: {hata}")
    return hata


if __name__ == "__main__":
    sys.exit(1 if main(sys.argv[1:] or list(BANKALAR)) else 0)
