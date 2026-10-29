"""Tutarlılık kontrolleri. Çıkış kodu 0 = tüm zorunlu kontroller geçti.

Zorunlu: satır denklikleri, ara dönem çeyrek sütunu = birikimli fark.
Uyarı: önceki yıl sütunu ile geçen yılın raporu arasındaki fark (yeniden düzenleme olabilir).
"""
import json
import sys

from ortak import BANKALAR, DONEMLER, HAM, KOK, PYS


def yakin(a, b, carpan):
    # milyon TL raporlarda yuvarlama 1 milyon TL'ye kadar sapabilir
    return abs(a - b) <= 2 * carpan + max(abs(a), abs(b)) * 1e-6


def main():
    hatalar, uyarilar, sayac = [], [], 0
    yeniden = []  # bankaların önceki dönemi yeniden düzenlemesi; analiz agent'ı "dikkat" olgusu olarak kullanır
    for kod in BANKALAR:
        ham = {}
        for d in DONEMLER:
            r = json.loads((HAM / kod / f"{d}.json").read_text())
            if r["durum"] != "ok":
                hatalar.append(f"{kod} {d}: {r['durum']}")
                continue
            ham[d] = r
        for d, r in ham.items():
            c = 1000 if r["kaynak_birim"] == "milyon TL" else 1
            sutunlar = [("cari", r["cari_birikimli"]), ("onceki", r["onceki_yil_birikimli"])]
            if r["cari_ceyrek"]:
                sutunlar += [("cari_c", r["cari_ceyrek"]), ("onceki_c", r["onceki_yil_ceyrek"])]
            for ad, v in sutunlar:
                for sol, sag, isim in [
                    (v["net_faiz"], v["faiz_geliri"] - v["faiz_gideri"], "III=I-II"),
                    (v["net_ucret_komisyon"], v["alinan_ucret_komisyon"] - v["verilen_ucret_komisyon"], "IV=4.1-4.2"),
                    (v["alinan_ucret_komisyon"], v["alinan_gayrinakdi"] + v["alinan_diger"], "4.1=4.1.1+4.1.2"),
                ]:
                    sayac += 1
                    if not yakin(sol, sag, c):
                        hatalar.append(f"{kod} {d} {ad} {isim}: {sol:,} vs {sag:,}")
            # ara dönem: çeyrek sütunu = birikimli - önceki çeyreğin birikimlisi
            y, q = d.split("_")
            q = int(q[0])
            onceki = ham.get(f"{y}_{q - 1}C")
            if r["cari_ceyrek"] and onceki:
                for a in ("net_faiz", "net_ucret_komisyon"):
                    sayac += 1
                    fark = r["cari_birikimli"][a] - onceki["cari_birikimli"][a]
                    x = r["cari_ceyrek"][a]
                    if not yakin(x, fark, c):
                        # %1 altı: önceki çeyreğin yeniden sınıflandırılması; üstü: sütun sırası hatası
                        hedef = hatalar if abs(x - fark) > abs(fark) * 0.01 else uyarilar
                        hedef.append(f"{kod} {d} çeyrek sütunu {a}: {x:,} vs {fark:,} ({(x - fark) / fark:+.2%})")
                        if hedef is uyarilar:
                            yeniden.append({"banka": kod, "donem": d, "kalem": a, "tur": "onceki_ceyrek",
                                            "fark_yuzde": round((x - fark) / fark * 100, 2)})
            # önceki yıl sütunu = geçen yılın raporu
            gy = ham.get(f"{int(y) - 1}_{q}C")
            if gy:
                for a in ("net_faiz", "net_ucret_komisyon"):
                    sayac += 1
                    x, z = r["onceki_yil_birikimli"][a], gy["cari_birikimli"][a]
                    if not yakin(x, z, c):
                        uyarilar.append(f"{kod} {d} önceki yıl {a}: {x:,} vs {z:,} ({(x - z) / z:+.2%})")
                        yeniden.append({"banka": kod, "donem": d, "kalem": a, "tur": "onceki_yil",
                                        "fark_yuzde": round((x - z) / z * 100, 2)})
    # mevduat: TP + YP = toplam, önceki yıl sonu sütunu = geçen yılın 4Ç raporu
    hb = KOK / "veri" / "ham_bilanco"
    for kod in BANKALAR:
        ham = {}
        for d in DONEMLER:
            r = json.loads((hb / kod / f"{d}.json").read_text())
            if r["durum"] != "ok":
                hatalar.append(f"{kod} {d} mevduat: {r['durum']}")
                continue
            ham[d] = r
        for d, r in ham.items():
            c = 1000 if r["kaynak_birim"] == "milyon TL" else 1
            for ad in ("cari", "onceki_yil_sonu"):
                v = r[ad]
                sayac += 1
                if not yakin(v["tp"] + v["yp"], v["toplam"], c):
                    hatalar.append(f"{kod} {d} mevduat {ad} TP+YP≠toplam: {v}")
            gy = ham.get(f"{int(d[:4]) - 1}_4C")
            if gy:
                sayac += 1
                x, z = r["onceki_yil_sonu"]["toplam"], gy["cari"]["toplam"]
                if not yakin(x, z, c):
                    uyarilar.append(f"{kod} {d} mevduat önceki yıl sonu: {x:,} vs {z:,} ({(x - z) / z:+.2%})")
                    yeniden.append({"banka": kod, "donem": d, "kalem": "mevduat", "tur": "onceki_yil_sonu",
                                    "fark_yuzde": round((x - z) / z * 100, 2)})
    # PYŞ: işaretler ve büyüklük sırası; birikimli fark ile raporun 3 aylık sütunu arasındaki sapma (TMS 29) uyarı
    hp = KOK / "veri" / "ham_pys"
    for kod in PYS:
        ham = {}
        for d in DONEMLER:
            r = json.loads((hp / kod / f"{d}.json").read_text())
            if r["durum"] != "ok":
                hatalar.append(f"PYŞ {kod} {d}: {r['durum']}")
                continue
            ham[d] = r
        for d, r in ham.items():
            k = r["kalemler"]
            sayac += 3
            if k["hasilat"]["cari"] <= 0:
                hatalar.append(f"PYŞ {kod} {d}: hasılat sıfır ya da negatif")
            if "genel_yonetim" in k and k["genel_yonetim"]["cari"] > 0:
                hatalar.append(f"PYŞ {kod} {d}: genel yönetim gideri pozitif okunmuş")
            if k["net_kar"]["cari"] > k["hasilat"]["cari"] * 1.5:
                hatalar.append(f"PYŞ {kod} {d}: net kâr hasılatın 1,5 katından büyük, satır yanlış olabilir")
            y, q = d.split("_")
            o = ham.get(f"{y}_{int(q[0]) - 1}C")
            if o and "cari_3ay" in k["hasilat"]:
                fark = k["hasilat"]["cari"] - o["kalemler"]["hasilat"]["cari"]
                c3 = k["hasilat"]["cari_3ay"]
                if abs(fark - c3) > abs(c3) * 0.25:
                    uyarilar.append(f"PYŞ {kod} {d} hasılat: rapordaki 3 ay {c3:,} vs birikimli fark {fark:,} ({(fark - c3) / c3:+.0%}, yeniden düzenleme)")
                    yeniden.append({"banka": kod, "donem": d, "kalem": "pys_hasilat", "tur": "pys_onceki_ceyrek",
                                    "fark_yuzde": round((fark - c3) / c3 * 100, 2)})
    print(f"{sayac} kontrol, {len(hatalar)} hata, {len(uyarilar)} uyarı")
    for h in hatalar:
        print("HATA ", h)
    for u in uyarilar:
        print("UYARI", u)
    (KOK / "veri" / "kontrol.json").write_text(json.dumps(
        {"hata_sayisi": len(hatalar), "uyari_sayisi": len(uyarilar), "yeniden_duzenleme": yeniden},
        ensure_ascii=False, indent=1))
    return 1 if hatalar else 0


if __name__ == "__main__":
    sys.exit(main())
