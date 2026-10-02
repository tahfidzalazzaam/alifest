// View: Beranda ("#/") -- PROFIL & INFO UMUM acara ALIF 5.0.
//
// Sebelumnya halaman ini LANGSUNG berisi daftar cabang lomba (kartu lomba,
// kuota, countdown, dsb). Sekarang itu semua PINDAH ke halaman baru "#/lomba"
// (lihat view-lomba.js, isinya persis sama seperti Beranda versi lama, cuma
// pindah file & route) -- Beranda sendiri sekarang jadi halaman profil
// ringkas: nama acara, deskripsi umum, dan (opsional) video dokumentasi
// tahun lalu, yang semuanya bisa diisi panitia lewat halaman Panitia
// TERSENDIRI "#/adminprofil" (lihat view-adminprofil.js -- sengaja dipisah
// dari "#/admin", bukan jadi tab di dalamnya) -- kolomnya disimpan di
// site_settings (migrasi 0031: profil_judul, profil_deskripsi,
// profil_video_url).
//
// Dari sini pengunjung diarahkan lewat dua kartu besar ke halaman masing-
// masing: "Lomba" (#/lomba) dan "Bazar" (#/bazar, sekarang juga halaman info
// umum -- form pendaftaran standnya sendiri pindah ke #/daftar-bazar).

const BERANDA_TEMPLATE = `
<section class="hero container">
  <span class="hero__eyebrow">Al Azzaam Islamic Fair</span>
  <h1 id="beranda-judul">ALIF 5.0</h1>
  <p class="lede" id="beranda-deskripsi">Memuat info acara...</p>
  <div class="hero__actions">
    <a href="#/lomba" class="btn btn--primary">Lihat Lomba</a>
    <a href="#/bazar" class="btn btn--ghost">Lihat Bazar</a>
  </div>
</section>

<section class="section container" id="beranda-video-wrap" style="display:none;">
  <div class="section__head">
    <h2>Dokumentasi</h2>
    <p>Intip keseruan ALIF tahun lalu.</p>
  </div>
  <div class="video-embed" id="beranda-video-embed"></div>
  <p id="beranda-video-fallback" style="text-align:center;display:none;"></p>
</section>

<section class="section container">
  <div class="section__head">
    <h2>Pilih Halaman</h2>
    <p>ALIF 5.0 punya dua kegiatan utama tahun ini -- pilih salah satu untuk lihat info lengkap & cara daftarnya.</p>
  </div>
  <div class="lomba-grid" id="beranda-nav-grid">
    <a href="#/lomba" class="lomba-card" id="beranda-card-lomba">
      <div class="lomba-card__main">
        <div class="lomba-card__icon">🏆</div>
        <h3>Lomba</h3>
        <p>Lima cabang lomba keagamaan untuk santri & pelajar SD–SMP: Adzan, Panahan, MHQ, Kaligrafi, dan Futsal.</p>
        <span class="lomba-card__cta" id="beranda-card-lomba-cta">Lihat cabang lomba &amp; daftar →</span>
      </div>
    </a>
    <a href="#/bazar" class="lomba-card" id="beranda-card-bazar">
      <div class="lomba-card__main">
        <div class="lomba-card__icon">🏪</div>
        <h3>Bazar</h3>
        <p>Buka stand/tenant usaha Anda di Bazar ALIF 5.0 -- ramaikan acara sekaligus promosikan produk.</p>
        <span class="lomba-card__cta" id="beranda-card-bazar-cta">Lihat info &amp; daftar stand →</span>
      </div>
    </a>
  </div>
</section>
`;

// Deskripsi default dipakai HANYA kalau panitia belum pernah mengisi
// profil_deskripsi lewat halaman Panitia "#/adminprofil" -- supaya Beranda
// tidak tampil kosong/aneh sebelum sempat diisi.
const BERANDA_DESKRIPSI_DEFAULT =
  "ALIF 5.0 (Al Azzaam Islamic Fair) adalah perhelatan tahunan PPTQ Al Azzaam yang mewadahi bakat santri dan pelajar lewat lomba keagamaan, sekaligus menghadirkan bazar UMKM untuk meramaikan acara. Jelajahi halaman Lomba dan Bazar di bawah untuk info lengkap & pendaftaran.";

function escapeHTMLBeranda(teks) {
  const div = document.createElement("div");
  div.textContent = String(teks == null ? "" : teks);
  return div.innerHTML;
}

// Ubah berbagai bentuk link YouTube (watch?v=, youtu.be/, /embed/, /shorts/)
// jadi URL embed "https://www.youtube.com/embed/<id>" -- return null kalau
// bukan link YouTube yang dikenali (link lain, mis. Instagram/Drive, TIDAK
// dipaksa di-iframe karena kebanyakan situs memblokir embed pihak ketiga --
// untuk kasus itu dipakaikan tombol tautan biasa, lihat pasangVideoProfil()).
function ekstrakEmbedYoutube(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    let id = null;
    if (u.hostname === "youtu.be") {
      id = u.pathname.slice(1);
    } else if (u.hostname.indexOf("youtube.com") !== -1) {
      if (u.pathname === "/watch") id = u.searchParams.get("v");
      else if (u.pathname.indexOf("/embed/") === 0) id = u.pathname.slice("/embed/".length);
      else if (u.pathname.indexOf("/shorts/") === 0) id = u.pathname.slice("/shorts/".length);
    }
    if (id) id = id.split("&")[0].split("?")[0].split("/")[0];
    return id ? ("https://www.youtube.com/embed/" + id) : null;
  } catch (e) {
    return null;
  }
}

function pasangVideoProfil(videoUrl) {
  const wrap = document.getElementById("beranda-video-wrap");
  const embedBox = document.getElementById("beranda-video-embed");
  const fallback = document.getElementById("beranda-video-fallback");
  if (!videoUrl) return; // tetap disembunyikan (display:none bawaan template)

  const embedUrl = ekstrakEmbedYoutube(videoUrl);
  wrap.style.display = "block";

  if (embedUrl) {
    embedBox.innerHTML = '<iframe src="' + embedUrl + '" title="Video Dokumentasi ALIF" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>';
  } else {
    // Bukan link YouTube yang dikenali -- tampilkan sebagai tautan biasa saja
    // (dibuka tab baru), tidak dipaksa jadi iframe.
    embedBox.style.display = "none";
    fallback.innerHTML = '<a href="' + escapeHTMLBeranda(videoUrl) + '" target="_blank" rel="noopener" class="btn btn--ghost">▶️ Tonton Video Dokumentasi</a>';
    fallback.style.display = "block";
  }
}

async function initBeranda() {
  const [{ data: site }, { data: bazarSettings }, { data: bazarTerisi }] = await Promise.all([
    supabaseClient.from("site_settings").select("profil_judul,profil_deskripsi,profil_video_url,pendaftaran_dibuka,tanggal_tutup_pendaftaran").eq("id", 1).single(),
    supabaseClient.from("bazar_settings").select("pendaftaran_dibuka,kuota_total").eq("id", 1).single(),
    supabaseClient.rpc("bazar_jumlah_terisi")
  ]);

  const judulEl = document.getElementById("beranda-judul");
  const deskripsiEl = document.getElementById("beranda-deskripsi");
  if (judulEl) judulEl.textContent = (site && site.profil_judul) || "ALIF 5.0";
  if (deskripsiEl) deskripsiEl.textContent = (site && site.profil_deskripsi) || BERANDA_DESKRIPSI_DEFAULT;

  pasangVideoProfil(site && site.profil_video_url);

  // -------- Badge kecil di kartu "Lomba" kalau pendaftaran lomba ditutup --------
  const statusLomba = window.hitungStatusPendaftaranAsli(site);
  const ctaLomba = document.getElementById("beranda-card-lomba-cta");
  if (ctaLomba && !statusLomba.dibuka) {
    ctaLomba.textContent = "🔒 Pendaftaran lomba sedang ditutup";
  }

  // -------- Badge kecil di kartu "Bazar" kalau pendaftaran/kuota bazar penuh --------
  const bazarDibuka = !bazarSettings || bazarSettings.pendaftaran_dibuka !== false;
  const kuotaTotal = bazarSettings ? bazarSettings.kuota_total : null;
  const terisi = typeof bazarTerisi === "number" ? bazarTerisi : 0;
  const bazarPenuh = kuotaTotal !== null && kuotaTotal !== undefined && terisi >= kuotaTotal;
  const ctaBazar = document.getElementById("beranda-card-bazar-cta");
  if (ctaBazar && (!bazarDibuka || bazarPenuh)) {
    ctaBazar.textContent = !bazarDibuka ? "🔒 Pendaftaran stand sedang ditutup" : "🚫 Kuota stand sudah penuh";
  }
}

window.ViewBeranda = { template: BERANDA_TEMPLATE, init: initBeranda };
