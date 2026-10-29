"""Ham JSON'lardan banka × dönem paneli üretir.

- Raporlar yılbaşından birikimli; çeyreklik = birikimli fark.
- 2023 çeyrekleri 2024 raporlarının karşılaştırma sütunundan gelir.
Çıktılar: veri/panel.csv, web/data/panel.json
"""
import csv
import json
from datetime import date

from ortak import BANKALAR, DONEMLER, HAM, KOK, PYS

ALANLAR = ["faiz_geliri", "faiz_gideri", "net_faiz", "net_ucret_komisyon",
           "alinan_ucret_komisyon", "alinan_gayrinakdi", "alinan_diger",
           "verilen_ucret_komisyon"]
TUM_DONEMLER = [f"2023_{q}C" for q in (1, 2, 3, 4)] + DONEMLER


def ham_oku(kod):
    out = {}
    for d in DONEMLER:
        r = json.loads((HAM / kod / f"{d}.json").read_text())
        if r["durum"] == "ok":
            out[d] = r
    return out


def birikimli_seri(kod):
    """dönem -> {alan: bin TL}, kaynak bilgisiyle."""
    ham = ham_oku(kod)
    seri, kaynak = {}, {}
    for d, r in ham.items():
        seri[d] = r["cari_birikimli"]
        kaynak[d] = {"dosya": r["dosya"], "sayfa": r["sayfa"], "sutun": "cari"}
    for q in (1, 2, 3, 4):
        r = ham.get(f"2024_{q}C")
        if r:
            seri[f"2023_{q}C"] = r["onceki_yil_birikimli"]
            kaynak[f"2023_{q}C"] = {"dosya": r["dosya"], "sayfa": r["sayfa"],
                                    "sutun": "onceki_yil"}
    return seri, kaynak


def ceyrek_seri(birikimli):
    out = {}
    for d in TUM_DONEMLER:
        if d not in birikimli:
            continue
        y, q = d.split("_")
        q = int(q[0])
        if q == 1:
            out[d] = dict(birikimli[d])
        else:
            onceki = birikimli.get(f"{y}_{q - 1}C")
            if onceki:
                out[d] = {a: birikimli[d][a] - onceki[a] for a in ALANLAR}
    return out


def uvek_oku():
    """Sunumlardan elle okunan ÜVEK yatırım hizmetleri payları (veri/uvek_yatirim_payi.csv)."""
    yol = KOK / "veri" / "uvek_yatirim_payi.csv"
    out = {}
    with open(yol) as f:
        for r in csv.DictReader(f):
            b = out.setdefault(r["banka"], {"kalem": r["sunumdaki_kalem"], "veri": {}, "kapsam": {}, "kaynak": {}})
            b["veri"][r["donem"]] = float(r["pay_yuzde"])
            b["kapsam"][r["donem"]] = r["kapsam"]
            b["kaynak"][r["donem"]] = f'{r["kaynak_dosya"]} s.{r["kaynak_sayfa"]}'
    # ana dönem eksenine hizala (2023 boş)
    return {k: {"kalem": v["kalem"],
                "veri": [v["veri"].get(d) for d in TUM_DONEMLER],
                "kapsam": [v["kapsam"].get(d) for d in TUM_DONEMLER],
                "kaynak": [v["kaynak"].get(d) for d in TUM_DONEMLER]} for k, v in out.items()}


def mevduat_seri(kod):
    """Çeyrek sonu mevduat bakiyesi (bin TL); 2023 4Ç 2024 raporlarının önceki yıl sonu sütunundan."""
    hb = KOK / "veri" / "ham_bilanco" / kod
    seri, kaynak = {}, {}
    for d in DONEMLER:
        r = json.loads((hb / f"{d}.json").read_text())
        if r["durum"] != "ok":
            continue
        seri[d] = r["cari"]
        kaynak[d] = f'{r["dosya"]} s.{r["sayfa"]}'
        if d == "2024_1C":
            seri["2023_4C"] = r["onceki_yil_sonu"]
            kaynak["2023_4C"] = f'{r["dosya"]} s.{r["sayfa"]} (önceki yıl sonu)'
    return seri, kaynak


PYS_ALANLAR = ["hasilat", "genel_yonetim", "pazarlama", "net_kar"]


def pys_seri(kod):
    """PYŞ çeyreklik serisi (TL), yayımlandığı haliyle, enflasyon düzeltmesi yok.
    1Ç: 3 aylık rapor; 2Ç-3Ç: raporun kendi 3 aylık sütunu; 4Ç: yıllık - 9 aylık (rapor 3 aylık vermiyor)."""
    hp = KOK / "veri" / "ham_pys" / kod
    ham = {d: json.loads((hp / f"{d}.json").read_text()) for d in DONEMLER}
    cey, yontem, kaynak = {}, {}, {}
    for d, x in ham.items():
        k = x["kalemler"]
        y, q = d.split("_")
        q = int(q[0])
        satir = {}
        for a in PYS_ALANLAR:
            v = k.get(a)
            if v is None:
                satir[a] = 0
            elif q == 1:
                satir[a] = v["cari"]
            elif "cari_3ay" in v:
                satir[a] = v["cari_3ay"]
            else:
                o = ham.get(f"{y}_{q - 1}C")
                ov = o["kalemler"].get(a) if o else None
                satir[a] = v["cari"] - (ov["cari"] if ov else 0)
        cey[d] = satir
        yontem[d] = "rapor" if q == 1 or "cari_3ay" in k["hasilat"] else "fark"
        kaynak[d] = f'{x["dosya"]} s.{x["sayfa"]}' + (" (elle okundu)" if x.get("elle") else "")
    return cey, yontem, kaynak


def buyukluk_oku():
    """pys -> dönem -> (yönetilen toplam portföy milyar TL, kaynak); SPK, betikler/cikar_spk_buyukluk.py."""
    out = {}
    with open(KOK / "veri" / "pys_buyukluk.csv") as f:
        for r in csv.DictReader(f):
            out.setdefault(r["pys"], {})[r["donem"]] = (
                round(float(r["toplam_tl"]) / 1e9, 2), {"etiket": r["kaynak"], "url": r["url"], "spk_ad": r["spk_ad"]})
    return out


def pys_blok():
    out = {}
    satirlar = []
    buyukluk = buyukluk_oku()
    for kod, (ad, _) in PYS.items():
        cey, yontem, kaynak = pys_seri(kod)
        out[kod] = {
            "ad": ad,
            "pdf_klasor": f"Portföy Yönetim Şirketleri Konsolide Raporlar/{PYS[kod][1]}",
            # milyon TL; 2023 boş
            **{a: [round(cey[d][a] / 1e6, 2) if d in cey else None for d in TUM_DONEMLER] for a in PYS_ALANLAR},
            "buyukluk": [buyukluk[kod][d][0] if d in buyukluk[kod] else None for d in TUM_DONEMLER],
            "buyukluk_kaynak": [buyukluk[kod][d][1] if d in buyukluk[kod] else None for d in TUM_DONEMLER],
            "yontem": [yontem.get(d) for d in TUM_DONEMLER],
            "kaynak": [kaynak.get(d) for d in TUM_DONEMLER],
        }
        for d in DONEMLER:
            satirlar.append({"pys": kod, "donem": d, **{f"{a}_tl": cey[d][a] for a in PYS_ALANLAR},
                             "ceyrek_yontemi": yontem[d], "kaynak": kaynak[d]})
    with open(KOK / "veri" / "pys_panel.csv", "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(satirlar[0]))
        w.writeheader()
        w.writerows(satirlar)
    return out


def etiket(d):
    y, q = d.split("_")
    return f"{y} {q[0]}Ç"


def enflasyon_blok():
    """TÜFE çarpanları: her çeyreği son çeyreğin fiyatlarına taşır.

    Gelir kalemleri (akış) çeyreğin üç aylık ortalama endeksiyle, mevduat (stok)
    çeyrek sonu endeksiyle düzeltilir. Endeks, aylık değişimlerden zincirlenir.
    """
    endeks, deger = {}, 100.0
    with open(KOK / "veri" / "tufe.csv") as f:
        for r in csv.DictReader(f):
            deger *= 1 + float(r["aylik_degisim"]) / 100
            endeks[r["ay"]] = deger
    ort, son = [], []
    for d in TUM_DONEMLER:
        yil, q = int(d[:4]), int(d[5])
        aylar = [f"{yil}-{3 * (q - 1) + i:02d}" for i in (1, 2, 3)]
        ort.append(sum(endeks[a] for a in aylar) / 3)
        son.append(endeks[aylar[-1]])
    return {
        "kaynak": "TÜİK TÜFE (2003=100) aylık değişim, TCMB üzerinden; veri/tufe.csv",
        "baz": etiket(TUM_DONEMLER[-1]),
        "akis": [round(ort[-1] / x, 6) for x in ort],
        "stok": [round(son[-1] / x, 6) for x in son],
    }


def main():
    satirlar, bankalar, mev_satirlar = [], [], []
    for kod, (ad, _, katilim) in BANKALAR.items():
        bir, kaynak = birikimli_seri(kod)
        cey = ceyrek_seri(bir)
        b = {"kod": kod, "ad": ad, "katilim": katilim, "seriler": {}, "kaynak": [],
             "pdf_klasor": f"Banka Konsolide Raporlar/{BANKALAR[kod][1]}"}
        for a in ALANLAR:
            b["seriler"][a] = {
                # milyon TL, 1 ondalık
                "birikimli": [round(bir[d][a] / 1000, 1) if d in bir else None
                              for d in TUM_DONEMLER],
                "ceyrek": [round(cey[d][a] / 1000, 1) if d in cey else None
                           for d in TUM_DONEMLER],
            }
        mev, mev_kaynak = mevduat_seri(kod)
        b["mevduat"] = {k: [round(mev[d][k] / 1000, 1) if d in mev else None for d in TUM_DONEMLER]
                        for k in ("tp", "yp", "toplam")}
        b["mevduat_kaynak"] = [mev_kaynak.get(d) for d in TUM_DONEMLER]
        for d in TUM_DONEMLER:
            if d in mev:
                mev_satirlar.append({"banka": kod, "donem": d, **{f"{k}_bin_tl": mev[d][k] for k in ("tp", "yp", "toplam")},
                                     "kaynak": mev_kaynak[d]})
        for d in TUM_DONEMLER:
            if d in bir:
                b["kaynak"].append({"donem": etiket(d), **kaynak[d]})
                for a in ALANLAR:
                    satirlar.append({
                        "banka": kod, "donem": d, "kalem": a,
                        "birikimli_bin_tl": bir[d][a],
                        "ceyrek_bin_tl": cey.get(d, {}).get(a, ""),
                        "kaynak_dosya": kaynak[d]["dosya"],
                        "kaynak_sayfa": kaynak[d]["sayfa"],
                        "kaynak_sutun": kaynak[d]["sutun"],
                    })
        bankalar.append(b)

    with open(KOK / "veri" / "panel.csv", "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(satirlar[0]))
        w.writeheader()
        w.writerows(satirlar)

    with open(KOK / "veri" / "mevduat.csv", "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(mev_satirlar[0]))
        w.writeheader()
        w.writerows(mev_satirlar)

    veri = {
        "olusturma": date.today().isoformat(),
        "birim": "milyon TL",
        "kaynak": "Bankaların BDDK konsolide finansal raporları, konsolide kâr veya zarar tablosu",
        "donemler": [etiket(d) for d in TUM_DONEMLER],
        "notlar": [
            "Tutarlar raporlarda yayımlandığı gibi nominaldir; üstteki anahtarla son çeyrek fiyatlarına (TÜFE) taşınmış hâli görülebilir.",
            "2023 çeyrekleri 2024 raporlarının önceki dönem sütunundan alındı.",
            "Kuveyt Türk katılım bankası: net faiz yerine net kâr payı geliri.",
            "2026/2Ç raporları milyon TL yayımlandı; diğer dönemler bin TL'den çevrildi.",
        ],
        "bankalar": bankalar,
        "uvek": uvek_oku(),
        "pys": pys_blok(),
        "enflasyon": enflasyon_blok(),
    }
    out = KOK / "web" / "data" / "panel.json"
    out.write_text(json.dumps(veri, ensure_ascii=False, separators=(",", ":")))
    print(f"{len(satirlar)} satır -> veri/panel.csv, {out.relative_to(KOK)}")


if __name__ == "__main__":
    main()
