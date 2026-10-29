# Banka analiz agent'ı · Tasarım

Tarih: 2026-10-15 · Kapsam: yalnız Banka sekmesi (Portföy sonra)

## Amaç

Banka sekmesinin üstündeki 4 özet kutusu kaldırılır. Yerine, bir analiz agent'ının ürettiği nötr bir yönetici özeti gelir.
Özet 8 bankayı eşit ele alır; Yapı Kredi'ye özel bakış yoktur.

Başarı ölçütleri:
- Özetteki her sayı veriden hesaplanmış bir olguya dayanır ve yayından önce doğrulanır.
- Yeni rapor gelip veri yenilenince analiz kendiliğinden güncellenir.
- Analizin üretim zamanı ve kapsadığı dönem sayfada görünür.
- Railway sürümünde kullanıcı "Analizi yenile" ile analizi yeniden ürettirebilir.

Kapsam dışı: Portföy sekmesi analizi, seçili banka/dönem aralığına göre değişen analiz, enflasyon düzeltmesi.

## Kararlar (Burak)

| Konu | Karar |
|---|---|
| Bakış açısı | Nötr sektör özeti |
| Başlıklar | Sektör eğilimi · İvme değişimi · Öne çıkanlar ve geride kalanlar · Dikkat edilecek noktalar |
| Tetikleme | Yeni rapor gelince otomatik + sayfada "Analizi yenile" düğmesi; üretim zamanı yazar |
| Model | OpenRouter |
| Yaklaşım | Hesap kodda, yorum modelde, sayılar doğrulanır |

## Mimari

```
web/data/panel.json ──► analiz/olgular.js ──► olgu listesi (id, değer, birim, açıklama)
                                               │
                         veri/olaylar.json ────┤ (elle tutulan tek seferlik olaylar)
                         kontrol uyarıları ────┘ (veri/kontrol.json, kontrol.py yazar)
                                               ▼
                                     analiz/agent.js ── OpenRouter ──► taslak JSON
                                               ▼
                                     analiz/dogrula.js ── geçmezse 1 düzeltme turu
                                               ▼
                                 web/data/analiz_banka.json ──► sayfa (4 kart)
```

Bileşenler Node ile yazılır, çünkü düğme sunucuda (`server.js`) aynı kodu çağırır. Python veri hattı değişmez; yalnız `kontrol.py` uyarıları ayrıca `veri/kontrol.json` olarak yazar.

### 1. Olgu katmanı · `analiz/olgular.js`

Girdi `panel.json`, `veri/olaylar.json`, `veri/kontrol.json`. Çıktı olgu dizisi; her olgu:
`{ id, baslik: "sektor|ivme|siralama|dikkat", aciklama, deger, birim: "mlr TL|%|puan|sıra", banka?, donem }`.
Hesaplar verideki son çeyrek (`n`) için yapılır.

- **Sektör (8 banka toplamı):** net faiz ve net ücret-komisyon için çeyreklik (n vs n-1) ve yıllık (n vs n-4) değişim;
  ücret-komisyon payı ve yıllık puan değişimi; toplam mevduatın çeyreklik ve yıllık büyümesi.
- **İvme:** her banka için net faiz ve ücret-komisyonun yıllık büyümesi n, n-1, n-2'de; mevduatın çeyreklik büyümesi n, n-1, n-2'de.
  İki çeyrek üst üste artış "hızlanıyor", azalış "yavaşlıyor" olarak işaretlenir; diğerleri işaretlenmez.
- **Sıralama:** her göstergede (net faiz, ücret-komisyon, ücret payı, mevduat) seviye ve yıllık büyüme sırası; n-1'e göre sıra değişimi.
  Yatırım hizmetleri payında (ÜVEK) dört bankanın son değeri ve sırası.
- **Dikkat:** `kontrol.json`daki yeniden düzenleme uyarıları; son çeyrekte mevduatı azalan bankalar;
  bir bankanın büyümesinin 8 bankanın ortanca değerinden 2 standart sapmadan fazla ayrıştığı durumlar; `olaylar.json` kayıtları
  (ör. `{ banka: "qnb", donem: "2025_3C", metin: "Enpara faaliyetlerinin bölünmeyle ayrılması" }`).

Olgu kimlikleri kararlıdır (ör. `sektor.net_faiz.yillik`, `ivme.isbank.mevduat`), böylece doğrulama atıfları kontrol edebilir.

### 2. Agent · `analiz/agent.js`

- OpenRouter `chat/completions`, `OPENROUTER_API_KEY` ve `OPENROUTER_MODEL` ortam değişkenleri.
  Varsayılan model, uygulama sırasında OpenRouter model listesinden seçilen güncel bir Claude modelidir.
- Sistem yönergesi: nötr, Türkçe, kısa; yalnız verilen olgular kullanılır; uzun çizgi kullanılmaz; yatırım tavsiyesi yok.
- Çıktı biçimi (JSON):
  `{ bolumler: [ { baslik, maddeler: [ { metin, olgular: [id, ...] } ] } ] }` · 4 bölüm, her birinde en fazla 2 madde, madde en fazla 220 karakter.
- Sayılar metinde Türkçe biçimde yazılır (`%7,4`, `344,0 milyar TL`, `-5,7 puan`).

### 3. Doğrulama · `analiz/dogrula.js`

- Bölüm başlıkları beklenen dört başlık, madde sayıları 1-2, uzunluk sınırı.
- Her madde en az bir olguya atıf yapar ve atıfların hepsi olgu listesinde vardır.
- Metindeki her sayı (yüzde, puan, tutar, sıra) atıf yapılan olgulardan birinin değeriyle, gösterilen ondalık hassasiyetinde yuvarlandığında eşleşir.
  Dönem adları (`2026 2Ç`) ve banka sayısı (8) sayı kontrolünden muaftır.
- Uzun çizgi (— –) yasak.
- Geçmezse hata listesi modele bir kez geri gönderilir. İkinci deneme de geçmezse dosya yazılmaz, eski analiz kalır, hata `veri/analiz_hata.log`a eklenir ve komut sıfır olmayan kodla çıkar.

### 4. Çıktı · `web/data/analiz_banka.json`

`{ uretim: ISO zaman, donem: "2026 2Ç", model, veri_izi: panel.json'ın SHA-256'sı, bolumler: [...] }`

### 5. Tetikleme

- **Otomatik:** `npm run veri` sonuna `node analiz/calistir.js --gerekirse` eklenir. `veri_izi` mevcut analizle aynıysa model çağrılmaz.
- **Elle (yerel):** `npm run analiz` her zaman yeniden üretir.
- **Düğme (Railway):** `server.js` içinde `POST /api/analiz`. 10 dakikada en fazla bir üretim; erken çağrıda `429` ve kalan süre döner.
  Aynı anda tek üretim çalışır. Anahtar yoksa `503` ve "Analiz servisi yapılandırılmamış" mesajı.
- **Claude paylaşım sürümü (artifact):** düğme gizlenir; son analiz ve üretim zamanı gösterilir. `tek_dosya.py` analiz dosyasını sayfaya gömer.

Anahtar yerelde `~/.config/banka-infografik/openrouter.env`, Railway'de ortam değişkenidir; repoya, log'a ve sayfaya yazılmaz.

### 6. Sayfa

- 4 özet kutusu kaldırılır; yerine başlık satırı + 4 kart.
- Başlık satırı: "Yapay zekâ analizi · 2026/2Ç verisi · 15 Ekim 2026 14:30 · OpenRouter modeli" ve sağda "Analizi yenile" düğmesi.
  Üretim sırasında düğme "Analiz hazırlanıyor…" olur; bitince kartlar yenilenir; hata olursa kısa bir mesaj gösterilir.
- Kartlar dört başlığı taşır, maddeler yalın metin, sayılar kalın.
- Analiz dosyası yoksa kartların yerine "Henüz analiz üretilmedi" ve (Railway'de) düğme gösterilir.
- Analiz verideki son çeyreğe göredir; dönem/banka seçimi analizi değiştirmez ve başlık satırı bunu söyler.

## Hata durumları

| Durum | Davranış |
|---|---|
| OpenRouter erişilemiyor / zaman aşımı (60 sn) | Eski analiz kalır, düğmede hata mesajı, log |
| Model geçersiz JSON döndürür | Doğrulama hatası gibi bir düzeltme turu |
| Doğrulama iki kez başarısız | Yazılmaz, log, çıkış kodu 1 |
| Anahtar yok | `npm run veri` analiz adımını atlar ve uyarı yazar; sunucu 503 |

## Test

- `analiz/olgular.test.js`: sabit bir küçük panel ile toplamlar, büyüme, ivme işaretleri ve sıralamalar beklenen değerleri verir.
- `analiz/dogrula.test.js`: doğru taslak geçer; yanlış sayı, olmayan olgu kimliği, uzun çizgi, fazla madde reddedilir; yuvarlama payı çalışır.
- Agent için sahte OpenRouter yanıtıyla uçtan uca deneme (ağ yok); ardından gerçek anahtarla bir kez canlı üretim ve doğrulamanın geçtiğinin görülmesi.
- Sayfa: yerel sunucuda kartların, zaman satırının ve düğmenin (429 dahil) çalıştığının tarayıcıda görülmesi.

## Ek · Portföy sekmesi (2026-10-15)

Aynı mimari, `tur = "portfoy"`. Başlıklar: Sektör eğilimi · Verimlilik ve kârlılık · Ana bankaya katkı · Dikkat edilecek noktalar.
- Olgular `analiz/olgular_portfoy.js`: TMS 29 ve hesaplanmış 4Ç nedeniyle çeyrekten çeyreğe tutar kıyası yok; yıllık kıyas ve
  birimsiz oranlar (marj, gider oranı, ana bankaya katkı). Dikkat: TMS 29 notu, son dört çeyrekte elle okunan raporlar,
  ortancadan 2 standart sapma ayrışan marjlar, hesaplanmış 4Ç, son dört çeyrekteki yeniden düzenlemeler.
- Yönerge: PYŞ ile banka tutarı doğrudan kıyaslanmaz; ilişki yalnız katkı oranıyla kurulur.
- Çıktı `web/data/analiz_portfoy.json`; veri izi yalnız PYŞ + banka ücret-komisyon + ÜVEK verisinden.
- `POST /api/analiz?tur=portfoy`; 10 dakika sınırı sekme başına ayrı; istekler `veri/analiz_istek.log`a yazılır.
