// View: Bazar ("#/bazar" atau path "/bazar") -- HALAMAN INFO UMUM Bazar
// ALIF 5.0 (deskripsi singkat, info biaya/rekening, status kuota, daftar
// kategori stand) -- BUKAN form pendaftaran. Form pendaftaran stand/tenant
// sendiri sekarang di halaman terpisah "#/daftar-bazar" (lihat
// view-daftarbazar.js, isinya pindahan PERSIS dari isi "#/bazar" versi
// lama), ditautkan lewat tombol "Daftar Stand Sekarang" di sini -- pola yang
// sama seperti Lomba ("#/lomba" = info, "#/daftar" = form).
//
// Tetap TERPISAH TOTAL dari skema lomba: datanya dari tabel bazar_settings
// (migrasi 0030, ditambah kolom profil_judul/profil_deskripsi lewat migrasi
// 0031) & fungsi publik bazar_jumlah_terisi() -- sama seperti yang dipakai
// form pendaftaran, supaya angkanya selalu konsisten.

const BAZAR_TEMPLATE = `
<section class="hero container">
  <span class="hero__eyebrow">Al Azzaam Islamic Fair</span>
  <h1 id="bazar-judul">Bazar ALIF 5.0</h1>
  <p class="lede" id="bazar-deskripsi">Memuat info bazar...</p>
  <div class="hero__actions">
    <a href="#/daftar-bazar" class="btn btn--primary" id="bazar-cta-daftar">Daftar Stand Sekarang</a>
  </div>
</section>

<section class="section container">
  <div class="notice" id="bazar-info-biaya" style="display:none;"></div>
  <div class="notice" id="bazar-info-rekening" style="display:none;"></div>
  <div class="notice" id="bazar-info-kuota" style="display:none;"></div>

  <div class="section__head">
    <h2>Jenis & Lokasi Stand</h2>
    <p>Tiga jenis stand yang tersedia, masing-masing punya area & kuota sendiri -- lokasi persisnya dipilih saat mengisi form pendaftaran.</p>
  </div>
  <div id="bazar-jenis-list">
    <p class="hint">Memuat jenis stand...</p>
  </div>
</section>

<section class="section container">
  <div class="section__head">
    <h2>Yang Perlu Disiapkan</h2>
    <p>Siapkan berkas berikut dulu sebelum mengisi form, supaya prosesnya lancar tanpa bolak-balik.</p>
  </div>
  <div class="syarat-card">
    <div class="syarat-item">
      <span class="syarat-item__icon">📸</span>
      <div class="syarat-item__text">
        <strong>Foto Produk/Logo Usaha</strong>
        <p>Satu atau beberapa foto produk/logo usaha Anda, dipakai panitia untuk verifikasi & promosi bazar. Format JPG/PNG, maksimal 4MB per file.</p>
      </div>
    </div>
    <div class="syarat-item">
      <span class="syarat-item__icon">💳</span>
      <div class="syarat-item__text">
        <strong>Bukti Pembayaran Sewa Stand</strong>
        <p>Screenshot/foto bukti transfer biaya sewa stand sesuai jenis & jumlah lokasi yang dipilih (lihat harga tiap jenis di atas). Format JPG/PNG/PDF, maksimal 4MB.</p>
      </div>
    </div>
  </div>
</section>

<section class="section container">
  <div class="info-banner">
    <div class="info-banner__item">
      <h4>Verifikasi</h4>
      <p>Panitia akan memverifikasi data & bukti pembayaran, lalu menghubungi lewat WhatsApp penanggung jawab yang didaftarkan.</p>
    </div>
    <div class="info-banner__item">
      <h4>Konfirmasi</h4>
      <p>Setelah mengisi form, Anda akan menerima nomor pendaftaran sebagai bukti — simpan baik-baik.</p>
    </div>
  </div>
</section>
`;

const BAZAR_DESKRIPSI_DEFAULT =
  "Buka stand/tenant usaha Anda di Bazar ALIF 5.0! Ramaikan acara sekaligus promosikan produk Anda ke pengunjung. Isi data usaha, pilih kategori stand, dan unggah bukti pembayaran sewa untuk mendaftar.";

function escapeHTMLBazarInfo(teks) {
  const div = document.createElement("div");
  div.textContent = String(teks == null ? "" : teks);
  return div.innerHTML;
}

// Pesan lucu bertema "lagi maintenance, ngumpulin cakra dulu" -- dipilih
// acak tiap kali halaman ini dirender supaya tidak monoton, gayanya sama
// seperti PESAN_LUCU_TUTUP di router.js (gerbang pendaftaran lomba), tapi
// isinya khusus dibuat berbeda/lebih "ninja-bertema-cakra" sesuai
// permintaan supaya pesan tutup Bazar juga terasa lucu, bukan cuma pesan
// error polos. ISI-nya SAMA PERSIS dengan yang ada di view-daftarbazar.js
// (kalau mau diubah, ganti di KEDUA tempat itu supaya tetap konsisten) --
// tapi NAMA KONSTANTANYA beda (`_INFO` di sini, `_DAFTAR` di
// view-daftarbazar.js) SENGAJA, bukan lupa disamakan: kedua file ini
// sama-sama <script> klasik di index.html yang berbagi satu scope global,
// jadi dua `const` bernama identik di file berbeda akan membuat browser
// melempar `SyntaxError: Identifier '...' has already been declared` saat
// file kedua dimuat -- yang menggagalkan TOTAL seluruh isi file itu
// (termasuk `window.ViewXxx` di baris paling akhirnya). Ini sumber bug
// nyata yang sempat bikin tombol "Daftar Stand Sekarang" gagal berpindah
// halaman (console menunjukkan error ini persis).
const PESAN_LUCU_BAZAR_TUTUP_TOTAL_INFO = [
  "Bazar-nya lagi mode pertapaan dulu, ngumpulin cakra sebanyak-banyaknya biar pas dibuka nanti langsung ngegas. 🌀 Sabar ya, chakra-nya baru keisi separuh.",
  "Maintenance dulu, Ninja! Panitia lagi menghimpun cakra di seluruh penjuru pondok sebelum Bazar resmi dibuka ke publik. 🥷⚡",
  "Error 404: Cakra belum cukup. Sedang dalam proses pengisian ulang, balik lagi nanti kalau sudah full tank ya. 🔋",
  "Lagi semedi di Air Terjun Kebenaran sambil ngumpulin cakra buat Bazar ALIF 5.0. Jangan diganggu dulu, nanti juga muncul sendiri. 🏞️🧘",
  "Rasengan Bazar-nya masih dalam proses pembentukan cakra, belum stabil kalau dibuka sekarang. Ditunggu ya sampai sempurna. 🌀",
  "Mode Sage lagi aktif: panitia sedang menyerap cakra alam demi persiapan Bazar yang maksimal. Coba mampir lagi nanti. 🍃"
];

// "Tutup Total Bazar" (bazar_settings.tutup_total, migrasi 0035) --
// menyembunyikan halaman info INI juga (bukan cuma form "/daftar-bazar"
// seperti pendaftaran_dibuka=false), KECUALI untuk panitia yang sedang
// login di browser ini (akun Supabase Auth yang sama dengan
// "/admin"/"/adminbazar" -- lihat getSession() di bawah), supaya panitia
// tetap bisa pratinjau halaman ini sebelum/sambil memutuskan kapan
// dibuka lagi ke publik.
function tampilkanPesanBazarTutupTotal() {
  const app = document.getElementById("app");
  if (!app) return;
  const pesan = PESAN_LUCU_BAZAR_TUTUP_TOTAL_INFO[Math.floor(Math.random() * PESAN_LUCU_BAZAR_TUTUP_TOTAL_INFO.length)];
  app.innerHTML =
    '<section class="hero container">' +
      '<span class="hero__eyebrow">Al Azzaam Islamic Fair</span>' +
      '<h1>🌀 Bazar Belum Dibuka</h1>' +
      '<p class="lede">' + escapeHTMLBazarInfo(pesan) + '</p>' +
    '</section>';
}

// Urutan tampil jenis stand -- tetap A, B, C apa pun urutan key di jsonb.
const URUTAN_JENIS_STAND_INFO = ["A", "B", "C"];

function formatRupiahBazarInfo(angka) {
  return "Rp" + Number(angka || 0).toLocaleString("id-ID");
}

async function initBazar() {
  const [{ data: settings }, { data: standData }, { data: sesi }] = await Promise.all([
    supabaseClient.from("bazar_settings").select("profil_judul,profil_deskripsi,pendaftaran_dibuka,tutup_total,jenis_stand_info,info_biaya,info_rekening").eq("id", 1).single(),
    supabaseClient.from("bazar_stand").select("jenis,area,tenant_id"),
    supabaseClient.auth.getSession()
  ]);

  const panitiaLogin = !!(sesi && sesi.session);
  if (settings && settings.tutup_total === true && !panitiaLogin) {
    tampilkanPesanBazarTutupTotal();
    return;
  }

  // Panitia yang login tetap melihat halaman ini seperti biasa walau
  // tutup_total aktif (supaya bisa pratinjau) -- diberi banner pengingat
  // di paling atas supaya tidak lupa ini sedang tersembunyi dari publik.
  if (settings && settings.tutup_total === true && panitiaLogin) {
    const hero = document.querySelector(".hero.container");
    if (hero) {
      const banner = document.createElement("div");
      banner.className = "notice notice--error";
      banner.style.marginBottom = "16px";
      banner.textContent = "🔒 Mode Pratinjau Panitia: halaman ini sedang DISEMBUNYIKAN dari publik (\"Tutup Total Bazar\" aktif di /adminbazar).";
      hero.insertBefore(banner, hero.firstChild);
    }
  }

  const judulEl = document.getElementById("bazar-judul");
  const deskripsiEl = document.getElementById("bazar-deskripsi");
  if (judulEl) judulEl.textContent = (settings && settings.profil_judul) || "Bazar ALIF 5.0";
  if (deskripsiEl) deskripsiEl.textContent = (settings && settings.profil_deskripsi) || BAZAR_DESKRIPSI_DEFAULT;

  const pendaftaranDibuka = !settings || settings.pendaftaran_dibuka !== false;
  const jenisStandInfo = (settings && settings.jenis_stand_info) || {};
  const standList = standData || [];
  const semuaPenuh = standList.length > 0 && standList.every(function (s) { return !!s.tenant_id; });

  // -------- Jenis & Lokasi Stand (migrasi 0037) -- satu kartu per jenis
  // (A/B/C), menampilkan ukuran, harga, daftar area & sisa kuota TIAP area
  // (bukan cuma total) -- supaya pengunjung sudah tahu area mana yang masih
  // longgar sebelum masuk ke form pendaftaran untuk memilih lokasi persisnya.
  const jenisListEl = document.getElementById("bazar-jenis-list");
  if (jenisListEl) {
    jenisListEl.innerHTML = URUTAN_JENIS_STAND_INFO.filter(function (j) { return jenisStandInfo[j]; }).map(function (j) {
      const info = jenisStandInfo[j];
      const standJenisIni = standList.filter(function (s) { return s.jenis === j; });
      const areaList = [];
      standJenisIni.forEach(function (s) { if (areaList.indexOf(s.area) === -1) areaList.push(s.area); });
      const rincianArea = areaList.map(function (area) {
        const standArea = standJenisIni.filter(function (s) { return s.area === area; });
        const sisaArea = standArea.filter(function (s) { return !s.tenant_id; }).length;
        return area + " (sisa " + sisaArea + "/" + standArea.length + ")";
      }).join(", ");
      const sisaJenis = standJenisIni.filter(function (s) { return !s.tenant_id; }).length;
      return (
        '<div class="syarat-card" style="margin-bottom:14px;">' +
          '<div class="syarat-item">' +
            '<span class="syarat-item__icon">🏪</span>' +
            '<div class="syarat-item__text">' +
              '<strong>' + escapeHTMLBazarInfo(info.nama || ("Jenis " + j)) + ' — ' + escapeHTMLBazarInfo(info.ukuran || "-") + ' — ' + formatRupiahBazarInfo(info.harga) + '</strong>' +
              '<p>Area: ' + escapeHTMLBazarInfo(rincianArea || "-") + '.' +
              (sisaJenis === 0 ? ' <strong style="color:#9C2B30;">Sudah penuh.</strong>' : (' Total sisa ' + sisaJenis + ' dari ' + standJenisIni.length + ' stand.')) +
              '</p>' +
            '</div>' +
          '</div>' +
        '</div>'
      );
    }).join("");
  }

  const infoBiayaEl = document.getElementById("bazar-info-biaya");
  if (infoBiayaEl && settings && settings.info_biaya) {
    infoBiayaEl.textContent = "💰 " + settings.info_biaya;
    infoBiayaEl.style.display = "block";
  }

  const infoRekeningEl = document.getElementById("bazar-info-rekening");
  if (infoRekeningEl && settings && settings.info_rekening) {
    infoRekeningEl.textContent = "🏦 " + settings.info_rekening;
    infoRekeningEl.style.display = "block";
  }

  // -------- Tombol CTA "Daftar Stand Sekarang" -- tetap menuju #/daftar-bazar
  // apa pun statusnya (sama seperti pola CTA "Daftar Sekarang" di halaman
  // Lomba): kalau sedang ditutup/semua jenis penuh, tombolnya cuma diberi
  // tanda gembok, halaman form itu sendiri yang menampilkan pesan
  // tertutup/penuh lengkap (lihat muatPengaturanBazar() di
  // view-daftarbazar.js).
  const cta = document.getElementById("bazar-cta-daftar");
  if (cta && (!pendaftaranDibuka || semuaPenuh)) {
    cta.classList.add("is-locked");
    cta.innerHTML = !pendaftaranDibuka ? "🔒 Daftar Stand Sekarang" : "🚫 Daftar Stand Sekarang";
  }
}

window.ViewBazar = { template: BAZAR_TEMPLATE, init: initBazar };
