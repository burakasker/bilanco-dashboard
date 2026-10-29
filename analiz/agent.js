// OpenRouter üzerinden yönetici özeti taslağı yazdırır; doğrulamadan geçemezse bir kez düzelttirir.
"use strict";

const { dogrula, BASLIKLAR, BASLIKLAR_PORTFOY, MADDE_MAX, METIN_MAX } = require("./dogrula");

const VARSAYILAN_MODEL = "anthropic/claude-sonnet-5.5";
const ZAMAN_ASIMI_MS = 60_000;

const SISTEM = `Sen bankacılık sektörünü izleyen kıdemli bir finansal analistsin. Türkiye'de 8 bankanın
(Yapı Kredi, Akbank, İş Bankası, Garanti BBVA, TEB, QNB, DenizBank, Kuveyt Türk) konsolide çeyreklik
verisinden yöneticiler için nötr bir sektör özeti yazıyorsun. Hiçbir bankayı kayırma; yatırım tavsiyesi verme.

Kurallar:
- YALNIZ sana verilen olguları kullan. Olgularda olmayan hiçbir sayıyı yazma, hesaplama yapma, tahmin etme.
- Her maddenin "olgular" dizisine, metinde geçen her sayının geldiği olgu kimliklerini yaz.
- Sayıları Türkçe yaz: ondalık ayırıcı virgül, binlik ayırıcı nokta, yüzde işareti başta (%7,4), tutarlar "milyar TL".
  Olgudaki değeri olduğu gibi kullan; istersen ondalığı atarak yuvarlayabilirsin (68,2 → %68).
- Negatif değerleri "geriledi/azaldı" gibi fiillerle anlat, sayıyı eksi işaretsiz yazabilirsin.
- Uzun çizgi (— ya da –) kullanma; ayraç için virgül ya da orta nokta (·) kullan.
- Kısa, somut cümleler. Her madde en fazla ${METIN_MAX} karakter. Rakamın neden önemli olduğunu söyle.
- Banka adlarını şöyle yaz: Yapı Kredi, Akbank, İş Bankası, Garanti BBVA, TEB, QNB, DenizBank, Kuveyt Türk.
- Tutarlar ve büyüme oranları nominaldir, enflasyondan arındırılmamıştır. Büyümeyi yorumlarken bunu belirt
  (ör. "nominal %68"); reel büyüme ya da satın alma gücü hakkında yorum yapma.

Bölümler (tam bu başlıklar, bu sırayla, her birinde en fazla ${MADDE_MAX} madde; yöneticinin bilmesi gereken en önemli noktaları seç):
1. "${BASLIKLAR[0]}": 8 bankanın toplamında net faiz, ücret-komisyon ve mevduatın seyri; gelir karmasının yönü.
2. "${BASLIKLAR[1]}": hızlanan ve yavaşlayan bankalar ("ivme" olguları).
3. "${BASLIKLAR[2]}": göstergelerde lider ve en zayıf bankalar, sıra değişiklikleri, yatırım hizmetleri payı.
4. "${BASLIKLAR[3]}": rakamları yanıltabilecek tek seferlik etkiler, yeniden düzenlemeler, aykırı değerler, mevduatı azalan bankalar.

Yalnız şu biçimde geçerli bir JSON nesnesi döndür, başka hiçbir şey yazma:
{"bolumler":[{"baslik":"...","maddeler":[{"metin":"...","olgular":["id", "..."]}]}]}`;

const ORTAK_KURALLAR = `Kurallar:
- YALNIZ sana verilen olguları kullan. Olgularda olmayan hiçbir sayıyı yazma, hesaplama yapma, tahmin etme.
- Her maddenin "olgular" dizisine, metinde geçen her sayının geldiği olgu kimliklerini yaz.
- Sayıları Türkçe yaz: ondalık ayırıcı virgül, binlik ayırıcı nokta, yüzde işareti başta (%7,4).
  Olgudaki değeri olduğu gibi kullan; istersen ondalığı atarak yuvarlayabilirsin (68,2 → %68).
- Negatif değerleri "geriledi/azaldı" gibi fiillerle anlat, sayıyı eksi işaretsiz yazabilirsin.
- Uzun çizgi (— ya da –) kullanma; ayraç için virgül ya da orta nokta (·) kullan.
- Kısa, somut cümleler. Her madde en fazla ${METIN_MAX} karakter. Rakamın neden önemli olduğunu söyle.`;

const SISTEM_PORTFOY = `Sen portföy yönetimi sektörünü izleyen kıdemli bir finansal analistsin. Türkiye'de 8 bankanın portföy
yönetim şirketinin (PYŞ) çeyreklik verisinden yöneticiler için nötr bir sektör özeti yazıyorsun. Hiçbir şirketi kayırma;
yatırım tavsiyesi verme.

${ORTAK_KURALLAR}
- Tutarlar "milyon TL". PYŞ rakamları enflasyon muhasebeli (TMS 29) ve yayımlandığı gibi; tutar karşılaştırmalarının
  yaklaşık olduğunu gerektiğinde belirt. Oranlara (marj, gider oranı, katkı) öncelik ver.
- Yönetilen portföy büyüklüğü SPK'nın çeyrek sonu verisidir, "milyar TL" ve nominaldir (TMS 29 değil). Efektif ücret oranı
  yıllıklandırılmış hasılatın ortalama portföye oranıdır; şirketin büyüklüğü ne kadar gelire çevirdiğini gösterir.
- Bir PYŞ ile bir bankanın tutarlarını doğrudan büyüklük olarak kıyaslama; ilişkiyi yalnız katkı oranı üzerinden kur.
- Şirket adlarını şöyle yaz: Yapı Kredi Portföy, Ak Portföy, İş Portföy, Garanti BBVA Portföy, TEB Portföy, QNB Portföy,
  Deniz Portföy, KT Portföy. Banka adı gerekirse: Yapı Kredi, Akbank, İş Bankası, Garanti BBVA, TEB, QNB, DenizBank, Kuveyt Türk.

Bölümler (tam bu başlıklar, bu sırayla, her birinde en fazla ${MADDE_MAX} madde; yöneticinin bilmesi gereken en önemli noktaları seç):
1. "${BASLIKLAR_PORTFOY[0]}": 8 PYŞ toplamında hasılat ve net kârın yıllık seyri, yönetilen toplam portföyün büyümesi ve efektif ücret oranı, toplam marj ve gider oranının yönü.
2. "${BASLIKLAR_PORTFOY[1]}": marj, gider oranı ve efektif ücret oranında öne çıkan ve geride kalan şirketler, portföyü en hızlı büyüyenler, marjı iyileşen ya da bozulanlar.
3. "${BASLIKLAR_PORTFOY[2]}": PYŞ hasılatının ana bankanın ücret-komisyon gelirine oranı; katkısı yüksek, artan ve azalan şirketler.
4. "${BASLIKLAR_PORTFOY[3]}": enflasyon muhasebesi etkisi, yeniden düzenlemeler, elle okunan raporlar, aykırı marjlar.

Yalnız şu biçimde geçerli bir JSON nesnesi döndür, başka hiçbir şey yazma:
{"bolumler":[{"baslik":"...","maddeler":[{"metin":"...","olgular":["id", "..."]}]}]}`;

function jsonAyikla(metin) {
  const s = String(metin || "").replace(/^```(?:json)?\s*|\s*```$/g, "");
  const a = s.indexOf("{"), b = s.lastIndexOf("}");
  if (a < 0 || b < a) throw new Error("Yanıtta JSON nesnesi yok.");
  return JSON.parse(s.slice(a, b + 1));
}

async function cagir({ anahtar, model, mesajlar, fetchFn }) {
  const ctrl = new AbortController();
  const zaman = setTimeout(() => ctrl.abort(), ZAMAN_ASIMI_MS);
  try {
    const r = await fetchFn("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      signal: ctrl.signal,
      headers: { Authorization: `Bearer ${anahtar}`, "Content-Type": "application/json", "X-Title": "Bilanco Dashboard" },
      // model varsayılan olarak önce düşünür; düşünmeye ayrı sınır verilmezse çıktı payının tamamını harcayıp boş yanıt döner
      body: JSON.stringify({ model, messages: mesajlar, temperature: 0.2, max_tokens: 9000, reasoning: { max_tokens: 4000 } }),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(`OpenRouter ${r.status}: ${j.error?.message || "bilinmeyen hata"}`);
    return { icerik: j.choices?.[0]?.message?.content || "", kullanim: j.usage || null };
  } catch (e) {
    if (e.name === "AbortError") throw new Error(`OpenRouter ${ZAMAN_ASIMI_MS / 1000} sn içinde yanıt vermedi.`);
    throw e;
  } finally {
    clearTimeout(zaman);
  }
}

async function ozetUret({ olgular, donem, anahtar, model = VARSAYILAN_MODEL, fetchFn = fetch, tur = "banka" }) {
  const basliklar = tur === "portfoy" ? BASLIKLAR_PORTFOY : BASLIKLAR;
  if (!anahtar) throw new Error("OPENROUTER_API_KEY tanımlı değil.");
  // modele gereken alanlar; sıralı ve kısa
  const liste = olgular.map((o) => ({ id: o.id, aciklama: o.aciklama, deger: o.deger, birim: o.birim }));
  const mesajlar = [
    { role: "system", content: tur === "portfoy" ? SISTEM_PORTFOY : SISTEM },
    { role: "user", content: `Dönem: ${donem}\nOlgular (${liste.length} adet):\n${JSON.stringify(liste)}` },
  ];
  const kullanim = [];
  for (let deneme = 1; deneme <= 2; deneme++) {
    const yanit = await cagir({ anahtar, model, mesajlar, fetchFn });
    kullanim.push(yanit.kullanim);
    let taslak, hatalar;
    try {
      taslak = jsonAyikla(yanit.icerik);
      hatalar = dogrula(taslak, olgular, basliklar);
    } catch (e) {
      hatalar = [`Çıktı geçerli JSON değil: ${e.message}`];
    }
    if (!hatalar.length) return { taslak, model, kullanim, deneme };
    if (deneme === 2) {
      const err = new Error(`Taslak iki denemede de doğrulamadan geçmedi:\n- ${hatalar.join("\n- ")}`);
      err.hatalar = hatalar;
      throw err;
    }
    mesajlar.push({ role: "assistant", content: yanit.icerik });
    mesajlar.push({ role: "user", content: `Taslak doğrulamadan geçmedi. Şu sorunları düzeltip JSON'u baştan döndür:\n- ${hatalar.join("\n- ")}` });
  }
}

module.exports = { ozetUret, VARSAYILAN_MODEL, jsonAyikla };
