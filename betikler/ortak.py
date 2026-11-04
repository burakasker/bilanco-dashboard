"""Ortak tanımlar: bankalar, dosya yolları, sayı ayrıştırma."""
import re
import subprocess
from pathlib import Path

KOK = Path(__file__).resolve().parent.parent
KAYNAK = KOK / "kaynak"
KONSOLIDE = KAYNAK / "Banka Konsolide Raporlar"
SUNUM = KAYNAK / "Banka Yatırımcı Sunumları"
HAM = KOK / "veri" / "ham"

# kod: (görünen ad, konsolide klasörü, katılım bankası mı)
# sıra sayfadaki sırayı belirler; Yapı Kredi her yerde önde
BANKALAR = {
    "yapikredi": ("Yapı Kredi", "01_Yapi_Kredi_Bankasi", False),
    "akbank": ("Akbank", "02_Akbank", False),
    "isbank": ("İş Bankası", "04_Is_Bankasi", False),
    "garanti": ("Garanti BBVA", "03_Garanti_BBVA", False),
    "teb": ("TEB", "05_TEB", False),
    "qnb": ("QNB", "07_QNB", False),
    "denizbank": ("DenizBank", "06_DenizBank", False),
    "kuveytturk": ("Kuveyt Türk", "08_Kuveyt_Turk", True),
}

PYS_KLASOR = KAYNAK / "Portföy Yönetim Şirketleri Konsolide Raporlar"
# PYŞ kodu ana bankanın koduyla aynı; renk ve logo bankadan gelir
PYS = {
    "yapikredi": ("Yapı Kredi Portföy", "01_Yapi_Kredi_Portfoy"),
    "akbank": ("Ak Portföy", "02_Ak_Portfoy"),
    "isbank": ("İş Portföy", "04_Is_Portfoy"),
    "garanti": ("Garanti BBVA Portföy", "03_Garanti_Portfoy"),
    "teb": ("TEB Portföy", "05_TEB_Portfoy"),
    "qnb": ("QNB Portföy", "07_QNB_Portfoy"),
    "denizbank": ("Deniz Portföy", "06_Deniz_Portfoy"),
    "kuveytturk": ("KT Portföy", "08_KT_Portfoy"),
}

DONEMLER = [f"{y}_{q}C" for y in (2024, 2025, 2026) for q in (1, 2, 3, 4)
            if not (y == 2026 and q > 3)]

def bekleniyor(r, donem):
    """Son dönemde raporu henüz yayımlanmamış kurum: hata sayılmaz, panelde boş kalır."""
    return r["durum"] == "dosya_yok" and donem == DONEMLER[-1]


SAYI = re.compile(r"^\(?-?\d{1,3}(?:[.,]\d{3})*\)?$")


def sayi(tok: str):
    """'1.234.567', '1,234,567', '(12.345)', '-' -> int (bin TL)."""
    tok = tok.strip()
    if tok in ("-", "–", "0"):
        return 0
    if not SAYI.match(tok):
        return None
    neg = tok.startswith("(") or tok.startswith("-")
    v = int(re.sub(r"[^\d]", "", tok))
    return -v if neg else v


def pdf_sayfalar(pdf: Path) -> list[str]:
    out = subprocess.run(["pdftotext", "-layout", str(pdf), "-"],
                         capture_output=True, text=True, check=True).stdout
    return out.split("\f")
