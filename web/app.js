/* Banka gelir görünümü: panel.json -> grafikler ve tablolar */
(function () {
  "use strict";

  const durum = { secili: new Set(), veri: null, bas: 0, son: 0, reel: false };
  const grafikler = [];

  /* ---- dil: Türkçe (varsayılan) ya da İngilizce; ?lang=en ya da kayıtlı seçim ---- */
  let EN = false;
  try { EN = (new URLSearchParams(location.search).get("lang") || localStorage.getItem("dil")) === "en"; } catch (e) { /* depolama kapalı olabilir */ }
  const L = (tr, en) => (EN ? en : tr);
  // "2026 2Ç" → "Q2 2026"
  const donemAd = (d) => { const m = EN && String(d).match(/^(\d{4}) (\d)Ç$/); return m ? `Q${m[2]} ${m[1]}` : d; };
  let sayiFmt, yuzdeFmt, yuzde2Fmt, eksenFmt, carpanFmt, tarihFmt;
  function bicimKur() {
    const y = EN ? "en-US" : "tr-TR";
    sayiFmt = new Intl.NumberFormat(y, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    yuzdeFmt = new Intl.NumberFormat(y, { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 });
    yuzde2Fmt = new Intl.NumberFormat(y, { style: "percent", minimumFractionDigits: 2, maximumFractionDigits: 2 });
    eksenFmt = new Intl.NumberFormat(y, { maximumFractionDigits: 1 });
    carpanFmt = new Intl.NumberFormat(y, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    tarihFmt = new Intl.DateTimeFormat(y, { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
  }
  bicimKur();
  const milyar = (v) => (v == null ? null : v / 1000);
  const fmt = (v) => (v == null || !isFinite(v) ? "-" : sayiFmt.format(v));
  const yuzde = (v) => (v == null || !isFinite(v) ? "-" : yuzdeFmt.format(v));
  const yuzde2 = (v) => (v == null || !isFinite(v) ? "-" : yuzde2Fmt.format(v));
  const css = (ad) => getComputedStyle(document.documentElement).getPropertyValue(ad).trim();
  const renk = (i) => css(`--s${i + 1}`);
  const kes = (a) => a.slice(durum.bas, durum.son + 1);

  /* ---- enflasyon düzeltmesi ---- */
  // gelir kalemleri çeyrek ortalaması, mevduat ve portföy büyüklüğü çeyrek sonu TÜFE çarpanıyla son çeyrek fiyatlarına taşınır.
  // PYŞ gelir tablosu kalemleri TMS 29 ile yayımlandığı için düzeltilmez.
  function reelVeri(v) {
    const { akis, stok } = v.enflasyon;
    const carp = (a, c) => a.map((x, i) => (x == null ? null : x * c[i]));
    const bankalar = v.bankalar.map((b) => ({
      ...b,
      seriler: Object.fromEntries(Object.entries(b.seriler).map(([k, x]) => [k, { ...x, ceyrek: carp(x.ceyrek, akis) }])),
      mevduat: { ...b.mevduat, tp: carp(b.mevduat.tp, stok), yp: carp(b.mevduat.yp, stok), toplam: carp(b.mevduat.toplam, stok) },
    }));
    const pys = Object.fromEntries(Object.entries(v.pys).map(([k, x]) => [k, { ...x, buyukluk: carp(x.buyukluk, stok) }]));
    return { ...v, bankalar, pys };
  }
  // eksen ve alt başlıklarda ölçü: nominal ya da son çeyrek fiyatlarıyla
  const olcu = () => (durum.reel ? L(`${durum.nominal.enflasyon.baz} fiyatlarıyla`, `in ${durum.nominal.enflasyon.baz} prices`) : "nominal");
  const eksenTL = (on) => (durum.reel ? `${on}, ${L("milyar TL", "TRY bn")}, ${olcu()}` : `${on}, ${L("milyar TL", "TRY bn")}`);
  const CEYREKLIK = () => L("Çeyreklik", "Quarterly");

  /* ---- logolar ---- */
  // en/boy oranı; yükseklik oranın kareköküyle küçülür, böylece geniş ve kompakt logolar eşit ağırlıkta görünür
  const LOGO_ORAN = { akbank: 9.09, isbank: 3.18, garanti: 5.45, yapikredi: 5.71, teb: 2.3, qnb: 3.41, denizbank: 5.71, kuveytturk: 5.66 };
  // portföy şirketi logoları (web/logolar/pys); çoğu iki satırlı olduğu için biraz büyük çizilir
  const LOGO_ORAN_PYS = { akbank: 7.79, isbank: 3.5, garanti: 4.15, yapikredi: 3.75, teb: 5.22, qnb: 2.67, denizbank: 5.56, kuveytturk: 4.73 };
  const LOGO_TABAN = { cip: 21, tablo: 24, kart: 31 }; // banka ve portföy logoları aynı tabanı kullanır
  const logoSrc = (kod, pys) => pys
    ? (window.LOGOLAR_PYS && window.LOGOLAR_PYS[kod]) || `logolar/pys/${kod}.png`
    : (window.LOGOLAR && window.LOGOLAR[kod]) || `logolar/${kod}.png`;
  function logoImg(b, temel, pys, alt = "") {
    const oran = (pys ? LOGO_ORAN_PYS : LOGO_ORAN)[b.kod];
    // İş Bankası logosunda yazı, işaretin yanında küçük kalıyor
    // iki sekmede aynı kural: her logo, yerinin taban boyutuna göre eşit alan kaplar
    // portföy logoları çoğunlukla iki satırlı; aynı alanda yazıları küçük kaldığı için hafif büyütülür
    const olcek = pys ? 1.15 : b.kod === "isbank" ? 1.4 : 1;
    const h = Math.min(temel * 1.15, temel * Math.sqrt(2.5 / oran)) * olcek;
    return `<img src="${logoSrc(b.kod, pys)}" alt="${alt}" style="height:${h.toFixed(1)}px;width:${(h * oran).toFixed(1)}px">`;
  }
  const logo = (b, temel, pys) => `<span class="logo-plaka">${logoImg(b, temel, pys, pys ? durum.veri.pys[b.kod].ad : b.ad)}</span>`;
  // yıllık değişim; karşılaştırma dönemi veri dışındaysa null
  const yoy = (a, b) => (a == null || b == null || !b ? null : a / b - 1);
  const degisim = (x, ok) => (x == null || !isFinite(x) ? `<span>-</span>`
    : `<span class="${x >= 0 ? "art" : "azal"}">${ok ? (x >= 0 ? "▲ " : "▼ ") : (x >= 0 ? "+" : "")}${yuzde(ok ? Math.abs(x) : x)}</span>`);

  /* ---- tema ---- */
  try {
    const t = localStorage.getItem("tema");
    if (t) document.documentElement.dataset.theme = t;
  } catch (e) { /* depolama kapalı olabilir */ }
  document.getElementById("tema").addEventListener("click", () => {
    const koyu = document.documentElement.dataset.theme
      ? document.documentElement.dataset.theme === "dark"
      : matchMedia("(prefers-color-scheme: dark)").matches;
    const yeni = koyu ? "light" : "dark";
    document.documentElement.dataset.theme = yeni;
    try { localStorage.setItem("tema", yeni); } catch (e) { /* yok say */ }
    ciz();
  });
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", ciz);

  /* ---- seri türetme ---- */
  // çeyreklik seri, milyar TL
  const seri = (b, alan) => b.seriler[alan].ceyrek.map(milyar);
  function paySeri(b) {
    const f = seri(b, "net_faiz");
    const k = seri(b, "net_ucret_komisyon");
    return f.map((v, i) => (v == null || k[i] == null ? null : (k[i] / (v + k[i])) * 100));
  }
  const seciliBankalar = () => durum.veri.bankalar.filter((b) => durum.secili.has(b.kod));
  const bankaRenk = (b) => css(`--b-${b.kod}`);
  // aynı renk ailesinde karışan bankalar kesik çizgiyle ayrılır
  const KESIK = new Set(["yapikredi"]);
  const bankaCizgi = (b) => (KESIK.has(b.kod) ? [6, 4] : "solid");

  /* ---- çizgi grafik ---- */
  function cizgiSecenek(donemler, seriler, birim, opts = {}) {
    const metin2 = css("--metin-2"), soluk = css("--soluk"), izgara = css("--izgara"), eksen = css("--eksen");
    const yuzey = css("--yuzey"), metin = css("--metin");
    const etiketli = seriler.length <= 4;
    return {
      animationDuration: 400,
      textStyle: { fontFamily: "Inter, system-ui, sans-serif" },
      // sağ boşluk çizgi ucundaki etikete göre: ad + değer ya da yalnız değer
      // çizgi ucunda ad + son değer; sağ boşluk en uzun etikete göre
      grid: { left: 8, right: Math.max(...seriler.map((s) => (s.etiket || s.ad).length), 4) * 6.4 + 64, top: opts.eksen ? 34 : 16, bottom: 8, containLabel: true },
      tooltip: {
        trigger: "axis",
        backgroundColor: yuzey, borderColor: izgara, borderWidth: 1, padding: [8, 10],
        textStyle: { color: metin, fontSize: 12 },
        axisPointer: { type: "line", lineStyle: { color: eksen, width: 1, type: "solid" } },
        formatter: (ps) => {
          const sirali = [...ps].filter((p) => p.value != null).sort((a, b) => b.value - a.value);
          const satir = sirali.map((p) =>
            `<div style="display:flex;gap:12px;justify-content:space-between"><span><span style="display:inline-block;width:14px;height:3px;border-radius:2px;background:${p.color};margin:0 6px 3px 0"></span>${p.seriesName}</span><b>${fmt(p.value)}${birim}</b></div>`).join("");
          return `<div style="font-weight:600;margin-bottom:4px">${ps[0].axisValue}</div>${satir || L("veri yok", "no data")}`;
        },
      },
      xAxis: {
        type: "category", data: donemler, boundaryGap: false,
        axisLine: { lineStyle: { color: eksen } }, axisTick: { show: false },
        axisLabel: { color: soluk, fontSize: 11, hideOverlap: true },
      },
      yAxis: {
        type: "value", scale: !!opts.olcek,
        // eksen birimi grafiğin sol üstünde: "Çeyreklik, milyar TL" gibi
        name: opts.eksen || "", nameLocation: "end", nameGap: 14,
        nameTextStyle: { color: metin2, fontSize: 11, fontWeight: 500, align: "left" },
        splitLine: { lineStyle: { color: izgara, width: 1, type: "solid" } },
        axisLabel: { color: soluk, fontSize: 11, formatter: (v) => eksenFmt.format(v) + birim },
      },
      series: seriler.map((s) => ({
        name: s.ad, type: "line", data: s.veri, connectNulls: false,
        showSymbol: false, symbol: "circle", symbolSize: 8,
        lineStyle: { width: 2, color: s.renk, type: s.cizgi || "solid" }, itemStyle: { color: s.renk, borderColor: yuzey, borderWidth: 2 },
        emphasis: { focus: "series", lineStyle: { width: 2.5 } },
        blur: { lineStyle: { opacity: 0.15 } },
        // çizginin ucunda son değer; seri çoksa yalnız değer, renkli nokta kimliği taşır
        endLabel: {
          show: true, distance: 6, fontSize: 11, color: metin2,
          formatter: (p) => {
            const deger = p.value == null ? "" : `{d|${fmt(p.value)}${birim}}`;
            return `{n|●} ${s.etiket || s.ad} ${deger}`;
          },
          rich: { n: { color: s.renk, fontSize: 10 }, d: { color: metin, fontWeight: 600, fontSize: 11 } },
        },
        labelLayout: { moveOverlap: "shiftY" },
      })),
    };
  }

  function grafik(id, secenek) {
    const el = document.getElementById(id);
    let g = echarts.getInstanceByDom(el);
    if (!g) { g = echarts.init(el, null, { renderer: "svg" }); grafikler.push(g); }
    g.setOption(secenek, true);
    return g;
  }

  /* ---- tablo ---- */
  // tablo başlıklarında her kelimenin (tireli parçalar dahil) ilk harfi büyük; bağlaç, edat ve birimler olduğu gibi kalır
  const KUCUK_KELIME = new Set(["ve", "ile", "to", "and", "of", "in", "per", "the", "mlr", "mn", "bn", "milyar", "milyon"]);
  const basHarf = (x) => String(x).split(" ").map((w, i) => (i > 0 && KUCUK_KELIME.has(w) ? w
    : w.split("-").map((p) => p.charAt(0).toLocaleUpperCase(EN ? "en" : "tr") + p.slice(1)).join("-"))).join(" ");
  function tablo(id, donemler, satirlar, bicim) {
    const bas = `<tr><th>${basHarf(L(durum.sekme === "portfoy" ? "Şirket" : "Banka", durum.sekme === "portfoy" ? "Company" : "Bank"))}</th>${donemler.map((d) => `<th>${d}</th>`).join("")}</tr>`;
    const govde = satirlar.map((s) =>
      `<tr><td><span class="nokta" style="background:${s.renk}"></span>${s.ad}</td>${s.veri.map((v) =>
        `<td class="${v == null ? "bos" : ""}">${bicim(v)}</td>`).join("")}</tr>`).join("");
    document.getElementById(id).innerHTML = `<table>${bas}${govde}</table>`;
  }

  /* ---- özet ---- */
  /* ---- yönetici özeti (analiz agent'ı) ----
     Railway'de data/analiz_banka.json okunur ve /api/analiz ile yenilenir;
     Claude paylaşım sürümünde analiz sayfaya gömülüdür (window.ANALIZ_BANKA), düğme yoktur. */
  const htmlKac = (x) => String(x).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  // maddelerdeki sayıları kalın yaz
  const sayiKalin = (x) => htmlKac(x).replace(/%?[-−]?\d{1,3}(?:\.\d{3})+(?:,\d+)?|%?[-−]?\d+(?:,\d+)?(?:\s?(?:milyar TL|puan))?/g,
    (m) => (/^(20[2-3]\d)$/.test(m) ? m : `<b>${m}</b>`));
  // banka adlarını bankanın rengiyle vurgula; sayılar kalınlaştırıldıktan sonra çalışır (eklenen etiketlerde banka adı yok)
  const BANKA_ADI = { "Yapı Kredi Portföy": "yapikredi", "Ak Portföy": "akbank", "İş Portföy": "isbank", "Garanti BBVA Portföy": "garanti",
    "TEB Portföy": "teb", "QNB Portföy": "qnb", "Deniz Portföy": "denizbank", "KT Portföy": "kuveytturk", "Garanti BBVA": "garanti", "Garanti": "garanti", "Yapı Kredi": "yapikredi", "İş Bankası": "isbank",
    "Kuveyt Türk": "kuveytturk", "DenizBank": "denizbank", "Akbank": "akbank", "TEB": "teb", "QNB": "qnb" };
  const BANKA_RE = new RegExp(`(${Object.keys(BANKA_ADI).join("|")})(?![\\p{L}])`, "gu");
  const ozetMetni = (x) => sayiKalin(x).replace(BANKA_RE, (m) => `<span class="banka-vurgu" style="--renk:var(--b-${BANKA_ADI[m]})">${m}</span>`);

  // "anthropic/claude-sonnet-5.5" → Claude logosu + "Sonnet 5.5"; başka sağlayıcıda düz metin
  function modelEtiket(model) {
    const m = String(model).split("/").pop().match(/^claude-([a-z]+)-([\d.]+)/);
    if (!m) return htmlKac(String(model).split("/").pop());
    const surum = `${m[1][0].toUpperCase()}${m[1].slice(1)} ${m[2]}`;
    return `<span class="model-etiket" title="${htmlKac(model)}"><span class="logo-plaka model-plaka"><img src="${logoSrc("claude")}" alt="Claude" width="51" height="11"></span>${surum}</span>`;
  }

  // iki sekmenin analiz bölümü aynı kodla çalışır; portföy öğelerinin kimlikleri "p" önekli (analizMeta → pAnalizMeta)
  const aEl = (tur, ad) => document.getElementById(tur === "portfoy" ? `p${ad[0].toUpperCase()}${ad.slice(1)}` : ad);
  const GOMULU = { banka: () => window.ANALIZ_BANKA, portfoy: () => window.ANALIZ_PORTFOY };

  function analizGoster(tur, a) {
    const meta = aEl(tur, "analizMeta"), kap = aEl(tur, "analizKartlar");
    sonAnaliz[tur] = a;
    if (!a || !a.bolumler) { meta.textContent = L("Henüz analiz üretilmedi.", "No analysis generated yet."); kap.innerHTML = ""; return; }
    const secim = tur === "portfoy" ? L("şirket", "company") : L("banka", "bank");
    meta.innerHTML = L(
      `Yapay zekâ analizi · ${htmlKac(a.donem.replace(" ", "/"))} verisi · ${tarihFmt.format(new Date(a.uretim))} · ${modelEtiket(a.model)} · Dönem ve ${secim} seçimi bu özeti değiştirmez.`,
      `AI analysis · ${htmlKac(donemAd(a.donem))} data · ${tarihFmt.format(new Date(a.uretim))} · ${modelEtiket(a.model)} · Period and ${secim} selection do not change this summary. The summary is written in Turkish.`);
    kap.innerHTML = a.bolumler.map((b) => `
      <article class="analiz-kart">
        <h3>${htmlKac(b.baslik)}</h3>
        <ul>${b.maddeler.map((m) => `<li>${ozetMetni(m.metin)}</li>`).join("")}</ul>
      </article>`).join("");
  }

  async function analizYukle(tur) {
    if (GOMULU[tur]()) { analizGoster(tur, GOMULU[tur]()); return; }
    try {
      const r = await fetch(`data/analiz_${tur}.json?t=${Date.now()}`);
      analizGoster(tur, r.ok ? await r.json() : null);
    } catch { analizGoster(tur, null); }
    // düğme yalnız analiz ucu olan sunucuda görünür
    try {
      const d = await (await fetch(`/api/analiz?tur=${tur}`)).json();
      if (d.aktif) { aEl(tur, "analizYenile").hidden = false; dugmeSayac(tur, d.kalan_sn); }
    } catch { /* statik barındırma: düğme gizli kalır */ }
  }

  const sayacZaman = {};
  function dugmeSayac(tur, sn) {
    const btn = aEl(tur, "analizYenile");
    clearInterval(sayacZaman[tur]);
    const yaz = () => {
      if (sn <= 0) { btn.disabled = false; btn.textContent = L("Analizi yenile", "Refresh analysis"); clearInterval(sayacZaman[tur]); return; }
      btn.disabled = true;
      const sure = `${Math.floor(sn / 60)}:${String(sn % 60).padStart(2, "0")}`;
      btn.textContent = L(`Yeniden ${sure} sonra`, `Available in ${sure}`);
      sn--;
    };
    yaz();
    if (sn > 0) sayacZaman[tur] = setInterval(yaz, 1000);
  }

  /* ---- geri bildirim: uygulanmaz, yalnız birikir ----
     Claude paylaşım sürümünde artifact veritabanına (db, "geri_bildirim" koleksiyonu),
     yerel sunucu ve Railway'de veri/geri_bildirim.jsonl dosyasına yazılır. */
  const sonAnaliz = {};
  let dbSoz = null;
  const dbAl = () => (dbSoz ||= (window.claude?.use ? window.claude.use("db").catch(() => null) : Promise.resolve(null)));

  async function geriBildirimKaydet(kayit) {
    const db = await dbAl();
    if (db) {
      const user = await window.claude.use("user").catch(() => null);
      await db.collection("geri_bildirim").add({ ...kayit, zaman: new Date().toISOString(), kisi: user ? await user.id() : null, kaynak: "artifact" });
      return;
    }
    const r = await fetch("/api/geri-bildirim", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(kayit) });
    if (!r.ok) throw new Error("kaydedilemedi");
  }

  async function geriBildirimKur(tur) {
    const kap = aEl(tur, "analizGeri");
    // kayıt yeri yoksa (statik barındırma) alan gösterilmez
    const db = await dbAl();
    if (!db) { try { if (!(await fetch("/api/analiz?tur=" + tur)).ok) return; } catch { return; } }
    const id = (x) => `${tur}-${x}`;
    kap.hidden = false;
    kap.innerHTML = `
      <span class="gb-soru">${L("Bu özet işine yaradı mı?", "Was this summary useful?")}</span>
      <div class="gb-dugmeler" role="group" aria-label="${L("Değerlendirme", "Rating")}">
        <button type="button" data-d="faydali" aria-pressed="false">${L("Faydalı", "Useful")}</button>
        <button type="button" data-d="gelistirilmeli" aria-pressed="false">${L("Geliştirilmeli", "Needs work")}</button>
      </div>
      <label class="gorunmez" for="${id("yorum")}">${L("Yorum", "Comment")}</label>
      <textarea id="${id("yorum")}" rows="1" maxlength="1500" placeholder="${L("İstersen kısaca yaz: eksik, yanlış ya da gereksiz bulduğun bir şey…", "Optional: briefly note anything missing, wrong or unnecessary…")}"></textarea>
      <button type="button" class="gb-gonder" disabled>${L("Gönder", "Send")}</button>
      <span class="gb-not" aria-live="polite"></span>`;
    let secim = null;
    const gonder = kap.querySelector(".gb-gonder"), not = kap.querySelector(".gb-not"), yorum = kap.querySelector("textarea");
    kap.querySelectorAll("[data-d]").forEach((b) => b.addEventListener("click", () => {
      secim = b.dataset.d;
      kap.querySelectorAll("[data-d]").forEach((x) => x.setAttribute("aria-pressed", x === b));
      gonder.disabled = false;
    }));
    gonder.addEventListener("click", async () => {
      gonder.disabled = true;
      const a = sonAnaliz[tur] || {};
      try {
        await geriBildirimKaydet({ tur, degerlendirme: secim, yorum: yorum.value.trim(), analiz_uretim: a.uretim || "", model: a.model || "" });
        not.textContent = L("Teşekkürler, kaydedildi. Uygulanmadan biriktiriliyor.", "Thanks, saved. Feedback is collected for later review.");
        yorum.value = "";
        kap.querySelectorAll("[data-d]").forEach((x) => x.setAttribute("aria-pressed", "false"));
        secim = null;
      } catch {
        not.textContent = L("Kaydedilemedi; biraz sonra yeniden dene.", "Could not save; please try again shortly.");
        gonder.disabled = false;
      }
    });
  }

  const ADIMLAR_EN = {
    banka: ["Preparing analysis", "Comparing data", "Computing sector totals", "Finding accelerating and slowing banks",
      "Building rankings", "Model is writing", "Checking numbers against data"],
    portfoy: ["Preparing analysis", "Comparing data", "Computing revenue and profit totals", "Comparing margins and cost ratios",
      "Computing contribution to parent bank", "Model is writing", "Checking numbers against data"],
  };
  const ADIMLAR_TR = {
    banka: ["Analiz hazırlanıyor", "Veriler karşılaştırılıyor", "Sektör toplamları hesaplanıyor", "Hızlanan ve yavaşlayan bankalar bulunuyor",
      "Sıralamalar çıkarılıyor", "Model yorumu yazıyor", "Sayılar veriyle doğrulanıyor"],
    portfoy: ["Analiz hazırlanıyor", "Veriler karşılaştırılıyor", "Hasılat ve kâr toplamları hesaplanıyor", "Marj ve gider oranları karşılaştırılıyor",
      "Ana bankaya katkı hesaplanıyor", "Model yorumu yazıyor", "Sayılar veriyle doğrulanıyor"],
  };
  const ADIMLAR = new Proxy({}, { get: (_, k) => (EN ? ADIMLAR_EN : ADIMLAR_TR)[k] });
  ["banka", "portfoy"].forEach((tur) => aEl(tur, "analizYenile").addEventListener("click", async () => {
    const btn = aEl(tur, "analizYenile"), durumEl = aEl(tur, "analizDurum"), kartlar = aEl(tur, "analizKartlar");
    btn.disabled = true;
    btn.textContent = L("Analiz hazırlanıyor…", "Preparing analysis…");
    // üretim sürerken kapsül içinde dönen gösterge ve sırayla değişen adım metni
    let adim = 0;
    durumEl.innerHTML = `<span class="analiz-kapsul" role="status"><span class="donen" aria-hidden="true"></span><span class="kapsul-metin">${ADIMLAR[tur][0]}…</span></span>`;
    kartlar.classList.add("yenileniyor");
    const adimZaman = setInterval(() => {
      adim = Math.min(adim + 1, ADIMLAR[tur].length - 1);
      const m = durumEl.querySelector(".kapsul-metin");
      if (m) m.textContent = `${ADIMLAR[tur][adim]}…`;
    }, 6000);
    const bitir = () => { clearInterval(adimZaman); kartlar.classList.remove("yenileniyor"); };
    try {
      const r = await fetch(`/api/analiz?tur=${tur}`, { method: "POST" });
      const j = await r.json();
      bitir();
      if (r.ok) {
        durumEl.textContent = L("Analiz yenilendi.", "Analysis refreshed.");
        analizGoster(tur, await (await fetch(`data/analiz_${tur}.json?t=${Date.now()}`)).json());
        dugmeSayac(tur, 600);
      } else {
        durumEl.textContent = j.hata || L("Analiz yenilenemedi.", "Analysis could not be refreshed.");
        dugmeSayac(tur, j.kalan_sn || 0);
      }
    } catch {
      bitir();
      durumEl.textContent = L("Sunucuya ulaşılamadı; önceki analiz yerinde.", "Server unreachable; the previous analysis is kept.");
      dugmeSayac(tur, 0);
    }
  }));

  /* ---- sıralama ---- */
  function siralama() {
    const v = durum.veri, n = durum.son;
    const satir = seciliBankalar().map((b) => {
      const f = milyar(b.seriler.net_faiz.ceyrek[n]), f0 = milyar(b.seriler.net_faiz.ceyrek[n - 4]);
      const k = milyar(b.seriler.net_ucret_komisyon.ceyrek[n]), k0 = milyar(b.seriler.net_ucret_komisyon.ceyrek[n - 4]);
      return { b, f, fd: yoy(f, f0), k, kd: yoy(k, k0), p: k / (f + k) };
    }).sort((a, c) => (c.b.kod === "yapikredi") - (a.b.kod === "yapikredi") || (c.f ?? -Infinity) - (a.f ?? -Infinity) || 0); // Yapı Kredi önde, kalanı net faize göre, raporu gelmeyen sonda
    const d = (x) => degisim(x, false);
    document.getElementById("siralama").innerHTML = `<table>
      <tr>${L(["Banka", "Net faiz", "Yıllık", "Net ücret-kom.", "Yıllık", "Ücret payı"], ["Bank", "Net interest", "YoY", "Net fees", "YoY", "Fee share"]).map((x) => `<th>${basHarf(x)}</th>`).join("")}</tr>
      ${satir.map((s) => `<tr><td><span class="sira-banka"><span class="nokta" style="background:${bankaRenk(s.b)}"></span>${logo(s.b, LOGO_TABAN.tablo)}</span></td>
        <td>${fmt(s.f)}</td><td>${d(s.fd)}</td><td>${fmt(s.k)}</td><td>${d(s.kd)}</td><td>${yuzde(s.p)}</td></tr>`).join("")}
    </table>`;
  }

  /* ---- banka kartları ---- */
  function bankaKartlari() {
    const v = durum.veri, n = durum.son;
    const kap = document.getElementById("bankaKartlari");
    if (!kap.children.length) {
      kap.innerHTML = v.bankalar.map((b) => `
        <article class="bkart" style="--renk:var(--b-${b.kod})">
          <div class="bkart-bas">${logo(b, LOGO_TABAN.kart)}<h3><i></i>${b.ad}${b.katilim ? " *" : ""}</h3></div>
          <div class="bkart-sayilar" id="say-${b.kod}"></div>
          <div class="mini" id="mini-${b.kod}" role="img" aria-label="${b.ad} net faiz ve ücret-komisyon çizgi grafiği"></div>
          <div class="bkart-alt" id="alt-${b.kod}"></div>
        </article>`).join("");
    }
    const metin2 = css("--metin-2");
    v.bankalar.forEach((b) => {
      const f = milyar(b.seriler.net_faiz.ceyrek[n]), f0 = milyar(b.seriler.net_faiz.ceyrek[n - 4]);
      const k = milyar(b.seriler.net_ucret_komisyon.ceyrek[n]), k0 = milyar(b.seriler.net_ucret_komisyon.ceyrek[n - 4]);
      const d = (a, c) => degisim(yoy(a, c), false);
      document.getElementById(`mini-${b.kod}`).setAttribute("aria-label", L(`${b.ad} net faiz ve ücret-komisyon çizgi grafiği`, `${b.ad} net interest and net fee income line chart`));
      const mlr = L("mlr", "bn"), yil = L("yıllık", "YoY");
      document.getElementById(`say-${b.kod}`).innerHTML = `
        <div>${L("Net faiz", "Net interest")} · ${v.donemler[n]}<b>${fmt(f)} ${mlr}</b>${d(f, f0)} ${yil}</div>
        <div>${L("Net ücret-kom.", "Net fees")} · ${v.donemler[n]}<b>${fmt(k)} ${mlr}</b>${d(k, k0)} ${yil}</div>`;
      const al = milyar(b.seriler.alinan_ucret_komisyon.ceyrek[n]);
      const ver = milyar(b.seriler.verilen_ucret_komisyon.ceyrek[n]);
      const gn = milyar(b.seriler.alinan_gayrinakdi.ceyrek[n]);
      document.getElementById(`alt-${b.kod}`).innerHTML = f == null ? L(`${v.donemler[n]}: rapor henüz yayımlanmadı.`, `${v.donemler[n]}: report not published yet.`) :
        L(`${v.donemler[n]}: alınan ${fmt(al)} mlr (gayrinakdi ${yuzde(gn / al)}), verilen ${fmt(ver)} mlr, verilen/alınan ${yuzde(ver / al)}`,
          `${v.donemler[n]}: received ${fmt(al)} bn (non-cash loans ${yuzde(gn / al)}), paid ${fmt(ver)} bn, paid/received ${yuzde(ver / al)}`);
      const g = grafik(`mini-${b.kod}`, cizgiSecenek(kes(v.donemler), [
        { ad: L("Net faiz", "Net interest"), etiket: L("Faiz", "Interest"), veri: kes(seri(b, "net_faiz")), renk: bankaRenk(b), cizgi: bankaCizgi(b) },
        { ad: L("Net ücret-kom.", "Net fees"), etiket: L("Komisyon", "Fees"), veri: kes(seri(b, "net_ucret_komisyon")), renk: metin2 },
      ], "", { sagBosluk: 70, eksen: eksenTL(CEYREKLIK()) }));
      g.setOption({ xAxis: { axisLabel: { interval: Math.max(0, Math.ceil((durum.son - durum.bas + 1) / 4) - 1) } }, yAxis: { splitNumber: 3 } });
    });
  }

  /* ---- kaynak PDF bağlantısı ----
     Claude paylaşım sürümünde PDF'ler artifact dosya deposundadır (window.PDF_URL: dosya adı → adres);
     yerel sunucuda kaynak klasöründen /kaynak/... yoluyla verilir. */
  const PDF_IKON = `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><path d="M6 2h8l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" fill="var(--pdf-zemin)" stroke="var(--pdf)" stroke-width="1.4"/><path d="M14 2v5h5" fill="none" stroke="var(--pdf)" stroke-width="1.4"/><text x="12" y="17.5" text-anchor="middle" font-size="6.2" font-weight="700" fill="var(--pdf)" font-family="Inter,system-ui,sans-serif">PDF</text></svg>`;
  function pdfBag(klasor, dosya) {
    const gomulu = window.PDF_URL ? window.PDF_URL[dosya] : null;
    if (window.ANALIZ_BANKA !== undefined && !gomulu) return `<span class="pdf-bag pdf-yok" title="${L("Bu PDF bu sürümde yok", "This PDF is not included in this version")}">${PDF_IKON}</span>`;
    const adres = gomulu || `kaynak/${`${klasor}/${dosya}`.split("/").map(encodeURIComponent).join("/")}`;
    return `<a class="pdf-bag" href="${adres}" target="_blank" rel="noopener" title="${L(`${htmlKac(dosya)} dosyasını aç`, `Open ${htmlKac(dosya)}`)}" aria-label="${htmlKac(dosya)} PDF">${PDF_IKON}</a>`;
  }

  /* ---- notlar ve kaynaklar ---- */
  function notlar() {
    const v = durum.veri;
    document.getElementById("notlar").innerHTML = (EN ? [
      "Amounts are nominal, as published in the reports; the inflation switch above shows them restated in latest-quarter prices (CPI).",
      "2023 quarters are taken from the prior-period column of the 2024 reports.",
      "Kuveyt Türk is a participation bank: net profit-share income is shown instead of net interest income.",
      "Q2 2026 reports were published in TRY million; other periods were converted from TRY thousand.",
      "Reports are cumulative from the start of the year; the quarterly amount is the difference between two consecutive reports.",
      "Deposits are the quarter-end balance of the “I. Deposits” line on the liabilities side of the consolidated balance sheet; for 2023 only the year-end is available (prior-period column of the 2024 reports). At Kuveyt Türk this line is “Funds Collected”, and “Participation Funds” from Q2 2026.",
      "QNB's deposit decline in Q3 2025 coincides with the demerger of Enpara activities in the same quarter, as noted in QNB's presentation; it should not be read as an organic deposit loss.",
      "Some banks reclassified prior periods in later reports (e.g. Garanti BBVA's 2025 net interest income is about 3% lower in its 2026 reports). Charts show each period as first published.",
      "Net interest income may differ from the “including swap costs” figure in investor presentations; the line from the BDDK income statement is used here.",
      `Inflation adjustment: a price index is built by chaining the monthly changes of TurkStat CPI as published via the CBRT (December 2022 = 100). Each amount is restated in the prices of the latest quarter (${v.enflasyon.baz}): adjusted amount = nominal amount × index of the latest quarter / index of that quarter. Income statement items (net interest, net fees, fees received and paid) are flows accumulated over the quarter, so they use the quarter's three-month average index; deposits are a quarter-end balance, so they use the index of the quarter's last month. For example, ${v.donemler[0]} income is multiplied by ${carpanFmt.format(v.enflasyon.akis[0])} and deposits by ${carpanFmt.format(v.enflasyon.stok[0])}; ${v.enflasyon.baz} figures do not change. Ratios such as the fee share are unaffected, while annual and quarterly changes become real changes. The adjustment is applied only on this page when the switch is on; amounts in the BDDK reports and the executive summary are nominal.`,
      `Data generated on: ${v.olusturma}.`,
    ] : [
      ...v.notlar,
      "Raporlar yılbaşından birikimli yayımlanır; çeyreklik tutar ardışık iki raporun farkıdır.",
      "Mevduat, konsolide bilançonun pasifindeki “I. Mevduat” satırının çeyrek sonu bakiyesidir; 2023 için yalnız yıl sonu var (2024 raporlarının önceki dönem sütunu). Kuveyt Türk'te bu satır “Toplanan Fonlar”, 2026/2Ç'den itibaren “Katılım Fonu” adını taşır.",
      "QNB'nin 2025/3Ç'deki mevduat düşüşü, QNB sunumunda belirtilen Enpara faaliyetlerinin 2025/3Ç'de bölünmeyle ayrılmasıyla aynı çeyreğe denk geliyor; organik bir mevduat kaybı olarak okunmamalı.",
      "Bazı bankalar sonraki raporlarda önceki dönemi yeniden sınıflandırdı (ör. Garanti BBVA 2026 raporlarında 2025 net faizi yaklaşık %3 düşük). Grafikler her dönemi ilk yayımlandığı raporla gösterir.",
      "Net faiz yatırımcı sunumlarındaki “swap maliyeti dahil” net faizden farklı olabilir; burada BDDK gelir tablosundaki satır kullanıldı.",
      `Enflasyondan arındırma: TÜİK TÜFE'nin TCMB üzerinden yayımlanan aylık değişimleri zincirlenerek bir fiyat endeksi kuruldu (Aralık 2022 = 100). Her tutar son çeyreğin (${v.enflasyon.baz}) fiyatlarına taşınır: düzeltilmiş tutar = nominal tutar × son çeyreğin endeksi / o çeyreğin endeksi. Gelir tablosu kalemleri (net faiz, net ücret-komisyon, alınan ve verilen ücret-komisyon) çeyrek boyunca biriken akışlar olduğu için o çeyreğin üç aylık ortalama endeksiyle; mevduat çeyrek sonu bakiyesi olduğu için çeyreğin son ayının endeksiyle düzeltilir. Örneğin ${v.donemler[0]} gelirleri ${carpanFmt.format(v.enflasyon.akis[0])}, mevduatı ${carpanFmt.format(v.enflasyon.stok[0])} ile çarpılır; ${v.enflasyon.baz} rakamları değişmez. Ücret-komisyon payı gibi oranlar etkilenmez, yıllık ve çeyreklik değişimler reel değişime dönüşür. Düzeltme yalnız bu sayfada, anahtar açıkken uygulanır; BDDK raporlarındaki tutarlar ve yönetici özeti nominaldir.`,
      `Veri üretim tarihi: ${v.olusturma}.`,
    ]).map((n) => `<li>${n}</li>`).join("");
    document.getElementById("kaynaklar").innerHTML = `<table><tr>${L(["Banka", "Dönem", "PDF", "Dosya", "Sayfa", "Sütun"], ["Bank", "Period", "PDF", "File", "Page", "Column"]).map((x) => `<th>${basHarf(x)}</th>`).join("")}</tr>${
      v.bankalar.flatMap((b) => b.kaynak.map((k) =>
        `<tr><td>${b.ad}</td><td>${donemAd(k.donem)}</td><td>${pdfBag(b.pdf_klasor, k.dosya)}</td><td style="text-align:left">${k.dosya}</td><td>${k.sayfa}</td><td>${k.sutun === "cari" ? L("cari dönem", "current period") : L("önceki dönem", "prior period")}</td></tr>`)).join("")}</table>`;
  }

  /* ---- filtreler ---- */
  function filtreler() {
    const v = durum.veri;
    const kap = document.getElementById("bankaSecim");
    kap.innerHTML = v.bankalar.map((b, i) =>
      `<button type="button" class="cip" data-kod="${b.kod}" aria-pressed="true" aria-label="${b.ad}" title="${b.ad}" style="--renk:var(--b-${b.kod})"><i class="${KESIK.has(b.kod) ? "kesik" : ""}"></i><span class="cip-logo">${logoImg(b, LOGO_TABAN.cip)}</span></button>`).join("");
    kap.addEventListener("click", (e) => {
      const c = e.target.closest(".cip"); if (!c) return;
      const kod = c.dataset.kod;
      if (e.altKey || e.metaKey) {
        // tek banka odağı
        durum.secili = new Set([kod]);
      } else if (durum.secili.has(kod)) durum.secili.delete(kod); else durum.secili.add(kod);
      kap.querySelectorAll(".cip").forEach((x) => x.setAttribute("aria-pressed", durum.secili.has(x.dataset.kod)));
      ciz();
    });
    const isaretle = () => kap.querySelectorAll(".cip").forEach((x) => x.setAttribute("aria-pressed", durum.secili.has(x.dataset.kod)));
    document.getElementById("bankaTumu").addEventListener("click", () => { durum.secili = new Set(v.bankalar.map((b) => b.kod)); isaretle(); ciz(); });
    document.getElementById("bankaTemizle").addEventListener("click", () => { durum.secili = new Set(); isaretle(); ciz(); });

    const bas = document.getElementById("donemBas"), son = document.getElementById("donemSon");
    const secenek = v.donemler.map((d, i) => `<option value="${i}">${d}</option>`).join("");
    bas.innerHTML = secenek; son.innerHTML = secenek;
    const donemYaz = () => {
      bas.value = durum.bas; son.value = durum.son;
      // bitiş, başlangıçtan önceki bir çeyrek olamaz
      [...son.options].forEach((o) => { o.disabled = +o.value < durum.bas; });
      const n = durum.son - durum.bas + 1, sonIdx = v.donemler.length - 1;
      document.querySelectorAll("[data-son]").forEach((x) => {
        const k = +x.dataset.son;
        x.setAttribute("aria-pressed", durum.son === sonIdx && (k ? durum.bas === Math.max(0, sonIdx - k + 1) : durum.bas === 0));
      });
      document.getElementById("donemOzet").innerHTML =
        `<b>${v.donemler[durum.bas]} - ${v.donemler[durum.son]}</b> · ${L(`${n} çeyrek gösteriliyor`, `${n} quarters shown`)}`;
    };
    durum.donemYaz = donemYaz;
    bas.addEventListener("change", () => {
      durum.bas = +bas.value;
      if (durum.son < durum.bas) durum.son = durum.bas; // aralık ters dönmesin
      donemYaz(); ciz();
    });
    son.addEventListener("change", () => {
      durum.son = +son.value;
      if (durum.bas > durum.son) durum.bas = durum.son;
      donemYaz(); ciz();
    });
    document.querySelectorAll("[data-son]").forEach((btn) => btn.addEventListener("click", () => {
      const k = +btn.dataset.son;
      durum.son = v.donemler.length - 1;
      durum.bas = k ? Math.max(0, durum.son - k + 1) : 0;
      donemYaz(); ciz();
    }));
    donemYaz();

    const anahtar = document.getElementById("enfAnahtar");
    anahtar.addEventListener("click", () => {
      durum.reel = !durum.reel;
      anahtar.setAttribute("aria-checked", durum.reel);
      ciz();
    });
  }

  /* ---- seçili aralığın başındaki tüm serilerin boş olduğu dönemleri atar ---- */
  function bosBasKirp(donemler, satir) {
    let ilk = donemler.findIndex((_, i) => satir.some((x) => x.veri[i] != null));
    if (ilk < 0) ilk = 0;
    return { donemler: donemler.slice(ilk), satir: satir.map((x) => ({ ...x, veri: x.veri.slice(ilk) })) };
  }

  /* ---- mevduat ---- */
  function mevduatCiz(donemler) {
    const bs = seciliBankalar();
    const tutar = bosBasKirp(donemler, bs.map((b) => ({ ad: b.ad, renk: bankaRenk(b), cizgi: bankaCizgi(b), veri: kes(b.mevduat.toplam).map(milyar) })));
    // çeyreklik büyüme: tüm seri üzerinde hesaplanır, sonra aralığa kesilir (aralığın ilk çeyreği de önceki çeyreği kullanır)
    const fark = (b) => b.mevduat.toplam.map((t, i) => { const o = b.mevduat.toplam[i - 1]; return t == null || o == null ? null : (t - o) / 1000; });
    const oran = (b) => b.mevduat.toplam.map((t, i) => { const o = b.mevduat.toplam[i - 1]; return t == null || !o ? null : (t / o - 1) * 100; });
    grafik("grafikMevduat", cizgiSecenek(tutar.donemler, tutar.satir, "", { eksen: eksenTL(L("Çeyrek sonu bakiye", "Quarter-end balance")) }));
    tablo("tabloMevduat", tutar.donemler, tutar.satir, fmt);
    isiHaritasi(donemler, bs.map((b) => ({ b, oran: kes(oran(b)), fark: kes(fark(b)) })));
  }

  /* ---- ısı haritası: mevduatın çeyreklik büyümesi ----
     artış: tek renk (mavi) açıktan koyuya, azalış: kırmızı; eşikler %2'lik adımlar */
  const ISI_ESIK = [2, 4, 6, 8, 10, 12];
  function isiRenk(x) {
    if (x == null) return { bg: "transparent", fg: css("--soluk") };
    if (x < 0) return x <= -5 ? { bg: css("--isi-n2"), fg: css("--isi-n2-metin") } : { bg: css("--isi-n1"), fg: css("--isi-n-metin") };
    const k = ISI_ESIK.findIndex((e) => x < e);
    const adim = k < 0 ? ISI_ESIK.length : k;           // 0..6
    return { bg: css(`--isi-${adim}`), fg: adim >= 4 ? css("--isi-metin-yogun") : css("--isi-metin") };
  }
  function isiHaritasi(donemler, satirlar) {
    // aralığın başındaki tüm hücreleri boş dönemleri at
    let ilk = donemler.findIndex((_, i) => satirlar.some((s) => s.oran[i] != null));
    if (ilk < 0) ilk = 0;
    const d = donemler.slice(ilk);
    const bas = `<tr><th></th>${d.map((x) => `<th>${basHarf(x)}</th>`).join("")}</tr>`;
    const govde = satirlar.map(({ b, oran, fark }) => `<tr><th scope="row"><span class="sira-banka">${logo(b, 18)}</span></th>${
      d.map((don, k) => {
        const x = oran[ilk + k], f = fark[ilk + k], c = isiRenk(x);
        const baslik = x == null ? `${b.ad} · ${don}: ${L("veri yok", "no data")}` : `${b.ad} · ${don}: ${x >= 0 ? "+" : ""}${sayiFmt.format(x)}%, ${f >= 0 ? "+" : ""}${fmt(f)} ${L("milyar TL", "TRY bn")}`;
        return `<td style="background:${c.bg};color:${c.fg}" title="${baslik}">${x == null ? "-" : (x >= 0 ? "" : "−") + sayiFmt.format(Math.abs(x))}</td>`;
      }).join("")}</tr>`).join("");
    const lejant = [["<0", css("--isi-n1"), css("--isi-n-metin")], ["0-2", css("--isi-0"), css("--isi-metin")],
      ...ISI_ESIK.map((e, k) => [k === ISI_ESIK.length - 1 ? `${e}+` : `${e}-${ISI_ESIK[k + 1]}`, css(`--isi-${k + 1}`), k + 1 >= 4 ? css("--isi-metin-yogun") : css("--isi-metin")])];
    document.getElementById("isiMevduat").innerHTML =
      `<div class="isi-lejant"><span>${L("Çeyreklik büyüme, %", "Quarterly growth, %")}</span>${lejant.map(([t, bg, fg]) => `<i style="background:${bg};color:${fg}">${t}</i>`).join("")}</div>
       <div class="tablo-kap"><table class="isi">${bas}${govde}</table></div>`;
  }

  /* ---- ÜVEK içinde yatırım hizmetleri payı ---- */
  const KAPSAM_AD = { "Ç": "çeyreklik", "1Ç": "1. çeyrek", "6A": "ilk 6 ay", "9A": "ilk 9 ay", "12A": "yıllık", "?": "dönem belirtilmemiş" };
  const KAPSAM_AD_EN = { "Ç": "quarterly", "1Ç": "Q1", "6A": "first 6 months", "9A": "first 9 months", "12A": "full year", "?": "period not stated" };
  function uvekCiz(donemler) {
    const v = durum.veri, u = v.uvek;
    const bs = seciliBankalar().filter((b) => u[b.kod]);
    let satir = bs.map((b) => ({ ad: b.ad, renk: bankaRenk(b), cizgi: bankaCizgi(b), veri: kes(u[b.kod].veri) }));
    // sunum verisi 2024'te başlıyor; seçili aralığın başındaki boş dönemleri at
    let ilk = donemler.findIndex((_, i) => satir.some((x) => x.veri[i] != null));
    if (ilk < 0) ilk = 0;
    donemler = donemler.slice(ilk);
    satir = satir.map((x) => ({ ...x, veri: x.veri.slice(ilk) }));
    const ofset = durum.bas + ilk;
    const sec = cizgiSecenek(donemler, satir, "%", { sagBosluk: 110, eksen: L("Çeyreklik, %", "Quarterly, %") });
    sec.yAxis.min = 0;
    // ipucunda sunumdaki kalem adı ve oranın kapsadığı dönem
    sec.tooltip.formatter = (ps) => {
      const i = ofset + ps[0].dataIndex;
      const sat = [...ps].filter((p) => p.value != null).sort((a, c) => c.value - a.value).map((p) => {
        const b = bs[p.seriesIndex], x = u[b.kod];
        return `<div style="display:flex;gap:12px;justify-content:space-between"><span><span style="display:inline-block;width:14px;height:3px;border-radius:2px;background:${p.color};margin:0 6px 3px 0"></span>${b.ad} <span style="opacity:.65">· ${x.kalem}, ${(EN ? KAPSAM_AD_EN : KAPSAM_AD)[x.kapsam[i]] || ""}</span></span><b>${sayiFmt.format(p.value)}%</b></div>`;
      }).join("");
      return `<div style="font-weight:600;margin-bottom:4px">${ps[0].axisValue}</div>${sat || L("veri yok", "no data")}`;
    };
    grafik("grafikUvek", sec);
    tablo("tabloUvek", donemler, satir, (x) => (x == null ? "-" : sayiFmt.format(x)));
    const disarida = v.bankalar.filter((b) => !u[b.kod]).map((b) => b.ad);
    const adlar = Object.entries(u).map(([k, x]) => `<b>${v.bankalar.find((b) => b.kod === k).ad}</b> ${x.kalem}`).join(", ");
    document.getElementById("uvekNot").innerHTML = (EN ? [
      `Item names in the presentations (as published, in Turkish): ${adlar}.`,
      `Not charted: <b>${disarida.join(", ")}</b>. QNB and TEB presentations have no investment or asset management slice in the fee breakdown. For Kuveyt Türk there is only an annual corporate presentation; DenizBank presentations are stored in the folder only as links.`,
      "Each point is the ratio published in that quarter's presentation. Akbank reports year-to-date figures, İş Bankası quarterly in 2024 and 2026 and year-to-date in 2025; Garanti BBVA and Yapı Kredi did not state the period until Q2 2026 and give nine-month figures in Q3 2026. Yapı Kredi's breakdown is based on bank-only management reporting. Garanti BBVA's was based on consolidated financials until Q2 2026 and on bank-only management data from Q3 2026, so the drop in Q3 2026 is partly a change of basis. Akbank and Yapı Kredi ratios are rounded to whole numbers.",
      "Ratios were read from the pie charts in the presentations; source pages are listed in veri/uvek_yatirim_payi.csv.",
    ] : [
      `Sunumdaki kalem adları: ${Object.entries(u).map(([k, x]) => `<b>${v.bankalar.find((b) => b.kod === k).ad}</b> ${x.kalem}`).join(", ")}.`,
      `Grafiğe alınmayanlar: <b>${disarida.join(", ")}</b>. QNB ve TEB sunumlarındaki ücret kırılımında yatırım veya varlık yönetimi dilimi yok. Kuveyt Türk için yalnız yıllık kurumsal tanıtım var, DenizBank sunumları klasörde yalnız bağlantı olarak duruyor.`,
      "Her nokta o çeyreğin sunumunda yayımlanan orandır. Akbank yılbaşından birikimli, İş Bankası 2024 ve 2026'da çeyreklik, 2025'te birikimli veriyor; Garanti BBVA ve Yapı Kredi 2026 2Ç'ye kadar dönemi belirtmiyor, 2026 3Ç'de dokuz aylık veriyor. Yapı Kredi kırılımı banka-solo yönetim raporlamasına dayanıyor. Garanti BBVA kırılımı 2026 2Ç'ye kadar konsolide finansallara, 2026 3Ç'den itibaren banka-solo yönetim verisine dayanıyor; 2026 3Ç'deki düşüşün bir kısmı bu yöntem değişikliğinden. Akbank ve Yapı Kredi oranları tam sayıya yuvarlanmış.",
      "Oranlar grafiklerdeki pasta dilimlerinden okundu, kaynak sayfalar veri/uvek_yatirim_payi.csv dosyasında.",
    ]).map((n) => `<li>${n}</li>`).join("");
  }

  /* ---- portföy yönetim şirketleri ---- */
  const pSeri = (b, alan) => durum.veri.pys[b.kod][alan];
  const pOran = (pay, payda) => pay.map((x, i) => (x == null || !payda[i] ? null : (x / payda[i]) * 100));
  const pGider = (b) => pSeri(b, "genel_yonetim").map((g, i) => (g == null ? null : -(g + (pSeri(b, "pazarlama")[i] || 0))));
  const pKatki = (b) => pOran(pSeri(b, "hasilat"), durum.nominal.bankalar.find((x) => x.kod === b.kod).seriler.net_ucret_komisyon.ceyrek);
  // efektif ücret oranı, %: yıllıklandırılmış hasılat (milyon TL) / çeyrek başı ve sonu büyüklük ortalaması (milyar TL)
  function pUcret(b) {
    const bk = durum.nominal.pys[b.kod].buyukluk;
    return pSeri(b, "hasilat").map((h, i) => {
      const ort = i > 0 && bk[i - 1] != null && bk[i] != null ? (bk[i - 1] + bk[i]) / 2 : null;
      return h == null || !ort ? null : ((h * 4) / 1000 / ort) * 100;
    });
  }
  const pAd = (b) => durum.veri.pys[b.kod].ad;

  function portfoyCiz(donemler) {
    const v = durum.veri;
    const bs = seciliBankalar().filter((b) => v.pys[b.kod]);
    const satir = (fn) => bs.map((b) => ({ ad: pAd(b), renk: bankaRenk(b), cizgi: bankaCizgi(b), veri: kes(fn(b)) }));
    const yuzdeBicim = (x) => (x == null ? "-" : sayiFmt.format(x));
    const yuzde2Bicim = (x) => (x == null ? "-" : yuzde2(x / 100));
    [
      ["Buyukluk", satir((b) => pSeri(b, "buyukluk")), "", fmt, eksenTL(L("Çeyrek sonu", "Quarter-end"))],
      ["Ucret", satir((b) => pUcret(b)), "%", yuzde2Bicim, L("Yıllıklandırılmış, %", "Annualised, %")],
      ["Hasilat", satir((b) => pSeri(b, "hasilat")), "", fmt],
      ["Kar", satir((b) => pSeri(b, "net_kar")), "", fmt],
      ["Marj", satir((b) => pOran(pSeri(b, "net_kar"), pSeri(b, "hasilat"))), "%", yuzdeBicim],
      ["Gider", satir((b) => pOran(pGider(b), pSeri(b, "hasilat"))), "%", yuzdeBicim],
      ["Katki", satir((b) => pKatki(b)), "%", yuzdeBicim],
    ].forEach(([ad, s, birim, bicim, eksen]) => {
      const k = bosBasKirp(donemler, s);
      grafik(`pGrafik${ad}`, cizgiSecenek(k.donemler, k.satir, birim, { olcek: birim === "%", eksen: eksen || (birim === "%" ? L("Çeyreklik, %", "Quarterly, %") : L("Çeyreklik, milyon TL", "Quarterly, TRY mn")) }));
      tablo(`pTablo${ad}`, k.donemler, k.satir, bicim);
    });
    pSiralama(bs);
    pKartlar();
  }

  function pSiralama(bs) {
    const n = durum.son;
    const d = (x) => degisim(x, false);
    const satir = bs.map((b) => {
      const h = pSeri(b, "hasilat")[n], k = pSeri(b, "net_kar")[n];
      return { b, h, hd: yoy(h, pSeri(b, "hasilat")[n - 4]), k, kd: yoy(k, pSeri(b, "net_kar")[n - 4]),
        m: h ? k / h : null, g: h ? pGider(b)[n] / h : null, kt: pKatki(b)[n],
        bk: pSeri(b, "buyukluk")[n], bkd: yoy(pSeri(b, "buyukluk")[n], pSeri(b, "buyukluk")[n - 4]), u: pUcret(b)[n] };
    }).sort((a, c) => (c.b.kod === "yapikredi") - (a.b.kod === "yapikredi") || (c.h || 0) - (a.h || 0)); // Yapı Kredi önde
    document.getElementById("pSiralama").innerHTML = `<table>
      <tr>${L(["Şirket", "Hasılat", "Yıllık", "Net kâr", "Yıllık", "Kâr marjı", "Gider oranı", "Bankaya katkı", "Büyüklük, mlr", "Yıllık", "Ücret oranı"],
        ["Company", "Revenue", "YoY", "Net profit", "YoY", "Profit margin", "Cost ratio", "Contribution to bank", "AUM, bn", "YoY", "Fee rate"]).map((x) => `<th>${basHarf(x)}</th>`).join("")}</tr>
      ${satir.map((s) => `<tr><td><span class="sira-banka"><span class="nokta" style="background:${bankaRenk(s.b)}"></span>${logo(s.b, LOGO_TABAN.tablo, true)}</span></td>
        <td>${fmt(s.h)}</td><td>${d(s.hd)}</td><td>${fmt(s.k)}</td><td>${d(s.kd)}</td><td>${yuzde(s.m)}</td><td>${yuzde(s.g)}</td><td>${s.kt == null ? "-" : yuzde(s.kt / 100)}</td><td>${fmt(s.bk)}</td><td>${d(s.bkd)}</td><td>${s.u == null ? "-" : yuzde2(s.u / 100)}</td></tr>`).join("")}
    </table>`;
  }

  function pKartlar() {
    const v = durum.veri, n = durum.son;
    const kap = document.getElementById("pKartlar");
    const liste = v.bankalar.filter((b) => v.pys[b.kod]);
    if (!kap.children.length) {
      kap.innerHTML = liste.map((b) => `
        <article class="bkart" style="--renk:var(--b-${b.kod})">
          <div class="bkart-bas">${logo(b, LOGO_TABAN.kart, true)}<h3><i></i>${pAd(b)}</h3></div>
          <div class="bkart-sayilar" id="psay-${b.kod}"></div>
          <div class="mini" id="pmini-${b.kod}" role="img" aria-label="${pAd(b)} hasılat ve net kâr çizgi grafiği"></div>
          <div class="bkart-alt" id="palt-${b.kod}"></div>
        </article>`).join("");
    }
    const metin2 = css("--metin-2");
    liste.forEach((b) => {
      const h = pSeri(b, "hasilat")[n], k = pSeri(b, "net_kar")[n];
      const dd = (a, c) => degisim(yoy(a, c), false);
      const yil = L("yıllık", "YoY"), hAd = L("Hasılat", "Revenue"), kAd = L("Net kâr", "Net profit");
      document.getElementById(`pmini-${b.kod}`).setAttribute("aria-label", L(`${pAd(b)} hasılat ve net kâr çizgi grafiği`, `${pAd(b)} revenue and net profit line chart`));
      document.getElementById(`psay-${b.kod}`).innerHTML = `
        <div>${hAd} · ${v.donemler[n]}<b>${fmt(h)} mn</b>${dd(h, pSeri(b, "hasilat")[n - 4])} ${yil}</div>
        <div>${kAd} · ${v.donemler[n]}<b>${fmt(k)} mn</b>${dd(k, pSeri(b, "net_kar")[n - 4])} ${yil}</div>`;
      const kt = pKatki(b)[n] == null ? "-" : yuzde(pKatki(b)[n] / 100), uo = pUcret(b)[n] == null ? "-" : yuzde2(pUcret(b)[n] / 100);
      document.getElementById(`palt-${b.kod}`).innerHTML = h
        ? L(`${v.donemler[n]}: kâr marjı ${yuzde(k / h)}, gider oranı ${yuzde(pGider(b)[n] / h)}, ana bankaya katkı ${kt}, portföy ${fmt(pSeri(b, "buyukluk")[n])} mlr TL, ücret oranı ${uo}`,
          `${v.donemler[n]}: profit margin ${yuzde(k / h)}, cost ratio ${yuzde(pGider(b)[n] / h)}, contribution to parent bank ${kt}, AUM TRY ${fmt(pSeri(b, "buyukluk")[n])} bn, fee rate ${uo}`)
        : L("Bu dönemde veri yok.", "No data for this period.");
      const s = bosBasKirp(kes(v.donemler), [
        { ad: hAd, etiket: hAd, veri: kes(pSeri(b, "hasilat")), renk: bankaRenk(b), cizgi: bankaCizgi(b) },
        { ad: kAd, etiket: kAd, veri: kes(pSeri(b, "net_kar")), renk: metin2 },
      ]);
      const g = grafik(`pmini-${b.kod}`, cizgiSecenek(s.donemler, s.satir, "", { sagBosluk: 66, eksen: L("Çeyreklik, milyon TL", "Quarterly, TRY mn") }));
      g.setOption({ xAxis: { axisLabel: { interval: Math.max(0, Math.ceil(s.donemler.length / 4) - 1) } }, yAxis: { splitNumber: 3 } });
    });
  }

  function pNotlar() {
    const v = durum.veri;
    document.getElementById("pNotlar").innerHTML = (EN ? [
      "Source: non-consolidated financial reports of the asset management companies.",
      "Exception, İş Portföy Q2 2026: taken from the consolidated report. The company set up ISFUND GP S.À R.L., a 100% subsidiary in Luxembourg, on 27 March 2026, and therefore published only a consolidated report for this period (KAP, 10 August 2026); no non-consolidated report was found. As the subsidiary is a newly founded general partner company, the effect is expected to be small, but this has not been verified with figures. It will be replaced if a non-consolidated report is published.",
      "Asset management companies apply TAS 29 hyperinflation accounting; each report states its amounts in the purchasing power at that report's date. Figures are used as published, with no further inflation adjustment, so comparisons across quarters and with banks are approximate.",
      "Quarterly amounts: Q1 from the 3-month report; Q2 and Q3 from the 3-month column the reports publish; Q4 is the full year minus 9 months, since reports do not give a 3-month column. Some companies restated the previous quarter in later reports, so this difference is large in places.",
      "2023 is not shown: 2023 figures in the 2024 reports were later restated for inflation.",
      "Net profit includes the net monetary position loss from inflation accounting, which reduces profit noticeably.",
      "Deniz Portföy's Q1 2024, Q3 2024, Q1 2025, Q3 2025 and Q1 2026 reports are scanned images; values were read from the images and checked with line-item identities. Ak Portföy's Q3 2024 profit line was taken manually from the PDF text.",
      "Assets under management are the quarter-end values published by the Capital Markets Board (SPK): monthly Excel files on the SPK yearly pages up to Q3 2024, the SPK portfolio values service afterwards. The two sources match in their common month, October 2024 (0.2% difference for Yapı Kredi Portföy). Kuveyt Türk Portföy appears as KT Portföy in the SPK list up to Q3 2023.",
      "On the Portfolio tab the inflation switch restates only assets under management, using quarter-end CPI, in latest-quarter prices; income statement items stay as published because they are reported under TAS 29. The effective fee rate and the contribution to the parent bank always use published figures.",
      "Asset management companies are drawn in their parent banks' colours.",
    ] : [
      "Kaynak: portföy yönetim şirketlerinin konsolide olmayan finansal raporları.",
      "İstisna, İş Portföy 2026/2Ç: konsolide rapordan alındı. Şirket 27 Mart 2026'da Lüksemburg'da %100 bağlı ortaklığı ISFUND GP S.À R.L.'yi kurduğu için bu dönemde yalnız konsolide rapor yayımladı (KAP, 10.08.2026); konsolide olmayan rapor bulunamadı. Bağlı ortaklık yeni kurulmuş bir komandite ortak şirketi olduğundan etkinin sınırlı olması beklenir, ancak bu rakamla doğrulanmadı. Konsolide olmayan rapor yayımlanırsa yerine konacak.",
      "PYŞ'ler TMS 29 enflasyon muhasebesi uygular; her rapordaki tutarlar o raporun tarihindeki satın alma gücüyle yayımlanır. Rakamlar yayımlandığı gibi kullanıldı, ayrıca enflasyon düzeltmesi yapılmadı. Bu yüzden çeyrekler arası kıyas ve bankalarla kıyas yaklaşıktır.",
      "Çeyreklik tutar: 1. çeyrek 3 aylık rapordan; 2. ve 3. çeyrek raporların kendi yayımladığı 3 aylık sütundan; 4. çeyrek, raporlar 3 aylık sütun vermediği için yıllık eksi 9 aylık tutardır. Bazı şirketler önceki çeyreği sonraki raporda yeniden düzenlediği için bu fark yer yer büyüktür.",
      "2023 gösterilmez: 2024 raporlarındaki 2023 rakamları sonradan enflasyona göre yeniden düzenlenmiştir.",
      "Net dönem kârı, enflasyon muhasebesinden gelen net parasal pozisyon kaybını içerir; bu kalem kârı belirgin şekilde düşürür.",
      "Deniz Portföy'ün 2024/1Ç, 2024/3Ç, 2025/1Ç, 2025/3Ç ve 2026/1Ç raporları taranmış görüntüdür; değerler görüntüden okundu ve satır denklikleriyle kontrol edildi. Ak Portföy 2024/3Ç'de kâr satırı PDF metninden elle alındı.",
      "Yönetilen portföy büyüklüğü SPK'nın yayımladığı çeyrek sonu değerleridir: 2024/3Ç'ye kadar SPK yıl sayfalarındaki aylık Excel dosyaları, sonrası SPK portföy değerleri servisi. İki kaynağın ortak ayı Ekim 2024'te tutarlar eşleşiyor (Yapı Kredi Portföy'de %0,2 fark). Kuveyt Türk Portföy 2023/3Ç'ye kadar SPK listesinde KT Portföy adıyla geçer.",
      "Enflasyon anahtarı Portföy sekmesinde yalnız büyüklüğü çeyrek sonu TÜFE ile son çeyrek fiyatlarına taşır; gelir tablosu kalemleri TMS 29 ile yayımlandığı için olduğu gibi kalır. Efektif ücret oranı ve bankaya katkı her zaman yayımlanan rakamlarla hesaplanır.",
      "Portföy şirketleri ana bankalarının renkleriyle çizilir.",
    ]).map((x) => `<li>${x}</li>`).join("");
    document.getElementById("pKaynaklar").innerHTML = `<table><tr>${L(["Şirket", "Dönem", "PDF", "Dosya ve sayfa", "Çeyrek hesabı"], ["Company", "Period", "PDF", "File and page", "Quarter method"]).map((x) => `<th>${basHarf(x)}</th>`).join("")}</tr>${
      v.bankalar.filter((b) => v.pys[b.kod]).flatMap((b) => v.donemler.map((d, i) => [d, v.pys[b.kod].kaynak[i], v.pys[b.kod].yontem[i]])
        .filter((x) => x[1]).map(([d, k, y]) => `<tr><td>${pAd(b)}</td><td>${d}</td><td>${pdfBag(v.pys[b.kod].pdf_klasor, k.split(" s.")[0])}</td><td style="text-align:left">${k}</td><td>${y === "fark" ? L("yıllık − 9 ay", "full year − 9 months") : L("rapordaki tutar", "as reported")}</td></tr>`)).join("")}</table>
      <h3 class="kaynak-bas">${L("Yönetilen Portföy Büyüklüğü (SPK)", "Assets Under Management (SPK)")}</h3>
      <table><tr>${L(["Şirket", "Dönem", "Kaynak", "SPK listesindeki ad", "Tutar, milyar TL"], ["Company", "Period", "Source", "Name in SPK list", "Amount, TRY bn"]).map((x) => `<th>${basHarf(x)}</th>`).join("")}</tr>${
      v.bankalar.filter((b) => v.pys[b.kod]).flatMap((b) => v.donemler.map((d, i) => [d, v.pys[b.kod].buyukluk_kaynak[i], v.pys[b.kod].buyukluk[i]])
        .filter((x) => x[1]).map(([d, k, t]) => `<tr><td>${pAd(b)}</td><td>${d}</td><td style="text-align:left"><a href="${htmlKac(k.url)}" target="_blank" rel="noopener">${htmlKac(k.etiket)}</a></td><td style="text-align:left">${htmlKac(k.spk_ad)}</td><td>${fmt(t)}</td></tr>`)).join("")}</table>`;
  }

  /* ---- sekmeler: Banka / Portföy; yalnız etkin sekme çizilir ---- */
  function sekmeSec(sekme, hashYaz) {
    durum.sekme = sekme;
    document.querySelectorAll("[data-sekme]").forEach((t) => {
      t.setAttribute("aria-selected", t.dataset.sekme === sekme);
      t.tabIndex = t.dataset.sekme === sekme ? 0 : -1;
    });
    document.getElementById("panelBanka").hidden = sekme !== "banka";
    document.getElementById("panelPortfoy").hidden = sekme !== "portfoy";
    document.getElementById("kurumBaslik").textContent = sekme === "banka" ? L("Bankalar", "Banks") : L("Portföy şirketleri", "Asset Management");
    // seçim düğmelerinde sekmeye göre banka ya da portföy logosu
    document.querySelectorAll(".cip").forEach((c) => {
      const b = durum.veri.bankalar.find((x) => x.kod === c.dataset.kod);
      const ad = sekme === "portfoy" ? pAd(b) : b.ad;
      c.querySelector(".cip-logo").innerHTML = logoImg(b, LOGO_TABAN.cip, sekme === "portfoy");
      c.setAttribute("aria-label", ad); c.title = ad;
    });
    if (hashYaz) { try { history.replaceState(null, "", `#${sekme}`); } catch (e) { /* çerçeve izin vermeyebilir */ } }
    ciz();
    requestAnimationFrame(() => grafikler.forEach((g) => g.resize()));
  }
  document.querySelectorAll("[data-sekme]").forEach((t) => t.addEventListener("click", () => sekmeSec(t.dataset.sekme, true)));
  document.querySelector(".sekmeler").addEventListener("keydown", (e) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const yeni = durum.sekme === "banka" ? "portfoy" : "banka";
    sekmeSec(yeni, true);
    document.getElementById(`sekme-${yeni}`).focus();
  });

  /* ---- son dönemde raporu henüz yayımlanmamış kurumlar ---- */
  function bekleyenYaz() {
    const not = document.getElementById("bekleyenNot"), bk = durum.nominal.bekleyen;
    const sonIdx = durum.nominal.donemler.length - 1;
    const pys = durum.sekme === "portfoy";
    const kodlar = bk ? (pys ? bk.pys : bk.banka) : [];
    not.hidden = !kodlar.length || durum.son !== sonIdx;
    if (not.hidden) return;
    const d = durum.veri.donemler[sonIdx];
    const adlar = kodlar.map((k) => (pys ? durum.veri.pys[k].ad : durum.veri.bankalar.find((b) => b.kod === k).ad));
    const liste = new Intl.ListFormat(L("tr", "en"), { type: "conjunction" }).format(adlar);
    not.textContent = pys && kodlar.length === Object.keys(durum.veri.pys).length
      ? L(`${d}: portföy şirketlerinin finansal raporları henüz yayımlanmadı. Bu çeyrekte yalnız SPK portföy büyüklüğü var.`,
          `${d}: the asset management companies have not published their financial reports yet. Only SPK assets under management are available for this quarter.`)
      : L(`${d}: ${liste} raporlarını henüz yayımlamadı; bu çeyrekte boş görünür.`,
          `${d}: ${liste} ${kodlar.length > 1 ? "have" : "has"} not published ${kodlar.length > 1 ? "their reports" : "its report"} yet and ${kodlar.length > 1 ? "appear" : "appears"} blank for this quarter.`);
  }

  /* ---- ana çizim ---- */
  function ciz() {
    if (!durum.nominal) return;
    durum.veri = durum.reel ? durum.reelV : durum.nominal;
    const v = durum.veri;
    document.querySelectorAll(".olcuAd").forEach((e) => (e.textContent = olcu()));
    document.getElementById("analizReelNot").hidden = !durum.reel;
    document.getElementById("pAnalizReelNot").hidden = !durum.reel;
    document.getElementById("enfAcik").textContent = durum.sekme === "portfoy"
      ? L(`Yalnız portföy büyüklüğüne, TÜFE ile ${durum.nominal.enflasyon.baz} fiyatlarına`, `Assets under management only, CPI, in ${durum.nominal.enflasyon.baz} prices`)
      : L(`TÜFE ile ${durum.nominal.enflasyon.baz} fiyatlarına`, `CPI, in ${durum.nominal.enflasyon.baz} prices`);
    document.querySelectorAll(".sonDonemAd").forEach((e) => (e.textContent = v.donemler[durum.son]));
    bekleyenYaz();
    if (durum.sekme === "portfoy") { portfoyCiz(kes(v.donemler)); return; }
    const bs = seciliBankalar();
    const satir = (fn) => bs.map((b) => ({ ad: b.ad, renk: bankaRenk(b), cizgi: bankaCizgi(b), veri: fn(b) }));
    const faiz = satir((b) => kes(seri(b, "net_faiz")));
    const kom = satir((b) => kes(seri(b, "net_ucret_komisyon")));
    const pay = satir((b) => kes(paySeri(b)));
    const donemler = kes(v.donemler);
    document.querySelectorAll(".sonDonemAd").forEach((e) => (e.textContent = v.donemler[durum.son]));
    grafik("grafikFaiz", cizgiSecenek(donemler, faiz, "", { eksen: eksenTL(CEYREKLIK()) }));
    grafik("grafikKom", cizgiSecenek(donemler, kom, "", { eksen: eksenTL(CEYREKLIK()) }));
    grafik("grafikPay", cizgiSecenek(donemler, pay, "%", { olcek: true, eksen: L("Çeyreklik, %", "Quarterly, %") }));
    uvekCiz(donemler);
    mevduatCiz(donemler);
    tablo("tabloFaiz", donemler, faiz, fmt);
    tablo("tabloKom", donemler, kom, fmt);
    tablo("tabloPay", donemler, pay, (x) => (x == null ? "-" : yuzde(x / 100)));
    siralama();
    bankaKartlari();
  }


  /* ---- dil geçişi: sayfa iskeletindeki metinler (index.html) sözlükten, üretilen içerik L() ile ---- */
  const EN_METIN = {
    "Bilanço Dashboard": "Balance Sheet Dashboard",
    "Banka": "Banks",
    "Portföy": "Asset Management",
    "Dönem aralığı": "Period range",
    "Başlangıç dönemi": "Start period",
    "Bitiş dönemi": "End period",
    "Son 4 çeyrek": "Last 4 quarters",
    "Son 8 çeyrek": "Last 8 quarters",
    "Tüm dönemler": "All periods",
    "Enflasyondan arındır": "Adjust for inflation",
    "Bankalar": "Banks",
    "Tümünü seç": "Select all",
    "Temizle": "Clear",
    "Yönetici Özeti": "Executive Summary",
    ", yapay zekâ ile üretildi": ", generated by AI",
    "Özet nominal rakamlara dayanır; enflasyon anahtarı özeti değiştirmez.": "The summary is based on nominal figures; the inflation switch does not change it.",
    "Analizi yenile": "Refresh analysis",
    "Net Faiz Geliri": "Net Interest Income",
    "Kuveyt Türk için net kâr payı geliri.": "Net profit-share income for Kuveyt Türk.",
    "Tablo görünümü": "Table view",
    "Net Ücret ve Komisyon Geliri": "Net Fee and Commission Income",
    "Ücret-Komisyonun Gelir Karmasındaki Payı": "Fee and Commission Share of the Income Mix",
    "Net ücret-komisyon / (net faiz + net ücret-komisyon).": "Net fees and commissions / (net interest + net fees and commissions).",
    "Yatırım Hizmetlerinin Ücret-Komisyondaki Payı": "Investment Services Share of Fees and Commissions",
    "Yatırımcı sunumlarındaki net ücret-komisyon kırılımında varlık yönetimi, yatırım ürünleri ve aracılık diliminin payı.": "Share of the asset management, investment products and brokerage slice in the net fee and commission breakdown of investor presentations.",
    "Mevduat": "Deposits",
    "Toplam mevduat (TL + yabancı para). Kuveyt Türk için toplanan fonlar / katılım fonu.": "Total deposits (TRY + foreign currency). For Kuveyt Türk, funds collected / participation funds.",
    "Mevduatın Çeyreklik Büyümesi": "Quarterly Deposit Growth",
    "Toplam mevduatın bir önceki çeyrek sonuna göre değişimi, %,": "Change in total deposits versus the previous quarter-end, %,",
    ". Bir bankanın satırı soldan sağa açılıyorsa mevduat artıyor ama hız düşüyor; kırmızı hücreler mevduatın azaldığı çeyrekler. Hücrenin üstüne gelince artışın milyar TL karşılığı görünür.": ". If a bank's row gets lighter from left to right, deposits are growing but more slowly; red cells are quarters in which deposits fell. Hover over a cell to see the change in TRY bn.",
    "Son Çeyrek Sıralaması": "Latest Quarter Ranking",
    ", çeyreklik, milyar TL. Değişim geçen yılın aynı çeyreğine göre,": ", quarterly, TRY bn. Change versus the same quarter of the previous year,",
    "Banka Bazında": "By Bank",
    "Yöntem ve Notlar": "Method and Notes",
    "Kaynak dosyalar ve sayfalar": "Source files and pages",
    "Yönetilen Portföy Büyüklüğü": "Assets Under Management",
    "Çeyrek sonu yönetilen toplam portföy (yatırım ve emeklilik fonları ile bireysel portföyler), SPK verisi,": "Total assets under management at quarter-end (investment and pension funds plus discretionary portfolios), SPK data,",
    "Hasılat": "Revenue",
    "Fon ve portföy yönetim ücretlerinden oluşan finans sektörü faaliyetleri hasılatı.": "Revenue from financial sector activities, made up of fund and portfolio management fees.",
    "Net Dönem Kârı": "Net Profit",
    "Enflasyon muhasebesinin net parasal pozisyon kaybı dahil.": "Including the net monetary position loss from inflation accounting.",
    "Net Kâr Marjı": "Net Profit Margin",
    "Net dönem kârı / hasılat.": "Net profit / revenue.",
    "Gider Oranı": "Cost Ratio",
    "(Genel yönetim + pazarlama giderleri) / hasılat. Düşük oran daha verimli.": "(General administrative + marketing expenses) / revenue. Lower is more efficient.",
    "Efektif Ücret Oranı": "Effective Fee Rate",
    "Yıllıklandırılmış çeyreklik hasılat / çeyrek başı ve sonu portföy büyüklüğünün ortalaması. Şirketin yönettiği her 100 TL'den yılda ne kadar gelir elde ettiğini gösterir; iki taraf da yayımlandığı gibi, enflasyon anahtarından etkilenmez.": "Annualised quarterly revenue / average of start and end-of-quarter assets under management. Shows how much revenue the company earns per year on every TRY 100 it manages; both sides are as published and unaffected by the inflation switch.",
    "Ana Bankaya Katkı": "Contribution to Parent Bank",
    "PYŞ hasılatı / ana bankanın konsolide net ücret-komisyon geliri. Yaklaşık bir büyüklük karşılaştırmasıdır; PYŞ rakamları enflasyon muhasebeli, banka rakamları nominal.": "Asset management company revenue / parent bank's consolidated net fee and commission income. An approximate size comparison; asset management figures are inflation-accounted, bank figures are nominal.",
    ", çeyreklik, milyon TL. Değişim geçen yılın aynı çeyreğine göre.": ", quarterly, TRY mn. Change versus the same quarter of the previous year.",
    "Şirket Bazında": "By Company",
    "Ana bankaya katkı çizgi grafiği": "Contribution to parent bank line chart",
    "Banka kartları": "Bank cards",
    "Bankaların net faiz geliri çizgi grafiği": "Banks' net interest income line chart",
    "Bankaların net ücret ve komisyon geliri çizgi grafiği": "Banks' net fee and commission income line chart",
    "Bankaların toplam mevduatı çizgi grafiği": "Banks' total deposits line chart",
    "Deneme aşamasında: yapay zekâ tarafından üretilir, rakamlar veriyle doğrulanır": "Experimental: generated by AI, numbers are checked against the data",
    "Efektif ücret oranı çizgi grafiği": "Effective fee rate line chart",
    "Gider oranı çizgi grafiği": "Cost ratio line chart",
    "Görünüm": "View",
    "Görünüm ve banka seçimi": "View and bank selection",
    "Hazır aralıklar": "Preset ranges",
    "Net kâr marjı çizgi grafiği": "Net profit margin line chart",
    "Portföy şirketi kartları": "Asset management company cards",
    "Portföy şirketlerinin hasılatı çizgi grafiği": "Asset management companies' revenue line chart",
    "Portföy şirketlerinin net dönem kârı çizgi grafiği": "Asset management companies' net profit line chart",
    "Portföy şirketlerinin yönetilen portföy büyüklüğü çizgi grafiği": "Asset management companies' assets under management line chart",
    "Temayı değiştir": "Toggle theme",
    "Yatırım hizmetlerinin ücret-komisyon içindeki payı çizgi grafiği": "Investment services share of fees line chart",
    "Ücret-komisyon payı çizgi grafiği": "Fee and commission share line chart",
  };
  const statik = [], statikAttr = [];
  // iskelet metinleri, veri gelmeden (dinamik alanlar boşken) bir kez toplanır
  const yuru = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT,
    { acceptNode: (n) => (n.parentElement.closest("script, style") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT) });
  for (let n; (n = yuru.nextNode());) { const t = n.nodeValue.trim(); if (EN_METIN[t]) statik.push([n, n.nodeValue, t]); }
  document.querySelectorAll("[aria-label], [title]").forEach((el) => ["aria-label", "title"].forEach((a) => {
    const t = el.getAttribute(a); if (t && EN_METIN[t]) statikAttr.push([el, a, t]);
  }));
  // "2026 2Ç" gibi ham dönem adları; dil değişince bunlardan üretilir
  function donemYerel() {
    const v = durum.nominal;
    v.donemler = durum.reelV.donemler = durum.donemlerHam.map(donemAd);
    v.enflasyon.baz = donemAd(durum.bazHam);
  }
  function dilUygula() {
    bicimKur();
    document.querySelectorAll("[lang]").forEach((el) => (el.lang = L("tr", "en")));
    document.title = L("Bilanço Dashboard", "Balance Sheet Dashboard");
    statik.forEach(([n, ham, t]) => (n.nodeValue = EN ? ham.replace(t, EN_METIN[t]) : ham));
    statikAttr.forEach(([el, a, t]) => el.setAttribute(a, EN ? EN_METIN[t] : t));
    const dd = document.getElementById("dil");
    dd.textContent = L("EN", "TR");
    dd.title = L("Switch to English", "Türkçeye geç");
    dd.setAttribute("aria-label", dd.title);
    if (!durum.nominal) return;
    donemYerel();
    ["donemBas", "donemSon"].forEach((id) => [...document.getElementById(id).options].forEach((o, i) => (o.textContent = durum.nominal.donemler[i])));
    durum.donemYaz();
    document.getElementById("kurumBaslik").textContent = durum.sekme === "portfoy" ? L("Portföy şirketleri", "Asset Management") : L("Bankalar", "Banks");
    notlar();
    pNotlar();
    ["banka", "portfoy"].forEach((tur) => {
      if (sonAnaliz[tur]) analizGoster(tur, sonAnaliz[tur]);
      const btn = aEl(tur, "analizYenile");
      if (!btn.disabled) btn.textContent = L("Analizi yenile", "Refresh analysis");
      if (!aEl(tur, "analizGeri").hidden) geriBildirimKur(tur);
    });
    ciz();
  }
  document.getElementById("dil").addEventListener("click", () => {
    EN = !EN;
    try { localStorage.setItem("dil", EN ? "en" : "tr"); } catch (e) { /* yok say */ }
    dilUygula();
    yenilikYaz();
  });
  dilUygula();

  /* ---- yenilikler: her tarayıcıda sürüm başına bir kez gösterilir ---- */
  const YENILIK_SURUM = "2026-10-21";
  const YENILIKLER = [
    ["Portföy sekmesine SPK verisiyle yönetilen portföy büyüklükleri eklendi.", "Assets under management from SPK data were added to the Portfolio tab."],
    ["Yıllık hasılatın ortalama portföy büyüklüğüne oranı olarak efektif ücret oranı eklendi.", "An effective fee rate (annual revenue over average assets under management) was added."],
    ["Banka rakamlarını enflasyondan arındıran anahtar eklendi; tutarlar TÜFE ile son çeyrek fiyatlarına çevrilir.", "A switch to adjust bank figures for inflation was added; amounts are restated to last quarter prices using CPI."],
    ["Sayfanın İngilizce sürümü eklendi; sağ üstteki EN/TR düğmesiyle geçilir.", "An English version was added; switch with the EN/TR button at the top right."],
    ["Yönetici özetleri yeni verilerle yeniden üretildi.", "Executive summaries were regenerated with the new data."],
  ];
  const yenilik = document.createElement("dialog");
  yenilik.className = "yenilik";
  document.body.appendChild(yenilik);
  function yenilikYaz() {
    yenilik.lang = L("tr", "en");
    yenilik.innerHTML = `<h2>${L("Yenilikler", "What's New")}</h2>
      <ul>${YENILIKLER.map((m) => `<li>${L(m[0], m[1])}</li>`).join("")}</ul>
      <form method="dialog"><button type="submit">${L("Tamam", "Got it")}</button></form>`;
  }
  yenilik.addEventListener("close", () => {
    try { localStorage.setItem("yenilik", YENILIK_SURUM); } catch (e) { /* yok say */ }
  });
  yenilik.addEventListener("click", (e) => { if (e.target === yenilik) yenilik.close(); });
  let yenilikGoruldu = false;
  try { yenilikGoruldu = localStorage.getItem("yenilik") === YENILIK_SURUM; } catch (e) { yenilikGoruldu = true; }
  if (!yenilikGoruldu && typeof yenilik.showModal === "function") { yenilikYaz(); yenilik.showModal(); }

  let zaman;
  addEventListener("resize", () => { clearTimeout(zaman); zaman = setTimeout(() => grafikler.forEach((g) => g.resize()), 120); });

  fetch("data/panel.json").then((r) => r.json()).then((v) => {
    durum.veri = durum.nominal = v;
    durum.reelV = reelVeri(v);
    durum.donemlerHam = v.donemler.slice();
    durum.bazHam = v.enflasyon.baz;
    donemYerel();
    durum.secili = new Set(v.bankalar.map((b) => b.kod));
    durum.son = v.donemler.length - 1;
    filtreler();
    notlar();
    pNotlar();
    analizYukle("banka");
    analizYukle("portfoy");
    geriBildirimKur("banka");
    geriBildirimKur("portfoy");
    sekmeSec(location.hash === "#portfoy" ? "portfoy" : "banka", false);
  });
})();
