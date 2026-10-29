// Olgu katmanı: panel.json'dan, yönetici özetinin dayanacağı bütün sayıları hesaplar.
// Model ham veriyi görmez; yalnız buradaki olguları görür ve onlara atıf yapar.
"use strict";

const METRIKLER = {
  net_faiz: "net faiz geliri",
  ucret: "net ücret-komisyon geliri",
};

const yuvarla = (x, d = 1) => (x == null || !isFinite(x) ? null : Math.round(x * 10 ** d) / 10 ** d);
const buyume = (a, b) => (a == null || b == null || !b ? null : (a / b - 1) * 100);

// çeyreklik akış serileri (milyon TL)
function seri(b, m) {
  if (m === "net_faiz") return b.seriler.net_faiz.ceyrek;
  if (m === "ucret") return b.seriler.net_ucret_komisyon.ceyrek;
  if (m === "mevduat") return b.mevduat.toplam;
  throw new Error(`bilinmeyen metrik ${m}`);
}

// büyükten küçüğe sıra (1 = en yüksek); eşitlikte banka sırası korunur
function sirala(degerler) {
  const sirali = Object.entries(degerler).filter(([, v]) => v != null).sort((a, b) => b[1] - a[1]);
  return Object.fromEntries(sirali.map(([k], i) => [k, i + 1]));
}

function olgular(panel, { olaylar = [], kontrol = { yeniden_duzenleme: [] } } = {}) {
  const D = panel.donemler;
  const kod = (i) => {
    const [y, q] = D[i].split(" ");
    return `${y}_${q[0]}C`;
  };
  // verideki son çeyrek: tüm bankalarda net faizin dolu olduğu son indeks
  let n = D.length - 1;
  while (n > 0 && panel.bankalar.some((b) => b.seriler.net_faiz.ceyrek[n] == null)) n--;
  const B = panel.bankalar;
  const ad = Object.fromEntries(B.map((b) => [b.kod, b.ad]));
  const out = [];
  const ekle = (o) => out.push({ donem: D[n], ...o });

  /* ---- sektör ---- */
  const toplam = (m, i) => (B.some((b) => seri(b, m)[i] == null) ? null : B.reduce((a, b) => a + seri(b, m)[i], 0));
  for (const m of ["net_faiz", "ucret"]) {
    const t = toplam(m, n);
    ekle({ id: `sektor.${m}.tutar`, baslik: "sektor", aciklama: `8 bankanın toplam ${METRIKLER[m]}, ${D[n]}`, deger: yuvarla(t / 1000), birim: "mlr TL" });
    ekle({ id: `sektor.${m}.ceyreklik`, baslik: "sektor", aciklama: `Toplam ${METRIKLER[m]}, önceki çeyreğe göre değişim`, deger: yuvarla(buyume(t, toplam(m, n - 1))), birim: "%" });
    ekle({ id: `sektor.${m}.yillik`, baslik: "sektor", aciklama: `Toplam ${METRIKLER[m]}, geçen yılın aynı çeyreğine göre değişim`, deger: yuvarla(buyume(t, toplam(m, n - 4))), birim: "%" });
  }
  const pay = (i) => { const f = toplam("net_faiz", i), u = toplam("ucret", i); return f == null || u == null ? null : (u / (f + u)) * 100; };
  ekle({ id: "sektor.ucret_payi", baslik: "sektor", aciklama: `Ücret-komisyonun (net faiz + ücret-komisyon) içindeki payı, ${D[n]}`, deger: yuvarla(pay(n)), birim: "%" });
  ekle({ id: "sektor.ucret_payi.yillik_puan", baslik: "sektor", aciklama: `Ücret-komisyon payının geçen yılın aynı çeyreğine göre değişimi`, deger: yuvarla(pay(n) - pay(n - 4)), birim: "puan" });
  const mt = toplam("mevduat", n);
  ekle({ id: "sektor.mevduat.tutar", baslik: "sektor", aciklama: `8 bankanın toplam mevduatı, ${D[n]} sonu`, deger: yuvarla(mt / 1000), birim: "mlr TL" });
  ekle({ id: "sektor.mevduat.ceyreklik", baslik: "sektor", aciklama: "Toplam mevduatın önceki çeyrek sonuna göre büyümesi", deger: yuvarla(buyume(mt, toplam("mevduat", n - 1))), birim: "%" });
  ekle({ id: "sektor.mevduat.yillik", baslik: "sektor", aciklama: "Toplam mevduatın bir yıl önceki çeyrek sonuna göre büyümesi", deger: yuvarla(buyume(mt, toplam("mevduat", n - 4))), birim: "%" });

  /* ---- ivme ---- */
  // net faiz ve ücret: yıllık büyüme (mevsim etkisi yok); mevduat: çeyreklik büyüme
  const oran = (b, m, i) => (m === "mevduat" ? buyume(seri(b, m)[i], seri(b, m)[i - 1]) : buyume(seri(b, m)[i], seri(b, m)[i - 4]));
  const yon = (a, b, c) => (a == null || b == null || c == null ? null : c > b && b > a ? "hızlanıyor" : c < b && b < a ? "yavaşlıyor" : null);
  for (const b of B) {
    for (const m of ["net_faiz", "ucret", "mevduat"]) {
      const [r2, r1, r0] = [oran(b, m, n - 2), oran(b, m, n - 1), oran(b, m, n)];
      const tur = m === "mevduat" ? "çeyreklik" : "yıllık";
      const adm = m === "mevduat" ? "mevduat" : METRIKLER[m];
      [[r2, n - 2], [r1, n - 1], [r0, n]].forEach(([r, i], k) => ekle({
        id: `ivme.${b.kod}.${m}.${["n2", "n1", "n0"][k]}`, baslik: "ivme", banka: b.kod,
        aciklama: `${ad[b.kod]} ${adm} ${tur} büyümesi, ${D[i]}`, deger: yuvarla(r), birim: "%",
      }));
      const y = yon(r2, r1, r0);
      if (y) ekle({ id: `ivme.${b.kod}.${m}.yon`, baslik: "ivme", banka: b.kod, aciklama: `${ad[b.kod]} ${adm} ${tur} büyümesi son üç çeyrektir ${y}`, deger: y, birim: "durum" });
    }
  }

  /* ---- sıralama ---- */
  for (const m of ["net_faiz", "ucret", "mevduat"]) {
    const adm = m === "mevduat" ? "mevduat" : METRIKLER[m];
    const seviye = Object.fromEntries(B.map((b) => [b.kod, seri(b, m)[n]]));
    const seviye0 = Object.fromEntries(B.map((b) => [b.kod, seri(b, m)[n - 1]]));
    const yillik = Object.fromEntries(B.map((b) => [b.kod, buyume(seri(b, m)[n], seri(b, m)[n - 4])]));
    const s = sirala(seviye), s0 = sirala(seviye0), sy = sirala(yillik);
    for (const b of B) {
      ekle({ id: `siralama.${m}.tutar.${b.kod}`, baslik: "siralama", banka: b.kod, aciklama: `${ad[b.kod]} ${adm}, ${D[n]}`, deger: yuvarla(seviye[b.kod] / 1000), birim: "mlr TL" });
      ekle({ id: `siralama.${m}.sira.${b.kod}`, baslik: "siralama", banka: b.kod, aciklama: `${ad[b.kod]} ${adm} büyüklüğünde 8 banka içinde sıra (önceki çeyrek: ${s0[b.kod]})`, deger: s[b.kod], birim: "sıra" });
      if (s0[b.kod] !== s[b.kod]) ekle({ id: `siralama.${m}.sira_degisim.${b.kod}`, baslik: "siralama", banka: b.kod, aciklama: `${ad[b.kod]} ${adm} sırasında önceki çeyreğe göre değişim (pozitif = yükseldi)`, deger: s0[b.kod] - s[b.kod], birim: "sıra" });
      ekle({ id: `siralama.${m}.yillik.${b.kod}`, baslik: "siralama", banka: b.kod, aciklama: `${ad[b.kod]} ${adm} yıllık büyümesi`, deger: yuvarla(yillik[b.kod]), birim: "%" });
      ekle({ id: `siralama.${m}.yillik_sira.${b.kod}`, baslik: "siralama", banka: b.kod, aciklama: `${ad[b.kod]} ${adm} yıllık büyümesinde 8 banka içinde sıra`, deger: sy[b.kod], birim: "sıra" });
    }
  }
  const upay = Object.fromEntries(B.map((b) => {
    const f = b.seriler.net_faiz.ceyrek[n], u = b.seriler.net_ucret_komisyon.ceyrek[n];
    return [b.kod, (u / (f + u)) * 100];
  }));
  const supay = sirala(upay);
  for (const b of B) {
    ekle({ id: `siralama.ucret_payi.${b.kod}`, baslik: "siralama", banka: b.kod, aciklama: `${ad[b.kod]} ücret-komisyon payı, ${D[n]}`, deger: yuvarla(upay[b.kod]), birim: "%" });
    ekle({ id: `siralama.ucret_payi_sira.${b.kod}`, baslik: "siralama", banka: b.kod, aciklama: `${ad[b.kod]} ücret-komisyon payında 8 banka içinde sıra`, deger: supay[b.kod], birim: "sıra" });
  }
  // yatırım hizmetlerinin ücret-komisyondaki payı (sunumlardan, yalnız 4 banka)
  const uv = panel.uvek || {};
  const uvSon = Object.fromEntries(Object.entries(uv).map(([k, x]) => [k, x.veri[n]]).filter(([, v]) => v != null));
  const suv = sirala(uvSon);
  for (const [k, v] of Object.entries(uvSon)) {
    ekle({ id: `siralama.yatirim_payi.${k}`, baslik: "siralama", banka: k, aciklama: `${ad[k]} yatırım hizmetlerinin (${uv[k].kalem}) ücret-komisyon içindeki payı, sunumdan, ${D[n]}`, deger: v, birim: "%" });
    ekle({ id: `siralama.yatirim_payi_sira.${k}`, baslik: "siralama", banka: k, aciklama: `${ad[k]} yatırım hizmetleri payında, bu payı açıklayan ${Object.keys(uvSon).length} banka içinde sıra`, deger: suv[k], birim: "sıra" });
  }

  /* ---- dikkat ---- */
  for (const b of B) {
    const r = oran(b, "mevduat", n);
    if (r != null && r < 0) ekle({ id: `dikkat.mevduat_azalis.${b.kod}`, baslik: "dikkat", banka: b.kod, aciklama: `${ad[b.kod]} mevduatı ${D[n]}'de önceki çeyreğe göre azaldı`, deger: yuvarla(r), birim: "%" });
  }
  // 8 bankanın ortancasından 2 standart sapmadan fazla ayrışan büyüme
  for (const m of ["net_faiz", "ucret", "mevduat"]) {
    const v = B.map((b) => [b.kod, oran(b, m, n)]).filter(([, x]) => x != null);
    const xs = v.map(([, x]) => x).sort((a, b) => a - b);
    const ort = xs[Math.floor(xs.length / 2)];
    const ss = Math.sqrt(xs.reduce((a, x) => a + (x - xs.reduce((p, q) => p + q, 0) / xs.length) ** 2, 0) / xs.length);
    for (const [k, x] of v) {
      if (ss > 0 && Math.abs(x - ort) > 2 * ss) ekle({
        id: `dikkat.aykiri.${m}.${k}`, baslik: "dikkat", banka: k,
        aciklama: `${ad[k]} ${m === "mevduat" ? "mevduat çeyreklik" : METRIKLER[m] + " yıllık"} büyümesi 8 bankanın ortancasından (${yuvarla(ort)}%) belirgin ayrışıyor`,
        deger: yuvarla(x), birim: "%",
      });
    }
  }
  // son dört çeyrekteki elle tutulan olaylar
  const son4 = new Set([n, n - 1, n - 2, n - 3].map(kod));
  olaylar.filter((o) => son4.has(o.donem)).forEach((o, i) => ekle({
    id: `dikkat.olay.${o.banka}.${o.donem}`, baslik: "dikkat", banka: o.banka, aciklama: o.metin, deger: o.donem.replace("_", " ").replace("C", "Ç"), birim: "dönem",
  }));
  // son iki çeyrekte 0,5%'ten büyük yeniden düzenlemeler
  const son2 = new Set([kod(n), kod(n - 1)]);
  kontrol.yeniden_duzenleme.filter((y) => son2.has(y.donem) && Math.abs(y.fark_yuzde) >= 0.5).forEach((y) => ekle({
    id: `dikkat.yeniden.${y.banka}.${y.kalem}.${y.donem}`, baslik: "dikkat", banka: y.banka,
    aciklama: `${ad[y.banka]}, ${y.donem.replace("_", " ").replace("C", "Ç")} raporunda önceki dönem ${y.kalem === "net_ucret_komisyon" ? "ücret-komisyon" : y.kalem === "net_faiz" ? "net faiz" : y.kalem} rakamını yeniden düzenledi`,
    deger: yuvarla(y.fark_yuzde), birim: "%",
  }));

  return { donem: D[n], olgular: out };
}

module.exports = { olgular, yuvarla, buyume };
