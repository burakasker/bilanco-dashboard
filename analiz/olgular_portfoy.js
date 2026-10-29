// Portföy (PYŞ) olgu katmanı. PYŞ rakamları TMS 29'lu ve 4. çeyrekler hesaplanmış olduğu için
// çeyrekten çeyreğe tutar kıyası kullanılmaz; yıllık kıyas ve birimsiz oranlar (marj, gider, katkı) esas alınır.
"use strict";

const { yuvarla, buyume } = require("./olgular");

function olgularPortfoy(panel, { kontrol = { yeniden_duzenleme: [] } } = {}) {
  const D = panel.donemler;
  const kod = (i) => { const [y, q] = D[i].split(" "); return `${y}_${q[0]}C`; };
  const P = panel.pys;
  const B = panel.bankalar.filter((b) => P[b.kod]);
  const ad = Object.fromEntries(B.map((b) => [b.kod, P[b.kod].ad]));
  let n = D.length - 1;
  while (n > 0 && B.some((b) => P[b.kod].hasilat[n] == null)) n--;
  const out = [];
  const ekle = (o) => out.push({ donem: D[n], ...o });

  const h = (b, i) => P[b.kod].hasilat[i];
  const k = (b, i) => P[b.kod].net_kar[i];
  const g = (b, i) => (P[b.kod].genel_yonetim[i] == null ? null : -(P[b.kod].genel_yonetim[i] + (P[b.kod].pazarlama[i] || 0)));
  const uk = (b, i) => b.seriler.net_ucret_komisyon.ceyrek[i];
  const bk = (b, i) => P[b.kod].buyukluk[i]; // SPK yönetilen toplam portföy, çeyrek sonu, milyar TL, nominal
  // efektif ücret oranı, %: yıllıklandırılmış hasılat / çeyrek başı ve sonu büyüklük ortalaması
  const ucret = (b, i) => (h(b, i) == null || bk(b, i) == null || bk(b, i - 1) == null ? null : ((h(b, i) * 4) / 1000 / ((bk(b, i) + bk(b, i - 1)) / 2)) * 100);
  const oran = (a, p) => (a == null || !p ? null : (a / p) * 100);
  const top = (fn, i) => (B.some((b) => fn(b, i) == null) ? null : B.reduce((s, b) => s + fn(b, i), 0));
  const sirala = (d) => Object.fromEntries(Object.entries(d).filter(([, v]) => v != null).sort((a, b) => b[1] - a[1]).map(([x], j) => [x, j + 1]));

  /* ---- sektör ---- */
  const th = top(h, n), tk = top(k, n), tg = top(g, n);
  ekle({ id: "sektor.hasilat.tutar", baslik: "sektor", aciklama: `8 PYŞ'nin toplam hasılatı, ${D[n]} (enflasyon muhasebeli, yayımlandığı gibi)`, deger: yuvarla(th), birim: "mn TL" });
  ekle({ id: "sektor.hasilat.yillik", baslik: "sektor", aciklama: "Toplam hasılatın geçen yılın aynı çeyreğine göre değişimi (yaklaşık, TMS 29)", deger: yuvarla(buyume(th, top(h, n - 4))), birim: "%" });
  ekle({ id: "sektor.net_kar.tutar", baslik: "sektor", aciklama: `8 PYŞ'nin toplam net dönem kârı, ${D[n]}`, deger: yuvarla(tk), birim: "mn TL" });
  ekle({ id: "sektor.net_kar.yillik", baslik: "sektor", aciklama: "Toplam net kârın geçen yılın aynı çeyreğine göre değişimi (yaklaşık, TMS 29)", deger: yuvarla(buyume(tk, top(k, n - 4))), birim: "%" });
  const marj = (i) => oran(top(k, i), top(h, i)), gider = (i) => oran(top(g, i), top(h, i));
  ekle({ id: "sektor.marj", baslik: "sektor", aciklama: "8 PYŞ toplamında net kâr marjı (net kâr / hasılat)", deger: yuvarla(marj(n)), birim: "%" });
  ekle({ id: "sektor.marj.yillik_puan", baslik: "sektor", aciklama: "Toplam net kâr marjının geçen yılın aynı çeyreğine göre değişimi", deger: yuvarla(marj(n) - marj(n - 4)), birim: "puan" });
  ekle({ id: "sektor.gider", baslik: "sektor", aciklama: "8 PYŞ toplamında gider oranı ((genel yönetim + pazarlama) / hasılat)", deger: yuvarla(gider(n)), birim: "%" });
  ekle({ id: "sektor.gider.yillik_puan", baslik: "sektor", aciklama: "Toplam gider oranının geçen yılın aynı çeyreğine göre değişimi", deger: yuvarla(gider(n) - gider(n - 4)), birim: "puan" });
  ekle({ id: "sektor.katki", baslik: "sektor", aciklama: "8 PYŞ hasılatının 8 ana bankanın net ücret-komisyon gelirine oranı", deger: yuvarla(oran(th, top(uk, n))), birim: "%" });

  const tb = top(bk, n);
  ekle({ id: "sektor.buyukluk.tutar", baslik: "sektor", aciklama: `8 PYŞ'nin yönetilen toplam portföyü, ${D[n]} sonu (SPK, nominal)`, deger: yuvarla(tb), birim: "milyar TL" });
  ekle({ id: "sektor.buyukluk.yillik", baslik: "sektor", aciklama: "Yönetilen toplam portföyün geçen yılın aynı çeyrek sonuna göre değişimi (nominal)", deger: yuvarla(buyume(tb, top(bk, n - 4))), birim: "%" });
  const tUcret = (i) => (th == null ? null : ((top(h, i) * 4) / 1000 / ((top(bk, i) + top(bk, i - 1)) / 2)) * 100);
  ekle({ id: "sektor.ucret_orani", baslik: "sektor", aciklama: "8 PYŞ toplamında efektif ücret oranı (yıllıklandırılmış hasılat / ortalama portföy)", deger: yuvarla(tUcret(n), 2), birim: "%" });
  ekle({ id: "sektor.ucret_orani.yillik_puan", baslik: "sektor", aciklama: "Toplam efektif ücret oranının geçen yılın aynı çeyreğine göre değişimi", deger: yuvarla(tUcret(n) - tUcret(n - 4), 2), birim: "puan" });

  /* ---- verimlilik ve kârlılık ---- */
  const m = Object.fromEntries(B.map((b) => [b.kod, oran(k(b, n), h(b, n))]));
  const gr = Object.fromEntries(B.map((b) => [b.kod, oran(g(b, n), h(b, n))]));
  const sm = sirala(m), sg = sirala(Object.fromEntries(Object.entries(gr).map(([x, v]) => [x, v == null ? null : -v]))); // düşük gider = 1. sıra
  const sb = sirala(Object.fromEntries(B.map((b) => [b.kod, bk(b, n)])));
  const su = sirala(Object.fromEntries(B.map((b) => [b.kod, ucret(b, n)])));
  for (const b of B) {
    ekle({ id: `verim.${b.kod}.buyukluk`, baslik: "verim", banka: b.kod, aciklama: `${ad[b.kod]} yönetilen toplam portföyü, ${D[n]} sonu (SPK)`, deger: yuvarla(bk(b, n)), birim: "milyar TL" });
    ekle({ id: `verim.${b.kod}.buyukluk_sira`, baslik: "verim", banka: b.kod, aciklama: `${ad[b.kod]} portföy büyüklüğünde 8 PYŞ içinde sıra`, deger: sb[b.kod], birim: "sıra" });
    ekle({ id: `verim.${b.kod}.buyukluk_yillik`, baslik: "verim", banka: b.kod, aciklama: `${ad[b.kod]} portföyünün geçen yılın aynı çeyrek sonuna göre değişimi (nominal)`, deger: yuvarla(buyume(bk(b, n), bk(b, n - 4))), birim: "%" });
    ekle({ id: `verim.${b.kod}.ucret_orani`, baslik: "verim", banka: b.kod, aciklama: `${ad[b.kod]} efektif ücret oranı, ${D[n]}`, deger: yuvarla(ucret(b, n), 2), birim: "%" });
    ekle({ id: `verim.${b.kod}.ucret_orani_sira`, baslik: "verim", banka: b.kod, aciklama: `${ad[b.kod]} efektif ücret oranında 8 PYŞ içinde sıra (1 = en yüksek)`, deger: su[b.kod], birim: "sıra" });
    const m0 = oran(k(b, n - 4), h(b, n - 4)), g0 = oran(g(b, n - 4), h(b, n - 4));
    const son4 = [0, 1, 2, 3].map((j) => [k(b, n - j), h(b, n - j)]);
    const ort4 = son4.some(([a, p]) => a == null || !p) ? null : oran(son4.reduce((s, [a]) => s + a, 0), son4.reduce((s, [, p]) => s + p, 0));
    ekle({ id: `verim.${b.kod}.marj`, baslik: "verim", banka: b.kod, aciklama: `${ad[b.kod]} net kâr marjı, ${D[n]}`, deger: yuvarla(m[b.kod]), birim: "%" });
    ekle({ id: `verim.${b.kod}.marj_sira`, baslik: "verim", banka: b.kod, aciklama: `${ad[b.kod]} net kâr marjında 8 PYŞ içinde sıra`, deger: sm[b.kod], birim: "sıra" });
    ekle({ id: `verim.${b.kod}.marj_yillik_puan`, baslik: "verim", banka: b.kod, aciklama: `${ad[b.kod]} net kâr marjının geçen yılın aynı çeyreğine göre değişimi`, deger: yuvarla(m[b.kod] - m0), birim: "puan" });
    ekle({ id: `verim.${b.kod}.marj_son4`, baslik: "verim", banka: b.kod, aciklama: `${ad[b.kod]} son dört çeyreğin toplamında net kâr marjı`, deger: yuvarla(ort4), birim: "%" });
    ekle({ id: `verim.${b.kod}.gider`, baslik: "verim", banka: b.kod, aciklama: `${ad[b.kod]} gider oranı, ${D[n]}`, deger: yuvarla(gr[b.kod]), birim: "%" });
    ekle({ id: `verim.${b.kod}.gider_sira`, baslik: "verim", banka: b.kod, aciklama: `${ad[b.kod]} gider oranında 8 PYŞ içinde sıra (1 = en düşük gider)`, deger: sg[b.kod], birim: "sıra" });
    ekle({ id: `verim.${b.kod}.gider_yillik_puan`, baslik: "verim", banka: b.kod, aciklama: `${ad[b.kod]} gider oranının geçen yılın aynı çeyreğine göre değişimi`, deger: yuvarla(gr[b.kod] - g0), birim: "puan" });
    ekle({ id: `verim.${b.kod}.hasilat`, baslik: "verim", banka: b.kod, aciklama: `${ad[b.kod]} hasılatı, ${D[n]}`, deger: yuvarla(h(b, n)), birim: "mn TL" });
    ekle({ id: `verim.${b.kod}.hasilat_yillik`, baslik: "verim", banka: b.kod, aciklama: `${ad[b.kod]} hasılatının geçen yılın aynı çeyreğine göre değişimi (yaklaşık, TMS 29)`, deger: yuvarla(buyume(h(b, n), h(b, n - 4))), birim: "%" });
  }

  /* ---- ana bankaya katkı ---- */
  const kt = Object.fromEntries(B.map((b) => [b.kod, oran(h(b, n), uk(b, n))]));
  const skt = sirala(kt);
  const uv = panel.uvek || {};
  for (const b of B) {
    ekle({ id: `katki.${b.kod}`, baslik: "katki", banka: b.kod, aciklama: `${ad[b.kod]} hasılatının ${b.ad} net ücret-komisyon gelirine oranı`, deger: yuvarla(kt[b.kod]), birim: "%" });
    ekle({ id: `katki.${b.kod}.sira`, baslik: "katki", banka: b.kod, aciklama: `${ad[b.kod]} ana bankaya katkı oranında 8 PYŞ içinde sıra`, deger: skt[b.kod], birim: "sıra" });
    ekle({ id: `katki.${b.kod}.yillik_puan`, baslik: "katki", banka: b.kod, aciklama: `${ad[b.kod]} katkı oranının geçen yılın aynı çeyreğine göre değişimi`, deger: yuvarla(kt[b.kod] - oran(h(b, n - 4), uk(b, n - 4))), birim: "puan" });
    if (uv[b.kod] && uv[b.kod].veri[n] != null) ekle({ id: `katki.${b.kod}.yatirim_payi`, baslik: "katki", banka: b.kod, aciklama: `${b.ad} sunumunda yatırım hizmetlerinin (${uv[b.kod].kalem}) ücret-komisyon içindeki payı`, deger: uv[b.kod].veri[n], birim: "%" });
  }

  /* ---- dikkat ---- */
  ekle({ id: "dikkat.tms29", baslik: "dikkat", aciklama: "PYŞ'ler enflasyon muhasebesi (TMS 29) uygular; her rapor kendi tarihinin parasıyla yayımlanır, tutar kıyasları yaklaşıktır", deger: "TMS 29", birim: "not" });
  // genel kural konsolide olmayan rapor; konsolide rapordan alınan dönemler ayrıca belirtilir (ör. İş Portföy 2026/2Ç)
  for (const b of B) {
    [n, n - 1, n - 2, n - 3].filter((i) => /_Konsolide\.pdf/.test(P[b.kod].kaynak[i] || "")).forEach((i) => ekle({
      id: `dikkat.konsolide.${b.kod}.${kod(i)}`, baslik: "dikkat", banka: b.kod,
      aciklama: `${ad[b.kod]} ${D[i]} rakamları konsolide rapordan alındı; şirket bu dönem konsolide olmayan rapor yayımlamadı (diğer şirketler ve dönemler konsolide olmayan). Kıyas yaklaşıktır`,
      deger: D[i], birim: "dönem",
    }));
  }
  const xs = Object.values(m).filter((x) => x != null).sort((a, b) => a - b);
  const ort = xs[Math.floor(xs.length / 2)], mean = xs.reduce((s, x) => s + x, 0) / xs.length;
  const ss = Math.sqrt(xs.reduce((s, x) => s + (x - mean) ** 2, 0) / xs.length);
  for (const [x, v] of Object.entries(m)) {
    if (v != null && ss > 0 && Math.abs(v - ort) > 2 * ss) ekle({ id: `dikkat.aykiri_marj.${x}`, baslik: "dikkat", banka: x, aciklama: `${ad[x]} net kâr marjı 8 PYŞ'nin ortancasından (${yuvarla(ort)}%) belirgin ayrışıyor`, deger: yuvarla(v), birim: "%" });
  }
  const son4 = new Set([n, n - 1, n - 2, n - 3]);
  for (const b of B) {
    const elle = [...son4].filter((i) => /elle okundu/.test(P[b.kod].kaynak[i] || ""));
    if (elle.length) ekle({ id: `dikkat.elle.${b.kod}`, baslik: "dikkat", banka: b.kod, aciklama: `${ad[b.kod]} son dört çeyrekte ${elle.length} raporu taranmış görüntüden elle okundu (satır denklikleriyle kontrol edildi)`, deger: elle.length, birim: "rapor" });
  }
  if (P[B[0].kod].yontem[n] === "fark") ekle({ id: "dikkat.q4_hesap", baslik: "dikkat", aciklama: `${D[n]} tutarları raporlarda 3 aylık verilmediği için yıllık eksi 9 aylık olarak hesaplandı`, deger: D[n], birim: "dönem" });
  const son4Kod = new Set([...son4].map(kod));
  kontrol.yeniden_duzenleme.filter((y) => y.kalem === "pys_hasilat" && son4Kod.has(y.donem)).forEach((y) => ekle({
    id: `dikkat.yeniden.${y.banka}.${y.donem}`, baslik: "dikkat", banka: y.banka,
    aciklama: `${ad[y.banka]}, ${y.donem.replace("_", " ").replace("C", "Ç")} raporunda önceki çeyreği yeniden düzenledi (raporun 3 aylık hasılatı ile birikimli fark arasındaki sapma)`,
    deger: yuvarla(y.fark_yuzde), birim: "%",
  }));

  return { donem: D[n], olgular: out };
}

module.exports = { olgularPortfoy };
