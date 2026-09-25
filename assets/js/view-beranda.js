// View: Beranda ("#/")

const BERANDA_TEMPLATE = `
<section class="hero container">
  <span class="hero__eyebrow">Al Azzaam Islamic Fair</span>
  <h1>Unjuk bakat, rebut juara di <em>ALIF 5.0</em></h1>
  <p class="lede">Lima cabang lomba untuk santri dan pelajar tingkat SD dan SMP. Daftar online, cukup lampirkan beberapa berkas singkat.</p>
  <div class="hero__actions">
    <a href="#/daftar" class="btn btn--primary" id="hero-cta-daftar">Daftar Sekarang</a>
    <a href="#lomba" class="btn btn--ghost">Lihat Cabang Lomba</a>
    <span id="juknis-btn-wrap"></span>
  </div>
  <div class="hero__stats">
    <div><strong>5</strong><span>Cabang lomba</span></div>
    <div><strong>SD–SMP</strong><span>Jenjang peserta</span></div>
    <div><strong>Online</strong><span>Pendaftaran & berkas</span></div>
  </div>
</section>

<section class="section container" id="lomba">
  <div class="section__head">
    <h2>Cabang lomba</h2>
    <p>Setiap cabang punya syarat jenjang dan usia sendiri (beda-beda tiap jenjang) — sistem akan memfilter otomatis saat kamu mengisi form pendaftaran.</p>
  </div>
  <div class="lomba-grid" id="lomba-grid">
    <p class="hint">Memuat data lomba...</p>
  </div>
</section>

<section class="section container">
  <div class="section__head">
    <h2>Syarat Berkas Pendaftaran</h2>
    <p>Siapkan berkas berikut dulu sebelum mulai mengisi form, supaya prosesnya lancar tanpa bolak-balik.</p>
  </div>
  <div class="syarat-card">
    <div class="syarat-item">
      <span class="syarat-item__icon">🪪</span>
      <div class="syarat-item__text">
        <strong>Kartu Pelajar / Surat Keterangan Aktif Sekolah</strong>
        <p>Unggah salah satu — kartu pelajar, atau surat keterangan aktif sekolah kalau kartu pelajar belum ada. Format JPG/PNG/PDF, maksimal 4MB.</p>
      </div>
    </div>
    <div class="syarat-item">
      <span class="syarat-item__icon">📸</span>
      <div class="syarat-item__text">
        <strong>Screenshot Bukti Follow Instagram</strong>
        <p>Follow <a href="https://instagram.com/al.azzaam.id" target="_blank" rel="noopener">@al.azzaam.id</a> dan <a href="https://instagram.com/alifest.26" target="_blank" rel="noopener">@alifest.26</a>, lalu screenshot halaman profil kedua akun (terlihat tombol "Following").</p>
      </div>
    </div>
    <div class="syarat-item">
      <span class="syarat-item__icon">📋</span>
      <div class="syarat-item__text">
        <strong>Surat Delegasi dari Sekolah <em>(khusus Lomba Futsal)</em></strong>
        <p>Surat resmi dari sekolah yang menugaskan tim mengikuti lomba. Hanya wajib untuk pendaftaran tim Futsal.</p>
      </div>
    </div>
  </div>
</section>

<section class="section container">
  <div class="info-banner">
    <div class="info-banner__item">
      <h4>Lomba tim</h4>
      <p>Lomba Futsal mewakili sekolah, satu tim terdiri dari 5–10 pemain ditambah satu guru pendamping.</p>
    </div>
    <div class="info-banner__item">
      <h4>Konfirmasi</h4>
      <p>Setelah mengisi form, kamu akan menerima nomor pendaftaran sebagai bukti — simpan baik-baik.</p>
    </div>
  </div>
</section>
`;

async function initBeranda() {
  muatTombolJuknis();

  const grid = document.getElementById("lomba-grid");
  if (!grid) return;

  const { data: rules, error: errRules } = await supabaseClient
    .from("lomba_rules").select("*").eq("aktif", true).order("urutan");

  if (errRules) {
    grid.innerHTML = '<p>Gagal memuat data lomba. Coba muat ulang halaman.</p>';
    console.error(errRules);
    return;
  }

  grid.innerHTML = rules.map(function (lomba) {
    const tipeLabel = lomba.tipe === "tim"
      ? "Tim (" + lomba.min_anggota + "–" + lomba.max_anggota + " orang)"
      : "Individu";

    const jumlahJenjang = (lomba.jenjang && lomba.jenjang.length) || 1;
    const kuotaLabel = lomba.kuota
      ? ("Maks " + Math.floor(lomba.kuota / jumlahJenjang) + "/jenjang/gender")
      : "Tidak dibatasi";

    const usiaRows = lomba.jenjang.map(function (j) {
      const r = (lomba.usia_per_jenjang || {})[j];
      const teks = r ? (r.min + "–" + r.max + " tahun") : "Belum diatur";
      return '<div class="stub-row"><span>Usia ' + j + '</span><strong>' + teks + '</strong></div>';
    }).join("");

    return (
      '<article class="lomba-card">' +
        '<div class="lomba-card__main">' +
          '<div class="lomba-card__icon">' + lomba.ikon + '</div>' +
          '<h3>' + lomba.nama + '</h3>' +
          '<p>' + lomba.deskripsi + '</p>' +
        '</div>' +
        '<div class="lomba-card__stub">' +
          '<div class="stub-row"><span>Jenjang</span><strong>' + lomba.jenjang.join(" · ") + '</strong></div>' +
          usiaRows +
          '<div class="stub-row"><span>Gender</span><strong>' + (lomba.gender_diizinkan === "semua" ? "Putra & Putri" : (lomba.gender_diizinkan === "laki-laki" ? "Khusus Putra" : "Khusus Putri")) + '</strong></div>' +
          '<div class="stub-row"><span>Tipe</span><strong>' + tipeLabel + '</strong></div>' +
          '<div class="stub-row"><span>Kuota</span><strong>' + kuotaLabel + '</strong></div>' +
        '</div>' +
      '</article>'
    );
  }).join("");
}

async function muatTombolJuknis() {
  const wrap = document.getElementById("juknis-btn-wrap");
  const { data } = await supabaseClient.from("site_settings").select("juknis_url,pendaftaran_dibuka").eq("id", 1).single();

  if (wrap && data && data.juknis_url) {
    wrap.innerHTML = '<a href="' + data.juknis_url + '" target="_blank" rel="noopener" class="btn btn--ghost">📄 Unduh Juknis</a>';
  }

  const dibuka = !data || data.pendaftaran_dibuka !== false;
  const heroCta = document.getElementById("hero-cta-daftar");
  if (heroCta) {
    heroCta.classList.toggle("is-locked", !dibuka);
    heroCta.innerHTML = dibuka ? "Daftar Sekarang" : "🔒 Daftar Sekarang";
  }
  if (typeof window.terapkanStatusPendaftaran === "function") window.terapkanStatusPendaftaran(dibuka);
}

window.ViewBeranda = { template: BERANDA_TEMPLATE, init: initBeranda };
