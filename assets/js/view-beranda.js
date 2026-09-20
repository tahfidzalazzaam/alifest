// View: Beranda ("#/")

const BERANDA_TEMPLATE = `
<section class="hero container">
  <span class="hero__eyebrow">Al Azzaam Islamic Fair</span>
  <h1>Unjuk bakat, rebut juara di <em>ALIF 5.0</em></h1>
  <p class="lede">Lima cabang lomba untuk santri dan pelajar tingkat SD, SMP, dan SMA. Daftar online, cukup lampirkan Surat Keterangan Aktif Sekolah, Kartu Pelajar, dan bukti follow Instagram.</p>
  <div class="hero__actions">
    <a href="#/daftar" class="btn btn--primary">Daftar Sekarang</a>
    <a href="#lomba" class="btn btn--ghost">Lihat Cabang Lomba</a>
    <span id="juknis-btn-wrap"></span>
  </div>
  <div class="hero__stats">
    <div><strong>5</strong><span>Cabang lomba</span></div>
    <div><strong>SD–SMA</strong><span>Jenjang peserta</span></div>
    <div><strong>Online</strong><span>Pendaftaran & berkas</span></div>
  </div>
</section>

<section class="section container" id="lomba">
  <div class="section__head">
    <h2>Cabang lomba</h2>
    <p>Setiap cabang punya syarat jenjang dan usia sendiri — sistem akan memfilter otomatis saat kamu mengisi form pendaftaran.</p>
  </div>
  <div class="lomba-grid" id="lomba-grid">
    <p class="hint">Memuat data lomba...</p>
  </div>
</section>

<section class="section container">
  <div class="info-banner">
    <div class="info-banner__item">
      <h4>Berkas yang perlu disiapkan</h4>
      <p>Surat Keterangan Aktif Sekolah, Kartu Pelajar, dan screenshot bukti follow Instagram <strong>@al.azzaam.id</strong> &amp; <strong>@alifest.26</strong> (JPG/PNG/PDF, maksimal 4MB per berkas).</p>
    </div>
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

  const [{ data: rules, error: errRules }, { data: counters }] = await Promise.all([
    supabaseClient.from("lomba_rules").select("*").eq("aktif", true).order("urutan"),
    supabaseClient.from("lomba_counter").select("*")
  ]);

  if (errRules) {
    grid.innerHTML = '<p>Gagal memuat data lomba. Coba muat ulang halaman.</p>';
    console.error(errRules);
    return;
  }

  const jumlahMap = {};
  (counters || []).forEach(function (c) { jumlahMap[c.lomba_id] = c.jumlah; });

  grid.innerHTML = rules.map(function (lomba) {
    const tipeLabel = lomba.tipe === "tim"
      ? "Tim (" + lomba.min_anggota + "–" + lomba.max_anggota + " orang)"
      : "Individu";

    const terisi = jumlahMap[lomba.id] || 0;
    const kuotaLabel = lomba.kuota
      ? (terisi >= lomba.kuota ? "Penuh" : terisi + " / " + lomba.kuota)
      : "Tidak dibatasi";

    return (
      '<article class="lomba-card">' +
        '<div class="lomba-card__main">' +
          '<div class="lomba-card__icon">' + lomba.ikon + '</div>' +
          '<h3>' + lomba.nama + '</h3>' +
          '<p>' + lomba.deskripsi + '</p>' +
        '</div>' +
        '<div class="lomba-card__stub">' +
          '<div class="stub-row"><span>Jenjang</span><strong>' + lomba.jenjang.join(" · ") + '</strong></div>' +
          '<div class="stub-row"><span>Usia</span><strong>' + lomba.usia_min + '–' + lomba.usia_max + ' tahun</strong></div>' +
          '<div class="stub-row"><span>Tipe</span><strong>' + tipeLabel + '</strong></div>' +
          '<div class="stub-row"><span>Kuota</span><strong>' + kuotaLabel + '</strong></div>' +
        '</div>' +
      '</article>'
    );
  }).join("");
}

async function muatTombolJuknis() {
  const wrap = document.getElementById("juknis-btn-wrap");
  if (!wrap) return;
  const { data } = await supabaseClient.from("site_settings").select("juknis_url").eq("id", 1).single();
  if (data && data.juknis_url) {
    wrap.innerHTML = '<a href="' + data.juknis_url + '" target="_blank" rel="noopener" class="btn btn--ghost">📄 Unduh Juknis</a>';
  }
}

window.ViewBeranda = { template: BERANDA_TEMPLATE, init: initBeranda };
