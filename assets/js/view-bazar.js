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
    <p>Tiga jenis stand yang tersedia, masing-masing punya area & kuota sendiri -- klik salah satu kartu untuk lihat denah & stand yang sudah terisi, atau pilih lokasi persisnya saat mengisi form pendaftaran.</p>
  </div>
  <div id="bazar-jenis-list">
    <p class="hint">Memuat jenis stand...</p>
  </div>

  <div id="bazar-denah-info-wrap" style="display:none;margin-top:18px;" class="syarat-card">
    <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:4px;">
      <strong id="bazar-denah-info-judul">Denah Jenis</strong>
      <button type="button" class="btn btn--ghost" id="bazar-denah-info-tutup" style="padding:4px 12px;font-size:0.82rem;">Tutup denah ✕</button>
    </div>
    <div id="bazar-denah-info-legenda"></div>
    <div style="padding:14px 10px 6px;">
      <div id="bazar-denah-info-outer" style="width:100%;max-width:900px;overflow:hidden;position:relative;border:2px dashed #b9d9c2;border-radius:16px;background:#eef7ec;margin:0 auto;">
        <div id="bazar-denah-info-inner" style="position:absolute;top:0;left:0;transform-origin:top left;"></div>
      </div>
    </div>
  </div>
</section>

<section class="section container">
  <div class="section__head">
    <h2>Yang Perlu Disiapkan</h2>
    <p>Siapkan berkas berikut dulu sebelum mengisi form, supaya prosesnya lancar tanpa bolak-balik.</p>
  </div>
  <div class="syarat-card">
    <div class="syarat-item">
      <span class="syarat-item__icon">🏷️</span>
      <div class="syarat-item__text">
        <strong>Logo Usaha & Foto Poster Promosi</strong>
        <p>Logo usaha/stand Anda, dan satu foto/poster promosi produk -- dipakai panitia untuk verifikasi & promosi bazar. Format JPG/PNG, maksimal 4MB per file.</p>
      </div>
    </div>
    <div class="syarat-item">
      <span class="syarat-item__icon">📱</span>
      <div class="syarat-item__text">
        <strong>Bukti Follow Instagram</strong>
        <p>Screenshot halaman profil <a href="https://instagram.com/al.azzaam.id" target="_blank" rel="noopener">@al.azzaam.id</a> dan <a href="https://instagram.com/alifest.26" target="_blank" rel="noopener">@alifest.26</a> (terlihat tombol "Following"), satu screenshot per akun.</p>
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
// Migrasi 0043: "Tutup Total Bazar" (bazar_settings.tutup_total, migrasi
// 0035) DIHAPUS dari aplikasi -- halaman info publik "/bazar" ini sekarang
// SELALU bisa dibuka siapa saja, apa pun status pendaftaran. Kolom
// `tutup_total` dibiarkan ada di database (additive-only) tapi sudah tidak
// dibaca di sini lagi. Hanya "/daftar-bazar" (form) yang masih bisa
// dikunci, lewat tombol satu-klik di "/adminbazar" (lihat view-daftarbazar.js).

// Urutan tampil jenis stand -- tetap A, B, C apa pun urutan key di jsonb.
const URUTAN_JENIS_STAND_INFO = ["A", "B", "C"];

function formatRupiahBazarInfo(angka) {
  return "Rp" + Number(angka || 0).toLocaleString("id-ID");
}

// -------- Denah READ-ONLY murni informatif, dibuka saat pengunjung klik
// salah satu kartu jenis stand (lihat renderDenahInfo() di bawah) -- MIRIP
// picker di view-daftarbazar.js (kanvas virtual discaling ke lebar
// kontainer), tapi di sini TIDAK ADA apa pun yang bisa diklik/dipilih
// (murni lihat-lihat), dan kotak yang SUDAH TERISI menampilkan nama usaha
// tenant-nya (dari RPC publik `bazar_denah_publik()`, migrasi 0042 -- CUMA
// nama usaha yang diekspos, bukan WhatsApp/penanggung jawab). Konstanta
// kanvas & warna SENGAJA diberi nama sendiri (akhiran `_INFO`) -- file ini
// dimuat sebagai <script> klasik berbagi satu scope global dengan
// view-daftarbazar.js & view-adminbazar.js, jadi nama identik akan tabrakan
// `SyntaxError: Identifier '...' has already been declared` (lihat catatan
// panjang soal bug ini di bagian atas file ini & view-daftarbazar.js).
const DENAH_INFO_CANVAS_W = 760;
const DENAH_INFO_CANVAS_H = 600;
const WARNA_JENIS_DENAH_INFO = { A: "#e08a2e", B: "#3f7fb0", C: "#d1588f" };
let _denahInfoResizeHandler = null;

function labelRingkasKodeBazarInfo(kode) {
  const bagian = String(kode || "").split("-");
  if (bagian.length >= 3) {
    const nomor = parseInt(bagian[bagian.length - 1], 10);
    return bagian.slice(1, -1).join("-") + "-" + (isNaN(nomor) ? bagian[bagian.length - 1] : nomor);
  }
  if (bagian.length === 2) {
    const nomor = parseInt(bagian[1], 10);
    return "DM-" + (isNaN(nomor) ? bagian[1] : nomor);
  }
  return kode;
}

function buatKotakDenahInfo(opsi) {
  const el = document.createElement("div");
  el.style.position = "absolute";
  el.style.left = opsi.x + "px";
  el.style.top = opsi.y + "px";
  el.style.width = opsi.w + "px";
  el.style.height = opsi.h + "px";
  el.style.transformOrigin = "50% 50%";
  el.style.transform = "rotate(" + (opsi.rotasi || 0) + "deg)";
  el.style.borderRadius = "6px";
  el.style.display = "flex";
  el.style.flexDirection = "column";
  el.style.alignItems = "center";
  el.style.justifyContent = "center";
  el.style.textAlign = "center";
  el.style.fontWeight = "700";
  el.style.lineHeight = "1.15";
  el.style.padding = "2px";
  el.style.boxSizing = "border-box";
  el.style.fontSize = Math.max(8, Math.min(26, Math.min(opsi.w, opsi.h) / 3.2)) + "px";
  el.style.border = "1.5px solid rgba(0,0,0,0.15)";
  el.style.userSelect = "none";

  if (opsi.tipeLabel) {
    el.style.background = opsi.warnaBg || "#eef3ea";
    el.style.color = opsi.warnaTeks || "#4b5f4d";
    el.style.opacity = "0.6";
    el.innerHTML =
      (opsi.sublabel ? ('<span style="display:block;font-size:1.3em;">' + escapeHTMLBazarInfo(opsi.sublabel) + '</span>') : "") +
      '<span>' + escapeHTMLBazarInfo(opsi.label) + '</span>';
    return el;
  }

  const warnaDasar = WARNA_JENIS_DENAH_INFO[opsi.jenis] || "#777777";
  el.textContent = labelRingkasKodeBazarInfo(opsi.kode);

  if (opsi.terisi) {
    el.style.background = "#fde8e8";
    el.style.color = "#b91c1c";
    el.title = opsi.kode + (opsi.namaUsaha ? (" -- sudah terisi: " + opsi.namaUsaha) : " -- sudah terisi.");
  } else {
    el.style.background = warnaDasar;
    el.style.color = "#ffffff";
    el.title = opsi.kode + " -- masih tersedia.";
  }
  return el;
}

// Dipanggil sekali di awal (bersamaan dengan data lain) supaya saat kartu
// jenis diklik, denahnya langsung tampil tanpa nunggu fetch lagi.
async function renderDenahInfo(jenis, standList, elemenList, namaTenantByKode) {
  const wrap = document.getElementById("bazar-denah-info-wrap");
  const judulEl = document.getElementById("bazar-denah-info-judul");
  const legendaEl = document.getElementById("bazar-denah-info-legenda");
  const outerEl = document.getElementById("bazar-denah-info-outer");
  const innerEl = document.getElementById("bazar-denah-info-inner");
  if (!wrap) return;

  judulEl.textContent = "Denah Jenis " + jenis;
  const warnaJenisAktif = WARNA_JENIS_DENAH_INFO[jenis] || "#777777";
  legendaEl.innerHTML =
    '<div style="display:flex;flex-wrap:wrap;gap:14px;margin:8px 0 2px;font-size:12.5px;color:#4b5563;">' +
      '<span style="display:inline-flex;align-items:center;gap:5px;"><span style="width:14px;height:14px;border-radius:3px;background:' + warnaJenisAktif + ';display:inline-block;"></span>Tersedia</span>' +
      '<span style="display:inline-flex;align-items:center;gap:5px;"><span style="width:14px;height:14px;border-radius:3px;background:#fde8e8;border:1px solid #f3b4b4;display:inline-block;"></span>Sudah terisi (arahkan kursor/tahan kotaknya untuk lihat nama usahanya)</span>' +
    '</div>';

  innerEl.style.width = DENAH_INFO_CANVAS_W + "px";
  innerEl.style.height = DENAH_INFO_CANVAS_H + "px";
  innerEl.innerHTML = "";

  elemenList.forEach(function (elm) {
    innerEl.appendChild(buatKotakDenahInfo({
      tipeLabel: true,
      x: elm.pos_x, y: elm.pos_y, w: elm.lebar, h: elm.tinggi, rotasi: elm.rotasi,
      warnaBg: elm.warna_bg, warnaTeks: elm.warna_teks,
      label: elm.teks, sublabel: elm.emoji
    }));
  });
  standList.filter(function (s) { return s.jenis === jenis; }).forEach(function (s) {
    innerEl.appendChild(buatKotakDenahInfo({
      kode: s.kode, jenis: s.jenis,
      x: s.pos_x != null ? s.pos_x : 20, y: s.pos_y != null ? s.pos_y : 20,
      w: s.lebar || 54, h: s.tinggi || 40, rotasi: s.rotasi || 0,
      terisi: !!s.tenant_id,
      namaUsaha: namaTenantByKode[s.kode] || null
    }));
  });

  function terapkanSkalaDenahInfo() {
    if (!outerEl.clientWidth) return;
    const scale = outerEl.clientWidth / DENAH_INFO_CANVAS_W;
    innerEl.style.transform = "scale(" + scale + ")";
    outerEl.style.height = (DENAH_INFO_CANVAS_H * scale) + "px";
  }
  terapkanSkalaDenahInfo();
  if (_denahInfoResizeHandler) window.removeEventListener("resize", _denahInfoResizeHandler);
  _denahInfoResizeHandler = terapkanSkalaDenahInfo;
  window.addEventListener("resize", _denahInfoResizeHandler);

  wrap.style.display = "block";
  wrap.scrollIntoView({ behavior: "smooth", block: "center" });
}

async function initBazar() {
  const [{ data: settings }, { data: standData }, { data: elemenData }, { data: tenantPublik }] = await Promise.all([
    supabaseClient.from("bazar_settings").select("profil_judul,profil_deskripsi,pendaftaran_dibuka,jenis_stand_info,info_biaya,info_rekening").eq("id", 1).single(),
    supabaseClient.from("bazar_stand").select("jenis,area,kode,tenant_id,pos_x,pos_y,lebar,tinggi,rotasi"),
    supabaseClient.from("bazar_denah_elemen").select("*").order("urutan"),
    supabaseClient.rpc("bazar_denah_publik")
  ]);
  const elemenList = elemenData || [];
  const namaTenantByKode = {};
  (tenantPublik || []).forEach(function (r) { namaTenantByKode[r.kode] = r.nama_usaha; });

  const judulEl = document.getElementById("bazar-judul");
  const deskripsiEl = document.getElementById("bazar-deskripsi");
  if (judulEl) judulEl.textContent = (settings && settings.profil_judul) || "Bazar ALIF 5.0";
  if (deskripsiEl) deskripsiEl.textContent = (settings && settings.profil_deskripsi) || BAZAR_DESKRIPSI_DEFAULT;

  const pendaftaranDibuka = !settings || settings.pendaftaran_dibuka !== false;
  const jenisStandInfo = (settings && settings.jenis_stand_info) || {};
  const standList = standData || [];
  const semuaPenuh = standList.length > 0 && standList.every(function (s) { return !!s.tenant_id; });

  // -------- Jenis & Lokasi Stand (migrasi 0037) -- satu kartu per jenis
  // (A/B/C), menampilkan ukuran, harga, daftar area & jumlah TERPAKAI tiap
  // area (bukan "sisa" lagi -- permintaan: tampilkan yang sudah terpakai,
  // bukan yang masih tersisa). Kartunya juga BISA DIKLIK (lihat listener di
  // bawah) untuk membuka denah jenis itu lengkap dengan status tiap stand +
  // nama tenant yang sudah menempatinya (renderDenahInfo() di atas).
  const jenisListEl = document.getElementById("bazar-jenis-list");
  if (jenisListEl) {
    jenisListEl.innerHTML = URUTAN_JENIS_STAND_INFO.filter(function (j) { return jenisStandInfo[j]; }).map(function (j) {
      const info = jenisStandInfo[j];
      const standJenisIni = standList.filter(function (s) { return s.jenis === j; });
      const areaList = [];
      standJenisIni.forEach(function (s) { if (areaList.indexOf(s.area) === -1) areaList.push(s.area); });
      const rincianArea = areaList.map(function (area) {
        const standArea = standJenisIni.filter(function (s) { return s.area === area; });
        const terpakaiArea = standArea.filter(function (s) { return !!s.tenant_id; }).length;
        return area + " (terpakai " + terpakaiArea + "/" + standArea.length + ")";
      }).join(", ");
      const terpakaiJenis = standJenisIni.filter(function (s) { return !!s.tenant_id; }).length;
      const semuaPenuhJenis = standJenisIni.length > 0 && terpakaiJenis === standJenisIni.length;
      return (
        '<div class="syarat-card jenis-stand-card" data-jenis="' + j + '" style="margin-bottom:14px;cursor:pointer;" role="button" tabindex="0">' +
          '<div class="syarat-item">' +
            '<span class="syarat-item__icon">🏪</span>' +
            '<div class="syarat-item__text">' +
              '<strong>' + escapeHTMLBazarInfo(info.nama || ("Jenis " + j)) + ' — ' + escapeHTMLBazarInfo(info.ukuran || "-") + ' — ' + formatRupiahBazarInfo(info.harga) + '</strong>' +
              '<p>Area: ' + escapeHTMLBazarInfo(rincianArea || "-") + '.' +
              (semuaPenuhJenis ? ' <strong style="color:#9C2B30;">Sudah penuh.</strong>' : (' Total terpakai ' + terpakaiJenis + ' dari ' + standJenisIni.length + ' stand.')) +
              ' <span style="color:#1E7A4C;font-weight:600;">Klik untuk lihat denah ↓</span>' +
              '</p>' +
            '</div>' +
          '</div>' +
        '</div>'
      );
    }).join("");

    jenisListEl.querySelectorAll(".jenis-stand-card").forEach(function (card) {
      function bukaDenahKartu() { renderDenahInfo(card.getAttribute("data-jenis"), standList, elemenList, namaTenantByKode); }
      card.addEventListener("click", bukaDenahKartu);
      card.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); bukaDenahKartu(); } });
    });
  }

  const tutupDenahInfoBtn = document.getElementById("bazar-denah-info-tutup");
  if (tutupDenahInfoBtn) {
    tutupDenahInfoBtn.addEventListener("click", function () {
      document.getElementById("bazar-denah-info-wrap").style.display = "none";
    });
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
