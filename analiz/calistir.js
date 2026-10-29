// Banka yönetici özetini üretir ve web/data/analiz_banka.json'a yazar.
// Kullanım: node analiz/calistir.js [--gerekirse]
//   --gerekirse: veri değişmediyse (veri izi aynıysa) modeli çağırmaz.
"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { olgular } = require("./olgular");
const { olgularPortfoy } = require("./olgular_portfoy");
const { ozetUret, VARSAYILAN_MODEL } = require("./agent");

const KOK = path.join(__dirname, "..");
const PANEL = path.join(KOK, "web", "data", "panel.json");
// KALICI_DIZIN (Railway volume) tanımlıysa çalışırken üretilen analizler ve log oraya yazılır; yoksa projeye
const KALICI = process.env.KALICI_DIZIN || null;
const CIKTI_DIZIN = KALICI || path.join(KOK, "web", "data");
const CIKTI = { banka: path.join(CIKTI_DIZIN, "analiz_banka.json"), portfoy: path.join(CIKTI_DIZIN, "analiz_portfoy.json") };
const HATA_LOG = path.join(KALICI || path.join(KOK, "veri"), "analiz_hata.log");
const ENV = path.join(process.env.HOME || "", ".config", "banka-infografik", "openrouter.env");

// yerelde anahtar ortamda yoksa env dosyasından okunur; değer hiçbir yere yazdırılmaz
function anahtarYukle() {
  if (process.env.OPENROUTER_API_KEY) return;
  try {
    for (const satir of fs.readFileSync(ENV, "utf8").split("\n")) {
      const m = satir.match(/^\s*([A-Z_]+)\s*=\s*(.+?)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  } catch { /* dosya yoksa ortam değişkeni beklenir */ }
}

const okuJson = (p, yedek) => { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return yedek; } };

async function analizUret({ gerekirse = false, fetchFn, tur = "banka" } = {}) {
  anahtarYukle();
  const ham = fs.readFileSync(PANEL);
  // veri izi yalnız o analizin kullandığı rakamlardan; üretim tarihi dışarıda
  const p = JSON.parse(ham);
  const kapsam = tur === "portfoy"
    ? { donemler: p.donemler, pys: p.pys, ucret: p.bankalar.map((b) => b.seriler.net_ucret_komisyon), uvek: p.uvek }
    : { donemler: p.donemler, bankalar: p.bankalar, uvek: p.uvek };
  const veriIzi = crypto.createHash("sha256").update(JSON.stringify(kapsam)).digest("hex");
  const mevcut = okuJson(CIKTI[tur], null) || okuJson(path.join(KOK, "web", "data", `analiz_${tur}.json`), null);
  if (gerekirse && mevcut && mevcut.veri_izi === veriIzi) return { atlandi: true, analiz: mevcut };
  if (!process.env.OPENROUTER_API_KEY) {
    const e = new Error("Analiz servisi yapılandırılmamış (OPENROUTER_API_KEY yok).");
    e.yapilandirma = true;
    throw e;
  }
  const panel = JSON.parse(ham);
  const kontrol = okuJson(path.join(KOK, "veri", "kontrol.json"), { yeniden_duzenleme: [] });
  const { donem, olgular: liste } = tur === "portfoy"
    ? olgularPortfoy(panel, { kontrol })
    : olgular(panel, { olaylar: okuJson(path.join(KOK, "veri", "olaylar.json"), []), kontrol });
  const model = process.env.OPENROUTER_MODEL || VARSAYILAN_MODEL;
  try {
    const { taslak, kullanim, deneme } = await ozetUret({ olgular: liste, donem, anahtar: process.env.OPENROUTER_API_KEY, model, fetchFn, tur });
    const analiz = { tur, uretim: new Date().toISOString(), donem, model, veri_izi: veriIzi, deneme, olgu_sayisi: liste.length, bolumler: taslak.bolumler, olgular: liste, kullanim };
    fs.writeFileSync(CIKTI[tur], JSON.stringify(analiz, null, 1));
    return { atlandi: false, analiz };
  } catch (e) {
    fs.appendFileSync(HATA_LOG, `${new Date().toISOString()} ${tur} ${model} ${e.message}\n`);
    throw e;
  }
}

module.exports = { analizUret, KALICI };

if (require.main === module) {
  // node analiz/calistir.js [--tur banka|portfoy|hepsi] [--gerekirse]
  const ti = process.argv.indexOf("--tur");
  const secim = ti > 0 ? process.argv[ti + 1] : "banka";
  const turler = secim === "hepsi" ? ["banka", "portfoy"] : [secim];
  const gerekirse = process.argv.includes("--gerekirse");
  (async () => {
    for (const tur of turler) {
      try {
        const { atlandi, analiz } = await analizUret({ gerekirse, tur });
        if (atlandi) console.log(`${tur}: analiz güncel (veri değişmedi, ${analiz.uretim}).`);
        else console.log(`${tur}: analiz üretildi, ${analiz.donem}, ${analiz.model}, ${analiz.deneme}. denemede doğrulandı.`);
      } catch (e) {
        if (e.yapilandirma && gerekirse) { console.warn(`UYARI: ${e.message} Analiz adımı atlandı.`); continue; }
        console.error(`${tur}: analiz üretilemedi: ${e.message}`);
        process.exitCode = 1;
      }
    }
  })();
}
