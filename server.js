// Railway ve benzeri ortamlar için bağımlılıksız statik sunucu + analiz ucu
const http = require("http");
const fs = require("fs");
const path = require("path");
const { analizUret, KALICI } = require("./analiz/calistir");

const KOK = path.join(__dirname, "web");
const PORT = process.env.PORT || 3000;
const TUR = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon",
};

// "Analizi yenile": 10 dakikada en fazla bir üretim, aynı anda tek üretim
const BEKLEME_MS = 10 * 60 * 1000;
// sınır ve "çalışıyor" durumu sekme başına ayrı: banka, portfoy
const sonUretim = { banka: 0, portfoy: 0 };
const calisiyor = { banka: null, portfoy: null };
const YAZ_DIZIN = KALICI || path.join(__dirname, "veri");
const ISTEK_LOG = path.join(YAZ_DIZIN, "analiz_istek.log");

const json = (res, kod, govde) => res.writeHead(kod, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }).end(JSON.stringify(govde));
const kalanSn = (tur) => Math.max(0, Math.ceil((sonUretim[tur] + BEKLEME_MS - Date.now()) / 1000));

async function analizUcu(req, res, tur) {
  if (!(tur in sonUretim)) return json(res, 400, { hata: "tur banka ya da portfoy olmalı" });
  if (req.method === "GET") return json(res, 200, { aktif: true, kalan_sn: kalanSn(tur), calisiyor: !!calisiyor[tur] });
  if (req.method !== "POST") return json(res, 405, { hata: "Yalnız POST" });
  // her yenileme isteği kaydedilir: kim, ne zaman (maliyetli işlem)
  fs.appendFile(ISTEK_LOG, `${new Date().toISOString()} ${tur} ${req.socket.remoteAddress} ${req.headers["user-agent"] || "-"}\n`, () => {});
  if (calisiyor[tur]) return json(res, 409, { hata: "Analiz zaten hazırlanıyor." });
  if (kalanSn(tur) > 0) return json(res, 429, { hata: "Analiz kısa süre önce yenilendi.", kalan_sn: kalanSn(tur) });
  calisiyor[tur] = analizUret({ gerekirse: false, tur });
  try {
    const { analiz } = await calisiyor[tur];
    sonUretim[tur] = Date.now();
    json(res, 200, { ok: true, uretim: analiz.uretim });
  } catch (e) {
    json(res, e.yapilandirma ? 503 : 502, { hata: e.yapilandirma ? "Analiz servisi yapılandırılmamış." : "Analiz üretilemedi, önceki analiz yerinde kaldı." });
  } finally {
    calisiyor[tur] = null;
  }
}

// yönetici özeti geri bildirimi: uygulanmaz, yalnız veri/geri_bildirim.jsonl dosyasında birikir
const GERI_BILDIRIM = path.join(YAZ_DIZIN, "geri_bildirim.jsonl");
function geriBildirimUcu(req, res) {
  if (req.method !== "POST") return json(res, 405, { hata: "Yalnız POST" });
  let govde = "";
  req.on("data", (p) => { govde += p; if (govde.length > 4000) req.destroy(); });
  req.on("end", () => {
    let k;
    try { k = JSON.parse(govde); } catch { return json(res, 400, { hata: "Geçersiz istek" }); }
    const kayit = {
      zaman: new Date().toISOString(),
      tur: k.tur === "portfoy" ? "portfoy" : "banka",
      degerlendirme: k.degerlendirme === "faydali" ? "faydali" : "gelistirilmeli",
      yorum: String(k.yorum || "").slice(0, 1500),
      analiz_uretim: String(k.analiz_uretim || ""), model: String(k.model || ""),
      kaynak: "sunucu", tarayici: req.headers["user-agent"] || "-",
    };
    fs.appendFile(GERI_BILDIRIM, JSON.stringify(kayit) + "\n", (e) => (e ? json(res, 500, { hata: "Kaydedilemedi" }) : json(res, 200, { ok: true })));
  });
}

http.createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  let yol = decodeURIComponent(url.pathname);
  // kaynak PDF'ler: yalnız kaynak klasörü altındaki .pdf dosyaları
  if (yol.startsWith("/kaynak/")) {
    const KAYNAK = path.join(__dirname, "kaynak");
    const pdf = path.join(KAYNAK, path.normalize(yol.slice("/kaynak/".length)));
    if (!pdf.startsWith(KAYNAK + path.sep) || path.extname(pdf).toLowerCase() !== ".pdf") { res.writeHead(403).end(); return; }
    fs.stat(pdf, (e, st) => {
      if (e || !st.isFile()) { res.writeHead(404, { "content-type": "text/plain; charset=utf-8" }).end("PDF bulunamadı"); return; }
      res.writeHead(200, { "content-type": "application/pdf", "content-length": st.size, "content-disposition": `inline; filename*=UTF-8''${encodeURIComponent(path.basename(pdf))}` });
      fs.createReadStream(pdf).pipe(res);
    });
    return;
  }
  if (yol === "/api/geri-bildirim") { geriBildirimUcu(req, res); return; }
  if (yol === "/api/analiz") { analizUcu(req, res, url.searchParams.get("tur") || "banka"); return; }
  // kalıcı diskte daha yeni analiz varsa (düğmeyle üretilmiş) o verilir
  const am = yol.match(/^\/data\/(analiz_(?:banka|portfoy)\.json)$/);
  if (am && KALICI && fs.existsSync(path.join(KALICI, am[1]))) {
    res.writeHead(200, { "content-type": TUR[".json"], "cache-control": "no-cache" });
    fs.createReadStream(path.join(KALICI, am[1])).pipe(res);
    return;
  }
  if (yol.endsWith("/")) yol += "index.html";
  const dosya = path.join(KOK, path.normalize(yol));
  if (!dosya.startsWith(KOK)) { res.writeHead(403).end(); return; }
  fs.readFile(dosya, (err, icerik) => {
    if (err) { res.writeHead(404, { "content-type": "text/plain; charset=utf-8" }).end("Bulunamadı"); return; }
    res.writeHead(200, {
      "content-type": TUR[path.extname(dosya)] || "application/octet-stream",
      "cache-control": "no-cache",
    });
    res.end(icerik);
  });
}).listen(PORT, () => console.log(`http://localhost:${PORT}`));
