"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { olgular } = require("./olgular");

// 2 banka, 7 çeyrek; değerler milyon TL
const banka = (kod, faiz, ucret, mevduat) => ({
  kod, ad: kod.toUpperCase(),
  seriler: { net_faiz: { ceyrek: faiz }, net_ucret_komisyon: { ceyrek: ucret } },
  mevduat: { toplam: mevduat },
});
const panel = {
  donemler: ["2024 4Ç", "2025 1Ç", "2025 2Ç", "2025 3Ç", "2025 4Ç", "2026 1Ç", "2026 2Ç"],
  bankalar: [
    banka("a", [100, 100, 100, 100, 100, 120, 130], [50, 50, 50, 50, 50, 50, 50], [900, 1000, 1100, 1200, 1300, 1400, 1300]),
    banka("b", [200, 200, 200, 200, 200, 200, 200], [100, 100, 100, 100, 100, 110, 120], [2000, 2000, 2000, 2000, 2000, 2000, 2100]),
  ],
};

const bul = (r, id) => r.olgular.find((o) => o.id === id);

test("sektör toplamları ve büyüme", () => {
  const r = olgular(panel);
  assert.strictEqual(r.donem, "2026 2Ç");
  assert.strictEqual(bul(r, "sektor.net_faiz.tutar").deger, 0.3); // 330 mn = 0,3 mlr
  // 2026 2Ç (330) / 2025 2Ç (300) - 1 = %10
  assert.strictEqual(bul(r, "sektor.net_faiz.yillik").deger, 10);
  // ücret: 170 / 160 - 1 = %6,25 → 6,3
  assert.strictEqual(bul(r, "sektor.ucret.ceyreklik").deger, 6.3);
  // mevduat: 3400 / 3400 → 0
  assert.strictEqual(bul(r, "sektor.mevduat.ceyreklik").deger, 0);
});

test("ivme işaretleri", () => {
  const r = olgular(panel);
  // B ücret yıllık büyümesi: 2025 4Ç %0, 2026 1Ç %10, 2026 2Ç %20 → hızlanıyor
  assert.strictEqual(bul(r, "ivme.b.ucret.yon").deger, "hızlanıyor");
  // A mevduat çeyreklik: %8,3, %7,7, -%7,1 → yavaşlıyor
  assert.strictEqual(bul(r, "ivme.a.mevduat.yon").deger, "yavaşlıyor");
});

test("sıralama ve mevduat azalışı", () => {
  const r = olgular(panel);
  assert.strictEqual(bul(r, "siralama.net_faiz.sira.b").deger, 1);
  assert.strictEqual(bul(r, "siralama.net_faiz.sira.a").deger, 2);
  assert.ok(bul(r, "dikkat.mevduat_azalis.a"));
  assert.ok(!bul(r, "dikkat.mevduat_azalis.b"));
});
