// Model taslağını yayından önce doğrular: yapı, atıflar ve metindeki her sayının olgulardan gelmesi.
"use strict";

const BASLIKLAR = ["Sektör eğilimi", "İvme değişimi", "Öne çıkanlar ve geride kalanlar", "Dikkat edilecek noktalar"];
const BASLIKLAR_PORTFOY = ["Sektör eğilimi", "Verimlilik ve kârlılık", "Ana bankaya katkı", "Dikkat edilecek noktalar"];
const MADDE_MIN = 1, MADDE_MAX = 2, METIN_MAX = 220;

// Türkçe biçimli sayılar: 15.883,7 · 344,0 · -5,7 · 68 · −0,6
const SAYI = /(?<![\d.,])[-−]?\d{1,3}(?:\.\d{3})+(?:,\d+)?(?![\d])|(?<![\d.,])[-−]?\d+(?:,\d+)?(?![\d])/g;

function sayiOku(s) {
  const temiz = s.replace("−", "-").replace(/\./g, "").replace(",", ".");
  const ondalik = s.includes(",") ? s.split(",")[1].length : 0;
  return { deger: Math.abs(parseFloat(temiz)), ondalik };
}

// sayı denetiminden muaf olanlar: yıllar, dönem adları (2Ç), banka sayısı, "3 çeyrek" gibi sayımlar
function muaf(metin, eslesme, indeks) {
  const s = eslesme.replace("−", "-");
  const sonra = metin.slice(indeks + eslesme.length, indeks + eslesme.length + 8);
  const v = Math.abs(parseFloat(s.replace(/\./g, "").replace(",", ".")));
  if (!s.includes(",") && v >= 2020 && v <= 2030) return true;
  if (/^Ç/.test(sonra)) return true;
  if (!s.includes(",") && v === 8 && /^\s*(banka|bankanın|PYŞ|şirket)/.test(sonra)) return true;
  if (!s.includes(",") && v <= 4 && /^\s*(çeyrek|banka)/.test(sonra)) return true;
  return false;
}

function dogrula(taslak, olguListesi, BASLIKLAR = module.exports.BASLIKLAR) {
  const hatalar = [];
  const olgu = new Map(olguListesi.map((o) => [o.id, o]));
  if (!taslak || !Array.isArray(taslak.bolumler)) return ["Çıktıda 'bolumler' dizisi yok."];
  const basliklar = taslak.bolumler.map((b) => b.baslik);
  if (JSON.stringify(basliklar) !== JSON.stringify(BASLIKLAR)) {
    hatalar.push(`Bölüm başlıkları tam olarak şunlar olmalı, bu sırayla: ${BASLIKLAR.join(" | ")}. Gelen: ${basliklar.join(" | ")}`);
  }
  taslak.bolumler.forEach((bol, bi) => {
    const m = bol.maddeler || [];
    if (m.length < MADDE_MIN || m.length > MADDE_MAX) hatalar.push(`"${bol.baslik}" bölümünde ${m.length} madde var; ${MADDE_MIN}-${MADDE_MAX} olmalı.`);
    m.forEach((md, mi) => {
      const yer = `"${bol.baslik}" madde ${mi + 1}`;
      const metin = String(md.metin || "");
      if (!metin.trim()) hatalar.push(`${yer}: metin boş.`);
      if (metin.length > METIN_MAX) hatalar.push(`${yer}: ${metin.length} karakter; en fazla ${METIN_MAX}.`);
      if (/[—–]/.test(metin)) hatalar.push(`${yer}: uzun çizgi (— ya da –) kullanılmamalı.`);
      const atif = Array.isArray(md.olgular) ? md.olgular : [];
      if (!atif.length) hatalar.push(`${yer}: en az bir olgu kimliğine atıf yapmalı.`);
      const yok = atif.filter((id) => !olgu.has(id));
      if (yok.length) hatalar.push(`${yer}: olmayan olgu kimlikleri: ${yok.join(", ")}.`);
      const degerler = atif.map((id) => olgu.get(id)).filter((o) => o && typeof o.deger === "number").map((o) => Math.abs(o.deger));
      for (const e of metin.matchAll(SAYI)) {
        if (muaf(metin, e[0], e.index)) continue;
        const { deger, ondalik } = sayiOku(e[0]);
        const tutuyor = degerler.some((d) => d.toFixed(ondalik) === deger.toFixed(ondalik));
        if (!tutuyor) hatalar.push(`${yer}: "${e[0]}" sayısı atıf yapılan olguların hiçbirinde yok (atıflar: ${atif.join(", ") || "yok"}).`);
      }
    });
  });
  return hatalar;
}

module.exports = { dogrula, BASLIKLAR, BASLIKLAR_PORTFOY, MADDE_MIN, MADDE_MAX, METIN_MAX };
