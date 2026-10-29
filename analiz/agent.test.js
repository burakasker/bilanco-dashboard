"use strict";
// Ağ yok: sahte OpenRouter yanıtlarıyla düzeltme turu ve hata yolu denenir.
const test = require("node:test");
const assert = require("node:assert");
const { ozetUret } = require("./agent");
const { BASLIKLAR } = require("./dogrula");

const olgular = [{ id: "sektor.net_faiz.yillik", aciklama: "x", deger: 68.2, birim: "%" }];
const taslak = (sayi) => JSON.stringify({
  bolumler: BASLIKLAR.map((baslik) => ({ baslik, maddeler: [
    { metin: `Net faiz yıllık %${sayi} arttı.`, olgular: ["sektor.net_faiz.yillik"] },
    { metin: "Net faiz yıllık %68 arttı.", olgular: ["sektor.net_faiz.yillik"] },
  ] })),
});
const sahte = (yanitlar) => {
  let i = 0;
  const istekler = [];
  const fn = async (_url, opt) => {
    istekler.push(JSON.parse(opt.body));
    return { ok: true, json: async () => ({ choices: [{ message: { content: yanitlar[i++] } }], usage: { total_tokens: 10 } }) };
  };
  fn.istekler = istekler;
  return fn;
};

test("ilk denemede doğru taslak kabul edilir", async () => {
  const r = await ozetUret({ olgular, donem: "2026 2Ç", anahtar: "k", fetchFn: sahte([taslak("68,2")]) });
  assert.strictEqual(r.deneme, 1);
});

test("yanlış sayı düzeltme turunda düzelir", async () => {
  const fn = sahte([taslak("71,4"), "```json\n" + taslak("68,2") + "\n```"]);
  const r = await ozetUret({ olgular, donem: "2026 2Ç", anahtar: "k", fetchFn: fn });
  assert.strictEqual(r.deneme, 2);
  assert.match(fn.istekler[1].messages.at(-1).content, /71,4/);
});

test("iki denemede de yanlışsa hata verir", async () => {
  await assert.rejects(ozetUret({ olgular, donem: "2026 2Ç", anahtar: "k", fetchFn: sahte([taslak("71,4"), taslak("70,0")]) }), /iki denemede/);
});

test("anahtar yoksa hata verir", async () => {
  await assert.rejects(ozetUret({ olgular, donem: "2026 2Ç", anahtar: "" }), /OPENROUTER_API_KEY/);
});
