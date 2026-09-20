# ALIF 5.0 — Pendaftaran Lomba

Situs pendaftaran lomba untuk **Al Azzaam Islamic Fair 5.0**: Lomba Adzan, Panahan, MHQ, Kaligrafi, dan Futsal (mewakili sekolah).

- Frontend: **satu halaman (SPA)** — HTML/CSS/JS murni, tanpa build step, dengan router hash sederhana. "Beranda" dan "Daftar Lomba" terasa seperti dua halaman berbeda (URL-nya pun beda: `#/` dan `#/daftar`), padahal isinya satu `index.html` yang kontennya diganti lewat JS tanpa reload — pola yang sama dengan Al-Hafizh.
- Backend: **Supabase** (Postgres + Storage + Edge Function) — database asli, sama seperti Al-Hafizh & Portal PSB, jadi tahan lonjakan pendaftar tanpa batas eksekusi paralel seperti Apps Script.
- Data pendaftaran otomatis **disinkronkan ke Google Sheet** (satu arah, insert-only) lewat Database Webhook + Edge Function, supaya panitia tetap bisa lihat rekap dalam bentuk spreadsheet.
- Hosting: Vercel (auto-deploy dari GitHub).

```
alif-pendaftaran/
├── index.html                          ← satu-satunya file HTML (shell: navbar, #app, footer)
├── assets/
│   ├── css/style.css
│   └── js/
│       ├── config.js                    ← URL/key Supabase, batas upload
│       ├── supabase-client.js
│       ├── router.js                    ← router hash: #/  <->  #/daftar
│       ├── view-beranda.js              ← template + logika halaman Beranda
│       └── view-daftar.js               ← template + logika form pendaftaran
└── supabase/
    ├── migrations/0001_init.sql         ← skema database, RLS, fungsi submit_pendaftaran
    └── functions/sync-ke-sheets/        ← Edge Function sinkron ke Google Sheets
```

**Cara kerja routernya** (`assets/js/router.js`): tiap `view-*.js` mengekspor sebuah objek `{ template, init }` — `template` adalah HTML halaman itu (string), `init` adalah fungsi yang memasang event listener & mengambil data setelah HTML-nya dipasang. Router dengar perubahan hash URL, tukar isi `<div id="app">`, lalu panggil `init()` view yang sesuai. Menambah "halaman" baru nanti tinggal: buat `view-xxx.js` baru, daftarkan di `ROUTES` pada `router.js`, tambahkan link `<a href="#/xxx" data-route="#/xxx">` di navbar `index.html`.

---

## 1. Setup Supabase

1. Buat project baru di [supabase.com](https://supabase.com) (atau pakai project yang sudah ada, disarankan project terpisah dari Al-Hafizh/PSB supaya datanya tidak bercampur).
2. Buka **SQL Editor**, tempel seluruh isi `supabase/migrations/0001_init.sql`, klik **Run**.
   Ini otomatis membuat: tabel `lomba_rules` (+ seed 5 lomba), `lomba_counter`, `pendaftaran`, `anggota_tim`, bucket Storage `berkas-pendaftaran`, RLS policy, GRANT, dan fungsi `submit_pendaftaran`.
3. Buka **Project Settings → API**, salin **Project URL** dan **anon public key**.

## 2. Hubungkan Frontend ke Supabase

Buka `assets/js/config.js`, isi:

```js
const SUPABASE_URL = "https://xxxxxxxx.supabase.co";
const SUPABASE_ANON_KEY = "eyJ...";
```

---

## 3. Setup Sinkron ke Google Sheets

### a. Siapkan Service Account Google

1. Di [console.cloud.google.com](https://console.cloud.google.com), buat project (atau pakai yang ada) → aktifkan **Google Sheets API** (menu "APIs & Services → Library").
2. **IAM & Admin → Service Accounts → Create Service Account** (tidak perlu memberi role apa pun di level IAM — aksesnya diatur lewat sharing sheet, bukan role).
3. Buka service account yang baru dibuat → tab **Keys → Add Key → Create new key → JSON** → file JSON otomatis terdownload. Simpan baik-baik, ini kredensial rahasia.
4. Buat Google Sheet baru untuk rekap (mis. "Data Pendaftaran ALIF 5.0"). Buat **2 tab** dengan nama persis: `Pendaftaran` dan `Anggota Tim`.
5. **Share** sheet tersebut ke email service account (field `client_email` di file JSON, formatnya `...@...iam.gserviceaccount.com`) dengan akses **Editor**.
6. Salin **Spreadsheet ID** dari URL sheet: `https://docs.google.com/spreadsheets/d/`**`ID_INI`**`/edit`.

### b. Deploy Edge Function

1. Di dashboard Supabase → **Edge Functions → Create a new function**, beri nama `sync-ke-sheets`.
2. Buka editornya, hapus isi default, tempel seluruh isi `supabase/functions/sync-ke-sheets/index.ts`, lalu **Deploy**.
3. Di **Project Settings → Edge Functions → Secrets**, tambahkan:
   - `GOOGLE_SERVICE_ACCOUNT_KEY` → isi seluruh isi file JSON service account (paste apa adanya sebagai satu nilai).
   - `SPREADSHEET_ID` → ID sheet dari langkah a.6.

### c. Hubungkan lewat Database Webhook

1. Di dashboard Supabase → **Database → Webhooks → Create a new webhook**.
2. Name: `sync-pendaftaran`. Table: `pendaftaran`. Events: **Insert** saja.
3. Type: pilih **Supabase Edge Functions**, arahkan ke `sync-ke-sheets` (Supabase otomatis menyertakan header otorisasi yang dibutuhkan Edge Function).
4. Ulangi langkah 1–3 sekali lagi untuk table `anggota_tim` (webhook kedua, nama mis. `sync-anggota-tim`, tetap arahkan ke function `sync-ke-sheets` yang sama — function-nya sudah membedakan berdasarkan nama tabel).

> Kalau versi dashboard Anda tidak punya opsi "Supabase Edge Functions" di webhook (hanya "HTTP Request"), pakai URL function-nya (`https://xxxxxxxx.supabase.co/functions/v1/sync-ke-sheets`) dan tambahkan header `Authorization: Bearer <service_role_key>` secara manual di form webhook.

---

## 4. Push ke GitHub & Deploy ke Vercel

1. Buat repository baru di GitHub (mis. `alif-5-pendaftaran`).
2. Upload seluruh isi folder ini lewat GitHub web UI ("Add file → Upload files") — termasuk folder `assets/` dan `supabase/` (folder `supabase/` hanya sebagai arsip kode di repo; migrasi & function-nya dijalankan lewat dashboard Supabase, bukan lewat Vercel).
3. Di [vercel.com](https://vercel.com) → **Add New → Project** → pilih repo tadi → Framework Preset: **Other** → **Deploy**.

---

## 5. Mengatur Syarat Lomba (jenjang, usia, kuota)

Sekarang **tidak perlu ubah kode sama sekali**. Buka dashboard Supabase → **Table Editor → lomba_rules**, edit langsung sel-selnya:

| kolom | isi |
|---|---|
| `jenjang` | array teks, mis. `{SD,SMP,SMA}` |
| `usia_min`, `usia_max` | angka |
| `tipe` | `individu` atau `tim` |
| `min_anggota`, `max_anggota` | khusus tipe tim |
| `kuota` | angka, atau kosongkan (`null`) untuk tanpa batas |
| `aktif` | matikan (`false`) untuk menyembunyikan lomba tanpa menghapus datanya |

Perubahan langsung berlaku di situs — tidak perlu deploy ulang.

---

## 6. Melihat & Mengelola Data Pendaftaran

- **Sumber data utama**: Table Editor → `pendaftaran` (data peserta lengkap + link berkas) dan `anggota_tim` (khusus Futsal). Ubah kolom `status` di sini untuk menandai "Diterima"/"Ditolak" dsb.
- **Salinan untuk dibaca cepat**: Google Sheet yang di-setup di langkah 3 — otomatis terisi tiap ada pendaftaran baru. Sheet ini **satu arah** (Supabase → Sheet); mengubah data di Sheet tidak akan mengubah data di Supabase. Anggap Sheet sebagai laporan yang selalu update, dan Supabase sebagai sumber kebenaran untuk verifikasi/status.
- Nomor pendaftaran dibuat otomatis per lomba, format `KODE-001`, `KODE-002`, dst.
- Berkas upload (Surat Aktif Sekolah, Kartu Pelajar) tersimpan di Supabase Storage, bucket `berkas-pendaftaran` — linknya ada di kolom `url_surat_aktif`/`url_kartu_pelajar` maupun di Sheet.

---

## 7. Uji Coba Sebelum Dipakai Publik

1. Buka situsnya, klik **Daftar Lomba** (URL akan berubah jadi `#/daftar` tanpa reload), isi form dengan data uji coba, unggah 2 berkas, kirim.
2. Pastikan baris baru muncul di Table Editor Supabase (`pendaftaran`) **dan** di Google Sheet.
3. Coba kombinasi jenjang/usia yang tidak memenuhi syarat suatu lomba — pastikan lomba itu otomatis nonaktif di form.
4. Kalau ingin uji kuota, set `kuota` sebuah lomba ke angka kecil (mis. 1) sementara, daftar dua kali, pastikan percobaan kedua ditolak dengan pesan "kuota penuh".

## Catatan Teknis

- Validasi syarat lomba (jenjang/usia/kuota/jumlah anggota tim) dilakukan **dua kali**: di browser (untuk pengalaman pakai yang responsif) dan sekali lagi di dalam fungsi `submit_pendaftaran` di database (lapisan keamanan sebenarnya — tidak bisa dilewati walau seseorang mengutak-atik request-nya langsung).
- Nomor pendaftaran & kuota dijaga atomik lewat tabel `lomba_counter` (increment dengan row-level lock Postgres), jadi aman dari race condition walau banyak orang submit dalam detik yang sama — inilah yang membuat arsitektur ini jauh lebih tahan lonjakan dibanding Apps Script.
- Data peserta (`pendaftaran`, `anggota_tim`) **tidak bisa dibaca publik** lewat API — hanya bisa ditulis lewat fungsi `submit_pendaftaran` (SECURITY DEFINER) dan dibaca lewat dashboard Supabase (atau admin panel kalau nanti dibangun).
- Batas ukuran berkas default **4MB** per file (`MAX_FILE_SIZE_MB` di `config.js`).
- Kalau ke depan perlu dashboard verifikasi berkas per peserta (bukan hanya lewat Table Editor mentah), ini bisa dibangun menyusul dengan pola yang sama seperti Portal PSB.
