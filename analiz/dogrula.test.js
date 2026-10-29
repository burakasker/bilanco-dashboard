"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { dogrula, BASLIKLAR } = require("./dogrula");

const olgular = [
  { id: "sektor.net_faiz.yillik", deger: 68.2, birim: "%" },
  { id: "sektor.ucret_payi.yillik_puan", deger: -5.7, birim: "puan" },
  { id: "sektor.mevduat.tutar", deger: 15883.7, birim: "mlr TL" },
  { id: "siralama.ucret.sira.garanti", deger: 1, birim: "sıra" },
  { id: "ivme.isbank.mevduat.yon", deger: "yavaşlıyor", birim: "durum" },
];
const madde = (metin, ids) => ({ metin, olgular: ids });
const taslak = (ilkMetin, ilkIds) => ({
  bolumler: BASLIKLAR.map((baslik, i) => ({
    baslik,
    maddeler: i === 0
      ? [madde(ilkMetin, ilkIds), madde("Mevduat 15.883,7 milyar TL'ye ulaştı.", ["sektor.mevduat.tutar"])]
      : [madde("İş Bankası'nda mevduat büyümesi 3 çeyrektir yavaşlıyor.", ["ivme.isbank.mevduat.yon"]),
         madde("Garanti BBVA ücret-komisyonda 1. sırada.", ["siralama.ucret.sira.garanti"])],
  })),
});

test("doğru taslak geçer", () => {
  const h = dogrula(taslak("Net faiz yıllık %68,2 arttı; ücret payı 5,7 puan geriledi.", ["sektor.net_faiz.yillik", "sektor.ucret_payi.yillik_puan"]), olgular);
  assert.deepStrictEqual(h, []);
});

test("yuvarlanmış sayı kabul edilir", () => {
  assert.deepStrictEqual(dogrula(taslak("Net faiz yıllık %68 arttı.", ["sektor.net_faiz.yillik"]), olgular), []);
});

test("yanlış sayı reddedilir", () => {
  const h = dogrula(taslak("Net faiz yıllık %71,4 arttı.", ["sektor.net_faiz.yillik"]), olgular);
  assert.ok(h.some((x) => x.includes("71,4")));
});

test("atıf yapılmayan olgudaki sayı reddedilir", () => {
  const h = dogrula(taslak("Ücret payı 5,7 puan geriledi.", ["sektor.net_faiz.yillik"]), olgular);
  assert.ok(h.some((x) => x.includes("5,7")));
});

test("olmayan olgu kimliği reddedilir", () => {
  const h = dogrula(taslak("Net faiz arttı.", ["sektor.uydurma"]), olgular);
  assert.ok(h.some((x) => x.includes("sektor.uydurma")));
});

test("uzun çizgi reddedilir", () => {
  const h = dogrula(taslak("Net faiz arttı — %68,2.", ["sektor.net_faiz.yillik"]), olgular);
  assert.ok(h.some((x) => x.includes("uzun çizgi")));
});

test("fazla madde ve yanlış başlık reddedilir", () => {
  const t = taslak("Net faiz %68,2 arttı.", ["sektor.net_faiz.yillik"]);
  t.bolumler[0].maddeler.push(t.bolumler[0].maddeler[0], t.bolumler[0].maddeler[0]);
  t.bolumler[1].baslik = "İvme";
  const h = dogrula(t, olgular);
  assert.ok(h.some((x) => x.includes("4 madde")));
  assert.ok(h.some((x) => x.includes("başlıkları")));
});

test("yıl ve dönem adları muaf", () => {
  assert.deepStrictEqual(dogrula(taslak("2026 2Ç'de net faiz yıllık %68,2 arttı.", ["sektor.net_faiz.yillik"]), olgular), []);
});
