"use strict";
// Gerçek panel üzerinde duman testi: olgular boş değer üretmez, kimlikler tekildir, sektör toplamı şirket toplamına eşittir.
const test = require("node:test");
const assert = require("node:assert");
const path = require("path");
const fs = require("fs");
const { olgularPortfoy } = require("./olgular_portfoy");

const panel = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "web", "data", "panel.json")));
const r = olgularPortfoy(panel);
const bul = (id) => r.olgular.find((o) => o.id === id);

test("boş ya da NaN değer yok, kimlikler tekil", () => {
  assert.deepStrictEqual(r.olgular.filter((o) => o.deger == null || Number.isNaN(o.deger)).map((o) => o.id), []);
  assert.strictEqual(new Set(r.olgular.map((o) => o.id)).size, r.olgular.length);
});

test("sektör hasılatı şirketlerin toplamı", () => {
  const toplam = Object.keys(panel.pys).reduce((s, k) => s + bul(`verim.${k}.hasilat`).deger, 0);
  assert.ok(Math.abs(toplam - bul("sektor.hasilat.tutar").deger) < 1);
});

test("marj sıraları 1-8 arası ve tekil", () => {
  const siralar = Object.keys(panel.pys).map((k) => bul(`verim.${k}.marj_sira`).deger).sort((a, b) => a - b);
  assert.deepStrictEqual(siralar, [1, 2, 3, 4, 5, 6, 7, 8]);
});

test("büyüklük ve ücret oranı sıraları 1-8 arası, sektör büyüklüğü şirket toplamı", () => {
  for (const a of ["buyukluk_sira", "ucret_orani_sira"]) {
    assert.deepStrictEqual(Object.keys(panel.pys).map((k) => bul(`verim.${k}.${a}`).deger).sort((x, y) => x - y), [1, 2, 3, 4, 5, 6, 7, 8]);
  }
  const toplam = Object.keys(panel.pys).reduce((s, k) => s + bul(`verim.${k}.buyukluk`).deger, 0);
  assert.ok(Math.abs(toplam - bul("sektor.buyukluk.tutar").deger) < 1);
});

test("konsolide rapordan alınan dönem dikkat olgusu olarak çıkar", () => {
  const k = r.olgular.filter((o) => o.id.startsWith("dikkat.konsolide."));
  assert.ok(k.some((o) => o.id === "dikkat.konsolide.isbank.2026_2C"), k.map((o) => o.id).join(","));
});
