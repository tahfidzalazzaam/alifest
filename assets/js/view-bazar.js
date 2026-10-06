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
    <h2>Kategori/Ukuran Stand</h2>
    <p>Pilihan kategori stand yang tersedia saat ini -- kategori dipilih saat mengisi form pendaftaran.</p>
  </div>
  <div class="chip-list" id="bazar-kategori-list">
    <p class="hint">Memuat kategori stand...</p>
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
        <p>Screenshot/foto bukti transfer biaya sewa stand sesuai kategori yang dipilih (lihat info biaya di atas). Format JPG/PNG/PDF, maksimal 4MB.</p>
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

async function initBazar() {
  const [{ data: settings }, { data: jumlahTerisi }] = await Promise.all([
    supabaseClient.from("bazar_settings").select("profil_judul,profil_deskripsi,pendaftaran_dibuka,kategori_list,kuota_total,info_biaya,info_rekening").eq("id", 1).single(),
    supabaseClient.rpc("bazar_jumlah_terisi")
  ]);

  const judulEl = document.getElementById("bazar-judul");
  const deskripsiEl = document.getElementById("bazar-deskripsi");
  if (judulEl) judulEl.textContent = (settings && settings.profil_judul) || "Bazar ALIF 5.0";
  if (deskripsiEl) deskripsiEl.textContent = (settings && settings.profil_deskripsi) || BAZAR_DESKRIPSI_DEFAULT;

  const pendaftaranDibuka = !settings || settings.pendaftaran_dibuka !== false;
  const kategoriList = (settings && Array.isArray(settings.kategori_list) && settings.kategori_list.length)
    ? settings.kategori_list
    : ["Kecil", "Sedang", "Besar"];
  const kuotaTotal = settings ? settings.kuota_total : null;
  const terisi = typeof jumlahTerisi === "number" ? jumlahTerisi : 0;
  const kuotaPenuh = kuotaTotal !== null && kuotaTotal !== undefined && terisi >= kuotaTotal;

  const kategoriListEl = document.getElementById("bazar-kategori-list");
  if (kategoriListEl) {
    kategoriListEl.innerHTML = kategoriList.map(function (k) {
      return '<span class="chip">🏪 ' + escapeHTMLBazarInfo(k) + '</span>';
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

  const infoKuotaEl = document.getElementById("bazar-info-kuota");
  if (infoKuotaEl && kuotaTotal !== null && kuotaTotal !== undefined) {
    infoKuotaEl.textContent = kuotaPenuh
      ? "🚫 Kuota stand bazar sudah penuh (" + terisi + "/" + kuotaTotal + ")."
      : "📊 Sisa kuota stand: " + Math.max(kuotaTotal - terisi, 0) + " dari " + kuotaTotal + ".";
    infoKuotaEl.className = "notice" + (kuotaPenuh ? " notice--error" : "");
    infoKuotaEl.style.display = "block";
  }

  // -------- Tombol CTA "Daftar Stand Sekarang" -- tetap menuju #/daftar-bazar
  // apa pun statusnya (sama seperti pola CTA "Daftar Sekarang" di halaman
  // Lomba): kalau sedang ditutup/penuh, tombolnya cuma diberi tanda gembok,
  // halaman form itu sendiri yang menampilkan pesan tertutup/penuh lengkap
  // (lihat muatPengaturanBazar() di view-daftarbazar.js).
  const cta = document.getElementById("bazar-cta-daftar");
  if (cta && (!pendaftaranDibuka || kuotaPenuh)) {
    cta.classList.add("is-locked");
    cta.innerHTML = !pendaftaranDibuka ? "🔒 Daftar Stand Sekarang" : "🚫 Daftar Stand Sekarang";
  }
}

window.ViewBazar = { template: BAZAR_TEMPLATE, init: initBazar };
