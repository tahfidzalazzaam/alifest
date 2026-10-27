// View: Panitia ("#/admin") — login khusus panitia (Supabase Auth), lalu
// tiga tab: Data Pendaftar, Kelola Lomba, Logo Situs.
//
// Akun panitia TIDAK bisa didaftarkan sendiri lewat situs ini — hanya bisa
// dibuat oleh pengelola lewat Supabase Dashboard -> Authentication -> Users.
// Lihat README.md bagian "Setup Halaman Panitia".

const ADMIN_TEMPLATE = `
<main class="admin-page container">
  <div id="admin-root"></div>
</main>
`;

async function initAdmin() {
  const root = document.getElementById("admin-root");
  root.innerHTML = '<p class="hint">Memeriksa sesi masuk...</p>';

  const { data } = await supabaseClient.auth.getSession();
  if (data && data.session) {
    renderDashboard(root, data.session);
  } else {
    renderLogin(root);
  }
}

/* ==================== LOGIN ==================== */

function renderLogin(root) {
  root.innerHTML =
    '<div class="form-shell admin-login">' +
      '<h1>Masuk Panitia</h1>' +
      '<p>Khusus tim panitia ALIF 5.0. Belum punya akun? Minta dibuatkan oleh pengelola situs.</p>' +
      '<form id="form-login" novalidate>' +
        '<div class="field">' +
          '<label for="admin-email">Email</label>' +
          '<input type="email" id="admin-email" required />' +
        '</div>' +
        '<div class="field">' +
          '<label for="admin-password">Kata Sandi</label>' +
          '<input type="password" id="admin-password" required />' +
        '</div>' +
        '<div class="form-error" id="login-error" style="display:none;"></div>' +
        '<div class="submit-row">' +
          '<button type="submit" class="btn btn--primary" id="btn-login">Masuk</button>' +
        '</div>' +
      '</form>' +
    '</div>';

  const form = document.getElementById("form-login");
  const errorEl = document.getElementById("login-error");
  const btn = document.getElementById("btn-login");

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    errorEl.style.display = "none";
    btn.disabled = true;
    btn.textContent = "Memeriksa...";

    const email = document.getElementById("admin-email").value.trim();
    const password = document.getElementById("admin-password").value;
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email: email, password: password });

    btn.disabled = false;
    btn.textContent = "Masuk";

    if (error) {
      errorEl.textContent = "Gagal masuk: email atau kata sandi salah.";
      errorEl.style.display = "block";
      return;
    }
    renderDashboard(root, data.session);
  });
}

/* ==================== DASHBOARD SHELL ==================== */

// Status tanggal tutup otomatis & saklar manual pendaftaran -- disimpan di
// level modul (bukan di dalam renderDashboard) supaya bisa dibaca/diubah
// juga dari tab "Kelola Lomba" (lihat kotak ringkas di loadTabLomba, migrasi
// 0022), yang letaknya sengaja dipindah ke sana (bukan lagi tampil di semua
// tab seperti sebelumnya) tapi tombol besar "Dibuka/Ditutup" di admin-header
// tetap perlu tahu status tanggal tutup ini untuk menentukan gaya/tulisannya.
let statusDibukaManual = true; // site_settings.pendaftaran_dibuka
let tanggalTutupOtomatis = null; // site_settings.tanggal_tutup_pendaftaran (ISO) atau null

function tutupOtomatisAktif() {
  return !!(tanggalTutupOtomatis && new Date() > new Date(tanggalTutupOtomatis));
}

function formatTanggalJamTutup(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "-";
  return d.toLocaleString("id-ID", { dateStyle: "long", timeStyle: "short" });
}

// Input datetime-local tidak menyimpan info zona waktu -- nilainya
// diperlakukan sebagai jam LOKAL browser, jadi dikonversi ke/dari objek Date
// supaya tetap konsisten disimpan sebagai timestamptz di database.
function isoKeDatetimeLocal(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = function (n) { return String(n).padStart(2, "0"); };
  return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) +
    "T" + pad(d.getHours()) + ":" + pad(d.getMinutes());
}

function perbaruiTombolToggle() {
  const btnToggle = document.getElementById("btn-toggle-pendaftaran");
  if (!btnToggle) return; // elemen ini cuma ada selama halaman Panitia terbuka
  const otomatisAktif = tutupOtomatisAktif();
  btnToggle.className = "btn " + (statusDibukaManual && !otomatisAktif ? "btn--primary" : "btn--ghost");
  btnToggle.textContent = statusDibukaManual ? "🟢 Pendaftaran Dibuka" : "🔒 Pendaftaran Ditutup";
  btnToggle.title = statusDibukaManual ? "Ketuk untuk menutup pendaftaran" : "Ketuk untuk membuka pendaftaran";
}

async function renderDashboard(root, session) {
  const { data: settings } = await supabaseClient.from("site_settings").select("pendaftaran_dibuka, tanggal_tutup_pendaftaran").eq("id", 1).single();
  statusDibukaManual = !settings || settings.pendaftaran_dibuka !== false;
  tanggalTutupOtomatis = (settings && settings.tanggal_tutup_pendaftaran) || null; // ISO string atau null

  root.innerHTML =
    '<div class="admin-header">' +
      '<div><h1>Panel Panitia</h1><p>Masuk sebagai ' + session.user.email + '</p></div>' +
      '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">' +
        '<button type="button" id="btn-notif-realtime-lomba"></button>' +
        '<button type="button" id="btn-toggle-pendaftaran"></button>' +
        '<button type="button" class="btn btn--ghost" id="btn-logout">Keluar</button>' +
      '</div>' +
    '</div>' +
    '<div class="admin-tabs">' +
      '<button type="button" class="admin-tab is-active" data-tab="pendaftar">Data Pendaftar</button>' +
      '<button type="button" class="admin-tab" data-tab="pendamping">Data Pendamping</button>' +
      '<button type="button" class="admin-tab" data-tab="lomba">Kelola Lomba</button>' +
      '<button type="button" class="admin-tab" data-tab="logo">Logo Situs</button>' +
      '<button type="button" class="admin-tab" data-tab="juknis">Petunjuk Teknis</button>' +
      '<button type="button" class="admin-tab" data-tab="kartu">Kartu Peserta</button>' +
      '<button type="button" class="admin-tab" data-tab="notifwa">Notifikasi WA</button>' +
    '</div>' +
    '<div id="admin-content"></div>' +
    '<div class="modal-overlay" id="modal-overlay" style="display:none;">' +
      '<div class="modal-box" id="modal-box"></div>' +
    '</div>' +
    // Panel detail Pendaftar (Lomba) -- DOCKED DI KANAN layar ala "preview
    // pane" File Explorer Windows, permintaan panitia (beda dari popup
    // tengah ".modal-overlay" di atas yang masih dipakai modal LAIN).
    // Lihat bukaPanelDetail()/tutupPanelDetail() di bawah & CSS
    // ".detail-panel..." di style.css.
    '<div class="detail-panel-overlay" id="detail-panel-overlay">' +
      '<div class="detail-panel" id="detail-panel">' +
        '<div class="detail-panel__header">' +
          '<h3 id="detail-panel-title"></h3>' +
          '<button type="button" class="modal-close" id="detail-panel-close-btn" aria-label="Tutup">&times;</button>' +
        '</div>' +
        '<div class="detail-panel__body" id="detail-panel-body"></div>' +
      '</div>' +
    '</div>';

  const btnToggle = document.getElementById("btn-toggle-pendaftaran");
  perbaruiTombolToggle();

  // Statusnya diperbarui tiap menit, supaya kalau panitia membiarkan
  // halaman ini terbuka pas waktu tutup otomatis lewat, tombol besar ini
  // ikut berubah tanpa perlu memuat ulang halaman.
  setInterval(perbaruiTombolToggle, 60000);

  btnToggle.addEventListener("click", async function () {
    const aksi = statusDibukaManual ? "menutup" : "membuka";
    if (!confirm('Yakin ingin ' + aksi + ' pendaftaran? Perubahan langsung berlaku di situs publik.')) return;

    btnToggle.disabled = true;
    const { error } = await supabaseClient.from("site_settings").update({ pendaftaran_dibuka: !statusDibukaManual }).eq("id", 1);
    btnToggle.disabled = false;

    if (error) {
      alert("Gagal mengubah status: " + error.message);
      return;
    }
    statusDibukaManual = !statusDibukaManual;
    perbaruiTombolToggle();
  });

  document.getElementById("btn-logout").addEventListener("click", async function () {
    await supabaseClient.auth.signOut();
    renderLogin(root);
  });

  // Notifikasi realtime pendaftar baru (migrasi 0051) -- lihat blok besar
  // di bawah file ini untuk detail lengkapnya.
  perbaruiTombolNotifikasiLomba();
  document.getElementById("btn-notif-realtime-lomba").addEventListener("click", aktifkanNotifikasiLomba);
  aktifkanRealtimePendaftarBaruLomba();

  const tabs = root.querySelectorAll(".admin-tab");
  tabs.forEach(function (tab) {
    tab.addEventListener("click", function () {
      tabs.forEach(function (t) { t.classList.remove("is-active"); });
      tab.classList.add("is-active");
      const nama = tab.getAttribute("data-tab");
      if (nama === "pendaftar") loadTabPendaftar();
      if (nama === "pendamping") loadTabPendamping();
      if (nama === "lomba") loadTabLomba();
      if (nama === "logo") loadTabLogo();
      if (nama === "juknis") loadTabJuknis();
      if (nama === "kartu") loadTabKartu();
      if (nama === "notifwa") loadTabNotifWa();
    });
  });

  loadTabPendaftar();
}

/* ==================== NOTIFIKASI REALTIME PENDAFTAR BARU (migrasi 0051) ====================
   Menggantikan Edge Function Fonnte untuk memberi tahu panitia ada
   pendaftar BARU -- wa.me TIDAK BISA dipakai untuk arah ini (wa.me wajib
   diklik seseorang, dan saat pendaftar baru masuk dari halaman publik
   tidak ada panitia yang "mengklik" apa pun saat itu). Sebagai gantinya,
   selama tab "/admin" ini TERBUKA, halaman berlangganan (subscribe) lewat
   Supabase Realtime ke tabel `pendaftaran` (publication diaktifkan di
   migrasi 0051) dan menampilkan Notifikasi Browser (Web Notifications API)
   + banner di dalam halaman begitu ada baris baru masuk.

   PENTING: ini BUKAN notifikasi push ala PWA -- tidak perlu "Add to Home
   Screen"/instal apa pun, tapi juga TIDAK bisa membangunkan notifikasi
   saat tab ini TERTUTUP (beda dari push notification aplikasi native/PWA
   yang didaftarkan lewat service worker). Hanya aktif selama tab ini
   terbuka & izin notifikasi browser sudah diberikan -- persis seperti
   notifikasi instan aplikasi desktop biasa (bukan PWA) selagi aplikasinya
   berjalan. */
let _realtimeChannelLomba = null;

function perbaruiTombolNotifikasiLomba() {
  const btn = document.getElementById("btn-notif-realtime-lomba");
  if (!btn) return;
  if (typeof Notification === "undefined") {
    btn.textContent = "🔕 Notifikasi tidak didukung browser ini";
    btn.className = "btn btn--ghost";
    btn.disabled = true;
    return;
  }
  if (Notification.permission === "granted") {
    btn.textContent = "🔔 Notifikasi Pendaftar Baru: Aktif";
    btn.className = "btn btn--ghost";
  } else if (Notification.permission === "denied") {
    btn.textContent = "🔕 Notifikasi diblokir (ubah di setelan situs browser)";
    btn.className = "btn btn--ghost";
  } else {
    btn.textContent = "🔔 Aktifkan Notifikasi Pendaftar Baru";
    btn.className = "btn btn--primary";
  }
}

async function aktifkanNotifikasiLomba() {
  if (typeof Notification === "undefined") return;
  if (Notification.permission === "default") {
    try { await Notification.requestPermission(); } catch (e) { /* abaikan, beberapa browser lama memakai API callback */ }
  }
  perbaruiTombolNotifikasiLomba();
}

function tampilkanBannerPendaftarBaruLomba(teks) {
  const lama = document.getElementById("banner-pendaftar-baru-lomba");
  if (lama) lama.remove();
  const banner = document.createElement("div");
  banner.id = "banner-pendaftar-baru-lomba";
  banner.className = "banner-pendaftar-baru";
  banner.innerHTML =
    '<span>🔔 ' + escapeHTML(teks) + '</span>' +
    '<span>' +
      '<button type="button" class="btn-link" id="btn-muat-ulang-banner-lomba">Muat Ulang</button> · ' +
      '<button type="button" class="btn-link" id="btn-tutup-banner-lomba">Tutup</button>' +
    '</span>';
  const content = document.getElementById("admin-content");
  if (content && content.parentNode) content.parentNode.insertBefore(banner, content);
  document.getElementById("btn-tutup-banner-lomba").addEventListener("click", function () { banner.remove(); });
  document.getElementById("btn-muat-ulang-banner-lomba").addEventListener("click", function () {
    banner.remove();
    loadTabPendaftar();
  });
}

// Dipanggil SATU KALI per sesi dashboard terbuka (renderDashboard) -- cek
// `_realtimeChannelLomba` dulu supaya tidak dobel subscribe kalau fungsi ini
// entah bagaimana terpanggil lagi (mis. panitia logout lalu login ulang
// tanpa memuat ulang halaman penuh).
function aktifkanRealtimePendaftarBaruLomba() {
  if (_realtimeChannelLomba) return;
  _realtimeChannelLomba = supabaseClient
    .channel("realtime-pendaftar-baru-lomba")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "pendaftaran" }, function (payload) {
      const r = payload.new || {};
      const nama = r.tipe === "tim" ? (r.nama_tim || r.nama_lengkap) : r.nama_lengkap;
      const teks = "Pendaftar baru: " + (nama || "-") + " (" + (r.lomba_nama || r.lomba_id || "-") + ")";
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        try { new Notification("ALIF 5.0 — Pendaftar Baru", { body: teks }); } catch (e) { console.warn("Gagal menampilkan notifikasi browser:", e); }
      }
      tampilkanBannerPendaftarBaruLomba(teks);
    })
    .subscribe();
}

/* ==================== MODAL (dipakai untuk popup detail tim) ==================== */

function bukaModal(judul, isiHTML) {
  const overlay = document.getElementById("modal-overlay");
  const box = document.getElementById("modal-box");
  box.innerHTML =
    '<div class="modal-box__header">' +
      '<h3>' + judul + '</h3>' +
      '<button type="button" class="modal-close" id="modal-close-btn" aria-label="Tutup">&times;</button>' +
    '</div>' +
    '<div class="modal-box__body">' + isiHTML + '</div>';
  overlay.style.display = "flex";
  document.getElementById("modal-close-btn").addEventListener("click", tutupModal);
  overlay.onclick = function (e) { if (e.target === overlay) tutupModal(); };
}

function tutupModal() {
  document.getElementById("modal-overlay").style.display = "none";
}

/* ==================== PANEL DETAIL PENDAFTAR (docked kanan) ====================
   Permintaan panitia: popup "Detail Peserta"/"Detail Tim" (tab "Data
   Pendaftar") dipindah dari modal tengah ke PANEL DI SISI KANAN layar,
   meniru panel preview file di Windows Explorer (daftar/tabel di
   belakangnya tetap kelihatan, TIDAK digelapkan seperti modal biasa).

   Dipakai KHUSUS untuk flow ini & sub-layarnya (Edit Data, Alasan
   Penolakan) -- bukaModalIndividu()/bukaModalTim()/
   bukaModalIndividuEdit()/bukaModalTimEdit()/bukaModalAlasanPenolakanPopup()
   di bawah semuanya dipindah memakai bukaPanelDetail()/tutupPanelDetail()
   ini, BUKAN bukaModal()/tutupModal() lagi. Popup/modal LAIN di halaman
   Panitia (Kelola Lomba, Data Pendamping, dst) TIDAK ikut berubah, tetap
   modal tengah seperti sebelumnya -- dua pasang fungsi ini sengaja dibuat
   terpisah (bukan menambah parameter "mode" ke bukaModal()) supaya
   perubahan di satu tidak berisiko mematahkan yang lain. */
function bukaPanelDetail(judul, isiHTML) {
  const overlay = document.getElementById("detail-panel-overlay");
  document.getElementById("detail-panel-title").textContent = judul;
  document.getElementById("detail-panel-body").innerHTML = isiHTML;
  overlay.classList.add("is-visible");
  document.getElementById("detail-panel-close-btn").addEventListener("click", tutupPanelDetail);
  overlay.onclick = function (e) { if (e.target === overlay) tutupPanelDetail(); };
}

function tutupPanelDetail() {
  document.getElementById("detail-panel-overlay").classList.remove("is-visible");
}

/* ==================== TAB 1: DATA PENDAFTAR ==================== */

/* ==================== Helper: hapus berkas & mundurkan nomor urut ==================== */

const BULAN_ID = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

// "2013-05-12" -> "12 Mei 2013". Parsing manual (bukan lewat objek Date)
// supaya tidak meleset sehari akibat konversi zona waktu.
function formatTanggalLahir(tgl) {
  if (!tgl) return "-";
  const bagian = String(tgl).split("-");
  if (bagian.length !== 3) return tgl;
  const tahun = bagian[0];
  const bulan = BULAN_ID[parseInt(bagian[1], 10) - 1] || bagian[1];
  const hari = parseInt(bagian[2], 10);
  return hari + " " + bulan + " " + tahun;
}

// Usia pada tanggal acuan tertentu (default: hari ini kalau acuanStr kosong)
// -- dipakai untuk menampilkan usia anggota tim di popup detail tim (dengan
// acuan hari ini, kolom "Usia"), dan sejak migrasi 0018 juga dipakai untuk
// menyorot anggota yang usianya di luar syarat jenjang PADA TANGGAL
// PELAKSANAAN lomba (dengan acuan tanggal_pelaksanaan) -- meniru cara server
// menentukan status "Perlu Verifikasi Usia" (ini cuma versi tampilan di sisi
// admin, bukan sumber kebenaran statusnya, yang tetap dari kolom `status` di
// database). Parsing manual sama seperti formatTanggalLahir, supaya tidak
// meleset sehari akibat konversi zona waktu.
function hitungUsiaDariTanggal(tgl, acuanStr) {
  if (!tgl) return null;
  const bagian = String(tgl).split("-");
  if (bagian.length !== 3) return null;
  const lahirTahun = parseInt(bagian[0], 10);
  const lahirBulan = parseInt(bagian[1], 10);
  const lahirHari = parseInt(bagian[2], 10);

  let acuanTahun, acuanBulan, acuanHari;
  if (acuanStr) {
    const bagianAcuan = String(acuanStr).split("-");
    if (bagianAcuan.length !== 3) return null;
    acuanTahun = parseInt(bagianAcuan[0], 10);
    acuanBulan = parseInt(bagianAcuan[1], 10);
    acuanHari = parseInt(bagianAcuan[2], 10);
  } else {
    const now = new Date();
    acuanTahun = now.getFullYear();
    acuanBulan = now.getMonth() + 1;
    acuanHari = now.getDate();
  }

  let usia = acuanTahun - lahirTahun;
  const belumUlangTahun =
    acuanBulan < lahirBulan || (acuanBulan === lahirBulan && acuanHari < lahirHari);
  if (belumUlangTahun) usia--;
  return usia;
}

// Ambil path relatif (di dalam bucket) dari URL publik Supabase Storage,
// supaya bisa dipakai untuk storage.remove().
function ekstrakPathBerkas(url) {
  const penanda = "/object/public/berkas-pendaftaran/";
  const idx = url.indexOf(penanda);
  if (idx === -1) return null;
  return decodeURIComponent(url.substring(idx + penanda.length));
}

// Catatan: sebelum migrasi 0029, ada fungsi bebaskanNomorPendaftaran() di
// sini yang mencatat nomor yang dihapus ke tabel pool "nomor_bebas" supaya
// bisa dipakai ulang. Fungsi itu DIHAPUS -- sejak migrasi 0029,
// ambil_nomor_berikutnya() di database menghitung LANGSUNG dari nomor yang
// masih terpakai sekarang (bukan dari pool yang perlu dicatat manual), jadi
// nomor yang dihapus otomatis bisa dipakai ulang TANPA perlu kode apa pun di
// sini -- berlaku apa pun cara menghapusnya (tombol Hapus di Panitia,
// Table Editor Supabase, dll). Lihat migrasi 0029 untuk penjelasan lengkap
// kenapa perubahan ini diperlukan (bug: nomor tidak terulang kalau baris
// dihapus lewat cara lain selain tombol Hapus).

// Warna baris/pil status menyesuaikan status pendaftaran -- dikelompokkan
// jadi 4 kelompok visual: "pending" (lagi menunggu), "warn" (butuh tindak
// lanjut panitia: usia/nomor punggung), "success" (Diterima), "danger"
// (Ditolak). Dipakai BERSAMA oleh renderBaris() (warna baris tabel) dan
// bukaModalIndividu()/bukaModalTim() (pil status di popup detail) -- jadi
// SENGAJA ditaruh di scope atas (bukan di dalam renderBaris() lagi seperti
// sebelumnya) supaya bisa diakses dari kedua tempat. Nama fungsi diberi
// akhiran "Lomba" supaya tidak bentrok dengan versi Bazar di
// view-adminbazar.js (satu scope global JS yang sama, lihat Catatan Teknis
// README).
function kelasBarisStatusLomba(status) {
  if (status === "Diterima") return "status-row--success";
  if (status === "Ditolak") return "status-row--danger";
  if (status === "Perlu Verifikasi Usia" || status === "Perlu Tambah Nomor Punggung") return "status-row--warn";
  return "status-row--pending"; // "Menunggu Verifikasi"
}

// Pil status berwarna di popup detail (lihat ".status-pill--..." di
// style.css) -- pakai palet yang SAMA dengan warna baris tabel (cukup
// mengganti awalan "status-row--" jadi "status-pill--"), supaya warnanya
// konsisten antara tabel & popup.
function pilStatusLombaHTML(status) {
  const sufiks = kelasBarisStatusLomba(status).replace("status-row--", "");
  return '<span class="status-pill status-pill--' + sufiks + '">' + escapeHTML(status) + '</span>';
}

// Satu chip link berkas di popup detail (lihat ".modal-berkas-chip" di
// style.css) -- kalau url-nya kosong/null, tampil sebagai chip abu-abu
// "label -" yang tidak bisa diklik (bukan <a> sama sekali), supaya jelas
// berkas itu memang belum ada (bukan link rusak).
function chipBerkasHTML(label, url) {
  if (!url) return '<span class="modal-berkas-chip modal-berkas-chip--kosong">📎 ' + escapeHTML(label) + ' -</span>';
  return '<a href="' + url + '" target="_blank" rel="noopener" class="modal-berkas-chip">📎 ' + escapeHTML(label) + '</a>';
}

// Label "Tipe Pendaftar" (migrasi 0005) -- dulu ikon 🏫/🎓 di kolom "Tipe"
// tabel Data Pendaftar (sudah dipindah ke popup detail supaya tabel lebih
// ringkas, lihat renderBaris()), dipakai BERSAMA oleh bukaModalIndividu()
// dan bukaModalTim() supaya informasinya tetap ada untuk kedua jenis
// pendaftar (field ini berlaku untuk individu maupun tim/Futsal).
function labelTipePendaftarHTML(row) {
  return row.tipe_pendaftar === "lembaga"
    ? ("🏫 Perwakilan Lembaga" + (row.penanggung_jawab_lembaga ? " · PJ: " + escapeHTML(row.penanggung_jawab_lembaga) : ""))
    : "🎓 Peserta Individu";
}

/* ==================== Ubah status pendaftaran -- SEKARANG DIPINDAH ke
   dalam popup detail (dulu lewat dropdown langsung di baris tabel) ====================
   Tombol/dropdown "ubah status" yang dulu ada di kolom Status tabel Data
   Pendaftar sudah DIPINDAH ke dalam popup detail (bukaModalIndividu/
   bukaModalTim) -- permintaan panitia supaya tabelnya lebih ringkas (kolom
   Status di tabel sekarang MURNI tampilan, pil warna saja, tidak bisa
   diklik), sementara aksi ubah status dilakukan dari popup yang sudah
   menampilkan detail lengkap pendaftar itu. Fungsi-fungsi di bawah ini
   SENGAJA ditaruh di scope atas (bukan lagi nested di dalam renderBaris()
   seperti sebelumnya) supaya bisa dipanggil dari popup (top-level juga),
   dan menyegarkan tabel di belakang popup lewat referensi
   renderBarisPendaftarRef/renderRekapPendaftarRef di bawah -- diisi oleh
   loadTabPendaftar() tiap kali tab "Data Pendaftar" dimuat. */
let renderBarisPendaftarRef = null;
let renderRekapPendaftarRef = null;

// Membuka ULANG popup detail yang sesuai (individu/tim) dengan data `row`
// TERKINI -- dipakai untuk: (a) menutup popup sementara "Alasan Penolakan"
// lalu kembali ke detail begitu selesai/dibatalkan, (b) menyegarkan isi
// popup (termasuk dropdown status & pil warnanya) begitu status BERHASIL
// diubah, supaya panitia tetap melihat detail yang sama tanpa perlu
// mengetuk ulang barisnya di tabel.
function bukaUlangPopupDetailLomba(row, isTim, rule) {
  if (isTim) {
    bukaModalTim(row, rule);
  } else {
    bukaModalIndividu(row, rule);
  }
}

// Fungsi bersama yang benar-benar MENYIMPAN perubahan status ke database --
// dipakai baik untuk status biasa (langsung) maupun status "Ditolak" (baru
// dipanggil SETELAH panitia memilih alasan penolakan lewat popup, lihat
// bukaModalAlasanPenolakanPopup di bawah). `alasanPenolakan` cuma dikirim
// kalau statusBaru === "Ditolak"; untuk status lain selalu null (mis. tidak
// menimpa alasan lama kalau panitia pernah menolak lalu mengubah lagi ke
// status lain, biar riwayatnya tetap ada kalau nanti ditolak ulang).
async function commitPerubahanStatusLomba(row, statusBaru, alasanPenolakan, isTim, rule) {
  const statusLama = row.status;

  // "Perlu Tambah Nomor Punggung" butuh token link /lengkapi -- dipastikan
  // (dibuat kalau belum ada) LEBIH DULU lewat RPC pastikan_token_lengkapi
  // (migrasi 0032, SECURITY DEFINER, khusus panitia) sebelum status di
  // baris ini diubah, supaya begitu notifikasi WA dikirim, tokennya sudah
  // pasti tersedia buat dirangkai jadi {link_lengkapi} di Edge Function.
  if (statusBaru === "Perlu Tambah Nomor Punggung") {
    const { data: tokenBaru, error: tokenError } = await supabaseClient.rpc("pastikan_token_lengkapi", { p_id: row.id });
    if (tokenError) {
      alert("Gagal menyiapkan link lengkapi nomor punggung: " + tokenError.message);
      bukaUlangPopupDetailLomba(row, isTim, rule); // kembali ke detail, status belum berubah
      return;
    }
    // BUG (migrasi 0051) yang diperbaiki di sini: token yang DIKEMBALIKAN RPC
    // ini TIDAK PERNAH disimpan ke `row.token_lengkapi` secara lokal --
    // untuk pendaftar yang BARU PERTAMA KALI masuk status ini (token-nya
    // baru dibuat RPC di atas, belum ada di `row` hasil query awal
    // loadTabPendaftar()), akibatnya bangunPesanWALomba() (cek
    // `row.token_lengkapi && settings.site_url`) selalu menganggap belum ada
    // token, jadi placeholder {link_lengkapi} ikut KOSONG di pesan "Kirim
    // WA" -- tombolnya tetap muncul tapi link lengkapi-nya tidak pernah
    // ikut terkirim. `row` disegarkan di sini supaya tombol "Kirim WA" yang
    // dirangkai begitu popup dibuka ulang (bukaUlangPopupDetailLomba di
    // bawah) selalu punya token yang benar.
    row.token_lengkapi = tokenBaru;
  }

  // `wa_terkirim` (migrasi 0051) direset ke false setiap kali status
  // berganti -- supaya tombol "Kirim WA" selalu tampil "belum terkirim"
  // lagi untuk status yang baru, tidak peduli status sebelumnya sudah
  // pernah dikirim atau belum.
  //
  // Sejak migrasi 0052: status TIDAK LAGI disimpan lewat .update() langsung
  // di sini, tapi lewat RPC ubah_status_pendaftaran() (SECURITY DEFINER) --
  // supaya pembebasan/pemulihan nomor_pendaftaran (lihat catatan panjang di
  // migrasi itu: nomor peserta yang DITOLAK "dibebaskan" dengan menambahkan
  // akhiran yang membuatnya tidak lagi dianggap "terpakai" oleh
  // ambil_nomor_berikutnya(), supaya bisa dipakai pendaftar lain) selalu
  // ikut dikerjakan ATOMIK bersama perubahan status itu sendiri, termasuk
  // menyamakan salinan nomor_pendaftaran di anggota_tim untuk pendaftar tim.
  const { data, error } = await supabaseClient.rpc("ubah_status_pendaftaran", {
    p_id: row.id,
    p_status_baru: statusBaru,
    p_alasan_penolakan: statusBaru === "Ditolak" ? alasanPenolakan : null
  });

  if (error || !data || data.success === false) {
    alert("Gagal mengubah status: " + ((data && data.message) || (error && error.message) || "Kesalahan tidak dikenal."));
    bukaUlangPopupDetailLomba(row, isTim, rule);
    return;
  }

  // `row` adalah REFERENSI yang sama dengan elemen di array `rows` milik
  // loadTabPendaftar() (dioper apa adanya dari rows.find() saat popup
  // dibuka) -- jadi cukup diubah di sini, otomatis ikut ter-update di
  // array itu juga tanpa perlu dicari ulang.
  row.status = statusBaru;
  row.wa_terkirim = false;
  if (statusBaru === "Ditolak") row.alasan_penolakan = alasanPenolakan;

  // Nomor pendaftaran bisa saja ikut berubah di sini: dibebaskan (ditandai,
  // BUKAN dihapus) begitu status jadi "Ditolak", atau dipulihkan/diganti
  // baru begitu dipulihkan DARI "Ditolak" ke status lain (lihat migrasi
  // 0052) -- `row` disegarkan supaya tabel, popup yang dibuka ulang, dan
  // query anggota_tim (bukaModalTim, dicocokkan lewat nomor_pendaftaran)
  // di bawah selalu memakai nilai TERBARU.
  if (data.nomor_berubah && data.nomor_pendaftaran) {
    row.nomor_pendaftaran = data.nomor_pendaftaran;
  }

  // Kasus langka yang PERLU diberi tahu panitia secara eksplisit: pendaftar
  // ini dipulihkan dari "Ditolak" dan nomor lamanya SUDAH kadung dipakai
  // pendaftar lain sejak dibebaskan, jadi baris ini dapat nomor pendaftaran
  // BARU -- panitia perlu tahu supaya bisa menginformasikan nomor barunya
  // ke pendaftar. (Pembebasan nomor saat DITOLAK sendiri tetap SENYAP/
  // otomatis seperti sebelumnya, tidak perlu pemberitahuan apa pun.)
  if (statusLama === "Ditolak" && statusBaru !== "Ditolak" && data.nomor_berubah) {
    alert('Status dipulihkan. Nomor pendaftaran untuk "' + (row.nama_tim || row.nama_lengkap) + '" sekarang: ' + data.nomor_pendaftaran + '. Mohon informasikan ke pendaftar kalau nomor sebelumnya berubah.');
  }

  // Menyegarkan tabel DI BELAKANG popup (warna baris & kartu rekap) --
  // lewat referensi yang diisi loadTabPendaftar(), bukan dengan menduga-duga
  // elemen DOM tabelnya dari sini.
  if (typeof renderRekapPendaftarRef === "function") renderRekapPendaftarRef();
  if (typeof renderBarisPendaftarRef === "function") renderBarisPendaftarRef();

  // Popup detail dibuka ULANG dengan data terbaru (dropdown status & pil
  // warnanya ikut menampilkan status yang baru saja tersimpan). Sejak
  // migrasi 0051, notifikasi WA TIDAK LAGI terkirim otomatis dari sini
  // (dulu lewat Fonnte) -- panitia mengirimnya sendiri secara manual lewat
  // tombol "Kirim WA" (link wa.me) yang akan muncul di popup yang dibuka
  // ulang ini, lihat renderTombolWALomba() yang dipanggil dari
  // pasangListenerStatusPopup().
  bukaUlangPopupDetailLomba(row, isTim, rule);
}

// Popup WAJIB pilih alasan penolakan, dibuka saat panitia memilih "Ditolak"
// di dropdown status popup -- daftar pilihannya diambil dari
// site_settings.alasan_penolakan_list (diedit panitia sendiri lewat tab
// "Notifikasi WA", lihat loadTabNotifWa), ditambah satu opsi tetap "Lainnya
// (tulis sendiri)" untuk kasus yang tidak ada di daftar. Menggantikan
// sementara isi popup detail yang sedang terbuka (pakai modal yang sama),
// lalu kembali ke detailnya lagi lewat bukaUlangPopupDetailLomba() begitu
// panitia menekan "Batal" atau selesai menyimpan.
async function bukaModalAlasanPenolakanPopup(row, statusLama, isTim, rule) {
  const { data: settingsRow } = await supabaseClient
    .from("site_settings").select("alasan_penolakan_list").eq("id", 1).single();
  const daftarAlasan = (settingsRow && Array.isArray(settingsRow.alasan_penolakan_list))
    ? settingsRow.alasan_penolakan_list
    : [];
  const alasanLama = row.alasan_penolakan;

  const optionsHTML = daftarAlasan.map(function (a) {
    const selected = a === alasanLama ? " selected" : "";
    return '<option value="' + escapeHTML(a) + '"' + selected + '>' + escapeHTML(a) + '</option>';
  }).join("") + '<option value="__lainnya__"' + (alasanLama && daftarAlasan.indexOf(alasanLama) === -1 ? " selected" : "") + '>Lainnya (tulis sendiri)</option>';

  const isiHTML =
    '<p class="hint">Pilih alasan penolakan -- wajib diisi, akan ikut dikirim ke pendaftar lewat WA lewat placeholder <code>{alasan}</code>.</p>' +
    '<div class="field">' +
      '<label for="alasan-penolakan-select">Alasan</label>' +
      '<select id="alasan-penolakan-select">' + optionsHTML + '</select>' +
    '</div>' +
    '<div class="field" id="alasan-penolakan-lainnya-wrap" style="margin-top:12px;display:none;">' +
      '<label for="alasan-penolakan-lainnya">Tulis alasan sendiri</label>' +
      '<input id="alasan-penolakan-lainnya" type="text" placeholder="mis. Berkas tidak lengkap" value="' + (alasanLama && daftarAlasan.indexOf(alasanLama) === -1 ? escapeHTML(alasanLama) : "") + '">' +
    '</div>' +
    '<div class="submit-row" style="display:flex;justify-content:flex-end;gap:10px;margin-top:20px;">' +
      '<button type="button" class="btn btn--ghost" id="btn-batal-alasan-penolakan">Batal</button>' +
      '<button type="button" class="btn btn--primary" id="btn-simpan-alasan-penolakan">Tandai Ditolak</button>' +
    '</div>';

  bukaPanelDetail("Alasan Penolakan — " + (row.nama_tim || row.nama_lengkap), isiHTML);

  const selectEl = document.getElementById("alasan-penolakan-select");
  const lainnyaWrap = document.getElementById("alasan-penolakan-lainnya-wrap");
  const lainnyaInput = document.getElementById("alasan-penolakan-lainnya");

  function syncLainnyaVisibility() {
    lainnyaWrap.style.display = selectEl.value === "__lainnya__" ? "block" : "none";
  }
  syncLainnyaVisibility();
  selectEl.addEventListener("change", syncLainnyaVisibility);

  document.getElementById("btn-batal-alasan-penolakan").addEventListener("click", function () {
    bukaUlangPopupDetailLomba(row, isTim, rule); // kembali ke detail, status tidak jadi diubah
  });

  document.getElementById("btn-simpan-alasan-penolakan").addEventListener("click", function () {
    const alasanDipilih = selectEl.value === "__lainnya__"
      ? lainnyaInput.value.trim()
      : selectEl.value;
    if (!alasanDipilih) {
      alert("Alasan penolakan wajib diisi.");
      return;
    }
    commitPerubahanStatusLomba(row, "Ditolak", alasanDipilih, isTim, rule);
  });
}

// Memasang listener dropdown status di dalam popup detail yang baru saja
// digambar (bukaModalIndividu/bukaModalTim) -- dipanggil SETELAH bukaPanelDetail()
// supaya elemennya sudah ada di DOM. "rule" cuma relevan untuk tim (dioper
// apa adanya ke bukaUlangPopupDetailLomba/commitPerubahanStatusLomba kalau
// perlu membuka ulang popup tim).
// Dropdown status yang dipasang di popup detail (menggantikan dropdown yang
// dulu ada di kolom Status tabel) -- "isTim" menentukan daftar opsinya
// (tim/Futsal punya opsi tambahan "Perlu Tambah Nomor Punggung"). Diikuti
// span ".wa-kirim-wrap" yang diisi ASYNC oleh renderTombolWALomba() (migrasi
// 0051) dengan tombol "Kirim WA" (link wa.me) -- menggantikan ".wa-status-
// note" lama yang dulu menampilkan status kirim OTOMATIS lewat Fonnte.
function statusSelectPopupHTML(id, status, isTim) {
  const opsi = isTim
    ? ["Menunggu Verifikasi", "Perlu Verifikasi Usia", "Perlu Tambah Nomor Punggung", "Diterima", "Ditolak"]
    : ["Menunggu Verifikasi", "Perlu Verifikasi Usia", "Diterima", "Ditolak"];
  return (
    '<select id="modal-status-select" class="status-select">' +
      opsi.map(function (s) {
        return '<option value="' + s + '"' + (s === status ? " selected" : "") + '>' + s + "</option>";
      }).join("") +
    '</select> <span class="wa-kirim-wrap" data-id="' + escapeHTML(id) + '"></span>'
  );
}

function pasangListenerStatusPopup(row, isTim, rule) {
  const sel = document.getElementById("modal-status-select");
  if (!sel) return;
  sel.addEventListener("change", function () {
    const statusBaru = sel.value;
    const statusLama = row.status;
    if (statusBaru === statusLama) return;

    // Status "Ditolak" WAJIB menyertakan alasan -- panitia harus pilih dulu
    // lewat popup (dropdown + opsi tulis sendiri) sebelum status-nya benar-
    // benar tersimpan.
    if (statusBaru === "Ditolak") {
      bukaModalAlasanPenolakanPopup(row, statusLama, isTim, rule);
      return;
    }

    commitPerubahanStatusLomba(row, statusBaru, null, isTim, rule);
  });

  // Tombol "Kirim WA" (migrasi 0051) dirangkai ASYNC setiap kali popup ini
  // dibuka/dibuka ulang (termasuk sesudah status berganti, lewat
  // bukaUlangPopupDetailLomba() -> bukaModalTim/bukaModalIndividu ->
  // pasangListenerStatusPopup lagi) supaya selalu menampilkan pesan & status
  // "sudah terkirim" yang sesuai dengan `row` TERBARU.
  renderTombolWALomba(row, rule);
  renderTombolSertifikatPendamping(row);
}

// Nama "pendamping" untuk SATU baris pendaftaran -- COALESCE dari TIGA
// kolom yang mutually-exclusive (lihat juga kumpulkanEntriPendamping() di
// tab "Data Pendamping"): pembina (tim/Futsal), penanggung_jawab_lembaga
// (Perwakilan Lembaga), atau nama_pendamping (individu biasa, opsional,
// migrasi 0027). Dipakai renderTombolSertifikatPendamping() di bawah untuk
// menentukan apakah baris ini PUNYA pendamping sama sekali (kalau tidak,
// tombol link sertifikatnya tidak relevan/tidak ditampilkan).
function namaPendampingUntukSertifikat(row) {
  return row.pembina || row.penanggung_jawab_lembaga || row.nama_pendamping || "";
}

// Mengisi `.sertifikat-link-wrap[data-id=...]` (field "Sertifikat
// Pendamping" di popup detail Tim/Individu, lihat bukaModalTim/
// bukaModalIndividu) -- BERBEDA dari "Kirim WA": tombol ini TIDAK otomatis
// mengirim apa pun, cuma MEMBUAT (kalau belum ada) & MENAMPILKAN link
// rahasia yang panitia salin & kirimkan SENDIRI secara manual ke pendamping
// (lewat WA/kanal apa pun pilihan panitia) -- permintaan panitia, berbeda
// dari link {link_lengkapi} yang otomatis tertaut ke pesan status WA.
// HANYA relevan kalau baris ini punya nama pendamping (lihat
// namaPendampingUntukSertifikat() di atas) DAN statusnya PERSIS "Diterima"
// (gating yang sama dipakai ulang di server oleh RPC ambil_sertifikat(),
// migrasi 0055 -- jadi walau tombol ini sempat tampil lalu statusnya
// berubah lagi, link yang SUDAH terkirim otomatis tidak berlaku lagi).
async function renderTombolSertifikatPendamping(row) {
  const wrap = document.querySelector('.sertifikat-link-wrap[data-id="' + row.id + '"]');
  if (!wrap) return;

  const namaPendamping = namaPendampingUntukSertifikat(row);
  if (!namaPendamping) {
    wrap.innerHTML = '<span class="hint">Tidak ada data pendamping/penanggung jawab untuk pendaftaran ini.</span>';
    return;
  }
  if (row.status !== "Diterima") {
    wrap.innerHTML = '<span class="hint">Link baru aktif begitu status pendaftaran ini "Diterima".</span>';
    return;
  }

  wrap.innerHTML = '<button type="button" class="btn-link btn-link-sertifikat" data-id="' + escapeHTML(row.id) + '">🎓 Buat/Lihat Link Sertifikat</button>';
  wrap.querySelector(".btn-link-sertifikat").addEventListener("click", async function () {
    const btn = this;
    const labelAsli = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Menyiapkan...";
    try {
      const { data: token, error } = await supabaseClient.rpc("pastikan_token_sertifikat", { p_id: row.id });
      if (error) throw error;
      const settings = await ambilSiteSettingsWALomba();
      const link = settings.site_url
        ? (settings.site_url + "/#/sertifikat?token=" + token)
        : ("#/sertifikat?token=" + token);
      // prompt() dipakai (bukan alert()) supaya panitia bisa langsung
      // menyalin teksnya (Ctrl+C) tanpa harus select manual -- link ini
      // sengaja TIDAK dikirim otomatis, panitia yang memutuskan kapan &
      // lewat kanal apa mengirimkannya ke pendamping.
      prompt('Link Sertifikat untuk "' + namaPendamping + '" -- salin (Ctrl+C) lalu kirimkan sendiri ke pendamping:', link);
    } catch (e) {
      alert("Gagal menyiapkan link sertifikat: " + e.message);
    } finally {
      btn.disabled = false;
      btn.textContent = labelAsli;
    }
  });
}

/* -------- Popup detail tim (Futsal): dibuka dengan mengetuk baris -------- */
// "rule" (opsional) = baris lomba_rules yang cocok dengan row.lomba_id --
// dipakai untuk menyorot anggota yang usianya di luar syarat jenjang tim itu
// (lihat migrasi 0018), murni bantuan visual di popup ini. Kalau tidak
// disediakan (mis. dipanggil dari tempat lain), popup tetap tampil normal
// tanpa penyorotan.
async function bukaModalTim(row, rule) {
  const infoHTML =
    '<div class="modal-field-grid">' +
      '<div class="modal-field modal-field--full"><span class="modal-field__label">Nama Tim/Sekolah</span><span class="modal-field__value">' + escapeHTML(row.nama_tim) + '</span></div>' +
      '<div class="modal-field"><span class="modal-field__label">Nama Pendamping</span><span class="modal-field__value">' + escapeHTML(row.pembina || "-") + '</span></div>' +
      '<div class="modal-field"><span class="modal-field__label">No. WA Pendamping</span><span class="modal-field__value">' + escapeHTML(row.whatsapp) + '</span></div>' +
      '<div class="modal-field"><span class="modal-field__label">Asal Sekolah</span><span class="modal-field__value">' + escapeHTML(row.asal_sekolah || "-") + '</span></div>' +
      '<div class="modal-field"><span class="modal-field__label">Tipe Pendaftar</span><span class="modal-field__value">' + labelTipePendaftarHTML(row) + '</span></div>' +
      '<div class="modal-field"><span class="modal-field__label">Nomor Pendaftaran</span><span class="modal-field__value">' + escapeHTML(row.nomor_pendaftaran) + '</span></div>' +
      '<div class="modal-field modal-field--full"><span class="modal-field__label">Status (ketuk untuk ubah)</span><span class="modal-field__value">' + statusSelectPopupHTML(row.id, row.status, true) + '</span></div>' +
      '<div class="modal-field modal-field--full"><span class="modal-field__label">Sertifikat Pendamping</span><span class="modal-field__value"><span class="sertifikat-link-wrap" data-id="' + escapeHTML(row.id) + '"></span></span></div>' +
    '</div>' +
    (row.status === "Perlu Verifikasi Usia"
      ? '<p class="modal-status-hint">Ada anggota tim yang usianya di luar syarat jenjang lomba ini (disorot merah di tabel bawah) -- silakan cek Surat Delegasi sebelum memutuskan status akhirnya.</p>'
      : "") +
    (row.status === "Perlu Tambah Nomor Punggung"
      ? '<p class="modal-status-hint">Link "Lengkapi Nomor Punggung" sudah/akan dikirim ke pendamping lewat WA -- status otomatis balik ke "Menunggu Verifikasi" begitu mereka selesai mengisi semua nomor punggung lewat link itu.</p>'
      : "") +
    (row.status === "Ditolak" && row.alasan_penolakan
      ? '<p class="modal-status-hint"><strong>Alasan Penolakan:</strong> ' + escapeHTML(row.alasan_penolakan) + '</p>'
      : "") +
    '<p class="modal-section-title">Berkas</p>' +
    '<div class="modal-berkas-row">' +
      chipBerkasHTML("Surat Delegasi", row.url_surat_delegasi) +
      renderDaftarBerkasTim(row.url_bukti_follow_ig, "Bukti IG") +
      renderDaftarBerkasTim(row.url_berkas_tim, "Kartu Anggota") +
    '</div>' +
    '<p class="modal-section-title" style="margin-top:18px;">Anggota Tim</p>' +
    '<div id="modal-tim-anggota"><p class="hint">Memuat data anggota tim...</p></div>' +
    '<div class="submit-row" style="display:flex;justify-content:flex-end;margin-top:16px;">' +
      '<button type="button" class="btn btn--ghost" id="btn-edit-tim">✏️ Edit Data</button>' +
    '</div>';

  bukaPanelDetail("Detail Tim — " + row.nama_tim, infoHTML);
  pasangListenerStatusPopup(row, true, rule);

  const btnEditTim = document.getElementById("btn-edit-tim");
  if (btnEditTim) btnEditTim.addEventListener("click", function () { bukaModalTimEdit(row, rule); });

  const { data: anggota, error } = await supabaseClient
    .from("anggota_tim").select("*").eq("nomor_pendaftaran", row.nomor_pendaftaran).order("created_at");

  const wrap = document.getElementById("modal-tim-anggota");
  if (!wrap) return; // modal sudah ditutup sebelum data selesai dimuat

  // Syarat usia jenjang tim ini (kalau rule-nya tersedia & sudah diatur
  // panitia) -- dipakai murni untuk menyorot baris anggota yang usianya di
  // luar syarat, meniru pengecekan otomatis di migrasi 0018. Acuan tanggalnya
  // tanggal_pelaksanaan lomba (sama seperti server), bukan hari ini.
  const syaratUsiaTim = rule && rule.usia_per_jenjang ? rule.usia_per_jenjang[row.jenjang] : null;
  const acuanUsiaTim = rule ? rule.tanggal_pelaksanaan : null;

  wrap.innerHTML = error
    ? ('<p>Gagal memuat anggota tim: ' + error.message + '</p>')
    : (
      '<table class="admin-table modal-table"><thead><tr><th>#</th><th>Nama</th><th>Tempat, Tanggal Lahir</th><th>Usia</th><th>Kelas</th><th>No. Punggung</th></tr></thead><tbody>' +
      (anggota && anggota.length ? anggota.map(function (a, i) {
        // Data lama (sebelum migrasi 0017) cuma punya tempat_tanggal_lahir
        // sebagai teks bebas, jadi usianya tidak bisa dihitung -- tampil "-".
        const ttl = a.tanggal_lahir
          ? ((a.tempat_lahir ? a.tempat_lahir + ", " : "") + formatTanggalLahir(a.tanggal_lahir))
          : (a.tempat_tanggal_lahir || "-");
        const usia = a.tanggal_lahir ? hitungUsiaDariTanggal(a.tanggal_lahir) : null;

        // Usia pada tanggal pelaksanaan (bukan usia hari ini di atas) --
        // dipakai cuma untuk menentukan apakah baris ini perlu disorot.
        const usiaPadaAcuan = a.tanggal_lahir ? hitungUsiaDariTanggal(a.tanggal_lahir, acuanUsiaTim) : null;
        const diLuarSyarat = syaratUsiaTim && usiaPadaAcuan != null &&
          (usiaPadaAcuan < syaratUsiaTim.min || usiaPadaAcuan > syaratUsiaTim.max);

        // nomor_punggung opsional (migrasi 0032) -- "-" kalau belum diisi,
        // misalnya sebelum pendamping mengisi lewat link /lengkapi.
        const punggung = (a.nomor_punggung != null && a.nomor_punggung !== "") ? a.nomor_punggung : "-";

        return '<tr class="' + (diLuarSyarat ? "row-usia-warn" : "") + '"><td>' + (i + 1) + '</td><td>' + a.nama + '</td><td>' + ttl + '</td><td>' + (usia != null ? usia + ' th' : '-') + (diLuarSyarat ? ' ⚠️' : '') + '</td><td>' + a.kelas + '</td><td>' + punggung + '</td></tr>';
      }).join("") : '<tr><td colspan="6">Belum ada data anggota.</td></tr>') +
      '</tbody></table>'
    );
}

// Menggambar satu atau lebih chip berkas (lihat chipBerkasHTML() di atas)
// untuk field yang bisa berisi BANYAK file sekaligus (mis. beberapa
// screenshot bukti follow IG) -- "label" dipakai sebagai awalan tiap chip,
// diberi nomor urut #1/#2/dst kalau lebih dari satu file.
function renderDaftarBerkasTim(urlBerkasTim, label) {
  const daftar = Array.isArray(urlBerkasTim) ? urlBerkasTim : [];
  if (daftar.length === 0) return chipBerkasHTML(label, null);
  if (daftar.length === 1) return chipBerkasHTML(label, daftar[0]);
  return daftar.map(function (url, i) {
    return chipBerkasHTML(label + " #" + (i + 1), url);
  }).join("");
}

/* ==================== Ganti berkas pendaftaran yang sudah diunggah ====================
   Dipakai form edit individu/tim (bukaModalIndividuEdit()/bukaModalTimEdit(),
   di bawah) supaya panitia bisa MENGGANTI berkas yang sudah diunggah (Kartu
   Pelajar, Surat Delegasi, Bukti IG, Kartu Anggota) tanpa perlu lewat
   Storage Supabase manual. Replikasi SEDERHANA dari uploadKeStorage()/
   kecilkanGambarJikaPerlu() di assets/js/view-daftar.js (nama fungsi diberi
   akhiran "Admin" supaya tidak bentrok -- satu scope global JS yang sama,
   lihat Catatan Teknis README) -- TANPA OCR nama kartu (fitur itu murni
   kemudahan penamaan file saat pendaftaran AWAL, tidak relevan untuk GANTI
   satu file oleh panitia yang sudah tahu persis berkas siapa yang diganti).
   Kompresi gambar TETAP dipakai (alasan sama seperti versi pendaftar, lihat
   komentarnya di sana) supaya berkas pengganti tidak balik jadi besar-besar
   lagi. Panitia (role `authenticated`) sudah punya izin INSERT/UPDATE/
   DELETE/SELECT penuh ke bucket `berkas-pendaftaran` sejak migrasi
   0001/0008/0009/0047 -- TIDAK butuh migrasi SQL baru untuk ini. */

// Menormalkan kolom berkas yang bisa berisi array JSON ATAU (data lama,
// sebelum migrasi 0021) satu string polos jadi array JS biasa -- dipakai
// bukaModalIndividuEdit()/bukaModalTimEdit() untuk merender satu kotak
// "Ganti" per berkas yang SUDAH ADA. "minSlot" (opsional) memaksa jumlah
// slot MINIMAL sekian -- dipakai untuk Bukti IG yang selalu diharapkan 2
// slot walau datanya kebetulan kurang -- tanpa memotong kalau jumlah
// aslinya lebih banyak dari itu.
function bukaUrlBerkasArray(nilai, minSlot) {
  const daftar = Array.isArray(nilai) ? nilai.slice() : (nilai ? [nilai] : []);
  while (minSlot && daftar.length < minSlot) daftar.push(null);
  return daftar;
}

function ekstensiAdmin(file) {
  const bagian = file.name.split(".");
  return bagian.length > 1 ? bagian.pop() : "bin";
}

function kecilkanGambarJikaPerluAdmin(file) {
  if (!file || file.type.indexOf("image/") !== 0 || file.size < 400 * 1024) {
    return Promise.resolve(file);
  }
  return new Promise(function (resolve) {
    const img = new Image();
    const urlSementara = URL.createObjectURL(file);
    img.onload = function () {
      URL.revokeObjectURL(urlSementara);
      const MAKS_SISI = 1600;
      const skala = Math.min(1, MAKS_SISI / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.round(img.naturalWidth * skala), h = Math.round(img.naturalHeight * skala);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      canvas.toBlob(function (blob) {
        if (!blob || blob.size >= file.size) { resolve(file); return; }
        resolve(new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" }));
      }, "image/jpeg", 0.82);
    };
    img.onerror = function () { URL.revokeObjectURL(urlSementara); resolve(file); };
    img.src = urlSementara;
  });
}

// Mengunggah SATU berkas pengganti, mengembalikan URL publiknya. Dipakai
// berkali-kali (satu panggilan per berkas yang diganti) oleh handler Simpan
// di bukaModalIndividuEdit()/bukaModalTimEdit().
async function unggahGantiBerkasAdmin(file, label) {
  file = await kecilkanGambarJikaPerluAdmin(file);
  const path = "admin-ganti/" + Date.now() + "-" + Math.random().toString(36).slice(2) + "-" + label + "." + ekstensiAdmin(file);
  const { error } = await supabaseClient.storage.from(STORAGE_BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false
  });
  if (error) throw new Error("Gagal mengunggah " + label + ": " + error.message);
  const { data } = supabaseClient.storage.from(STORAGE_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

// Menghapus berkas LAMA dari Storage setelah berhasil diganti -- dipanggil
// SETELAH baris `pendaftaran` berhasil disimpan dengan URL yang baru, biar
// tidak ada jendela waktu di mana link berkas di database mengarah ke file
// yang sudah terhapus. Best-effort, SAMA seperti pembersihan berkas saat
// menghapus pendaftaran (lihat tombol Hapus di loadTabPendaftar()): kalau
// gagal, cukup dicatat di console, TIDAK membatalkan penggantian yang sudah
// berhasil tersimpan (berkas baru sudah terpakai, berkas lama yang gagal
// terhapus paling buruk cuma tertinggal "sampah" di Storage).
async function hapusBerkasLamaAdmin(urlLama) {
  const path = ekstrakPathBerkas(urlLama);
  if (!path) return;
  const { error } = await supabaseClient.storage.from(STORAGE_BUCKET).remove([path]);
  if (error) console.error("Berkas lama gagal dihapus (ditinggalkan, bukan error fatal):", urlLama, error);
}

/* -------- Form edit data tim (migrasi 0052) -------- */
// Dibuka lewat tombol "✏️ Edit Data" di bukaModalTim(). Field yang SENGAJA
// TIDAK disediakan di sini: Nomor Pendaftaran (identitas sistem, dikelola
// otomatis lewat ambil_nomor_berikutnya()/status "Ditolak" -- lihat RPC
// ubah_status_pendaftaran() di migrasi 0052), jenis kelamin tim (tidak
// pernah ditampilkan di popup detail ini sama sekali, ditentukan otomatis
// dari syarat lomba saat daftar), dan berkas unggahan (mengganti file perlu
// alur unggah ulang yang lebih rumit, di luar cakupan permintaan ini --
// panitia tetap bisa membuka berkasnya lewat chip di popup detail seperti
// biasa). Menambah/menghapus anggota tim JUGA di luar cakupan form ini --
// cuma field anggota yang SUDAH ADA yang bisa dibetulkan; panitia perlu
// lewat Table Editor Supabase kalau harus menambah/menghapus anggota.
async function bukaModalTimEdit(row, rule) {
  bukaPanelDetail("Edit Data Tim — " + row.nama_tim, '<p class="hint">Memuat data anggota tim...</p>');

  const { data: anggota, error } = await supabaseClient
    .from("anggota_tim").select("*").eq("nomor_pendaftaran", row.nomor_pendaftaran).order("created_at");

  if (error) {
    bukaPanelDetail("Edit Data Tim — " + row.nama_tim, '<p>Gagal memuat anggota tim: ' + error.message + '</p>');
    return;
  }

  // Pilihan jenjang dibatasi ke syarat lomba ini (rule.jenjang) kalau
  // tersedia -- fallback ke input teks bebas kalau "rule"-nya entah kenapa
  // tidak ada (mis. dipanggil dari tempat lain tanpa rule).
  const opsiJenjang = rule && Array.isArray(rule.jenjang) && rule.jenjang.length ? rule.jenjang : null;

  const formHTML =
    '<p class="modal-section-title">Data Tim</p>' +
    '<div class="field-row">' +
      '<div class="field"><label for="edit-nama-tim">Nama Tim/Sekolah</label><input type="text" id="edit-nama-tim" value="' + escapeHTML(row.nama_tim) + '"></div>' +
      '<div class="field"><label for="edit-pembina">Nama Pendamping</label><input type="text" id="edit-pembina" value="' + escapeHTML(row.pembina || "") + '"></div>' +
    '</div>' +
    '<div class="field-row">' +
      '<div class="field"><label for="edit-wa-tim">No. WA Pendamping</label><input type="text" id="edit-wa-tim" value="' + escapeHTML(row.whatsapp || "") + '"></div>' +
      '<div class="field"><label for="edit-sekolah-tim">Asal Sekolah</label><input type="text" id="edit-sekolah-tim" value="' + escapeHTML(row.asal_sekolah || "") + '"></div>' +
    '</div>' +
    '<div class="field">' +
      '<label for="edit-jenjang-tim">Jenjang</label>' +
      (opsiJenjang
        ? ('<select id="edit-jenjang-tim">' + opsiJenjang.map(function (j) { return '<option value="' + escapeHTML(j) + '"' + (j === row.jenjang ? " selected" : "") + '>' + escapeHTML(j) + '</option>'; }).join("") + '</select>')
        : ('<input type="text" id="edit-jenjang-tim" value="' + escapeHTML(row.jenjang) + '">')) +
    '</div>' +
    '<p class="modal-section-title" style="margin-top:18px;">Anggota Tim</p>' +
    '<p class="hint">Menambah/menghapus anggota tidak bisa lewat form ini -- hanya membetulkan data anggota yang sudah ada.</p>' +
    '<div class="table-wrap"><table class="admin-table modal-table"><thead><tr><th>#</th><th>Nama</th><th>Tempat Lahir</th><th>Tanggal Lahir</th><th>Kelas</th><th>No. Punggung</th></tr></thead><tbody>' +
    (anggota && anggota.length ? anggota.map(function (a, i) {
      return '<tr data-anggota-id="' + escapeHTML(a.id) + '">' +
        '<td>' + (i + 1) + '</td>' +
        '<td><input type="text" class="edit-anggota-nama" value="' + escapeHTML(a.nama || "") + '"></td>' +
        '<td><input type="text" class="edit-anggota-tempat" value="' + escapeHTML(a.tempat_lahir || "") + '"></td>' +
        '<td><input type="date" class="edit-anggota-tanggal" value="' + escapeHTML(a.tanggal_lahir || "") + '"></td>' +
        '<td><input type="text" class="edit-anggota-kelas" value="' + escapeHTML(a.kelas || "") + '"></td>' +
        '<td><input type="number" min="1" max="99" class="edit-anggota-punggung" value="' + (a.nomor_punggung != null ? a.nomor_punggung : "") + '"></td>' +
      '</tr>';
    }).join("") : '<tr><td colspan="6">Belum ada data anggota.</td></tr>') +
    '</tbody></table></div>' +
    '<p class="modal-section-title" style="margin-top:18px;">Ganti Berkas</p>' +
    '<p class="hint">Kosongkan kotak mana pun yang tidak perlu diganti -- berkas lamanya tetap dipakai apa adanya.</p>' +
    '<div class="field"><label for="edit-file-delegasi">Surat Delegasi' + (row.url_surat_delegasi ? ' (<a href="' + row.url_surat_delegasi + '" target="_blank" rel="noopener">lihat berkas saat ini</a>)' : ' (belum ada)') + '</label><input type="file" id="edit-file-delegasi" accept="image/*,.pdf"></div>' +
    '<div class="field-row">' +
      bukaUrlBerkasArray(row.url_bukti_follow_ig, 2).map(function (u, i) {
        return '<div class="field"><label for="edit-file-ig' + i + '">Bukti IG #' + (i + 1) + (u ? ' (<a href="' + u + '" target="_blank" rel="noopener">lihat berkas saat ini</a>)' : ' (belum ada)') + '</label><input type="file" id="edit-file-ig' + i + '" accept="image/*,.pdf"></div>';
      }).join("") +
    '</div>' +
    '<p class="hint" style="margin-top:14px;">Kartu Anggota -- mengganti HANYA berkas yang sudah ada di bawah ini (menambah/menghapus berkas baru tidak bisa lewat form ini):</p>' +
    bukaUrlBerkasArray(row.url_berkas_tim).map(function (u, i) {
      return '<div class="field"><label for="edit-file-kartutim' + i + '">Kartu Anggota #' + (i + 1) + (u ? ' (<a href="' + u + '" target="_blank" rel="noopener">lihat berkas saat ini</a>)' : ' (belum ada)') + '</label><input type="file" id="edit-file-kartutim' + i + '" accept="image/*,.pdf"></div>';
    }).join("") +
    '<p class="hint">Nomor pendaftaran tidak bisa diubah lewat form ini.</p>' +
    '<div class="submit-row" style="display:flex;justify-content:flex-end;gap:10px;margin-top:10px;">' +
      '<button type="button" class="btn btn--ghost" id="btn-batal-edit-tim">Batal</button>' +
      '<button type="button" class="btn btn--primary" id="btn-simpan-edit-tim">Simpan Perubahan</button>' +
    '</div>';

  bukaPanelDetail("Edit Data Tim — " + row.nama_tim, formHTML);

  document.getElementById("btn-batal-edit-tim").addEventListener("click", function () {
    bukaModalTim(row, rule);
  });

  document.getElementById("btn-simpan-edit-tim").addEventListener("click", async function () {
    const namaTimBaru = document.getElementById("edit-nama-tim").value.trim();
    const pembinaBaru = document.getElementById("edit-pembina").value.trim();
    const waBaru = document.getElementById("edit-wa-tim").value.trim();
    const sekolahBaru = document.getElementById("edit-sekolah-tim").value.trim();
    const jenjangBaru = document.getElementById("edit-jenjang-tim").value.trim();

    if (!namaTimBaru || !pembinaBaru || !waBaru || !jenjangBaru) {
      alert("Nama Tim, Nama Pendamping, No. WA Pendamping, dan Jenjang wajib diisi.");
      return;
    }

    const barisAnggota = Array.from(document.querySelectorAll("#detail-panel-body tr[data-anggota-id]"));
    const anggotaBaru = [];
    const punggungTerpakai = [];
    for (const tr of barisAnggota) {
      const idAnggota = tr.getAttribute("data-anggota-id");
      const nama = tr.querySelector(".edit-anggota-nama").value.trim();
      const tempat = tr.querySelector(".edit-anggota-tempat").value.trim();
      const tanggal = tr.querySelector(".edit-anggota-tanggal").value;
      const kelasAnggota = tr.querySelector(".edit-anggota-kelas").value.trim();
      const punggungStr = tr.querySelector(".edit-anggota-punggung").value.trim();

      if (!nama || !tempat || !tanggal || !kelasAnggota) {
        alert("Nama, Tempat Lahir, Tanggal Lahir, dan Kelas setiap anggota wajib diisi.");
        return;
      }

      let punggung = null;
      if (punggungStr !== "") {
        punggung = parseInt(punggungStr, 10);
        if (isNaN(punggung) || punggung < 1 || punggung > 99) {
          alert("Nomor punggung harus angka 1-99 (atau dikosongkan).");
          return;
        }
        if (punggungTerpakai.indexOf(punggung) !== -1) {
          alert("Nomor punggung " + punggung + " dipakai lebih dari satu anggota.");
          return;
        }
        punggungTerpakai.push(punggung);
      }

      anggotaBaru.push({ id: idAnggota, nama: nama, tempat_lahir: tempat, tanggal_lahir: tanggal, kelas: kelasAnggota, nomor_punggung: punggung });
    }

    const btnSimpan = document.getElementById("btn-simpan-edit-tim");
    btnSimpan.disabled = true;
    btnSimpan.textContent = "Mengunggah berkas...";

    // Kumpulkan dulu SEMUA berkas pengganti yang dipilih (kotak yang
    // dibiarkan kosong tidak ikut diproses -- berkas lamanya dipakai apa
    // adanya), unggah satu per satu, baru masukkan URL barunya ke payload.
    // Berkas LAMA yang tergantikan baru dihapus dari Storage SETELAH baris
    // `pendaftaran` berhasil disimpan dengan URL baru (lihat
    // hapusBerkasLamaAdmin()), supaya tidak ada jendela waktu di mana link
    // di database mengarah ke file yang sudah terhapus.
    const payloadTim = { nama_tim: namaTimBaru, pembina: pembinaBaru, whatsapp: waBaru, asal_sekolah: sekolahBaru, jenjang: jenjangBaru };
    const berkasLamaUntukDihapus = [];

    try {
      const fileDelegasiBaru = document.getElementById("edit-file-delegasi").files[0] || null;
      if (fileDelegasiBaru) {
        payloadTim.url_surat_delegasi = await unggahGantiBerkasAdmin(fileDelegasiBaru, "surat-delegasi");
        if (row.url_surat_delegasi) berkasLamaUntukDihapus.push(row.url_surat_delegasi);
      }

      const igLama = bukaUrlBerkasArray(row.url_bukti_follow_ig, 2);
      const igBaru = igLama.slice();
      let igBerubah = false;
      for (let i = 0; i < igLama.length; i++) {
        const fileIgBaru = document.getElementById("edit-file-ig" + i).files[0] || null;
        if (!fileIgBaru) continue;
        igBaru[i] = await unggahGantiBerkasAdmin(fileIgBaru, "bukti-ig-" + (i + 1));
        if (igLama[i]) berkasLamaUntukDihapus.push(igLama[i]);
        igBerubah = true;
      }
      if (igBerubah) payloadTim.url_bukti_follow_ig = igBaru;

      const kartuTimLama = bukaUrlBerkasArray(row.url_berkas_tim);
      const kartuTimBaru = kartuTimLama.slice();
      let kartuTimBerubah = false;
      for (let i = 0; i < kartuTimLama.length; i++) {
        const fileKartuTimBaru = document.getElementById("edit-file-kartutim" + i).files[0] || null;
        if (!fileKartuTimBaru) continue;
        kartuTimBaru[i] = await unggahGantiBerkasAdmin(fileKartuTimBaru, "kartu-anggota-" + (i + 1));
        if (kartuTimLama[i]) berkasLamaUntukDihapus.push(kartuTimLama[i]);
        kartuTimBerubah = true;
      }
      if (kartuTimBerubah) payloadTim.url_berkas_tim = kartuTimBaru;
    } catch (e) {
      alert(e.message || "Gagal mengunggah berkas pengganti.");
      btnSimpan.disabled = false;
      btnSimpan.textContent = "Simpan Perubahan";
      return;
    }

    btnSimpan.textContent = "Menyimpan...";

    const { error: errorTim } = await supabaseClient.from("pendaftaran").update(payloadTim).eq("id", row.id);
    if (errorTim) {
      alert("Gagal menyimpan data tim: " + errorTim.message);
      btnSimpan.disabled = false;
      btnSimpan.textContent = "Simpan Perubahan";
      return;
    }

    berkasLamaUntukDihapus.forEach(function (u) { hapusBerkasLamaAdmin(u); });

    const hasilAnggota = await Promise.all(anggotaBaru.map(function (a) {
      return supabaseClient.from("anggota_tim").update({
        nama: a.nama, tempat_lahir: a.tempat_lahir, tanggal_lahir: a.tanggal_lahir, kelas: a.kelas, nomor_punggung: a.nomor_punggung
      }).eq("id", a.id);
    }));
    const errorAnggota = hasilAnggota.find(function (h) { return h.error; });
    if (errorAnggota) {
      alert("Data tim tersimpan, tapi sebagian data anggota gagal disimpan: " + errorAnggota.error.message);
    }

    Object.assign(row, payloadTim);
    if (typeof renderRekapPendaftarRef === "function") renderRekapPendaftarRef();
    if (typeof renderBarisPendaftarRef === "function") renderBarisPendaftarRef();
    bukaModalTim(row, rule);
  });
}

/* -------- Popup detail peserta INDIVIDU: dibuka dengan mengetuk baris -------- */
// Sejak migrasi 0027, baris peserta individu juga bisa diketuk (sebelumnya
// cuma baris tim/Futsal yang bisa) supaya panitia bisa lihat data lengkapnya,
// termasuk field "Nama Pendamping" yang SENGAJA TIDAK ditampilkan sebagai
// kolom di tabel Data Pendaftar (biar tabelnya tetap ramping). Tidak perlu
// query tambahan ke database -- semua field sudah ada di `row` (hasil
// select("*") pada `pendaftaran`), jadi fungsi ini sinkron (tidak seperti
// bukaModalTim yang harus memuat anggota_tim secara async). "rule" (baris
// lomba_rules yang cocok, opsional, migrasi 0052) dipakai untuk membatasi
// pilihan jenjang/jenis kelamin di form edit (lihat bukaModalIndividuEdit())
// sesuai syarat lomba ini, dan untuk menghitung ulang usia memakai tanggal
// pelaksanaan lomba kalau tanggal lahirnya diubah -- kalau tidak disediakan,
// popup tetap tampil normal, cuma form edit jadi lebih longgar (input bebas).
function bukaModalIndividu(row, rule) {
  const infoHTML =
    '<div class="modal-field-grid">' +
      '<div class="modal-field modal-field--full"><span class="modal-field__label">Nama Lengkap Peserta</span><span class="modal-field__value">' + escapeHTML(row.nama_lengkap) + '</span></div>' +
      '<div class="modal-field"><span class="modal-field__label">Nama Pendamping</span><span class="modal-field__value">' + escapeHTML(row.nama_pendamping || "-") + '</span></div>' +
      '<div class="modal-field"><span class="modal-field__label">Jenjang/Kelas</span><span class="modal-field__value">' + escapeHTML(row.jenjang) + '/' + escapeHTML(row.kelas) + '</span></div>' +
      '<div class="modal-field"><span class="modal-field__label">Jenis Kelamin</span><span class="modal-field__value">' + (row.jenis_kelamin === "perempuan" ? "Perempuan" : row.jenis_kelamin === "laki-laki" ? "Laki-laki" : "-") + '</span></div>' +
      '<div class="modal-field"><span class="modal-field__label">Tanggal Lahir</span><span class="modal-field__value">' + formatTanggalLahir(row.tanggal_lahir) + (row.usia != null ? " (" + row.usia + " th)" : "") + '</span></div>' +
      '<div class="modal-field"><span class="modal-field__label">Asal Sekolah</span><span class="modal-field__value">' + escapeHTML(row.asal_sekolah) + '</span></div>' +
      '<div class="modal-field"><span class="modal-field__label">No. WhatsApp</span><span class="modal-field__value">' + escapeHTML(row.whatsapp) + '</span></div>' +
      '<div class="modal-field"><span class="modal-field__label">Email</span><span class="modal-field__value">' + escapeHTML(row.email || "-") + '</span></div>' +
      '<div class="modal-field"><span class="modal-field__label">Nomor Pendaftaran</span><span class="modal-field__value">' + escapeHTML(row.nomor_pendaftaran) + '</span></div>' +
      '<div class="modal-field"><span class="modal-field__label">Tipe Pendaftar</span><span class="modal-field__value">' + labelTipePendaftarHTML(row) + '</span></div>' +
      '<div class="modal-field modal-field--full"><span class="modal-field__label">Status (ketuk untuk ubah)</span><span class="modal-field__value">' + statusSelectPopupHTML(row.id, row.status, false) + '</span></div>' +
      '<div class="modal-field modal-field--full"><span class="modal-field__label">Sertifikat Pendamping</span><span class="modal-field__value"><span class="sertifikat-link-wrap" data-id="' + escapeHTML(row.id) + '"></span></span></div>' +
    '</div>' +
    (row.status === "Perlu Verifikasi Usia"
      ? '<p class="modal-status-hint">Usia peserta ini di luar syarat jenjang lomba pada tanggal pelaksanaan -- silakan cek data sebelum memutuskan status akhirnya.</p>'
      : "") +
    (row.status === "Ditolak" && row.alasan_penolakan
      ? '<p class="modal-status-hint"><strong>Alasan Penolakan:</strong> ' + escapeHTML(row.alasan_penolakan) + '</p>'
      : "") +
    '<p class="modal-section-title">Berkas</p>' +
    '<div class="modal-berkas-row">' +
      chipBerkasHTML("Kartu Pelajar", row.url_kartu_pelajar) +
      renderDaftarBerkasTim(row.url_bukti_follow_ig, "Bukti IG") +
    '</div>' +
    '<div class="submit-row" style="display:flex;justify-content:flex-end;margin-top:16px;">' +
      '<button type="button" class="btn btn--ghost" id="btn-edit-individu">✏️ Edit Data</button>' +
    '</div>';

  bukaPanelDetail("Detail Peserta — " + row.nama_lengkap, infoHTML);
  pasangListenerStatusPopup(row, false, rule);

  const btnEditIndividu = document.getElementById("btn-edit-individu");
  if (btnEditIndividu) btnEditIndividu.addEventListener("click", function () { bukaModalIndividuEdit(row, rule); });
}

/* -------- Form edit data peserta individu (migrasi 0052) -------- */
// Dibuka lewat tombol "✏️ Edit Data" di bukaModalIndividu(). Field yang
// SENGAJA TIDAK disediakan di sini: Nomor Pendaftaran (identitas sistem,
// dikelola otomatis lewat ambil_nomor_berikutnya()/status "Ditolak" -- lihat
// RPC ubah_status_pendaftaran() di migrasi 0052) & berkas unggahan
// (mengganti file perlu alur unggah ulang yang lebih rumit, di luar cakupan
// permintaan ini -- panitia tetap bisa membuka berkasnya lewat chip di
// popup detail seperti biasa).
function bukaModalIndividuEdit(row, rule) {
  const opsiJenjang = rule && Array.isArray(rule.jenjang) && rule.jenjang.length ? rule.jenjang : null;
  const opsiGender = rule && rule.gender_diizinkan && rule.gender_diizinkan !== "semua"
    ? [rule.gender_diizinkan]
    : ["laki-laki", "perempuan"];

  const formHTML =
    '<div class="field-row">' +
      '<div class="field"><label for="edit-nama-lengkap">Nama Lengkap Peserta</label><input type="text" id="edit-nama-lengkap" value="' + escapeHTML(row.nama_lengkap) + '"></div>' +
      '<div class="field"><label for="edit-nama-pendamping">Nama Pendamping</label><input type="text" id="edit-nama-pendamping" value="' + escapeHTML(row.nama_pendamping || "") + '"></div>' +
    '</div>' +
    '<div class="field-row">' +
      '<div class="field"><label for="edit-jenjang">Jenjang</label>' +
        (opsiJenjang
          ? ('<select id="edit-jenjang">' + opsiJenjang.map(function (j) { return '<option value="' + escapeHTML(j) + '"' + (j === row.jenjang ? " selected" : "") + '>' + escapeHTML(j) + '</option>'; }).join("") + '</select>')
          : ('<input type="text" id="edit-jenjang" value="' + escapeHTML(row.jenjang) + '">')) +
      '</div>' +
      '<div class="field"><label for="edit-kelas">Kelas</label><input type="text" id="edit-kelas" value="' + escapeHTML(row.kelas || "") + '"></div>' +
    '</div>' +
    '<div class="field-row">' +
      '<div class="field"><label for="edit-jenis-kelamin">Jenis Kelamin</label><select id="edit-jenis-kelamin">' +
        opsiGender.map(function (g) { return '<option value="' + g + '"' + (g === row.jenis_kelamin ? " selected" : "") + '>' + (g === "laki-laki" ? "Laki-laki" : "Perempuan") + '</option>'; }).join("") +
      '</select></div>' +
      '<div class="field"><label for="edit-tanggal-lahir">Tanggal Lahir</label><input type="date" id="edit-tanggal-lahir" value="' + escapeHTML(row.tanggal_lahir || "") + '"></div>' +
    '</div>' +
    '<div class="field-row">' +
      '<div class="field"><label for="edit-asal-sekolah">Asal Sekolah</label><input type="text" id="edit-asal-sekolah" value="' + escapeHTML(row.asal_sekolah || "") + '"></div>' +
      '<div class="field"><label for="edit-whatsapp">No. WhatsApp</label><input type="text" id="edit-whatsapp" value="' + escapeHTML(row.whatsapp || "") + '"></div>' +
    '</div>' +
    '<div class="field"><label for="edit-email">Email</label><input type="email" id="edit-email" value="' + escapeHTML(row.email || "") + '"></div>' +
    '<p class="modal-section-title" style="margin-top:18px;">Ganti Berkas</p>' +
    '<p class="hint">Kosongkan kotak mana pun yang tidak perlu diganti -- berkas lamanya tetap dipakai apa adanya.</p>' +
    '<div class="field"><label for="edit-file-kartu">Kartu Pelajar / Surat Aktif' + (row.url_kartu_pelajar ? ' (<a href="' + row.url_kartu_pelajar + '" target="_blank" rel="noopener">lihat berkas saat ini</a>)' : ' (belum ada)') + '</label><input type="file" id="edit-file-kartu" accept="image/*,.pdf"></div>' +
    '<div class="field-row">' +
      bukaUrlBerkasArray(row.url_bukti_follow_ig, 2).map(function (u, i) {
        return '<div class="field"><label for="edit-file-ig' + i + '">Bukti IG #' + (i + 1) + (u ? ' (<a href="' + u + '" target="_blank" rel="noopener">lihat berkas saat ini</a>)' : ' (belum ada)') + '</label><input type="file" id="edit-file-ig' + i + '" accept="image/*,.pdf"></div>';
      }).join("") +
    '</div>' +
    '<p class="hint">Nomor pendaftaran tidak bisa diubah lewat form ini.</p>' +
    '<div class="submit-row" style="display:flex;justify-content:flex-end;gap:10px;margin-top:10px;">' +
      '<button type="button" class="btn btn--ghost" id="btn-batal-edit-individu">Batal</button>' +
      '<button type="button" class="btn btn--primary" id="btn-simpan-edit-individu">Simpan Perubahan</button>' +
    '</div>';

  bukaPanelDetail("Edit Data Peserta — " + row.nama_lengkap, formHTML);

  document.getElementById("btn-batal-edit-individu").addEventListener("click", function () {
    bukaModalIndividu(row, rule);
  });

  document.getElementById("btn-simpan-edit-individu").addEventListener("click", async function () {
    const namaBaru = document.getElementById("edit-nama-lengkap").value.trim();
    const jenjangBaru = document.getElementById("edit-jenjang").value.trim();
    const kelasBaru = document.getElementById("edit-kelas").value.trim();
    const genderBaru = document.getElementById("edit-jenis-kelamin").value;
    const tanggalBaru = document.getElementById("edit-tanggal-lahir").value;
    const sekolahBaru = document.getElementById("edit-asal-sekolah").value.trim();
    const waBaru = document.getElementById("edit-whatsapp").value.trim();
    const emailBaru = document.getElementById("edit-email").value.trim();
    const pendampingBaru = document.getElementById("edit-nama-pendamping").value.trim();

    if (!namaBaru || !jenjangBaru || !kelasBaru || !tanggalBaru || !sekolahBaru || !waBaru) {
      alert("Nama, Jenjang, Kelas, Tanggal Lahir, Asal Sekolah, dan No. WhatsApp wajib diisi.");
      return;
    }

    // Usia dihitung ulang memakai tanggal PELAKSANAAN lomba sebagai acuan
    // (sama seperti submit_pendaftaran() di server) -- bukan tanggal hari
    // ini, supaya tetap konsisten dengan cara "usia" ini dipakai di tempat
    // lain (pengecekan status "Perlu Verifikasi Usia").
    const acuanUsia = (rule && rule.tanggal_pelaksanaan) || null;
    const usiaBaru = hitungUsiaDariTanggal(tanggalBaru, acuanUsia);

    const payload = {
      nama_lengkap: namaBaru,
      nama_pendamping: pendampingBaru || null,
      jenjang: jenjangBaru,
      kelas: kelasBaru,
      jenis_kelamin: genderBaru,
      tanggal_lahir: tanggalBaru,
      usia: usiaBaru,
      asal_sekolah: sekolahBaru,
      whatsapp: waBaru,
      email: emailBaru || null
    };

    const btnSimpan = document.getElementById("btn-simpan-edit-individu");
    btnSimpan.disabled = true;
    btnSimpan.textContent = "Mengunggah berkas...";

    // Sama seperti bukaModalTimEdit(): unggah dulu berkas pengganti yang
    // dipilih (kotak kosong dilewati), baru masukkan URL barunya ke
    // payload -- berkas LAMA yang tergantikan baru dihapus dari Storage
    // SETELAH baris `pendaftaran` berhasil disimpan dengan URL baru.
    const berkasLamaUntukDihapus = [];
    try {
      const fileKartuBaru = document.getElementById("edit-file-kartu").files[0] || null;
      if (fileKartuBaru) {
        payload.url_kartu_pelajar = await unggahGantiBerkasAdmin(fileKartuBaru, "kartu-pelajar");
        if (row.url_kartu_pelajar) berkasLamaUntukDihapus.push(row.url_kartu_pelajar);
      }

      const igLama = bukaUrlBerkasArray(row.url_bukti_follow_ig, 2);
      const igBaru = igLama.slice();
      let igBerubah = false;
      for (let i = 0; i < igLama.length; i++) {
        const fileIgBaru = document.getElementById("edit-file-ig" + i).files[0] || null;
        if (!fileIgBaru) continue;
        igBaru[i] = await unggahGantiBerkasAdmin(fileIgBaru, "bukti-ig-" + (i + 1));
        if (igLama[i]) berkasLamaUntukDihapus.push(igLama[i]);
        igBerubah = true;
      }
      if (igBerubah) payload.url_bukti_follow_ig = igBaru;
    } catch (e) {
      alert(e.message || "Gagal mengunggah berkas pengganti.");
      btnSimpan.disabled = false;
      btnSimpan.textContent = "Simpan Perubahan";
      return;
    }

    btnSimpan.textContent = "Menyimpan...";

    const { error } = await supabaseClient.from("pendaftaran").update(payload).eq("id", row.id);
    if (error) {
      alert("Gagal menyimpan perubahan: " + error.message);
      btnSimpan.disabled = false;
      btnSimpan.textContent = "Simpan Perubahan";
      return;
    }

    berkasLamaUntukDihapus.forEach(function (u) { hapusBerkasLamaAdmin(u); });

    Object.assign(row, payload);
    if (typeof renderRekapPendaftarRef === "function") renderRekapPendaftarRef();
    if (typeof renderBarisPendaftarRef === "function") renderBarisPendaftarRef();
    bukaModalIndividu(row, rule);
  });
}

/* -------- Kirim notifikasi WA (Fonnte) lewat Edge Function -- TIDAK DIPAKAI
   LAGI sejak migrasi 0051 (diganti tombol "Kirim WA"/wa.me manual di bawah),
   fungsi ini SENGAJA DIBIARKAN (tidak dihapus) kalau suatu saat Fonnte mau
   dipakai lagi -- lihat catatan di migrasi 0051. -------- */
async function kirimNotifikasiWA(id, selEl) {
  const noteEl = document.querySelector('.wa-status-note[data-note-for="' + id + '"]');
  if (noteEl) noteEl.textContent = " · mengirim WA...";
  try {
    const { data, error } = await supabaseClient.functions.invoke("kirim-notifikasi-wa", { body: { id: id } });
    if (error) throw error;
    if (data && data.success === false) throw new Error(data.message || "Gagal mengirim notifikasi WA.");
    if (noteEl) {
      noteEl.textContent = " · ✅ WA terkirim";
      setTimeout(function () { if (noteEl) noteEl.textContent = ""; }, 4000);
    }
  } catch (err) {
    console.error("Gagal mengirim notifikasi WA:", err);
    if (noteEl) {
      noteEl.textContent = " · ⚠️ WA gagal terkirim";
      noteEl.title = (err && err.message) || String(err);
    }
  }
}

/* ==================== KIRIM WA LEWAT wa.me (migrasi 0051) ====================
   Menggantikan pengiriman OTOMATIS lewat Fonnte di atas -- pesan dirangkai
   di BROWSER panitia sendiri (bukan Edge Function), memakai template yang
   SAMA (site_settings.wa_template_per_status/wa_notif_template, diedit di
   tab "Notifikasi WA"), lalu dijadikan link `https://wa.me/<nomor>?text=...`
   yang panitia klik manual untuk membuka WhatsApp & mengirim sendiri. Logika
   placeholder {nama}/{nomor}/{lomba}/{status}/{grup}/{anggota_usia}/
   {link_lengkapi}/{alasan} SENGAJA direplikasi PERSIS dari Edge Function
   kirim-notifikasi-wa/index.ts (lihat komentar di sana) supaya isi pesannya
   tidak berubah, cuma cara kirimnya yang berubah. */

// "08..." -> "628..." -- sama persis normalisasiNomorWA() di Edge Function.
function normalisasiNomorWALomba(nomor) {
  let bersih = String(nomor || "").replace(/[^0-9]/g, "");
  if (bersih.indexOf("0") === 0) bersih = "62" + bersih.slice(1);
  if (bersih.indexOf("8") === 0) bersih = "62" + bersih;
  return bersih;
}

function terapkanTemplateWALomba(template, data) {
  return String(template || "").replace(/\{(\w+)\}/g, function (m, key) {
    return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : m;
  });
}

function buatLinkWaMeLomba(nomor, pesan) {
  const tujuan = normalisasiNomorWALomba(nomor);
  if (!tujuan) return null;
  return "https://wa.me/" + tujuan + "?text=" + encodeURIComponent(pesan);
}

// Cache sederhana di level modul -- template/link grup/URL situs jarang
// berubah dalam satu sesi panitia terbuka, jadi tidak perlu query ulang
// setiap kali tombol "Kirim WA" dibangun (mis. tiap kali popup detail
// dibuka). Dikosongkan lagi (lihat loadTabNotifWa) begitu panitia menyimpan
// perubahan template di tab "Notifikasi WA", supaya tombol langsung
// memakai versi terbaru tanpa perlu memuat ulang halaman.
let _cacheSiteSettingsWALomba = null;
async function ambilSiteSettingsWALomba() {
  if (_cacheSiteSettingsWALomba) return _cacheSiteSettingsWALomba;
  const { data } = await supabaseClient
    .from("site_settings")
    .select("wa_notif_template, wa_template_per_status, link_grup_wa, link_grup_wa_futsal, site_url")
    .eq("id", 1).single();
  _cacheSiteSettingsWALomba = data || {};
  return _cacheSiteSettingsWALomba;
}

// Usia pada tanggal acuan -- SAMA PERSIS rumusnya dengan hitungUsia() di
// Edge Function kirim-notifikasi-wa/index.ts (migrasi 0018).
function hitungUsiaWALomba(tanggalLahir, tanggalAcuan) {
  try {
    const lahir = new Date(tanggalLahir + "T00:00:00Z");
    const acuan = new Date(tanggalAcuan + "T00:00:00Z");
    if (isNaN(lahir.getTime()) || isNaN(acuan.getTime())) return null;
    let usia = acuan.getUTCFullYear() - lahir.getUTCFullYear();
    const belumUlangTahun =
      acuan.getUTCMonth() < lahir.getUTCMonth() ||
      (acuan.getUTCMonth() === lahir.getUTCMonth() && acuan.getUTCDate() < lahir.getUTCDate());
    if (belumUlangTahun) usia--;
    return usia;
  } catch (e) {
    return null;
  }
}

// {anggota_usia}: replikasi PERSIS logika Edge Function -- cuma relevan
// untuk pendaftaran tim (Futsal) berstatus "Perlu Verifikasi Usia".
async function hitungAnggotaUsiaTextWALomba(row, rule) {
  if (row.tipe !== "tim") return "";
  const syaratJenjang = rule && rule.usia_per_jenjang ? rule.usia_per_jenjang[row.jenjang] : null;
  if (!syaratJenjang || syaratJenjang.min == null || syaratJenjang.max == null) return "";
  const tanggalAcuan = (rule && rule.tanggal_pelaksanaan) || new Date().toISOString().slice(0, 10);
  const { data: anggotaList } = await supabaseClient
    .from("anggota_tim")
    .select("nama, tanggal_lahir")
    .eq("nomor_pendaftaran", row.nomor_pendaftaran);
  const namaDiLuarSyarat = (anggotaList || [])
    .filter(function (a) {
      if (!a.tanggal_lahir) return false;
      const usia = hitungUsiaWALomba(a.tanggal_lahir, tanggalAcuan);
      return usia != null && (usia < syaratJenjang.min || usia > syaratJenjang.max);
    })
    .map(function (a) { return a.nama; });
  return namaDiLuarSyarat.join(", ");
}

// Merangkai teks pesan WA untuk status `row.status` SAAT INI -- replikasi
// PERSIS gating {grup}/{link_lengkapi}/{alasan} dari Edge Function
// kirim-notifikasi-wa/index.ts (migrasi 0028/0032/0036/0048).
async function bangunPesanWALomba(row, rule) {
  const settings = await ambilSiteSettingsWALomba();
  const templatePerStatus = settings.wa_template_per_status ? settings.wa_template_per_status[row.status] : null;
  const template = templatePerStatus || settings.wa_notif_template ||
    "Assalamu'alaikum {nama}, status pendaftaran Anda di {lomba} ALIF 5.0 (nomor {nomor}) kini: {status}.";

  const namaTampil = row.tipe === "tim" ? (row.nama_tim || row.nama_lengkap) : row.nama_lengkap;
  const anggotaUsiaText = await hitungAnggotaUsiaTextWALomba(row, rule);

  const grupUntukStatusIni = row.status === "Diterima"
    ? ((row.lomba_id === "futsal" && settings.link_grup_wa_futsal) || settings.link_grup_wa || "")
    : "";

  const linkLengkapiUntukStatusIni =
    (row.status === "Perlu Tambah Nomor Punggung" && row.token_lengkapi && settings.site_url)
      ? (settings.site_url + "/#/lengkapi?token=" + row.token_lengkapi)
      : "";

  const alasanUntukStatusIni = (row.status === "Ditolak" && row.alasan_penolakan) || "";

  return terapkanTemplateWALomba(template, {
    nama: namaTampil || "-",
    nomor: row.nomor_pendaftaran || "-",
    lomba: row.lomba_nama || "-",
    status: row.status || "-",
    grup: grupUntukStatusIni,
    anggota_usia: anggotaUsiaText,
    link_lengkapi: linkLengkapiUntukStatusIni,
    alasan: alasanUntukStatusIni
  });
}

// Mengisi `.wa-kirim-wrap[data-id=...]` (lihat statusSelectPopupHTML()) --
// kosong kalau status saat ini bukan salah satu dari 4 status yang memang
// butuh notifikasi (STATUS_WA_LIST, didefinisikan di bawah di tab
// "Notifikasi WA"). Tombolnya SELALU aktif/bisa diklik lagi (bukan
// dinonaktifkan permanen) supaya panitia tetap bisa kirim ULANG kalau perlu
// -- `wa_terkirim` cuma mengubah labelnya, bukan menghilangkan tombolnya.
async function renderTombolWALomba(row, rule) {
  const wrap = document.querySelector('.wa-kirim-wrap[data-id="' + row.id + '"]');
  if (!wrap) return;
  if (STATUS_WA_LIST.indexOf(row.status) === -1) { wrap.innerHTML = ""; return; }

  wrap.innerHTML = '<span class="hint">Menyiapkan tautan WA...</span>';
  let link;
  try {
    const pesan = await bangunPesanWALomba(row, rule);
    link = buatLinkWaMeLomba(row.whatsapp, pesan);
  } catch (e) {
    wrap.innerHTML = '<span class="hint">⚠️ Gagal menyiapkan tautan WA.</span>';
    console.error("Gagal merangkai pesan WA:", e);
    return;
  }
  if (!link) {
    wrap.innerHTML = '<span class="hint">⚠️ Nomor WhatsApp tidak valid, tidak bisa membuat tautan WA.</span>';
    return;
  }

  // Elemen yang sama dicek ulang (bukan dianggap masih ada) karena fungsi
  // ini ASYNC -- popup bisa saja sudah ditutup/dibuka ulang selagi menunggu
  // query di atas, jadi `wrap` lama bisa sudah lepas dari DOM.
  const wrapTerkini = document.querySelector('.wa-kirim-wrap[data-id="' + row.id + '"]');
  if (!wrapTerkini) return;
  wrapTerkini.innerHTML =
    '<a href="' + link + '" target="_blank" rel="noopener" class="btn-link btn-kirim-wa" data-id="' + escapeHTML(row.id) + '">' +
      (row.wa_terkirim ? "✅ Kirim Ulang WA" : "📲 Kirim WA") +
    '</a>';

  wrapTerkini.querySelector(".btn-kirim-wa").addEventListener("click", async function () {
    // Link wa.me tetap dibuka APA ADANYA oleh browser (target="_blank") --
    // listener ini cuma menandai `wa_terkirim = true` SECARA PARALEL, tidak
    // pernah mem-preventDefault apa pun, supaya panitia tidak lupa sudah
    // mengklik tombol ini untuk status saat ini.
    if (row.wa_terkirim) return; // sudah ditandai sebelumnya, tidak perlu update lagi
    const { error } = await supabaseClient.from("pendaftaran").update({ wa_terkirim: true }).eq("id", row.id);
    if (!error) {
      row.wa_terkirim = true;
      if (typeof renderBarisPendaftarRef === "function") renderBarisPendaftarRef();
      renderTombolWALomba(row, rule);
    }
  });
}

async function loadTabPendaftar() {
  const content = document.getElementById("admin-content");
  content.innerHTML = '<p class="hint">Memuat data pendaftar...</p>';

  const rulesRes = await supabaseClient.from("lomba_rules").select("id,nama,ikon,jenjang,kuota,usia_per_jenjang,tanggal_pelaksanaan,gender_diizinkan").order("urutan");
  const rowsRes = await supabaseClient.from("pendaftaran").select("*").order("created_at", { ascending: false });

  if (rowsRes.error) {
    content.innerHTML = "<p>Gagal memuat data pendaftar: " + rowsRes.error.message + "</p>";
    return;
  }

  const rules = rulesRes.data || [];
  let rows = rowsRes.data || [];
  let lombaFilter = ""; // diatur dengan mengetuk kartu rekap, bukan dropdown lagi

  content.innerHTML =
    '<div class="rekap-grid" id="rekap-grid"></div>' +
    '<div class="poster-rekap-toolbar" style="margin:4px 0 16px;display:flex;gap:10px;flex-wrap:wrap;">' +
      '<button type="button" class="btn btn--ghost" id="btn-buka-poster-rekap">🖼️ Buat Poster Rekap</button>' +
      '<button type="button" class="btn btn--ghost" id="btn-unduh-xlsx">⬇️ Unduh Data (XLSX)</button>' +
    '</div>' +
    '<div class="admin-filters">' +
      '<input type="text" id="filter-cari" placeholder="Cari nama / nomor pendaftaran..." />' +
    '</div>' +
    '<p class="hint" id="jumlah-hint"></p>' +
    '<div class="table-wrap"><table class="admin-table" id="tabel-pendaftar"><thead><tr>' +
      '<th>Nomor</th><th>Nama</th><th>Lomba</th><th class="col-status">Status</th><th></th>' +
    '</tr></thead><tbody></tbody></table></div>';

  /* -------- Kuota efektif per sel (jenjang x gender), sama dengan rumus di server -------- */
  function kuotaEfektifRule(r) {
    if (r.kuota == null) return null;
    const n = (r.jenjang && r.jenjang.length) || 1;
    return Math.floor(r.kuota / n);
  }

  /* -------- Rekap kartu (jumlah per lomba + jenis kelamin) --------
     Ditampilkan sebagai "terisi/kapasitas" per jenjang & gender (bukan
     angka kuota yang sudah dibagi begitu saja) supaya tidak ambigu.

     Pendaftar berstatus "Ditolak" SENGAJA TIDAK ikut dihitung di sini --
     pendaftar yang sudah ditolak tidak lagi dianggap mengisi slot/kuota,
     jadi kartu rekap (dan kartu "KUOTA PENUH" yang dihitung dari totalnya)
     tidak boleh ikut menghitungnya. `rows` yang sebenarnya (tanpa difilter)
     tetap dipakai apa adanya untuk tabel pendaftar & unduhan XLSX di bawah --
     admin tetap perlu melihat/mengunduh baris yang ditolak, cuma tidak ikut
     masuk hitungan rekap. */
  function renderRekap() {
    const rekapEl = document.getElementById("rekap-grid");
    if (!rekapEl) return;

    const rowsRekap = rows.filter(function (r) { return r.status !== "Ditolak"; });

    const perLomba = {};
    rules.forEach(function (r) { perLomba[r.id] = { total: 0, l: 0, p: 0, perJenjang: {} }; });
    let totalL = 0, totalP = 0;
    rowsRekap.forEach(function (r) {
      const d = perLomba[r.lomba_id];
      if (d) {
        d.total++;
        if (r.jenis_kelamin === "laki-laki") d.l++;
        else if (r.jenis_kelamin === "perempuan") d.p++;
        if (!d.perJenjang[r.jenjang]) d.perJenjang[r.jenjang] = { l: 0, p: 0 };
        if (r.jenis_kelamin === "laki-laki") d.perJenjang[r.jenjang].l++;
        else if (r.jenis_kelamin === "perempuan") d.perJenjang[r.jenjang].p++;
      }
      if (r.jenis_kelamin === "laki-laki") totalL++;
      else if (r.jenis_kelamin === "perempuan") totalP++;
    });

    let html = '<div class="rekap-card' + (lombaFilter === "" ? " is-active" : "") + '" data-lomba="">' +
      '<div class="rekap-card__label">Semua Lomba</div>' +
      '<div class="rekap-card__total">' + rowsRekap.length + '</div>' +
      '<div class="rekap-card__gender"><span class="rekap-chip">L: ' + totalL + ' · P: ' + totalP + '</span></div>' +
    '</div>';

    html += rules.map(function (r) {
      const d = perLomba[r.id] || { total: 0, l: 0, p: 0, perJenjang: {} };
      const efektif = kuotaEfektifRule(r);
      const jenjangList = r.jenjang || [];
      let totalLabel = String(d.total);
      let genderLabel;

      // Lomba yang sudah dikunci ke satu jenis kelamin (gender_diizinkan
      // bukan "semua") tidak akan pernah punya peserta gender lain, jadi
      // split L/P di sini cuma bikin bingung (seolah ada slot gender lain
      // yang bisa terisi padahal tidak akan pernah ada peserta gender itu) --
      // tampilkan angka tunggal saja, dan kapasitas totalnya juga TIDAK
      // dikali 2 (cuma satu sel gender yang berlaku untuk lomba ini).
      const genderTerkunci = r.gender_diizinkan !== "semua";

      // Kartu rekap ditandai besar-besar "KUOTA PENUH" kalau SEMUA sel
      // (jenjang x gender yang berlaku untuk lomba ini) sudah mencapai
      // kuota efektifnya -- sama seperti aturan "lomba penuh" di halaman
      // Daftar Lomba publik (assets/js/view-daftar.js, fungsi kuotaPenuh()).
      let kartuPenuh = false;

      if (efektif !== null) {
        const kapasitasTotal = efektif * jenjangList.length * (genderTerkunci ? 1 : 2);
        totalLabel = d.total + ' / ' + kapasitasTotal;
        kartuPenuh = d.total >= kapasitasTotal;
        genderLabel = jenjangList.map(function (j) {
          const jd = d.perJenjang[j] || { l: 0, p: 0 };
          if (genderTerkunci) {
            const terisi = r.gender_diizinkan === "laki-laki" ? jd.l : jd.p;
            const selPenuh = terisi >= efektif ? " rekap-chip--penuh" : "";
            return '<span class="rekap-chip' + selPenuh + '">' + j + ': ' + terisi + '/' + efektif + '</span>';
          }
          const selPenuh = (jd.l >= efektif && jd.p >= efektif) ? " rekap-chip--penuh" : "";
          return '<span class="rekap-chip' + selPenuh + '">' + j + ': L ' + jd.l + '/' + efektif + ' · P ' + jd.p + '/' + efektif + '</span>';
        }).join("");
      } else if (genderTerkunci) {
        genderLabel = '<span class="rekap-chip">' + (r.gender_diizinkan === "laki-laki" ? d.l : d.p) + ' peserta</span>';
      } else {
        genderLabel = '<span class="rekap-chip">L: ' + d.l + ' · P: ' + d.p + '</span>';
      }

      return '<div class="rekap-card' + (lombaFilter === r.id ? " is-active" : "") + (kartuPenuh ? " rekap-card--penuh" : "") + '" data-lomba="' + r.id + '">' +
        (kartuPenuh ? '<div class="rekap-card__badge-penuh">KUOTA PENUH</div>' : "") +
        '<div class="rekap-card__label">' + (r.ikon || "") + ' ' + r.nama + '</div>' +
        '<div class="rekap-card__total">' + totalLabel + '</div>' +
        '<div class="rekap-card__gender">' + genderLabel + '</div>' +
      '</div>';
    }).join("");

    rekapEl.innerHTML = html;

    rekapEl.querySelectorAll(".rekap-card").forEach(function (card) {
      card.addEventListener("click", function () {
        lombaFilter = card.getAttribute("data-lomba");
        document.getElementById("filter-cari").value = "";
        renderBaris();
        renderRekap();
      });
    });
  }

  function renderBaris() {
    const cari = document.getElementById("filter-cari").value.toLowerCase();

    const tampil = rows.filter(function (r) {
      if (lombaFilter && r.lomba_id !== lombaFilter) return false;
      if (cari && r.nama_lengkap.toLowerCase().indexOf(cari) === -1 &&
          r.nomor_pendaftaran.toLowerCase().indexOf(cari) === -1) return false;
      return true;
    });

    document.getElementById("jumlah-hint").textContent = "Menampilkan " + tampil.length + " dari " + rows.length + " pendaftar.";

    const tbody = document.querySelector("#tabel-pendaftar tbody");
    if (tampil.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5">Tidak ada data yang cocok.</td></tr>';
      return;
    }

    // Tabel diringkas lebih jauh (permintaan panitia) -- kolom Jenjang/Kelas,
    // Lahir/Usia, Tipe (ikon lembaga/individu), Sekolah, & WA SUDAH DIPINDAH
    // ke popup detail (lihat bukaModalIndividu/bukaModalTim di bawah, field
    // "Tipe Pendaftar" & "Asal Sekolah" ditambahkan ke SANA supaya tidak ada
    // informasi yang hilang). Kolom "Berkas" sendiri sudah dipindah lebih
    // dulu (lihat catatan lama di bawah). Tabel sekarang cuma menyisakan
    // info untuk SCAN CEPAT/CARI (Nomor, Nama, Lomba, Status) + Aksi Hapus --
    // detail lengkap lainnya semua di popup, satu ketuk saja.
    tbody.innerHTML = tampil.map(function (r) {
      return (
        '<tr class="row-clickable ' + kelasBarisStatusLomba(r.status) + '" data-id="' + r.id + '">' +
          '<td>' + r.nomor_pendaftaran + '</td>' +
          '<td class="col-truncate" title="' + r.nama_lengkap + '">' + r.nama_lengkap + ' <span class="lp-badge">' + (r.tipe === "tim" ? "TIM" : (r.jenis_kelamin === "perempuan" ? "P" : r.jenis_kelamin === "laki-laki" ? "L" : "-")) + '</span> <span class="lp-badge">ketuk untuk detail</span></td>' +
          '<td>' + r.lomba_nama + '</td>' +
          '<td class="col-status">' + pilStatusLombaHTML(r.status) + (r.wa_terkirim ? ' <span class="hint" title="Tombol Kirim WA sudah diklik untuk status saat ini">✅</span>' : '') + '</td>' +
          '<td><button type="button" class="btn-remove btn-hapus-pendaftar" data-id="' + r.id + '">Hapus</button></td>' +
        '</tr>'
      );
    }).join("");

    // Semua baris (tim/Futsal maupun individu) bisa diketuk di mana saja untuk
    // membuka popup detail -- kecuali kalau yang diketuk adalah tombol/dropdown
    // di dalam baris itu sendiri (status, hapus, lihat berkas), supaya tidak
    // bentrok dengan aksi masing-masing. Baris tim membuka bukaModalTim
    // (dengan daftar anggota tim), baris individu membuka bukaModalIndividu
    // (migrasi 0027) yang menampilkan field "Nama Pendamping" yang sengaja
    // tidak dijadikan kolom tabel.
    tbody.querySelectorAll("tr.row-clickable").forEach(function (tr) {
      tr.addEventListener("click", function (e) {
        if (e.target.closest("select, button, a")) return;
        const id = tr.getAttribute("data-id");
        const row = rows.find(function (r) { return r.id === id; });
        if (!row) return;
        if (row.tipe === "tim") {
          bukaModalTim(row, rules.find(function (l) { return l.id === row.lomba_id; }));
        } else {
          bukaModalIndividu(row, rules.find(function (l) { return l.id === row.lomba_id; }));
        }
      });
    });

    // (Tombol "Lihat berkas" / class ".btn-lihat-tim" yang dulu ada di kolom
    // Berkas, beserta listener-nya, sudah dihapus bersamaan dengan kolom
    // Berkas itu sendiri -- lihat komentar di renderBaris() di atas. Baris
    // tim tetap bisa dibuka lewat listener "row-clickable" di atas.)

    // (Dropdown status & logika penyimpanannya -- dulu ada persis di sini,
    // di kolom Status tabel -- SUDAH DIPINDAH ke dalam popup detail. Lihat
    // commitPerubahanStatusLomba()/bukaModalAlasanPenolakanPopup()/
    // pasangListenerStatusPopup() di scope atas file ini, dipanggil dari
    // bukaModalIndividu()/bukaModalTim(). Kolom Status di tabel sekarang
    // murni tampilan baca-saja lewat pilStatusLombaHTML().)

    tbody.querySelectorAll(".btn-hapus-pendaftar").forEach(function (btn) {
      btn.addEventListener("click", async function () {
        const id = btn.getAttribute("data-id");
        const row = rows.find(function (r) { return r.id === id; });
        const label = row ? (row.nama_lengkap + " (" + row.nomor_pendaftaran + ")") : "";
        if (!confirm('Hapus pendaftaran "' + label + '"? Berkas yang sudah diunggah (Surat, Kartu, Screenshot IG) juga akan ikut terhapus permanen. Tindakan ini tidak bisa dibatalkan.')) return;

        btn.disabled = true;
        btn.textContent = "Menghapus...";

        if (row) {
          const urlIgList = Array.isArray(row.url_bukti_follow_ig) ? row.url_bukti_follow_ig : (row.url_bukti_follow_ig ? [row.url_bukti_follow_ig] : []);
          const pathBerkas = [row.url_kartu_pelajar, row.url_surat_delegasi].concat(urlIgList)
            .filter(Boolean)
            .map(ekstrakPathBerkas)
            .filter(Boolean);
          if (pathBerkas.length > 0) {
            const { error: errHapusBerkas } = await supabaseClient.storage.from("berkas-pendaftaran").remove(pathBerkas);
            if (errHapusBerkas) console.error("Sebagian/semua berkas gagal dihapus:", errHapusBerkas);
            // tetap lanjut hapus datanya walau ada berkas yang gagal terhapus,
            // supaya panitia tidak buntu hanya karena satu file bermasalah.
          }
        }

        const { error } = await supabaseClient.from("pendaftaran").delete().eq("id", id);
        if (error) {
          alert("Gagal menghapus: " + error.message);
          btn.disabled = false;
          btn.textContent = "Hapus";
          return;
        }

        // Nomor pendaftaran yang terpakai baris ini otomatis bebas untuk
        // dipakai ulang lewat ambil_nomor_berikutnya() (migrasi 0029) --
        // tidak perlu pencatatan manual apa pun di sini lagi.

        rows = rows.filter(function (r) { return r.id !== id; });
        renderBaris();
        renderRekap();
      });
    });

  }

  // Diisi supaya popup detail (bukaModalIndividu/bukaModalTim, lewat
  // commitPerubahanStatusLomba() di scope atas file ini) bisa menyegarkan
  // tabel & kartu rekap di belakangnya begitu status diubah dari dalam
  // popup -- lihat komentar di definisi kedua variabel ini.
  renderBarisPendaftarRef = renderBaris;
  renderRekapPendaftarRef = renderRekap;

  renderRekap();
  renderBaris();
  document.getElementById("filter-cari").addEventListener("input", renderBaris);

  document.getElementById("btn-buka-poster-rekap").addEventListener("click", function () {
    bukaPosterRekap(rules, rows);
  });

  document.getElementById("btn-unduh-xlsx").addEventListener("click", function () {
    unduhXLSXPendaftar(this, rows, rules, lombaFilter);
  });
}

/* =============================================================================
   Tab "Data Pendamping" -- permintaan panitia: "mengetahui jumlah pendamping",
   dengan pendamping yang sama (mendampingi lebih dari satu peserta/tim)
   dihitung SATU kali saja, bukan satu per baris pendaftaran.

   "Nama pendamping" satu baris pendaftaran diambil dari salah satu dari TIGA
   kolom berikut (saling eksklusif tergantung tipe pendaftarannya -- cuma
   SATU dari ketiganya yang akan terisi per baris):
     - r.pembina                  -> lomba TIM (mis. Futsal): guru pendamping
     - r.penanggung_jawab_lembaga -> pendaftaran Perwakilan Lembaga
     - r.nama_pendamping          -> lomba individu (field OPSIONAL, migrasi 0027)
   Baris yang ketiga kolom itu kosong semua (individu yang tidak mengisi
   nama pendamping) TIDAK ikut dihitung sama sekali -- tidak ada pendamping
   yang bisa dicatat dari baris itu.

   Dua baris pendaftaran dianggap PENDAMPING YANG SAMA kalau NAMA-nya cocok
   (setelah dirapikan: spasi berlebih & besar/kecil huruf diabaikan) ATAU
   nomor WA-nya cocok (setelah dirapikan ke format "08..." -- "62"/"+62" di
   depan disamakan ke "0") -- permintaan panitia eksplisit supaya pendamping
   yang namanya ditulis beda-beda ejaan di form (tapi WA-nya sama) tetap
   dianggap satu orang, dan sebaliknya. Pencocokan ini TRANSITIF lewat
   union-find sederhana (gabungMap): kalau A=B lewat nama dan B=C lewat WA,
   A/B/C semua jadi satu kelompok.

   Baris berstatus "Ditolak" TIDAK ikut dihitung (sama seperti renderRekap()
   di tab "Data Pendaftar") -- pendamping dari pendaftaran yang sudah
   ditolak panitia tidak dianggap benar-benar akan datang.

   Detail "siapa saja yang didampingi" TIDAK ditaruh di kolom tabel lagi
   (permintaan panitia) -- sekarang ditaruh di POPUP yang terbuka begitu
   baris pendamping diketuk (bukaModalDetailPendamping(), lewat bukaModal()
   yang sudah ada). Di dalam popup itu, kalau ADA peserta/tim yang sama
   ternyata tercatat didampingi oleh LEBIH DARI SATU pendamping (hasil
   deteksi tandaiPendampingGanda() di bawah -- dicocokkan lewat nama peserta
   + asal sekolah, dirapikan sama seperti nama pendamping), baris itu diberi
   tanda ⚠️ "GANDA" beserta nama pendamping lain yang juga mengaku
   mendampinginya -- supaya panitia bisa mengecek langsung mana yang benar
   (mis. kekeliruan isi form, bukan dianggap otomatis salah satu yang salah).

   Tab ini query SENDIRI ke tabel `pendaftaran` (tidak menumpang data `rows`
   milik tab "Data Pendaftar") supaya tetap akurat dibuka kapan pun, tanpa
   harus tab "Data Pendaftar" dibuka duluan pada sesi yang sama. */
function rapikanNamaPendamping(s) {
  return (s || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function rapikanWaPendamping(s) {
  let d = (s || "").replace(/\D/g, "");
  if (!d) return "";
  if (d.indexOf("62") === 0) d = "0" + d.slice(2);
  return d;
}

function kumpulkanEntriPendamping(rows) {
  const entri = [];
  rows.forEach(function (r) {
    if (r.status === "Ditolak") return;
    const namaAsli = (r.pembina || r.penanggung_jawab_lembaga || r.nama_pendamping || "").trim();
    if (!namaAsli) return;
    const pesertaLabel = (r.tipe === "tim" ? (r.nama_tim || r.nama_lengkap) : r.nama_lengkap) || "-";
    entri.push({
      namaAsli: namaAsli,
      namaKey: rapikanNamaPendamping(namaAsli),
      waAsli: (r.whatsapp || "").trim(),
      waKey: rapikanWaPendamping(r.whatsapp),
      pesertaLabel: pesertaLabel,
      // Kunci identitas peserta/tim yang didampingi -- nama + asal sekolah
      // (dirapikan), BUKAN termasuk lomba, supaya peserta yang sama tapi
      // mendaftar >1 lomba dengan pendamping BEDA tetap terdeteksi "ganda"
      // (lihat tandaiPendampingGanda()). Baris tanpa asal_sekolah (jarang)
      // tetap dapat kunci dari nama saja.
      pesertaKey: rapikanNamaPendamping(pesertaLabel) + "|" + rapikanNamaPendamping(r.asal_sekolah || ""),
      lomba: r.lomba_nama || r.lomba_id || "-",
      nomorPendaftaran: r.nomor_pendaftaran || ""
    });
  });
  return entri;
}

// Union-find super sederhana (array parent per index) -- cukup untuk jumlah
// entri pendaftaran yang realistis di aplikasi ini (ratusan, bukan jutaan).
function kelompokkanPendamping(entri) {
  const parent = entri.map(function (_, i) { return i; });
  function temukan(i) {
    while (parent[i] !== i) i = parent[i];
    return i;
  }
  function gabung(a, b) {
    const ra = temukan(a), rb = temukan(b);
    if (ra !== rb) parent[ra] = rb;
  }

  const namaMap = {}; // namaKey -> index entri pertama yang punya key itu
  const waMap = {};   // waKey -> index entri pertama yang punya key itu
  entri.forEach(function (e, i) {
    if (e.namaKey) {
      if (namaMap[e.namaKey] !== undefined) gabung(i, namaMap[e.namaKey]);
      else namaMap[e.namaKey] = i;
    }
    if (e.waKey) {
      if (waMap[e.waKey] !== undefined) gabung(i, waMap[e.waKey]);
      else waMap[e.waKey] = i;
    }
  });

  const kelompokMap = {}; // root index -> [entri, ...]
  entri.forEach(function (e, i) {
    const r = temukan(i);
    if (!kelompokMap[r]) kelompokMap[r] = [];
    kelompokMap[r].push(e);
  });

  const kelompok = Object.values(kelompokMap).map(function (list) {
    // Nama tampilan: ejaan asli yang paling sering muncul di kelompok ini.
    const hitungNama = {};
    list.forEach(function (e) { hitungNama[e.namaAsli] = (hitungNama[e.namaAsli] || 0) + 1; });
    const namaTampil = Object.keys(hitungNama).sort(function (a, b) { return hitungNama[b] - hitungNama[a]; })[0];

    const waSet = Array.from(new Set(list.map(function (e) { return e.waAsli; }).filter(Boolean)));

    // Detail per peserta/tim -- dedup lewat nomor pendaftaran (satu baris
    // pendaftaran = satu peserta/tim, jadi ini kunci paling pasti, tidak
    // bergantung ejaan nama).
    const sudahAda = {};
    const didampingi = [];
    list.forEach(function (e) {
      const kunci = e.nomorPendaftaran || (e.pesertaLabel + "|" + e.lomba);
      if (sudahAda[kunci]) return;
      sudahAda[kunci] = true;
      didampingi.push({ label: e.pesertaLabel, lomba: e.lomba, nomorPendaftaran: e.nomorPendaftaran, pesertaKey: e.pesertaKey, ganda: false, pendampingLain: [] });
    });

    return { nama: namaTampil, wa: waSet.join(" / ") || "-", jumlah: list.length, didampingi: didampingi, adaGanda: false };
  }).sort(function (a, b) { return b.jumlah - a.jumlah || a.nama.localeCompare(b.nama); });

  tandaiPendampingGanda(kelompok);
  return kelompok;
}

// Deteksi "ganda": satu peserta/tim (pesertaKey) yang muncul di daftar
// "didampingi" LEBIH DARI SATU kelompok pendamping -- permintaan panitia
// supaya kasus begini ditandai, bukan diam-diam dianggap benar. Ditulis ke
// tiap item didampingi yang terdampak (k.ganda + k.pendampingLain) DAN
// ke level kelompok (adaGanda, supaya bisa ditandai di baris tabel).
function tandaiPendampingGanda(kelompok) {
  const pemilik = {}; // pesertaKey -> [{ kelompokIdx, nama }]
  kelompok.forEach(function (k, ki) {
    k.didampingi.forEach(function (d) {
      if (!pemilik[d.pesertaKey]) pemilik[d.pesertaKey] = [];
      pemilik[d.pesertaKey].push({ kelompokIdx: ki, nama: k.nama });
    });
  });

  Object.keys(pemilik).forEach(function (pesertaKey) {
    const daftar = pemilik[pesertaKey];
    if (daftar.length < 2) return;
    daftar.forEach(function (pemilikIni) {
      const k = kelompok[pemilikIni.kelompokIdx];
      k.adaGanda = true;
      k.didampingi.forEach(function (d) {
        if (d.pesertaKey !== pesertaKey) return;
        d.ganda = true;
        d.pendampingLain = daftar
          .filter(function (p) { return p.kelompokIdx !== pemilikIni.kelompokIdx; })
          .map(function (p) { return p.nama; });
      });
    });
  });
}

async function loadTabPendamping() {
  const content = document.getElementById("admin-content");
  content.innerHTML = '<p class="hint">Memuat data pendamping...</p>';

  const { data: rows, error } = await supabaseClient.from("pendaftaran").select("*");
  if (error) {
    content.innerHTML = "<p>Gagal memuat data pendamping: " + error.message + "</p>";
    return;
  }

  const entri = kumpulkanEntriPendamping(rows || []);
  const kelompok = kelompokkanPendamping(entri);

  const jumlahGanda = kelompok.filter(function (k) { return k.adaGanda; }).length;

  content.innerHTML =
    '<p class="hint">Daftar pendamping UNIK (guru pendamping Futsal, penanggung jawab Perwakilan Lembaga, atau Nama Pendamping individu kalau diisi) -- pendamping yang mendampingi lebih dari satu peserta/tim/lomba sudah digabung jadi satu baris, dicocokkan lewat nama (ejaan dirapikan) dan/atau nomor WA. <strong>Ketuk baris</strong> untuk melihat detail siapa saja yang didampingi. Pendaftaran berstatus "Ditolak" tidak ikut dihitung.' +
      (jumlahGanda > 0 ? ' <strong style="color:var(--danger);">⚠️ Ada ' + jumlahGanda + ' pendamping dengan peserta/tim yang ternyata tercatat ganda (didampingi >1 pendamping) -- lihat detailnya di popup.</strong>' : '') +
    '</p>' +
    '<div class="admin-filters">' +
      '<input type="text" id="filter-cari-pendamping" placeholder="Cari nama pendamping / WA..." />' +
    '</div>' +
    '<p class="hint" id="jumlah-hint-pendamping"></p>' +
    '<div class="table-wrap"><table class="admin-table" id="tabel-pendamping"><thead><tr>' +
      '<th>#</th><th>Nama Pendamping</th><th>No. WA</th><th>Jumlah Didampingi</th><th></th>' +
    '</tr></thead><tbody></tbody></table></div>';

  function renderBaris() {
    const cari = document.getElementById("filter-cari-pendamping").value.toLowerCase();
    const tampil = kelompok.filter(function (k) {
      if (!cari) return true;
      return k.nama.toLowerCase().indexOf(cari) !== -1 || k.wa.toLowerCase().indexOf(cari) !== -1;
    });

    document.getElementById("jumlah-hint-pendamping").textContent =
      "Menampilkan " + tampil.length + " dari " + kelompok.length + " pendamping unik (" + entri.length + " baris pendaftaran yang mencatat pendamping).";

    const tbody = document.querySelector("#tabel-pendamping tbody");
    if (tampil.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5">Tidak ada data yang cocok.</td></tr>';
      return;
    }

    tbody.innerHTML = tampil.map(function (k, i) {
      return '<tr class="baris-pendamping" data-idx="' + kelompok.indexOf(k) + '" style="cursor:pointer;">' +
        '<td>' + (i + 1) + '</td>' +
        '<td>' + escapeHTML(k.nama) + ' <span class="lp-badge">ketuk untuk detail</span></td>' +
        '<td>' + escapeHTML(k.wa) + '</td>' +
        '<td>' + k.jumlah + (k.adaGanda ? ' <span class="status-pill status-pill--danger">⚠️ Ganda</span>' : '') + '</td>' +
        '<td></td>' +
      '</tr>';
    }).join("");

    tbody.querySelectorAll(".baris-pendamping").forEach(function (tr) {
      tr.addEventListener("click", function () {
        bukaModalDetailPendamping(kelompok[Number(tr.getAttribute("data-idx"))]);
      });
    });
  }

  renderBaris();
  document.getElementById("filter-cari-pendamping").addEventListener("input", renderBaris);
}

// Popup "siapa saja yang didampingi" oleh satu kelompok pendamping --
// dibuka dengan mengetuk barisnya di tabel (loadTabPendamping() di atas).
// Item yang terdeteksi "ganda" (lihat tandaiPendampingGanda()) diberi pil
// merah beserta nama pendamping lain yang juga mengaku mendampingi
// peserta/tim yang sama, supaya panitia bisa mengecek langsung mana yang
// benar.
function bukaModalDetailPendamping(k) {
  const baris = k.didampingi.map(function (d) {
    return '<tr' + (d.ganda ? ' style="background:rgba(194,58,46,0.06);"' : '') + '>' +
      '<td>' + escapeHTML(d.label) + '</td>' +
      '<td>' + escapeHTML(d.lomba) + '</td>' +
      '<td>' + escapeHTML(d.nomorPendaftaran || "-") + '</td>' +
      '<td>' + (d.ganda
        ? '<span class="status-pill status-pill--danger">⚠️ GANDA -- juga didampingi: ' + escapeHTML(d.pendampingLain.join(", ")) + '</span>'
        : '') +
      '</td>' +
    '</tr>';
  }).join("");

  const isiHTML =
    '<div class="modal-field-grid">' +
      '<div class="modal-field"><span class="modal-field__label">Nama Pendamping</span><span class="modal-field__value">' + escapeHTML(k.nama) + '</span></div>' +
      '<div class="modal-field"><span class="modal-field__label">No. WA</span><span class="modal-field__value">' + escapeHTML(k.wa) + '</span></div>' +
      '<div class="modal-field"><span class="modal-field__label">Jumlah Didampingi</span><span class="modal-field__value">' + k.jumlah + '</span></div>' +
    '</div>' +
    (k.adaGanda ? '<p class="modal-status-hint" style="color:var(--danger);">⚠️ Ada peserta/tim di bawah yang ternyata tercatat didampingi oleh LEBIH dari satu pendamping -- baris yang dimaksud disorot merah, cek lagi mana yang benar.</p>' : '') +
    '<p class="modal-section-title">Mendampingi</p>' +
    '<div class="table-wrap"><table class="admin-table modal-table"><thead><tr>' +
      '<th>Nama Peserta/Tim</th><th>Lomba</th><th>Nomor Pendaftaran</th><th>Keterangan</th>' +
    '</tr></thead><tbody>' + baris + '</tbody></table></div>';

  bukaModal("Detail Pendamping — " + k.nama, isiHTML);
}

/* -------- Unduh Data Pendaftar sebagai XLSX (murni client-side) --------
   Memakai pustaka SheetJS (xlsx), dimuat LAZY dari CDN (sama pola dengan
   muatTesseract() di view-daftar.js) -- HANYA saat tombol ini diklik, jadi
   panitia yang tidak pernah pakai fitur ini tidak ikut mengunduh pustaka
   ini sama sekali.

   Cakupan datanya ikut kartu rekap lomba yang sedang AKTIF/difilter di atas
   tabel (`lombaFilter`), BUKAN kotak cari teks (kotak cari murni buat
   mencari sekilas di tabel, tidak dimaksudkan membatasi arsip unduhan):
     - Kartu "Semua Lomba" aktif (lombaFilter === "") -> unduh SEMUA
       pendaftar, dipisah jadi SATU SHEET PER CABANG LOMBA (urutannya
       mengikuti urutan lomba di tab "Kelola Lomba"), dan baris di tiap
       sheet diurutkan menurut Jenis Kelamin (Laki-laki dulu, lalu
       Perempuan).
     - Kartu salah satu lomba aktif (lombaFilter = id lomba itu) -> unduh
       HANYA pendaftar lomba itu. Kalau pendaftarnya mencakup lebih dari
       satu kombinasi Jenjang+Jenis Kelamin, dipisah lagi jadi satu sheet
       per kombinasi (mis. "SD - Laki-laki", "SMP - Perempuan"); kalau
       cuma ada satu kombinasi, tetap satu sheet saja (tidak dipecah
       percuma).
   Sheet terakhir, "Anggota Tim" (cuma dibuat kalau ada minimal satu
   pendaftaran tim di dalam cakupan yang sama di atas), berisi kolom-kolom
   relevan tabel `anggota_tim` untuk tim-tim itu, satu query tambahan
   `.in()` sekali jalan (bukan satu query per tim). Kolom ID internal
   (`id`, `lomba_id`, dst) dan "Waktu Daftar" SENGAJA TIDAK disertakan --
   tidak relevan buat panitia yang cuma butuh rekap datanya. */
let sheetJSPromise = null;
function muatSheetJS() {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  if (sheetJSPromise) return sheetJSPromise;
  sheetJSPromise = new Promise(function (resolve, reject) {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";
    script.onload = function () {
      if (window.XLSX) resolve(window.XLSX);
      else reject(new Error("Pustaka XLSX gagal dimuat."));
    };
    script.onerror = function () { reject(new Error("Gagal memuat pustaka XLSX dari CDN.")); };
    document.head.appendChild(script);
  });
  return sheetJSPromise;
}

// Urutan tampil Jenis Kelamin di tiap sheet: Laki-laki dulu, lalu
// Perempuan, lalu yang tidak diketahui/kosong di paling akhir.
function urutanJenisXLSX(j) {
  if (j === "laki-laki") return 0;
  if (j === "perempuan") return 1;
  return 2;
}
function labelJenisXLSX(j) {
  if (j === "laki-laki") return "Laki-laki";
  if (j === "perempuan") return "Perempuan";
  return "-";
}

// Nama sheet Excel maksimal 31 karakter & tidak boleh berisi \ / ? * [ ] : --
// dibersihkan, dipotong, dan dipastikan unik dalam satu file (ditambah
// " (2)", " (3)", dst kalau ada nama yang jadi sama setelah dibersihkan).
function namaSheetXLSXAman(nama, dipakai) {
  let bersih = String(nama || "Sheet").replace(/[\\/?*[\]:]/g, "-").trim();
  if (!bersih) bersih = "Sheet";
  if (bersih.length > 31) bersih = bersih.slice(0, 31);
  let final = bersih;
  let i = 2;
  while (dipakai[final]) {
    const sufiks = " (" + i + ")";
    final = bersih.slice(0, 31 - sufiks.length) + sufiks;
    i++;
  }
  dipakai[final] = true;
  return final;
}

function slugXLSXNamaFile(teks) {
  return String(teks || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "lomba";
}

const HEADER_PENDAFTARAN_XLSX = [
  "Nomor Pendaftaran", "Nama Lomba", "Tipe (individu/tim)",
  "Kategori Pendaftar (individu/lembaga)", "Nama Lengkap / Nama Tim", "Jenis Kelamin",
  "Jenjang", "Kelas", "Tanggal Lahir", "Usia", "Asal Sekolah", "No. WhatsApp", "Email",
  "Nama Pendamping (individu)", "Penanggung Jawab Lembaga", "Nama Tim", "Guru/Pendamping Tim",
  "Link Surat Aktif Sekolah", "Link Kartu Pelajar", "Link Bukti Follow IG", "Link Berkas Tim",
  "Link Surat Delegasi", "Status"
];

function petakanBarisPendaftaranXLSX(list) {
  return list.map(function (r) {
    return {
      "Nomor Pendaftaran": r.nomor_pendaftaran,
      "Nama Lomba": r.lomba_nama,
      "Tipe (individu/tim)": r.tipe,
      "Kategori Pendaftar (individu/lembaga)": r.tipe_pendaftar || "",
      "Nama Lengkap / Nama Tim": r.nama_lengkap,
      "Jenis Kelamin": r.jenis_kelamin || "",
      "Jenjang": r.jenjang || "",
      "Kelas": r.kelas || "",
      "Tanggal Lahir": r.tanggal_lahir || "",
      "Usia": r.usia != null ? r.usia : "",
      "Asal Sekolah": r.asal_sekolah,
      "No. WhatsApp": r.whatsapp,
      "Email": r.email || "",
      "Nama Pendamping (individu)": r.nama_pendamping || "",
      "Penanggung Jawab Lembaga": r.penanggung_jawab_lembaga || "",
      "Nama Tim": r.nama_tim || "",
      "Guru/Pendamping Tim": r.pembina || "",
      "Link Surat Aktif Sekolah": r.url_surat_aktif || "",
      "Link Kartu Pelajar": r.url_kartu_pelajar || "",
      "Link Bukti Follow IG": Array.isArray(r.url_bukti_follow_ig) ? r.url_bukti_follow_ig.join(", ") : (r.url_bukti_follow_ig || ""),
      "Link Berkas Tim": Array.isArray(r.url_berkas_tim) ? r.url_berkas_tim.join(", ") : (r.url_berkas_tim || ""),
      "Link Surat Delegasi": r.url_surat_delegasi || "",
      "Status": r.status
    };
  });
}

async function unduhXLSXPendaftar(btn, rows, rules, lombaFilter) {
  const labelAsli = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Menyiapkan...";

  try {
    const XLSX = await muatSheetJS();

    // Cakupan: HANYA lomba yang sedang difilter kartu rekapnya (kalau ada),
    // atau semua pendaftar (kalau kartu "Semua Lomba" yang aktif).
    const data = lombaFilter ? rows.filter(function (r) { return r.lomba_id === lombaFilter; }) : rows;

    const wb = XLSX.utils.book_new();
    const namaSheetDipakai = {};

    function tambahSheetPendaftaran(nama, list) {
      const ws = XLSX.utils.json_to_sheet(petakanBarisPendaftaranXLSX(list), { header: HEADER_PENDAFTARAN_XLSX });
      XLSX.utils.book_append_sheet(wb, ws, namaSheetXLSXAman(nama, namaSheetDipakai));
    }

    if (lombaFilter) {
      // -------- Mode TERFILTER (satu kartu lomba aktif): HANYA lomba itu,
      // dipecah jadi beberapa sheet (satu per kombinasi Jenjang+Jenis
      // Kelamin) KALAU memang ada lebih dari satu kombinasi -- kalau cuma
      // satu kombinasi, tetap satu sheet saja.
      const kelompok = {};
      data.forEach(function (r) {
        const kunci = (r.jenjang || "-") + "||" + (r.jenis_kelamin || "-");
        if (!kelompok[kunci]) kelompok[kunci] = { jenjang: r.jenjang || "-", jenis: r.jenis_kelamin || "", list: [] };
        kelompok[kunci].list.push(r);
      });
      const daftarKelompok = Object.keys(kelompok).map(function (k) { return kelompok[k]; });
      daftarKelompok.sort(function (a, b) {
        if (a.jenjang !== b.jenjang) return a.jenjang < b.jenjang ? -1 : 1;
        return urutanJenisXLSX(a.jenis) - urutanJenisXLSX(b.jenis);
      });

      const namaLomba = (rules.find(function (r) { return r.id === lombaFilter; }) || {}).nama || "Lomba";

      if (daftarKelompok.length <= 1) {
        tambahSheetPendaftaran(namaLomba, data);
      } else {
        daftarKelompok.forEach(function (g) {
          g.list.sort(function (a, b) { return urutanJenisXLSX(a.jenis_kelamin) - urutanJenisXLSX(b.jenis_kelamin); });
          tambahSheetPendaftaran(g.jenjang + " - " + labelJenisXLSX(g.jenis), g.list);
        });
      }
    } else {
      // -------- Mode SEMUA LOMBA (tidak ada kartu yang difilter): satu
      // sheet per cabang lomba yang punya minimal 1 pendaftar, urutan sheet
      // mengikuti urutan lomba di tab "Kelola Lomba", baris di tiap sheet
      // diurutkan menurut Jenis Kelamin.
      rules.forEach(function (rule) {
        const list = data.filter(function (r) { return r.lomba_id === rule.id; });
        if (list.length === 0) return;
        list.sort(function (a, b) { return urutanJenisXLSX(a.jenis_kelamin) - urutanJenisXLSX(b.jenis_kelamin); });
        tambahSheetPendaftaran(rule.nama, list);
      });

      // Pendaftar yang lomba-nya sudah tidak ada lagi di "Kelola Lomba"
      // (lomba_id tidak cocok rule manapun, mis. lomba itu sudah dihapus) --
      // jangan sampai hilang dari unduhan, kumpulkan jadi satu sheet terakhir.
      const idLombaDikenal = rules.map(function (r) { return r.id; });
      const sisa = data.filter(function (r) { return idLombaDikenal.indexOf(r.lomba_id) === -1; });
      if (sisa.length > 0) {
        sisa.sort(function (a, b) { return urutanJenisXLSX(a.jenis_kelamin) - urutanJenisXLSX(b.jenis_kelamin); });
        tambahSheetPendaftaran("Lainnya", sisa);
      }
    }

    // -------- Sheet Anggota Tim -- HANYA untuk tim yang ada di `data`
    // (ikut terfilter kalau lombaFilter aktif), satu query .in() sekali
    // jalan untuk semua tim dalam cakupan itu (bukan satu query per tim).
    const idTim = data.filter(function (r) { return r.tipe === "tim"; }).map(function (r) { return r.id; });
    if (idTim.length > 0) {
      const { data: anggota, error: errAnggota } = await supabaseClient
        .from("anggota_tim")
        .select("*")
        .in("pendaftaran_id", idTim)
        .order("created_at", { ascending: true });

      if (errAnggota) {
        console.error("Gagal memuat data anggota tim untuk XLSX:", errAnggota);
      } else if (anggota && anggota.length > 0) {
        const barisAnggota = anggota.map(function (a) {
          return {
            "Nomor Pendaftaran": a.nomor_pendaftaran,
            "Nama Tim": a.nama_tim,
            "Nama Anggota": a.nama,
            "Tempat Lahir": a.tempat_lahir || "",
            "Tanggal Lahir": a.tanggal_lahir || "",
            "Kelas": a.kelas,
            "No. Punggung": (a.nomor_punggung != null ? a.nomor_punggung : ""),
            "Tempat/Tanggal Lahir (data lama)": a.tempat_tanggal_lahir || ""
          };
        });
        const HEADER_ANGGOTA = [
          "Nomor Pendaftaran", "Nama Tim", "Nama Anggota", "Tempat Lahir", "Tanggal Lahir", "Kelas", "No. Punggung",
          "Tempat/Tanggal Lahir (data lama)"
        ];
        const ws2 = XLSX.utils.json_to_sheet(barisAnggota, { header: HEADER_ANGGOTA });
        XLSX.utils.book_append_sheet(wb, ws2, namaSheetXLSXAman("Anggota Tim", namaSheetDipakai));
      }
    }

    const sufiksNama = lombaFilter
      ? ("-" + slugXLSXNamaFile((rules.find(function (r) { return r.id === lombaFilter; }) || {}).nama))
      : "";
    XLSX.writeFile(wb, "data-pendaftar-alif5" + sufiksNama + "-" + new Date().toISOString().slice(0, 10) + ".xlsx");
  } catch (err) {
    alert("Gagal membuat file XLSX: " + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = labelAsli;
  }
}

/* -------- Poster Rekap Pendaftar: dibuat & diunduh langsung dari browser
   panitia (data yang dipakai SAMA dengan `rules`/`rows` yang sudah dimuat
   tab "Data Pendaftar" -- tidak ada query/akses tambahan apa pun), supaya
   tidak perlu memasukkan angka manual satu-satu. Gambar dibuat di <canvas>
   (sama seperti Kartu Peserta, lihat gambarKartu()), bukan lewat library
   screenshot DOM -- lebih ringan & hasilnya tajam di ukuran berapa pun.
   Rasio POSTER_LEBAR_PX:POSTER_TINGGI_PX = 4:5 (1080x1350, rasio potret
   standar Instagram) -- diganti dari 2:3 (1200x1800) atas permintaan,
   sekaligus menyamakan rasio dengan poster rekap Bazar
   (lihat POSTER_BAZAR_LEBAR_PX/POSTER_BAZAR_TINGGI_PX di view-adminbazar.js). */
const POSTER_LEBAR_PX = 1080;
const POSTER_TINGGI_PX = 1350;

// Hitung ulang rekap per lomba (total, laki-laki/perempuan, per jenjang) --
// SENGAJA dihitung terpisah dari renderRekap() (bukan dipakai bersama)
// supaya perubahan di salah satu fungsi tidak berisiko mematahkan fungsi
// lain; keduanya memakai data `rows`/`rules` yang sama (dan SAMA-SAMA
// membuang baris berstatus "Ditolak" sebelum menghitung -- lihat komentar
// di renderRekap() untuk alasannya) jadi hasilnya selalu konsisten dengan
// kartu rekap yang terlihat di atas tabel.
function hitungRekapUntukPoster(rules, rows) {
  const rowsRekap = (rows || []).filter(function (r) { return r.status !== "Ditolak"; });
  const perLomba = {};
  rules.forEach(function (r) { perLomba[r.id] = { total: 0, l: 0, p: 0, perJenjang: {} }; });
  rowsRekap.forEach(function (r) {
    const d = perLomba[r.lomba_id];
    if (!d) return;
    d.total++;
    if (r.jenis_kelamin === "laki-laki") d.l++;
    else if (r.jenis_kelamin === "perempuan") d.p++;
    if (!d.perJenjang[r.jenjang]) d.perJenjang[r.jenjang] = { l: 0, p: 0 };
    if (r.jenis_kelamin === "laki-laki") d.perJenjang[r.jenjang].l++;
    else if (r.jenis_kelamin === "perempuan") d.perJenjang[r.jenjang].p++;
  });
  return { perLomba: perLomba, totalPendaftar: rowsRekap.length };
}

// Rounded-rect kompatibel browser lama yang belum punya ctx.roundRect bawaan.
function kotakBulat(ctx, x, y, w, h, r) {
  if (typeof ctx.roundRect === "function") {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    return;
  }
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Ikon kecil per cabang lomba untuk chip ikon di tiap kartu rekap (lihat
// gambarPosterRekap()) -- dipetakan dari `lomba_id` ke emoji yang
// menggambarkan kegiatannya. Kalau lomba_id tidak dikenali (lomba baru yang
// ditambah panitia sendiri lewat "Kelola Lomba"), jatuh balik ke `r.ikon`
// apa adanya -- tidak pernah kosong.
const KARAKTER_LOMBA = {
  adzan: "🕌",
  panahan: "🏹",
  mhq: "📖",
  kaligrafi: "🖋️",
  futsal: "⚽",
};

// Palet warna "batu permata" untuk kartu mozaik -- tiap cabang lomba dapat
// warnanya sendiri (bukan satu warna seragam untuk semua) supaya poster
// terasa hidup, bukan seperti tabel yang didandani. Dipilih dari gradasi
// gelap->terang supaya teks putih di atasnya tetap kontras & tetap senada
// "elegan" (bukan warna-warna terang/flat ala festival anak-anak).
// Warna ditentukan dari INDEKS lomba (urutan tetap dari `lomba_rules`,
// bukan dari ranking total pendaftar) supaya satu cabang lomba selalu
// kebagian warna yang sama tiap kali poster dibuat ulang, walau rankingnya
// berubah-ubah seiring pendaftar bertambah. Siklus (modulo) supaya tetap
// jalan walau panitia menambah lomba baru lewat "Kelola Lomba" (tidak
// terbatas 5 warna saja).
const PALET_PERMATA = [
  { bg: "#a9771f", bg2: "#c99a2e" }, // emas
  { bg: "#1f2a6b", bg2: "#30409c" }, // nila
  { bg: "#0b4a4a", bg2: "#157a7a" }, // teal
  { bg: "#0b4d29", bg2: "#17914a" }, // zamrud
  { bg: "#6b1f3a", bg2: "#9c2f54" }, // delima
];

// Hash deterministik kecil (BUKAN Math.random()) -- dipakai untuk menggeser
// sudut kartu "pecahan keramik" (lihat pathKeramik()) supaya posisinya
// TETAP sama tiap poster digambar ulang (konsisten dengan render-determinism
// yang sudah jadi prinsip di elemen dekoratif lain di file ini).
function hashKecil(seed) {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x); // 0..1
}

// Bintang delapan-penjuru (dua bujur sangkar bertumpuk 45 derajat) -- motif
// ornamen Islami klasik, dipakai sebagai hiasan tipis di latar & pojok
// kartu.
function gambarBintang8(ctx, cx, cy, r) {
  ctx.save();
  ctx.translate(cx, cy);
  for (let i = 0; i < 2; i++) {
    ctx.rotate(i === 0 ? 0 : Math.PI / 4);
    ctx.beginPath();
    ctx.moveTo(-r, -r);
    ctx.lineTo(r, -r);
    ctx.lineTo(r, r);
    ctx.lineTo(-r, r);
    ctx.closePath();
    ctx.stroke();
  }
  ctx.restore();
}

// Jalur (path) kartu berbentuk "pecahan keramik" -- poligon 8 titik (4 sudut
// + 4 titik tengah sisi persegi panjang x,y,w,h), tiap titik digeser sedikit
// ke dalam/luar memakai hashKecil(seed) supaya siluetnya tidak kotak
// sempurna (permintaan: "potongan kartunya dibuat tidak kotak, seperti
// pecahan keramik"). `seed` beda per kartu supaya bentuknya tidak seragam
// antar kartu, tapi TETAP sama tiap kartu yang sama digambar ulang.
function pathKeramik(ctx, x, y, w, h, seed) {
  const jMax = Math.min(w, h) * 0.05;
  const titik = [
    [x, y], [x + w / 2, y], [x + w, y],
    [x + w, y + h / 2],
    [x + w, y + h], [x + w / 2, y + h], [x, y + h],
    [x, y + h / 2],
  ];
  ctx.beginPath();
  titik.forEach(function (p, i) {
    const j1 = hashKecil(seed * 97 + i * 13.37) * 2 - 1;
    const j2 = hashKecil(seed * 211 + i * 7.77) * 2 - 1;
    const px = p[0] + j1 * jMax, py = p[1] + j2 * jMax;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.closePath();
}

// Pecah teks jadi beberapa baris supaya tidak keluar dari lebar maksimal --
// dipakai untuk nama lomba yang bisa panjang (mis. "Musabaqah Hifdzil
// Qur'an (MHQ)"), jadi SENGAJA TIDAK dipotong/disingkat ("...").
function pecahTeks(ctx, teks, lebarMaks) {
  const kata = String(teks || "").split(" ");
  const baris = [];
  let sekarang = "";
  kata.forEach(function (k) {
    const coba = sekarang ? sekarang + " " + k : k;
    if (ctx.measureText(coba).width > lebarMaks && sekarang) {
      baris.push(sekarang);
      sekarang = k;
    } else {
      sekarang = coba;
    }
  });
  if (sekarang) baris.push(sekarang);
  return baris;
}

// Gambar satu kartu "permata" (lihat gambarPosterRekap()) -- dipakai untuk
// kartu unggulan (selebar penuh, `besar=true`) maupun kartu grid 2 kolom
// (`besar=false`). `warna` dari PALET_PERMATA, `seed` untuk bentuk pecahan
// keramik (lihat pathKeramik()).
function gambarKartuPermata(ctx, r, d, x, y, w, h, besar, warna, seed) {
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.2)";
  ctx.shadowBlur = 16;
  ctx.shadowOffsetY = 6;
  const grad = ctx.createLinearGradient(x, y, x + w, y + h);
  grad.addColorStop(0, warna.bg);
  grad.addColorStop(1, warna.bg2);
  ctx.fillStyle = grad;
  pathKeramik(ctx, x, y, w, h, seed);
  ctx.fill();
  ctx.restore();

  // Garis tepi tipis terang -- menonjolkan kesan "tepi pecahan" keramik.
  pathKeramik(ctx, x, y, w, h, seed);
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.22)";
  ctx.lineWidth = 1;
  gambarBintang8(ctx, x + w - 30, y + 28, besar ? 20 : 14);
  ctx.restore();

  const pad = besar ? 26 : 20;

  // Ikon lomba DIBESARKAN -- chip lingkaran tersendiri di pojok kiri-atas
  // kartu (bukan emoji kecil menempel di depan teks nama), supaya langsung
  // kelihatan jelas dari jauh, bukan detail kecil yang gampang terlewat.
  const rChip = besar ? 38 : 28;
  const chipCx = x + pad + rChip, chipCy = y + pad + rChip;
  ctx.save();
  ctx.fillStyle = "rgba(255,255,255,0.22)";
  ctx.beginPath();
  ctx.arc(chipCx, chipCy, rChip, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(chipCx, chipCy, rChip, 0, Math.PI * 2);
  ctx.stroke();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = (rChip * 1.15) + "px sans-serif";
  ctx.fillText(KARAKTER_LOMBA[r.id] || r.ikon || "🏆", chipCx, chipCy + 2);
  ctx.restore();

  // Nama lomba -- dipecah ke baris kedua (pecahTeks()) kalau terlalu
  // panjang untuk sisa lebar kartu (mis. "Musabaqah Hifdzil Qur'an (MHQ)"
  // di kartu kecil 2 kolom), jadi SENGAJA TIDAK dipotong/disingkat ("...").
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.font = (besar ? "600 20px" : "600 16px") + " 'Plus Jakarta Sans', sans-serif";
  const xNama = chipCx + rChip + (besar ? 16 : 12);
  const lebarMaksNama = x + w - pad - xNama;
  const barisNama = pecahTeks(ctx, r.nama, lebarMaksNama);
  ctx.fillText(barisNama[0] || r.nama, xNama, chipCy - (barisNama.length > 1 ? 4 : -7));
  if (barisNama.length > 1) {
    ctx.fillText(barisNama.slice(1).join(" "), xNama, chipCy + (besar ? 20 : 17));
  }

  ctx.fillStyle = "#ffffff";
  ctx.font = (besar ? "900 64px" : "900 46px") + " 'Outfit', sans-serif";
  ctx.fillText(String(d.total), x + pad, y + h - (besar ? 22 : 18));

  ctx.textAlign = "right";
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.font = (besar ? "600 18px" : "600 14px") + " 'Plus Jakarta Sans', sans-serif";
  const genderTerkunci = r.gender_diizinkan && r.gender_diizinkan !== "semua";
  const ringkas = genderTerkunci
    ? (r.gender_diizinkan === "laki-laki" ? "Laki-laki" : "Perempuan")
    : "L " + d.l + " · P " + d.p;
  ctx.fillText(ringkas, x + w - pad, y + h - (besar ? 24 : 18));
  ctx.textAlign = "left";
}

function gambarPosterRekap(canvas, logoImg, rules, perLomba, totalPendaftar) {
  canvas.width = POSTER_LEBAR_PX;
  canvas.height = POSTER_TINGGI_PX;
  const ctx = canvas.getContext("2d");
  const W = POSTER_LEBAR_PX, H = POSTER_TINGGI_PX;
  const marginX = 56;
  const emas = "#c99a2e";

  // -------- Latar belakang krem + tekstur bintang delapan-penjuru tipis +
  // bingkai emas tipis keliling poster.
  ctx.fillStyle = "#fffaf0";
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.strokeStyle = "rgba(201,154,46,0.12)";
  ctx.lineWidth = 1.1;
  const sisi = 100;
  for (let yy = 60; yy < H; yy += sisi) {
    for (let xx = 60; xx < W; xx += sisi) { gambarBintang8(ctx, xx, yy, 27); }
  }
  ctx.restore();
  ctx.save();
  ctx.strokeStyle = emas;
  ctx.lineWidth = 2.5;
  ctx.strokeRect(20, 20, W - 40, H - 40);
  ctx.restore();

  // -------- Header asimetris: swoosh hijau diagonal (bukan pita rata tengah
  // simetris) + medalion logo menumpang di tepi lengkungan -- komposisi
  // lebih dinamis dibanding header kotak biasa.
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(W, 0);
  ctx.lineTo(W, 150);
  ctx.lineTo(0, 260);
  ctx.closePath();
  const gradSwoosh = ctx.createLinearGradient(0, 0, W, 200);
  gradSwoosh.addColorStop(0, "#0b4d29");
  gradSwoosh.addColorStop(1, "#1a8f4c");
  ctx.fillStyle = gradSwoosh;
  ctx.fill();
  ctx.restore();

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#ffffff";
  ctx.font = "900 64px 'Outfit', sans-serif";
  ctx.fillText("ALIF 5.0", marginX, 94);
  ctx.fillStyle = "#dff3e4";
  ctx.font = "600 21px 'Plus Jakarta Sans', sans-serif";
  ctx.fillText("Al Azzaam Islamic Fair · Rekap Pendaftar", marginX, 124);

  const medR = 72, medCx = W - marginX - medR, medCy = 110;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.25)";
  ctx.shadowBlur = 16;
  ctx.shadowOffsetY = 5;
  ctx.fillStyle = "#fff8e8";
  ctx.beginPath();
  ctx.arc(medCx, medCy, medR, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = emas;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(medCx, medCy, medR, 0, Math.PI * 2);
  ctx.stroke();
  if (logoImg) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(medCx, medCy, medR - 6, 0, Math.PI * 2);
    ctx.clip();
    const logoSize = (medR - 6) * 2;
    const skala = Math.min(logoSize / logoImg.width, logoSize / logoImg.height);
    const lw = logoImg.width * skala, lh = logoImg.height * skala;
    ctx.drawImage(logoImg, medCx - lw / 2, medCy - lh / 2, lw, lh);
    ctx.restore();
  } else {
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "72px sans-serif";
    ctx.fillText("🌙", medCx, medCy + 4);
  }

  // -------- Angka HERO -- total pendaftar jadi elemen visual utama di atas
  // (bukan teks kecil di footer), supaya poster "berbicara" langsung lewat
  // angka besar, bukan terasa seperti laporan/tabel.
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#12291c";
  ctx.font = "900 150px 'Outfit', sans-serif";
  ctx.fillText(String(totalPendaftar), marginX, 440);
  ctx.fillStyle = "#6b7d72";
  ctx.font = "700 24px 'Plus Jakarta Sans', sans-serif";
  ctx.fillText("T O T A L   P E N D A F T A R   D A R I   " + rules.length + "   C A B A N G   L O M B A", marginX, 472);

  ctx.textAlign = "right";
  ctx.fillStyle = emas;
  ctx.font = "700 20px 'Outfit', sans-serif";
  ctx.fillText("✦ PENDAFTARAN", W - marginX, 410);
  ctx.fillText("MASIH DIBUKA ✦", W - marginX, 436);
  ctx.textAlign = "left";

  // -------- Mozaik kartu "permata" -- diurutkan dari PENDAFTAR TERBANYAK
  // (permintaan: "yang paling atas adalah yang paling banyak"): kartu
  // unggulan selebar penuh untuk peringkat #1, sisanya mengisi grid 2 kolom
  // berurutan dari kiri-atas (peringkat #2) ke kanan lalu baris berikutnya.
  // Warna tiap kartu (PALET_PERMATA) tetap mengikuti INDEKS lomba asli
  // (bukan urutan setelah diranking) supaya warnanya stabil antar reload.
  const terurut = rules.slice().sort(function (a, b) {
    const totalA = (perLomba[a.id] || { total: 0 }).total;
    const totalB = (perLomba[b.id] || { total: 0 }).total;
    return totalB - totalA;
  });
  const indeksAsli = {};
  rules.forEach(function (r, i) { indeksAsli[r.id] = i; });

  const gridTop = 500, gap = 20, bawahBatas = H - 70;
  const featureH = terurut.length > 1 ? 190 : Math.min(320, bawahBatas - gridTop);
  const sisanya = terurut.slice(1);
  const kolom = 2;
  const baris = Math.ceil(sisanya.length / kolom);
  const tinggiTersedia = bawahBatas - gridTop - featureH - (sisanya.length ? gap : 0);
  const cellH = baris > 0 ? Math.max(130, (tinggiTersedia - gap * Math.max(baris - 1, 0)) / baris) : 0;
  const colW = (W - marginX * 2 - gap) / kolom;

  if (terurut.length) {
    const unggulan = terurut[0];
    const d0 = perLomba[unggulan.id] || { total: 0, l: 0, p: 0 };
    gambarKartuPermata(ctx, unggulan, d0, marginX, gridTop, W - marginX * 2, featureH, true,
      PALET_PERMATA[indeksAsli[unggulan.id] % PALET_PERMATA.length], indeksAsli[unggulan.id]);
  }
  sisanya.forEach(function (r, i) {
    const baseKol = i % kolom, baseBaris = Math.floor(i / kolom);
    const x = marginX + baseKol * (colW + gap);
    const y = gridTop + featureH + gap + baseBaris * (cellH + gap);
    const d = perLomba[r.id] || { total: 0, l: 0, p: 0 };
    gambarKartuPermata(ctx, r, d, x, y, colW, cellH, false,
      PALET_PERMATA[indeksAsli[r.id] % PALET_PERMATA.length], indeksAsli[r.id] + 2);
  });

  // -------- Footer --------
  ctx.textAlign = "center";
  ctx.strokeStyle = "rgba(201,154,46,0.6)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(marginX, H - 60);
  ctx.lineTo(W - marginX, H - 60);
  ctx.stroke();
  const tanggalCetak = new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
  ctx.fillStyle = "#6b7d72";
  ctx.font = "500 17px 'Plus Jakarta Sans', sans-serif";
  ctx.fillText("Diperbarui " + tanggalCetak + " · PPTQ Al Azzaam", W / 2, H - 32);
}

// Caption siap-salin untuk dibagikan bersamaan dengan poster (mis. di
// Instagram/WhatsApp) -- angka & nama lomba diambil dari data yang SAMA
// dipakai menggambar poster, supaya tidak pernah berbeda dari posternya.
function buatCaptionPosterRekap(rules, perLomba, totalPendaftar) {
  const tanggalCetak = new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
  const baris = rules.map(function (r) {
    const d = perLomba[r.id] || { total: 0, l: 0, p: 0, perJenjang: {} };
    const genderTerkunci = r.gender_diizinkan && r.gender_diizinkan !== "semua";
    const jenjangList = r.jenjang && r.jenjang.length ? r.jenjang : ["-"];
    const rincian = jenjangList.map(function (j) {
      const jd = d.perJenjang[j] || { l: 0, p: 0 };
      if (genderTerkunci) {
        const terisi = r.gender_diizinkan === "laki-laki" ? jd.l : jd.p;
        return j + " " + terisi;
      }
      return j + " (L" + jd.l + "/P" + jd.p + ")";
    }).join(", ");
    return (r.ikon ? r.ikon + " " : "") + r.nama + ": " + d.total + " pendaftar — " + rincian;
  }).join("\n");

  return (
    "📢 REKAP PENDAFTAR ALIF 5.0 — Al Azzaam Islamic Fair\n" +
    "Update per " + tanggalCetak + "\n\n" +
    baris + "\n\n" +
    "Total keseluruhan: " + totalPendaftar + " pendaftar\n\n" +
    "Yuk segera daftarkan ananda sebelum kuota penuh! 🔥\n" +
    "#ALIF5 #AlAzzaamIslamicFair #PPTQAlAzzaam"
  );
}

async function bukaPosterRekap(rules, rows) {
  bukaModal(
    "🖼️ Poster Rekap Pendaftar",
    '<p class="hint">Memuat logo & menyiapkan poster...</p>'
  );

  // Seluruh proses dibungkus try/catch -- SEBELUMNYA kalau ADA SAJA langkah
  // di bawah yang gagal/macet TANPA tertangkap (mis. query `site_settings`
  // error, atau logo macet dimuat tanpa pernah memicu timeout/onerror-nya
  // sendiri), popup akan diam selamanya di pesan "Memuat logo..." di atas
  // TANPA pemberitahuan apa pun ke panitia (persis keluhan "diklik tapi
  // macet, tidak terjadi apa-apa"). Sekarang begitu ada error apa pun,
  // popup diganti pesan gagal + tombol "Coba Lagi" (bukan macet selamanya).
  try {
    const { perLomba, totalPendaftar } = hitungRekapUntukPoster(rules, rows);
    const { data: settingsData, error: errSettings } = await supabaseClient.from("site_settings").select("logo_url").eq("id", 1).single();
    if (errSettings) console.warn("Gagal memuat site_settings untuk poster (dilanjutkan tanpa logo):", errSettings);
    const logoUrl = settingsData ? settingsData.logo_url : null;

    let logoImg = null;
    if (logoUrl) {
      try { logoImg = await muatGambar(logoUrl); }
      catch (e) { console.warn("Logo situs gagal dimuat untuk poster, dipakai ikon bulan sebagai gantinya:", e); }
    }

    const caption = buatCaptionPosterRekap(rules, perLomba, totalPendaftar);

    const overlay = document.getElementById("modal-overlay");
    if (!overlay || overlay.style.display === "none") {
      return; // modal sudah ditutup (mis. diklik di luar kotak) sebelum logo selesai dimuat
    }

    bukaModal(
    "🖼️ Poster Rekap Pendaftar",
    '<p class="hint">Rasio 4:5 (potret standar Instagram), resolusi ' + POSTER_LEBAR_PX + '×' + POSTER_TINGGI_PX + 'px — cukup tajam untuk diunggah ke Instagram/WhatsApp. Angkanya otomatis dari data "Data Pendaftar" saat ini, kartu diurutkan dari pendaftar terbanyak.</p>' +
    '<div class="poster-rekap-preview-wrap">' +
      '<canvas id="poster-rekap-canvas"></canvas>' +
    '</div>' +
    '<div class="submit-row" style="display:flex;gap:10px;flex-wrap:wrap;margin-top:14px;">' +
      '<button type="button" class="btn btn--primary" id="btn-unduh-poster-rekap">⬇️ Unduh PNG</button>' +
      '<button type="button" class="btn btn--ghost" id="btn-ulang-poster-rekap">🔄 Muat Ulang Data</button>' +
    '</div>' +
    '<div class="field" style="margin-top:18px;">' +
      '<label for="poster-caption-text">Caption (bisa diedit sebelum disalin)</label>' +
      '<textarea id="poster-caption-text" rows="10">' + escapeHTML(caption) + '</textarea>' +
    '</div>' +
    '<div class="submit-row" style="display:flex;gap:10px;">' +
      '<button type="button" class="btn btn--ghost" id="btn-salin-caption-poster">📋 Salin Caption</button>' +
    '</div>' +
    '<p class="hint" id="poster-rekap-status" style="margin-top:8px;"></p>'
  );

  const canvas = document.getElementById("poster-rekap-canvas");
  gambarPosterRekap(canvas, logoImg, rules, perLomba, totalPendaftar);

  document.getElementById("btn-unduh-poster-rekap").addEventListener("click", function () {
    canvas.toBlob(function (blob) {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "poster-rekap-alif5-" + new Date().toISOString().slice(0, 10) + ".png";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
    }, "image/png");
  });

  document.getElementById("btn-ulang-poster-rekap").addEventListener("click", async function () {
    const { data: rowsBaru } = await supabaseClient.from("pendaftaran").select("*");
    const ulang = hitungRekapUntukPoster(rules, rowsBaru || rows);
    gambarPosterRekap(canvas, logoImg, rules, ulang.perLomba, ulang.totalPendaftar);
    document.getElementById("poster-caption-text").value = buatCaptionPosterRekap(rules, ulang.perLomba, ulang.totalPendaftar);
    const statusEl = document.getElementById("poster-rekap-status");
    statusEl.textContent = "Data diperbarui.";
    setTimeout(function () { statusEl.textContent = ""; }, 2500);
  });

  document.getElementById("btn-salin-caption-poster").addEventListener("click", async function () {
    const teks = document.getElementById("poster-caption-text").value;
    const statusEl = document.getElementById("poster-rekap-status");
    try {
      await navigator.clipboard.writeText(teks);
      statusEl.textContent = "Caption tersalin ke clipboard.";
    } catch (e) {
      // Fallback untuk browser/konteks yang tidak mengizinkan Clipboard API
      // (mis. bukan HTTPS) -- pilih teksnya otomatis supaya tinggal Ctrl+C.
      const area = document.getElementById("poster-caption-text");
      area.focus();
      area.select();
      statusEl.textContent = "Tidak bisa menyalin otomatis -- teks sudah diseleksi, tekan Ctrl+C (atau Cmd+C).";
    }
    setTimeout(function () { statusEl.textContent = ""; }, 3500);
  });
  } catch (err) {
    console.error("Poster Rekap gagal dibuat:", err);
    const overlayGagal = document.getElementById("modal-overlay");
    if (!overlayGagal || overlayGagal.style.display === "none") return; // sudah ditutup duluan
    bukaModal(
      "🖼️ Poster Rekap Pendaftar",
      '<p>Gagal menyiapkan poster: ' + escapeHTML((err && err.message) || String(err)) + '</p>' +
      '<p class="hint">Coba lagi -- biasanya ini karena koneksi lambat/putus sesaat saat memuat logo situs.</p>' +
      '<div class="submit-row"><button type="button" class="btn btn--primary" id="btn-coba-lagi-poster">🔄 Coba Lagi</button></div>'
    );
    document.getElementById("btn-coba-lagi-poster").addEventListener("click", function () {
      bukaPosterRekap(rules, rows);
    });
  }
}

/* ==================== TAB 2: KELOLA LOMBA ==================== */

async function loadTabLomba() {
  const content = document.getElementById("admin-content");
  content.innerHTML = '<p class="hint">Memuat data lomba...</p>';

  const { data, error } = await supabaseClient.from("lomba_rules").select("*").order("urutan");
  if (error) {
    content.innerHTML = "<p>Gagal memuat data lomba: " + error.message + "</p>";
    return;
  }
  let lombaList = data || [];

  content.innerHTML =
    '<div class="table-wrap"><table class="admin-table" id="tabel-lomba"><thead><tr>' +
      '<th></th><th>Nama</th><th>Jenjang</th><th>Usia</th><th>Tipe</th><th>Gender</th><th>Kuota (jelas per jenjang &amp; gender)</th><th>Tgl. Pelaksanaan</th><th>Aktif</th><th></th>' +
    '</tr></thead><tbody></tbody></table></div>' +
    '<button type="button" class="btn btn--primary" id="btn-tambah-lomba" style="margin-top:16px;">+ Tambah Lomba</button>' +
    '<div id="form-lomba-wrap"></div>' +
    // Pengatur "Tutup Otomatis Pendaftaran" (migrasi 0022) -- sengaja
    // dipindah ke sini, paling bawah tab "Kelola Lomba", dan dibuat kecil/
    // ringkas (bukan lagi kotak besar yang tampil di SEMUA tab seperti
    // sebelumnya). Satu tanggal ini berlaku untuk SEMUA lomba sekaligus,
    // TERPISAH dari Tanggal Pelaksanaan tiap lomba di tabel di atas (yang
    // dipakai buat hitung usia peserta) -- makanya diletakkan di tab ini
    // juga (sama-sama soal tanggal terkait lomba), tapi tetap dua hal yang
    // beda: tanggal ini murni soal kapan pintu pendaftaran online ditutup.
    '<div class="tutup-otomatis-ringkas" id="tutup-otomatis-ringkas">' +
      '<span class="tutup-otomatis-ringkas__label">⏰ Tutup otomatis pendaftaran:</span>' +
      '<input type="datetime-local" id="input-tanggal-tutup" />' +
      '<button type="button" class="btn-link" id="btn-simpan-tanggal-tutup">Simpan</button>' +
      '<button type="button" class="btn-link" id="btn-hapus-tanggal-tutup">Hapus</button>' +
      '<span class="hint" id="status-tanggal-tutup"></span>' +
    '</div>';

  // Kuota yang diisi admin dibagi rata per jenjang, lalu per gender --
  // ditampilkan gamblang per baris jenjang (bukan satu angka hasil bagi yang
  // ambigu), plus angka asli yang diisi panitia sebagai catatan kecil. Kalau
  // lomba itu sudah dikunci ke satu jenis kelamin (gender_diizinkan bukan
  // "semua"), split putra/putri tidak ditampilkan -- gendernya sudah jelas
  // dari kolom Gender di tabel yang sama, jadi split di sini cuma bikin
  // seolah ada kuota gender lain padahal tidak ada peserta gender itu yang
  // bisa daftar ke lomba ini.
  function renderKuotaLomba(l) {
    if (l.kuota == null) return "Tanpa batas";
    const efektif = Math.floor(l.kuota / (l.jenjang.length || 1));
    const genderTerkunci = l.gender_diizinkan !== "semua";
    const baris = l.jenjang.map(function (j) {
      const nilai = genderTerkunci ? ('<strong>' + efektif + '</strong>') : ('<strong>' + efektif + '</strong>/putra · <strong>' + efektif + '</strong>/putri');
      return '<div>' + j + ': maks ' + nilai + '</div>';
    }).join("");
    return baris + '<div class="hint" style="margin-top:2px;">(angka kuota diisi panitia: ' + l.kuota + ')</div>';
  }

  function renderTabel() {
    const tbody = document.querySelector("#tabel-lomba tbody");
    tbody.innerHTML = lombaList.map(function (l) {
      return (
        '<tr>' +
          '<td>' + l.ikon + '</td>' +
          '<td>' + l.nama + '</td>' +
          '<td>' + l.jenjang.join("/") + '</td>' +
          '<td>' + l.jenjang.map(function (j) {
            const r = (l.usia_per_jenjang || {})[j];
            return r ? (j + " " + r.min + "-" + r.max) : (j + " -");
          }).join(", ") + '</td>' +
          '<td>' + (l.tipe === "tim" ? "Tim" : "Individu") + '</td>' +
          '<td>' + (l.gender_diizinkan === "semua" ? "Semua" : l.gender_diizinkan) + '</td>' +
          '<td>' + renderKuotaLomba(l) + '</td>' +
          '<td>' + (l.tanggal_pelaksanaan || "Belum diatur") + '</td>' +
          '<td>' + (l.aktif ? "Ya" : "Tidak") + '</td>' +
          '<td>' +
            '<button type="button" class="btn-link btn-edit-lomba" data-id="' + l.id + '">Edit</button> · ' +
            '<button type="button" class="btn-link btn-hapus-lomba" data-id="' + l.id + '">Hapus</button>' +
          '</td>' +
        '</tr>'
      );
    }).join("");

    tbody.querySelectorAll(".btn-edit-lomba").forEach(function (btn) {
      btn.addEventListener("click", function () {
        const l = lombaList.find(function (x) { return x.id === btn.getAttribute("data-id"); });
        tampilkanForm(l);
      });
    });

    tbody.querySelectorAll(".btn-hapus-lomba").forEach(function (btn) {
      btn.addEventListener("click", async function () {
        const id = btn.getAttribute("data-id");
        const l = lombaList.find(function (x) { return x.id === id; });
        if (!confirm('Hapus lomba "' + (l ? l.nama : id) + '"? Kalau sudah ada pendaftar di lomba ini, lebih baik nonaktifkan saja lewat "Edit".')) return;

        const { error } = await supabaseClient.from("lomba_rules").delete().eq("id", id);
        if (error) {
          if (error.code === "23503") {
            alert('Tidak bisa dihapus karena sudah ada pendaftar di lomba ini. Nonaktifkan saja lewat "Edit" (matikan centang Aktif).');
          } else {
            alert("Gagal menghapus: " + error.message);
          }
          return;
        }
        lombaList = lombaList.filter(function (x) { return x.id !== id; });
        renderTabel();
      });
    });
  }

  function tampilkanForm(existing) {
    const wrap = document.getElementById("form-lomba-wrap");
    const isEdit = !!existing;

    const jenjangCheckboxes = JENJANG_LIST.map(function (j) {
      const checked = existing && existing.jenjang.indexOf(j) !== -1 ? "checked" : "";
      return '<label style="margin-right:14px;font-weight:400;display:inline-flex;align-items:center;gap:6px;">' +
        '<input type="checkbox" class="lm-jenjang" value="' + j + '" ' + checked + ' /> ' + j + '</label>';
    }).join("");

    // Syarat usia disimpan per jenjang. usiaState menyimpan nilai yang
    // sedang diisi admin, supaya tidak hilang saat centang jenjang diubah.
    let usiaState = Object.assign({}, existing && existing.usia_per_jenjang);

    wrap.innerHTML =
      '<div class="form-shell" style="margin-top:16px;">' +
        '<h3>' + (isEdit ? "Edit Lomba" : "Tambah Lomba Baru") + '</h3>' +
        '<form id="form-lomba" novalidate>' +
          '<div class="field-row">' +
            '<div class="field"><label>Kode unik (id)</label>' +
              '<input type="text" id="lm-id" ' + (isEdit ? "disabled" : "") + ' value="' + (existing ? existing.id : "") + '" placeholder="mis. tahfidz" />' +
              (isEdit ? '<div class="hint">Kode tidak bisa diubah setelah dibuat.</div>' : '<div class="hint">Huruf kecil, tanpa spasi, tidak bisa diubah nanti.</div>') +
            '</div>' +
            '<div class="field"><label>Ikon (emoji)</label><input type="text" id="lm-ikon" value="' + (existing ? existing.ikon : "🏆") + '" /></div>' +
          '</div>' +
          '<div class="field"><label>Nama Lomba</label><input type="text" id="lm-nama" value="' + (existing ? existing.nama.replace(/"/g, "&quot;") : "") + '" /></div>' +
          '<div class="field"><label>Jenjang</label><div>' + jenjangCheckboxes + '</div></div>' +
          '<div class="field"><label>Syarat Usia per Jenjang</label>' +
            '<div id="lm-usia-per-jenjang-wrap" class="kartu-pos-grid"></div>' +
          '</div>' +
          '<div class="field-row">' +
            '<div class="field"><label>Tipe</label><select id="lm-tipe">' +
              '<option value="individu"' + (existing && existing.tipe === "individu" ? " selected" : "") + '>Individu</option>' +
              '<option value="tim"' + (existing && existing.tipe === "tim" ? " selected" : "") + '>Tim</option>' +
            '</select></div>' +
            '<div class="field"></div>' +
          '</div>' +
          '<div class="field-row" id="lm-anggota-wrap" style="display:' + (existing && existing.tipe === "tim" ? "grid" : "none") + ';">' +
            '<div class="field"><label>Min Anggota</label><input type="number" id="lm-min-anggota" value="' + (existing && existing.min_anggota != null ? existing.min_anggota : 5) + '" /></div>' +
            '<div class="field"><label>Max Anggota</label><input type="number" id="lm-max-anggota" value="' + (existing && existing.max_anggota != null ? existing.max_anggota : 10) + '" /></div>' +
          '</div>' +
          '<div class="field-row">' +
            '<div class="field"><label>Angka Kuota Dasar (kosongkan = tanpa batas)</label><input type="number" id="lm-kuota" value="' + (existing && existing.kuota != null ? existing.kuota : "") + '" />' +
              '<div class="hint">Dibagi otomatis rata ke tiap jenjang, dan angka hasil baginya berlaku PENUH untuk masing-masing gender (bukan dibagi lagi). Contoh: isi 40 untuk lomba dengan 2 jenjang → tiap jenjang dapat maks 20 putra + 20 putri (total kapasitas lomba = 80).</div></div>' +
            '<div class="field"><label>Urutan tampil</label><input type="number" id="lm-urutan" value="' + (existing ? existing.urutan : 0) + '" /></div>' +
          '</div>' +
          '<div class="field">' +
            '<label>Tanggal Pelaksanaan</label><input type="date" id="lm-tanggal-pelaksanaan" value="' + (existing && existing.tanggal_pelaksanaan ? existing.tanggal_pelaksanaan : "") + '" />' +
            '<div class="hint">Acuan hitung usia peserta (individu maupun tiap anggota tim), sampai presisi hari — kosongkan untuk pakai tanggal hari ini. Batasan usia jenjang di bawah berlaku KETAT, tanpa toleransi: meleset walau 1 hari langsung ditolak.</div>' +
          '</div>' +
          '<div class="field">' +
            '<label>Gender Diizinkan</label><select id="lm-gender">' +
              '<option value="semua"' + (!existing || existing.gender_diizinkan === "semua" ? " selected" : "") + '>Semua (laki-laki & perempuan)</option>' +
              '<option value="laki-laki"' + (existing && existing.gender_diizinkan === "laki-laki" ? " selected" : "") + '>Khusus Laki-laki</option>' +
              '<option value="perempuan"' + (existing && existing.gender_diizinkan === "perempuan" ? " selected" : "") + '>Khusus Perempuan</option>' +
            '</select>' +
          '</div>' +
          '<div class="field"><label>Deskripsi</label><textarea id="lm-deskripsi">' + (existing ? existing.deskripsi : "") + '</textarea></div>' +
          '<label class="checkbox-field"><input type="checkbox" id="lm-aktif" ' + (!existing || existing.aktif ? "checked" : "") + ' /> <span>Aktif (tampil di situs)</span></label>' +
          '<div class="form-error" id="lomba-form-error" style="display:none;"></div>' +
          '<div class="submit-row" style="margin-top:16px;display:flex;gap:10px;">' +
            '<button type="submit" class="btn btn--primary">Simpan</button>' +
            '<button type="button" class="btn btn--ghost" id="btn-batal-lomba">Batal</button>' +
          '</div>' +
        '</form>' +
      '</div>';

    wrap.scrollIntoView({ behavior: "smooth", block: "center" });

    function bacaUsiaDariInput() {
      document.querySelectorAll(".usia-jenjang-min").forEach(function (inp) {
        const j = inp.getAttribute("data-jenjang");
        usiaState[j] = Object.assign({}, usiaState[j], { min: parseInt(inp.value, 10) || 0 });
      });
      document.querySelectorAll(".usia-jenjang-max").forEach(function (inp) {
        const j = inp.getAttribute("data-jenjang");
        usiaState[j] = Object.assign({}, usiaState[j], { max: parseInt(inp.value, 10) || 0 });
      });
    }

    function renderUsiaInputs() {
      const jenjangTerpilih = Array.from(document.querySelectorAll(".lm-jenjang:checked")).map(function (c) { return c.value; });
      const usiaWrap = document.getElementById("lm-usia-per-jenjang-wrap");
      usiaWrap.innerHTML = jenjangTerpilih.length === 0
        ? '<p class="hint">Centang jenjang dulu untuk atur syarat usianya.</p>'
        : jenjangTerpilih.map(function (j) {
            const data = usiaState[j] || { min: 7, max: 12 };
            return (
              '<div class="kartu-pos-group">' +
                '<span class="kartu-pos-group__label">' + j + '</span>' +
                '<label>Usia Min <input type="number" class="usia-jenjang-min" data-jenjang="' + j + '" value="' + data.min + '" /></label>' +
                '<label>Usia Maks <input type="number" class="usia-jenjang-max" data-jenjang="' + j + '" value="' + data.max + '" /></label>' +
              '</div>'
            );
          }).join("");
    }
    renderUsiaInputs();

    document.querySelectorAll(".lm-jenjang").forEach(function (cb) {
      cb.addEventListener("change", function () {
        bacaUsiaDariInput();
        renderUsiaInputs();
      });
    });

    document.getElementById("lm-tipe").addEventListener("change", function () {
      document.getElementById("lm-anggota-wrap").style.display = this.value === "tim" ? "grid" : "none";
    });
    document.getElementById("btn-batal-lomba").addEventListener("click", function () { wrap.innerHTML = ""; });

    document.getElementById("form-lomba").addEventListener("submit", async function (e) {
      e.preventDefault();
      const errEl = document.getElementById("lomba-form-error");
      errEl.style.display = "none";

      const id = document.getElementById("lm-id").value.trim();
      const jenjangTerpilih = Array.from(document.querySelectorAll(".lm-jenjang:checked")).map(function (c) { return c.value; });
      const tipe = document.getElementById("lm-tipe").value;
      const kuotaVal = document.getElementById("lm-kuota").value;
      const namaVal = document.getElementById("lm-nama").value.trim();

      if (!id || !namaVal || jenjangTerpilih.length === 0) {
        errEl.textContent = "Kode, nama, dan minimal satu jenjang wajib diisi.";
        errEl.style.display = "block";
        return;
      }

      bacaUsiaDariInput();
      const usiaPerJenjangFinal = {};
      jenjangTerpilih.forEach(function (j) { usiaPerJenjangFinal[j] = usiaState[j] || { min: 7, max: 12 }; });
      const semuaMin = jenjangTerpilih.map(function (j) { return usiaPerJenjangFinal[j].min; });
      const semuaMax = jenjangTerpilih.map(function (j) { return usiaPerJenjangFinal[j].max; });

      const payload = {
        id: id,
        ikon: document.getElementById("lm-ikon").value.trim() || "🏆",
        nama: namaVal,
        jenjang: jenjangTerpilih,
        usia_per_jenjang: usiaPerJenjangFinal,
        usia_min: Math.min.apply(null, semuaMin),
        usia_max: Math.max.apply(null, semuaMax),
        tipe: tipe,
        min_anggota: tipe === "tim" ? parseInt(document.getElementById("lm-min-anggota").value, 10) : null,
        max_anggota: tipe === "tim" ? parseInt(document.getElementById("lm-max-anggota").value, 10) : null,
        kuota: kuotaVal === "" ? null : parseInt(kuotaVal, 10),
        urutan: parseInt(document.getElementById("lm-urutan").value, 10) || 0,
        tanggal_pelaksanaan: document.getElementById("lm-tanggal-pelaksanaan").value || null,
        gender_diizinkan: document.getElementById("lm-gender").value,
        deskripsi: document.getElementById("lm-deskripsi").value.trim(),
        aktif: document.getElementById("lm-aktif").checked
      };

      const result = isEdit
        ? await supabaseClient.from("lomba_rules").update(payload).eq("id", existing.id)
        : await supabaseClient.from("lomba_rules").insert(payload);

      if (result.error) {
        errEl.textContent = "Gagal menyimpan: " + result.error.message;
        errEl.style.display = "block";
        return;
      }

      wrap.innerHTML = "";
      loadTabLomba();
    });
  }

  document.getElementById("btn-tambah-lomba").addEventListener("click", function () { tampilkanForm(null); });
  renderTabel();

  // Kotak ringkas "Tutup Otomatis Pendaftaran" (migrasi 0022) -- baca nilai
  // dari status modul (tanggalTutupOtomatis, disinkronkan renderDashboard()
  // tiap halaman Panitia dibuka), simpan/hapus langsung ke site_settings,
  // lalu perbarui juga tombol besar "Dibuka/Ditutup" di admin-header lewat
  // perbaruiTombolToggle() supaya keduanya tetap sinkron tanpa perlu memuat
  // ulang seluruh halaman.
  (function setupTutupOtomatisRingkas() {
    const input = document.getElementById("input-tanggal-tutup");
    const statusEl = document.getElementById("status-tanggal-tutup");
    input.value = isoKeDatetimeLocal(tanggalTutupOtomatis);

    function refreshStatus() {
      if (tutupOtomatisAktif()) {
        statusEl.innerHTML = '<strong style="color:var(--danger);">Sudah lewat (' + formatTanggalJamTutup(tanggalTutupOtomatis) + ') — pendaftaran tertutup otomatis.</strong>';
      } else if (tanggalTutupOtomatis) {
        statusEl.textContent = "Tertutup otomatis pada " + formatTanggalJamTutup(tanggalTutupOtomatis) + ".";
      } else {
        statusEl.textContent = "Belum diatur (manual saja lewat tombol di atas).";
      }
    }
    refreshStatus();

    document.getElementById("btn-simpan-tanggal-tutup").addEventListener("click", async function () {
      const val = input.value;
      if (val && isNaN(new Date(val).getTime())) {
        alert("Tanggal/jam tidak valid.");
        return;
      }
      const isoBaru = val ? new Date(val).toISOString() : null;
      const btn = this;
      btn.disabled = true;
      const { error } = await supabaseClient.from("site_settings").update({ tanggal_tutup_pendaftaran: isoBaru }).eq("id", 1);
      btn.disabled = false;
      if (error) {
        alert("Gagal menyimpan tanggal tutup: " + error.message);
        return;
      }
      tanggalTutupOtomatis = isoBaru;
      refreshStatus();
      perbaruiTombolToggle();
    });

    document.getElementById("btn-hapus-tanggal-tutup").addEventListener("click", async function () {
      if (!tanggalTutupOtomatis && !input.value) return;
      if (!confirm("Hapus tanggal tutup otomatis? Buka/tutup pendaftaran akan sepenuhnya manual lewat tombol di atas.")) return;

      const { error } = await supabaseClient.from("site_settings").update({ tanggal_tutup_pendaftaran: null }).eq("id", 1);
      if (error) {
        alert("Gagal menghapus tanggal tutup: " + error.message);
        return;
      }
      tanggalTutupOtomatis = null;
      input.value = "";
      refreshStatus();
      perbaruiTombolToggle();
    });
  })();
}

/* ==================== TAB 3: LOGO SITUS ==================== */

async function loadTabLogo() {
  const content = document.getElementById("admin-content");
  content.innerHTML = '<p class="hint">Memuat logo...</p>';

  const { data } = await supabaseClient.from("site_settings").select("logo_url").eq("id", 1).single();
  const logoUrl = data ? data.logo_url : null;

  content.innerHTML =
    '<div class="form-shell" style="max-width:480px;">' +
      '<h3>Logo Situs</h3>' +
      '<p>Format PNG saja. Logo akan tampil apa adanya di navbar — tidak dipotong bulat seperti ikon bawaan.</p>' +
      '<div id="logo-preview" style="margin:16px 0;">' +
        (logoUrl
          ? '<img src="' + logoUrl + '" alt="Logo saat ini" style="max-height:80px;display:block;" />'
          : '<p class="hint">Belum ada logo — situs masih memakai ikon bulan default.</p>') +
      '</div>' +
      '<div class="field">' +
        '<label for="input-logo">Pilih file PNG</label>' +
        '<input type="file" id="input-logo" accept=".png,image/png" />' +
      '</div>' +
      '<div class="form-error" id="logo-error" style="display:none;"></div>' +
      '<div class="submit-row" style="display:flex;gap:10px;">' +
        '<button type="button" class="btn btn--primary" id="btn-upload-logo">Upload Logo</button>' +
        (logoUrl ? '<button type="button" class="btn btn--ghost" id="btn-hapus-logo">Kembalikan ke Ikon Default</button>' : "") +
      '</div>' +
    '</div>';

  document.getElementById("btn-upload-logo").addEventListener("click", async function () {
    const fileInput = document.getElementById("input-logo");
    const errEl = document.getElementById("logo-error");
    errEl.style.display = "none";

    const file = fileInput.files[0];
    if (!file) {
      errEl.textContent = "Pilih file PNG dulu.";
      errEl.style.display = "block";
      return;
    }
    if (file.type !== "image/png") {
      errEl.textContent = "File harus berformat PNG.";
      errEl.style.display = "block";
      return;
    }

    const btn = this;
    btn.disabled = true;
    btn.textContent = "Mengunggah...";

    const path = "logo/logo-" + Date.now() + ".png";
    const { error: uploadError } = await supabaseClient.storage.from("aset-situs").upload(path, file, { contentType: "image/png" });

    if (uploadError) {
      btn.disabled = false;
      btn.textContent = "Upload Logo";
      errEl.textContent = "Gagal mengunggah: " + uploadError.message;
      errEl.style.display = "block";
      return;
    }

    const { data: pub } = supabaseClient.storage.from("aset-situs").getPublicUrl(path);
    const { error: updateError } = await supabaseClient.from("site_settings").update({ logo_url: pub.publicUrl }).eq("id", 1);

    btn.disabled = false;
    btn.textContent = "Upload Logo";

    if (updateError) {
      errEl.textContent = "Berkas terunggah tapi gagal menyimpan pengaturan: " + updateError.message;
      errEl.style.display = "block";
      return;
    }

    if (typeof window.terapkanLogo === "function") window.terapkanLogo(pub.publicUrl);
    loadTabLogo();
  });

  const btnHapus = document.getElementById("btn-hapus-logo");
  if (btnHapus) {
    btnHapus.addEventListener("click", async function () {
      if (!confirm("Kembalikan navbar ke ikon default?")) return;
      const { error } = await supabaseClient.from("site_settings").update({ logo_url: null }).eq("id", 1);
      if (error) {
        alert("Gagal: " + error.message);
        return;
      }
      if (typeof window.terapkanLogo === "function") window.terapkanLogo(null);
      loadTabLogo();
    });
  }
}

/* ==================== TAB 4: PETUNJUK TEKNIS (PDF) ==================== */

// Catatan: pengaturan profil Beranda ("Beranda/Profil") TIDAK ADA LAGI di
// sini -- dipindah ke halaman Panitia terpisah "#/adminprofil"
// (lihat view-adminprofil.js), supaya tidak dicampur dengan tab-tab
// pengelolaan lomba di panel ini. Login tetap pakai akun panitia yang sama.

async function loadTabJuknis() {
  const content = document.getElementById("admin-content");
  content.innerHTML = '<p class="hint">Memuat data juknis...</p>';

  const { data } = await supabaseClient.from("site_settings").select("juknis_url,juknis_nama").eq("id", 1).single();
  const juknisUrl = data ? data.juknis_url : null;
  const juknisNama = data ? data.juknis_nama : null;

  content.innerHTML =
    '<div class="form-shell" style="max-width:480px;">' +
      '<h3>Petunjuk Teknis (Juknis)</h3>' +
      '<p>Format PDF saja. File ini akan muncul sebagai tombol unduh di halaman Lomba dan halaman Daftar Lomba.</p>' +
      '<div id="juknis-preview" style="margin:16px 0;">' +
        (juknisUrl
          ? '<a href="' + juknisUrl + '" target="_blank" rel="noopener">📄 ' + (juknisNama || "Lihat juknis saat ini") + '</a>'
          : '<p class="hint">Belum ada juknis diunggah — tombol unduh belum tampil di situs.</p>') +
      '</div>' +
      '<div class="field">' +
        '<label for="input-juknis">Pilih file PDF</label>' +
        '<input type="file" id="input-juknis" accept=".pdf,application/pdf" />' +
      '</div>' +
      '<div class="form-error" id="juknis-error" style="display:none;"></div>' +
      '<div class="submit-row" style="display:flex;gap:10px;">' +
        '<button type="button" class="btn btn--primary" id="btn-upload-juknis">Upload Juknis</button>' +
        (juknisUrl ? '<button type="button" class="btn btn--ghost" id="btn-hapus-juknis">Hapus Juknis</button>' : "") +
      '</div>' +
    '</div>';

  document.getElementById("btn-upload-juknis").addEventListener("click", async function () {
    const fileInput = document.getElementById("input-juknis");
    const errEl = document.getElementById("juknis-error");
    errEl.style.display = "none";

    const file = fileInput.files[0];
    if (!file) {
      errEl.textContent = "Pilih file PDF dulu.";
      errEl.style.display = "block";
      return;
    }
    if (file.type !== "application/pdf") {
      errEl.textContent = "File harus berformat PDF.";
      errEl.style.display = "block";
      return;
    }

    const btn = this;
    btn.disabled = true;
    btn.textContent = "Mengunggah...";

    const path = "juknis/juknis-" + Date.now() + ".pdf";
    const { error: uploadError } = await supabaseClient.storage.from("aset-situs").upload(path, file, { contentType: "application/pdf" });

    if (uploadError) {
      btn.disabled = false;
      btn.textContent = "Upload Juknis";
      errEl.textContent = "Gagal mengunggah: " + uploadError.message;
      errEl.style.display = "block";
      return;
    }

    const { data: pub } = supabaseClient.storage.from("aset-situs").getPublicUrl(path);
    const { error: updateError } = await supabaseClient.from("site_settings")
      .update({ juknis_url: pub.publicUrl, juknis_nama: file.name })
      .eq("id", 1);

    btn.disabled = false;
    btn.textContent = "Upload Juknis";

    if (updateError) {
      errEl.textContent = "Berkas terunggah tapi gagal menyimpan pengaturan: " + updateError.message;
      errEl.style.display = "block";
      return;
    }

    loadTabJuknis();
  });

  const btnHapus = document.getElementById("btn-hapus-juknis");
  if (btnHapus) {
    btnHapus.addEventListener("click", async function () {
      if (!confirm("Hapus juknis? Tombol unduh akan hilang dari situs sampai diupload lagi.")) return;
      const { error } = await supabaseClient.from("site_settings").update({ juknis_url: null, juknis_nama: null }).eq("id", 1);
      if (error) {
        alert("Gagal: " + error.message);
        return;
      }
      loadTabJuknis();
    });
  }
}

/* ==================== TAB 5: KARTU PESERTA & PENDAMPING ==================== */

// Sejak pembaruan ini: Kartu Peserta & Kartu Peserta Futsal/Tim memakai
// TEMPLATE TERPISAH per kombinasi CABANG LOMBA x JENIS KELAMIN (bukan lagi
// satu template dibagi rata semua lomba) -- permintaan panitia, supaya
// tiap cabang lomba bisa punya gambar/nuansa kartu sendiri-sendiri (ini
// juga yang jadi "gambaran jenis lomba" di kartunya -- bukan lewat ikon
// tambahan, tapi lewat template gambarnya sendiri yang beda per lomba).
// Posisi & ukuran tiap field (Nama, Nomor Pendaftaran, dst.) JUGA diatur
// TERPISAH per kombinasi tsb (tata letak gambar bisa beda-beda per
// template), lewat editor DRAG-AND-DROP langsung di atas pratinjau kartu
// (klik+geser tulisan contohnya buat mengatur posisi, seret bulatan kecil
// di pojok kanan-bawah tiap tulisan buat memperbesar/mengecilkan huruf --
// mirip Canva, tidak perlu lagi mengetik angka X/Y manual) -- lihat
// buatEditorDrag().
//
// Kartu Pendamping TETAP satu template & satu posisi global (tidak
// terikat cabang lomba tertentu, karena satu pendamping bisa membina lebih
// dari satu lomba), tapi editornya memakai drag-and-drop yang sama.
//
// Semuanya tersimpan di SATU kolom site_settings.kartu_templates (jsonb,
// migrasi 0053), strukturnya:
//   {
//     peserta:    { "<lomba_id>|<jenis_kelamin>": { url, layout } },
//     pesertaTim: { "<lomba_id>|<jenis_kelamin>": { url, layout } },
//     pendamping: { url, layout }
//   }
// (Kolom lama kartu_peserta_url/kartu_pendamping_url/kartu_layout dari
// migrasi 0012 TIDAK dipakai lagi mulai migrasi 0053 -- lihat catatan di
// file migrasinya.)
const FIELD_PESERTA = [
  { key: "nama", label: "Nama" },
  { key: "nomor_pendaftaran", label: "Nomor Pendaftaran" }
];
// Kartu khusus pendaftar TIM (Futsal) -- SATU KARTU PER ANGGOTA tim, bukan
// per baris pendaftaran (lihat cetakKartuPDF(), jenis "pesertaTim").
const FIELD_PESERTA_TIM = [
  { key: "nama_tim", label: "Nama Tim" },
  { key: "nama_anggota", label: "Nama Anggota" },
  { key: "nomor_pendaftaran", label: "Nomor Pendaftaran" }
];
const FIELD_PENDAMPING = [
  { key: "nama", label: "Nama" },
  { key: "lomba", label: "Lomba/Sekolah" }
];

// Sertifikat (BARU) -- SATU templat generik untuk SEMUA penerima (peserta
// individu, tiap anggota tim, & pendamping), beda dari Kartu yang punya
// templat terpisah per Cabang Lomba x Jenis Kelamin. Field key "lomba"
// TIDAK dipakai ulang di sini (walau namanya sama persis dengan field Kartu
// Pendamping) -- dipakai key "lomba_sertifikat" yang beda, supaya
// pengaturan rata tengah di KARTU_FIELD_RATA_TENGAH (di bawah) untuk field
// ini TIDAK ikut membuat field "lomba" milik Kartu Pendamping jadi rata
// tengah juga (field itu sengaja dibiarkan rata kiri, lihat komentarnya).
const FIELD_SERTIFIKAT = [
  { key: "nama", label: "Nama" },
  { key: "lomba_sertifikat", label: "Cabang Lomba" },
  { key: "nomor_pendaftaran", label: "Nomor Pendaftaran" }
];

// Ukuran cetak KARTU PESERTA & KARTU PENDAMPING dibuat TETAP (bukan lagi
// ikut ukuran piksel PNG template yang diupload panitia) -- 8,5 x 11,5 cm,
// PORTRAIT, supaya 4 kartu pas tercetak dalam satu lembar A4 (grid 2x2,
// lihat cetakKartuPDF()) -- lebih efisien/murah dicetak massal lewat jasa
// cetak biasa dibanding satu kartu per halaman. Berapa pun ukuran file PNG
// yang diupload, hasil pratinjau & PDF-nya SELALU pas di ukuran fisik ini
// (gambar template ditarik/disusutkan otomatis supaya penuh) -- lihat
// gambarKartu() & cetakKartuPDF(). Sebaiknya desain template dibuat dengan
// rasio 8,5:11,5 (portrait) supaya tidak gepeng/melar.
const KARTU_LEBAR_CM = 8.5;
const KARTU_TINGGI_CM = 11.5;
const KARTU_DPI = 300; // dipakai buat kanvas pratinjau di layar; PDF-nya sendiri pakai satuan cm langsung (lihat cetakKartuPDF) supaya ukuran fisiknya presisi
const KARTU_LEBAR_PX = Math.round((KARTU_LEBAR_CM / 2.54) * KARTU_DPI);
const KARTU_TINGGI_PX = Math.round((KARTU_TINGGI_CM / 2.54) * KARTU_DPI);

// Ukuran cetak SERTIFIKAT (BARU) -- A4 LANDSCAPE penuh (29,7 x 21 cm), SATU
// sertifikat per halaman -- beda dari Kartu yang portrait kecil 4-per-
// halaman, karena sertifikat lazimnya memang mengisi satu lembar A4 utuh.
// Memakai fungsi gambar (gambarKartu()/gambarTeksPasKotak()) & editor
// drag-and-drop (buatEditorDrag()) YANG SAMA dengan Kartu, cuma dioper
// resolusi & skala tampilan sendiri lewat parameter opsional masing-masing
// fungsi itu -- lihat komentarnya.
const SERTIFIKAT_LEBAR_CM = 29.7;
const SERTIFIKAT_TINGGI_CM = 21;
const SERTIFIKAT_DPI = 300;
const SERTIFIKAT_LEBAR_PX = Math.round((SERTIFIKAT_LEBAR_CM / 2.54) * SERTIFIKAT_DPI);
const SERTIFIKAT_TINGGI_PX = Math.round((SERTIFIKAT_TINGGI_CM / 2.54) * SERTIFIKAT_DPI);
const SERTIFIKAT_DISPLAY_LEBAR = 480; // px -- lebih lebar dari KARTU_DISPLAY_LEBAR (300) karena rasionya landscape, bukan portrait

// Posisi default untuk template BARU yang belum pernah diatur -- cuma
// titik awal, panitia tinggal menggeser lewat editor drag-and-drop.
// "lebar" (baru) = lebar KOTAK PEMBATAS teks itu (dalam px kanvas cetak,
// KARTU_LEBAR_PX) -- begitu nama/teksnya lebih panjang dari kotak ini,
// gambarTeksPasKotak() (dipakai gambarKartu()) otomatis MENGECILKAN
// hurufnya dulu, dan kalau masih belum cukup di ukuran terkecil yang
// wajar, baru MENYINGKATNYA (dipotong per kata lalu per huruf, diakhiri
// "…") -- supaya nama peserta yang panjang tidak pernah meluber keluar
// template kartunya. Lihat juga KARTU_FONT_MIN_RASIO.
const DEFAULT_LAYOUT_KARTU = {
  peserta: {
    nama: { x: 60, y: 620, font: 64, lebar: 880 },
    nomor_pendaftaran: { x: 60, y: 710, font: 36, lebar: 880 }
  },
  pesertaTim: {
    nama_tim: { x: 60, y: 540, font: 46, lebar: 880 },
    nama_anggota: { x: 60, y: 630, font: 46, lebar: 880 },
    nomor_pendaftaran: { x: 60, y: 720, font: 36, lebar: 880 }
  },
  pendamping: {
    nama: { x: 60, y: 620, font: 64, lebar: 880 },
    lomba: { x: 60, y: 710, font: 36, lebar: 880 }
  },
  // Posisi awal untuk kanvas A4 LANDSCAPE (3508x2480px, lihat
  // SERTIFIKAT_LEBAR_PX/TINGGI_PX) -- jauh lebih lebar dari Kartu, jadi
  // angkanya sengaja beda skala. Cuma titik awal, panitia tinggal menggeser
  // lewat editor sesuai desain templatenya sendiri.
  sertifikat: {
    nama: { x: 600, y: 1050, font: 140, lebar: 2308 },
    lomba_sertifikat: { x: 600, y: 1260, font: 70, lebar: 2308 },
    nomor_pendaftaran: { x: 600, y: 2300, font: 40, lebar: 2308 }
  }
};

// Salinan BARU (bukan referensi) dari posisi default suatu jenis kartu --
// dipakai sebagai titik awal tiap kali kombinasi lomba+gender yang belum
// pernah disentuh dibuka di editor, supaya menggeser satu kombinasi tidak
// ikut mengubah objek default global/kombinasi lain.
function layoutDefaultBaru(jenis, fields) {
  const sumber = DEFAULT_LAYOUT_KARTU[jenis] || {};
  const hasil = {};
  fields.forEach(function (f) {
    hasil[f.key] = Object.assign({ x: 60, y: 60, font: 32, lebar: 880 }, sumber[f.key] || {});
  });
  return hasil;
}

function kunciKartu(lombaId, gender) { return lombaId + "|" + gender; }

async function ambilKartuTemplates() {
  const { data } = await supabaseClient.from("site_settings").select("kartu_templates").eq("id", 1).single();
  return (data && data.kartu_templates) || {};
}
function simpanKartuTemplates(templatesSemua) {
  return supabaseClient.from("site_settings").update({ kartu_templates: templatesSemua }).eq("id", 1);
}

let libKartuSiap = false;
function muatScript(src) {
  return new Promise(function (resolve, reject) {
    if (document.querySelector('script[src="' + src + '"]')) { resolve(); return; }
    const s = document.createElement("script");
    s.src = src;
    s.onload = function () { resolve(); };
    s.onerror = function () { reject(new Error("Gagal memuat " + src)); };
    document.head.appendChild(s);
  });
}
async function pastikanLibKartu() {
  if (libKartuSiap) return;
  await muatScript("https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js");
  libKartuSiap = true;
}

// `timeoutMs` (default 8 detik) -- jaga-jaga kalau `url`-nya macet dimuat
// (jaringan lambat/putus di tengah, atau gagal tanpa pernah memicu
// `onerror`-nya sendiri sama sekali) supaya pemanggil (mis. Poster Rekap)
// TIDAK macet selamanya menunggu, melainkan lanjut pakai gambar pengganti.
function muatGambar(url, timeoutMs) {
  return new Promise(function (resolve, reject) {
    const img = new Image();
    img.crossOrigin = "anonymous";
    const batasWaktu = setTimeout(function () {
      reject(new Error("Waktu memuat gambar habis (jaringan lambat/macet)."));
    }, timeoutMs || 8000);
    img.onload = function () { clearTimeout(batasWaktu); resolve(img); };
    img.onerror = function () { clearTimeout(batasWaktu); reject(new Error("Gagal memuat gambar template.")); };
    img.src = url;
  });
}

// Jangan mengecilkan huruf lebih dari 55% ukuran yang diatur panitia --
// di bawah itu, gambarTeksPasKotak() berhenti mengecilkan & mulai
// MENYINGKAT teksnya (lihat fungsi itu) supaya hurufnya tidak sampai
// terlalu kecil untuk dibaca.
const KARTU_FONT_MIN_RASIO = 0.55;

// Field yang ditulis RATA TENGAH di dalam kotaknya (bukan rata kiri seperti
// bawaan) -- permintaan panitia: Nama (dipakai field "peserta.nama" & juga
// "pendamping.nama"), Nomor Pendaftaran, Nama Tim, dan Nama Anggota (dua
// yang terakhir khusus Kartu Peserta Futsal/Tim). Field lain yang tidak
// disebut di sini (Lomba di kartu Pendamping) TETAP rata kiri seperti
// semula. "x" tetap berarti TEPI KIRI kotak (sama seperti sebelumnya,
// dipakai editor drag-and-drop untuk menggeser) -- cuma titik gambar
// teksnya yang dipindah ke tengah kotak lewat gambarTeksPasKotak() di
// bawah.
const KARTU_FIELD_RATA_TENGAH = { nama: true, nomor_pendaftaran: true, nama_tim: true, nama_anggota: true, lomba_sertifikat: true };

// Menggambar satu baris teks (`teks`) supaya PAS di dalam kotak pembatas
// selebar `lebarMaks` px (satuan kanvas cetak, KARTU_LEBAR_PX) -- permintaan
// panitia: nama yang panjang jangan sampai meluber keluar template
// kartunya. Urutannya: (1) coba apa adanya di `fontAwal`, (2) kalau
// kepanjangan, kecilkan hurufnya sedikit demi sedikit sampai PAS atau
// sampai batas KARTU_FONT_MIN_RASIO, (3) kalau MASIH kepanjangan di ukuran
// terkecil itu, singkat teksnya -- buang kata terakhir satu-satu (bukan
// potong tengah kata) sampai pas, diberi akhiran "…"; kalau cuma satu kata
// pun masih kepanjangan (nama tanpa spasi), baru dipotong huruf per huruf.
// `lebarMaks` kosong/0 (data lama sebelum fitur ini, atau field yang
// sengaja tidak dibatasi) -> digambar apa adanya tanpa batasan sama sekali.
// `align` ("left"/"center", default "left") -- lihat KARTU_FIELD_RATA_TENGAH
// di atas; untuk "center" teks digambar di tengah kotak (x + lebarMaks/2),
// "x" sendiri tetap tepi kiri kotak, tidak berubah artinya.
function gambarTeksPasKotak(ctx, teks, x, y, fontAwal, lebarMaks, align) {
  teks = teks || "-";
  align = align === "center" ? "center" : "left";

  if (!lebarMaks) {
    ctx.textAlign = align;
    ctx.font = "600 " + fontAwal + "px 'Plus Jakarta Sans', sans-serif";
    ctx.fillText(teks, x, y);
    ctx.textAlign = "left"; // dikembalikan supaya tidak mempengaruhi field lain
    return;
  }

  const fontMin = Math.max(14, Math.round(fontAwal * KARTU_FONT_MIN_RASIO));
  let font = fontAwal;
  ctx.font = "600 " + font + "px 'Plus Jakarta Sans', sans-serif";
  while (font > fontMin && ctx.measureText(teks).width > lebarMaks) {
    font -= 2;
    ctx.font = "600 " + font + "px 'Plus Jakarta Sans', sans-serif";
  }

  if (ctx.measureText(teks).width > lebarMaks) {
    const kata = teks.split(" ");
    while (kata.length > 1 && ctx.measureText(kata.join(" ") + "…").width > lebarMaks) {
      kata.pop();
    }
    teks = kata.join(" ") + "…";
    while (teks.length > 2 && ctx.measureText(teks).width > lebarMaks) {
      teks = teks.slice(0, -2) + "…";
    }
  }

  ctx.textAlign = align;
  ctx.fillText(teks, align === "center" ? (x + lebarMaks / 2) : x, y);
  ctx.textAlign = "left"; // dikembalikan supaya tidak mempengaruhi field lain
}

// `lebarPx`/`tinggiPx` (opsional, BARU) -- resolusi kanvas cetak dalam px.
// Default ke KARTU_LEBAR_PX/KARTU_TINGGI_PX (ukuran Kartu Peserta/Pendamping)
// kalau tidak dioper sama sekali, supaya semua pemanggil LAMA (yang tidak
// tahu-menahu soal parameter ini) tetap berjalan tanpa berubah. Sertifikat
// (lihat SERTIFIKAT_LEBAR_PX/TINGGI_PX di bawah) memakai fungsi gambar YANG
// SAMA ini, cuma mengoper resolusi A4 landscape-nya sendiri -- supaya tidak
// ada duplikasi logika gambar/auto-mengecilkan teks antara Kartu & Sertifikat.
function gambarKartu(canvas, templateImg, layout, data, fields, lebarPx, tinggiPx) {
  lebarPx = lebarPx || KARTU_LEBAR_PX;
  tinggiPx = tinggiPx || KARTU_TINGGI_PX;
  canvas.width = lebarPx;
  canvas.height = tinggiPx;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(templateImg, 0, 0, lebarPx, tinggiPx);
  ctx.fillStyle = "#000000";
  ctx.textBaseline = "top";
  fields.forEach(function (f) {
    const pos = (layout && layout[f.key]) || { x: 40, y: 40, font: 22, lebar: 880 };
    // Lebar kotak: pakai yang diatur panitia -- untuk layout LAMA (sebelum
    // fitur ini, belum punya "lebar" sama sekali) dibuatkan perkiraan yang
    // masuk akal dari posisi X-nya ke tepi kanan kartu, supaya template
    // yang sudah pernah diatur sebelum ini tetap ikut terlindung dari nama
    // yang meluber tanpa panitia perlu mengatur ulang satu-satu.
    const lebar = pos.lebar || Math.max(100, lebarPx - pos.x - 40);
    const align = KARTU_FIELD_RATA_TENGAH[f.key] ? "center" : "left";
    gambarTeksPasKotak(ctx, data[f.key] || "-", pos.x, pos.y, pos.font, lebar, align);
  });
}

// ======================= EDITOR DRAG-AND-DROP (gaya Canva) =======================
// Dipakai ulang untuk ketiga jenis kartu. `wrapEl` jadi kanvas pratinjau
// berukuran tetap (KARTU_DISPLAY_LEBAR px, diskalakan dari ukuran cetak
// sesungguhnya) dengan gambar template sebagai latar; tiap field jadi
// KOTAK teks yang bisa diseret langsung (geser badan tulisannya = pindah
// posisi, seret bulatan HIJAU di pojok kanan-bawah = perbesar/perkecil
// huruf, seret pegangan BIRU di tepi kanan-tengah = ubah LEBAR kotaknya).
// Kotak ini adalah batas lebar yang dipakai gambarTeksPasKotak() saat
// kartu sungguhan dicetak -- begitu nama peserta lebih panjang dari
// kotaknya, hurufnya otomatis mengecil dulu, lalu disingkat kalau masih
// belum cukup (lihat komentar di gambarTeksPasKotak()) -- jadi mengatur
// lebar kotak di sini = mengatur seberapa panjang nama yang masih
// ditampilkan apa adanya sebelum mulai mengecil/disingkat.
// `layout` DIUBAH LANGSUNG (bukan disalin) oleh editor ini -- pemanggil
// cukup simpan objek `layout` yang sama saat tombol Simpan ditekan, tidak
// perlu baca ulang dari form.
const KARTU_DISPLAY_LEBAR = 300; // px -- lebar kanvas pratinjau drag-and-drop di layar
function kartuSkalaDrag() { return KARTU_LEBAR_PX / KARTU_DISPLAY_LEBAR; }
function kartuDisplayTinggi() { return Math.round(KARTU_TINGGI_PX / kartuSkalaDrag()); }

// `opsi` (opsional, BARU) -- { lebarPx, tinggiPx, displayLebar } supaya
// editor yang SAMA ini bisa dipakai ulang untuk kanvas beda ukuran/rasio
// (Sertifikat, landscape A4, lihat SERTIFIKAT_LEBAR_PX dkk di bawah), bukan
// cuma Kartu Peserta/Pendamping (portrait 8,5x11,5cm). Default ke
// KARTU_LEBAR_PX/KARTU_TINGGI_PX/KARTU_DISPLAY_LEBAR kalau tidak dioper sama
// sekali, supaya semua pemanggil LAMA (Kartu) tetap berjalan tanpa berubah.
function buatEditorDrag(wrapEl, templateUrl, fields, layout, onUbah, opsi) {
  opsi = opsi || {};
  const lebarPx = opsi.lebarPx || KARTU_LEBAR_PX;
  const tinggiPx = opsi.tinggiPx || KARTU_TINGGI_PX;
  const displayLebar = opsi.displayLebar || KARTU_DISPLAY_LEBAR;
  const skala = lebarPx / displayLebar;
  const displayTinggi = Math.round(tinggiPx / skala);

  wrapEl.innerHTML = "";
  wrapEl.style.position = "relative";
  wrapEl.style.width = displayLebar + "px";
  wrapEl.style.height = displayTinggi + "px";
  wrapEl.style.background = "#dcdcdc";
  wrapEl.style.border = "1px solid #c7c7c7";
  wrapEl.style.borderRadius = "10px";
  wrapEl.style.overflow = "visible"; // label kecil & tombol A-/A+ tiap field boleh sedikit menonjol ke luar kotak kartu
  wrapEl.style.userSelect = "none";
  wrapEl.style.touchAction = "none";
  wrapEl.style.marginTop = "10px";

  if (!templateUrl) {
    wrapEl.innerHTML = '<p class="hint" style="padding:14px;margin:0;">Belum ada template -- upload dulu supaya bisa mengatur posisi dengan menggeser.</p>';
    return;
  }

  // Kanvas pratinjau WYSIWYG (baru) -- digambar memakai gambarKartu()/
  // gambarTeksPasKotak() YANG SAMA PERSIS dengan kartu sungguhan (resolusi
  // ASLI KARTU_LEBAR_PX x KARTU_TINGGI_PX, cuma DITAMPILKAN lebih kecil
  // lewat CSS width/height) -- supaya posisi & ukuran huruf yang kelihatan
  // di sini PERSIS SAMA dengan hasil kartu/PDF yang tercetak. Sebelumnya
  // pratinjau ini dibuat dari <div> teks HTML biasa, yang metrik
  // vertikalnya (line-height, padding) berbeda dari <canvas> fillText()
  // yang dipakai saat cetak -- itu sebabnya posisi yang terlihat "pas" di
  // pratinjau bisa meleset (teks tercetak lebih ke atas dari yang
  // kelihatan) saat benar-benar dicetak. Dengan memakai fungsi gambar yang
  // sama di sini, selisih itu sekarang tidak mungkin terjadi lagi.
  const kanvasPratinjau = document.createElement("canvas");
  Object.assign(kanvasPratinjau.style, {
    position: "absolute", left: "0", top: "0",
    width: displayLebar + "px", height: displayTinggi + "px",
    borderRadius: "10px", pointerEvents: "none"
  });
  wrapEl.appendChild(kanvasPratinjau);

  const dataContoh = {};
  fields.forEach(function (f) { dataContoh[f.key] = "Contoh " + f.label; });

  let templateImg = null;
  function gambarUlang() {
    if (!templateImg) return;
    gambarKartu(kanvasPratinjau, templateImg, layout, dataContoh, fields, lebarPx, tinggiPx);
  }
  muatGambar(templateUrl).then(function (img) {
    templateImg = img;
    gambarUlang();
  }).catch(function () {
    // Gagal memuat template (jaringan lambat/putus) -- kotak-kotak
    // pengatur posisi di bawah tetap bisa dipakai, cuma latarnya kosong.
  });

  fields.forEach(function (f) {
    const pos = layout[f.key];
    // Layout LAMA (disimpan sebelum fitur kotak-pembatas ini ada) belum
    // punya "lebar" sama sekali -- dikasih perkiraan awal yang masuk akal
    // begitu editornya dibuka, sama seperti fallback di gambarKartu().
    // Ini MENULIS ke `pos` (bagian dari `layout` yang dioper apa adanya,
    // bukan disalin) supaya begitu panitia menekan Simpan, nilai "lebar"
    // yang baru ini ikut tersimpan -- bukan cuma dipakai sementara di
    // pratinjau lalu hilang lagi.
    if (pos.lebar == null) pos.lebar = Math.max(100, lebarPx - pos.x - 40);

    function tinggiKotak() { return Math.round(pos.font * 1.3); }

    // Kotak transparan ini HANYA area pegangan untuk geser/ubah ukuran --
    // teksnya sendiri sudah digambar di kanvasPratinjau di bawahnya
    // (WYSIWYG), jadi kotak ini tidak perlu menampilkan tulisan apa pun.
    const el = document.createElement("div");
    el.title = f.label + " -- geser untuk pindah posisi";
    Object.assign(el.style, {
      position: "absolute",
      left: (pos.x / skala) + "px",
      top: (pos.y / skala) + "px",
      width: (pos.lebar / skala) + "px",
      height: (tinggiKotak() / skala) + "px",
      boxSizing: "border-box",
      cursor: "move",
      outline: "1.5px dashed #2f7bdb",
      background: "rgba(47,123,219,0.07)"
    });

    // Label kecil nama field -- cuma penanda kotak mana ini (bukan teks
    // kartu sungguhan), supaya tetap jelas kalau ada beberapa kotak
    // berdekatan/bertumpuk.
    const labelKecil = document.createElement("span");
    labelKecil.textContent = f.label;
    Object.assign(labelKecil.style, {
      position: "absolute", left: "0", bottom: "100%", marginBottom: "2px",
      fontSize: "10px", fontFamily: "sans-serif", fontWeight: "600", color: "#fff",
      background: "#2f7bdb", padding: "1px 5px", borderRadius: "3px", whiteSpace: "nowrap"
    });
    el.appendChild(labelKecil);

    // Tombol A-/A+ (ditambahkan lagi) -- cara TAMBAHAN yang presisi untuk
    // mengecilkan/membesarkan huruf (langkah 2px tiap klik), selain
    // menyeret bulatan hijau di pojok kanan-bawah -- lebih mudah dipakai
    // kalau kotaknya kecil/berdekatan sehingga menyeret jadi kurang presisi.
    const tombolFontKecil = document.createElement("button");
    tombolFontKecil.type = "button";
    tombolFontKecil.textContent = "A−";
    tombolFontKecil.title = "Kecilkan huruf";
    const tombolFontBesar = document.createElement("button");
    tombolFontBesar.type = "button";
    tombolFontBesar.textContent = "A+";
    tombolFontBesar.title = "Besarkan huruf";
    [tombolFontKecil, tombolFontBesar].forEach(function (btn, i) {
      Object.assign(btn.style, {
        position: "absolute", bottom: "100%", marginBottom: "2px",
        right: (i === 0 ? "19px" : "0"),
        width: "17px", height: "17px", fontSize: "11px", lineHeight: "1",
        padding: "0", border: "1px solid #2f7bdb", borderRadius: "3px",
        background: "#fff", color: "#2f7bdb", cursor: "pointer", fontWeight: "700"
      });
      btn.addEventListener("pointerdown", function (ev) { ev.stopPropagation(); });
      el.appendChild(btn);
    });
    tombolFontKecil.addEventListener("click", function (ev) {
      ev.stopPropagation();
      pos.font = Math.max(10, pos.font - 2);
      el.style.height = (tinggiKotak() / skala) + "px";
      gambarUlang();
      onUbah();
    });
    tombolFontBesar.addEventListener("click", function (ev) {
      ev.stopPropagation();
      pos.font = pos.font + 2;
      el.style.height = (tinggiKotak() / skala) + "px";
      gambarUlang();
      onUbah();
    });

    // Bulatan HIJAU di pojok kanan-bawah -- seret VERTIKAL = ubah ukuran
    // HURUF (pos.font), sama seperti sebelumnya (dipertahankan sebagai
    // cara cepat selain tombol A-/A+ di atas).
    const handleFont = document.createElement("span");
    Object.assign(handleFont.style, {
      position: "absolute", right: "-9px", bottom: "-9px", width: "15px", height: "15px",
      borderRadius: "50%", background: "#0f7b3e", border: "2px solid #fff", cursor: "nwse-resize",
      boxShadow: "0 1px 3px rgba(0,0,0,0.4)"
    });
    el.appendChild(handleFont);

    // Pegangan BIRU di tepi kanan-tengah -- seret HORIZONTAL = ubah LEBAR
    // KOTAK (pos.lebar), batas sebelum teks otomatis mengecil/disingkat
    // saat kartu sungguhan dicetak.
    const handleLebar = document.createElement("span");
    Object.assign(handleLebar.style, {
      position: "absolute", right: "-5px", top: "50%", width: "9px", height: "20px",
      marginTop: "-10px", borderRadius: "4px", background: "#2f7bdb", border: "2px solid #fff",
      cursor: "ew-resize", boxShadow: "0 1px 3px rgba(0,0,0,0.4)"
    });
    el.appendChild(handleLebar);

    let modeAktif = null;

    function gerak(ev) {
      if (!modeAktif) return;
      if (modeAktif.mode === "geser") {
        pos.x = Math.max(0, Math.round(modeAktif.ox + (ev.clientX - modeAktif.x0) * skala));
        pos.y = Math.max(0, Math.round(modeAktif.oy + (ev.clientY - modeAktif.y0) * skala));
        el.style.left = (pos.x / skala) + "px";
        el.style.top = (pos.y / skala) + "px";
      } else if (modeAktif.mode === "besar") {
        pos.font = Math.max(10, Math.round(modeAktif.of + (ev.clientY - modeAktif.y0) * skala));
        el.style.height = (tinggiKotak() / skala) + "px";
      } else { // "lebar"
        pos.lebar = Math.max(40, Math.round(modeAktif.ol + (ev.clientX - modeAktif.x0) * skala));
        el.style.width = (pos.lebar / skala) + "px";
      }
      gambarUlang();
      onUbah();
    }
    function lepas() { modeAktif = null; }

    el.addEventListener("pointerdown", function (ev) {
      ev.preventDefault();
      modeAktif = { mode: "geser", x0: ev.clientX, y0: ev.clientY, ox: pos.x, oy: pos.y };
      el.setPointerCapture(ev.pointerId);
    });
    el.addEventListener("pointermove", gerak);
    el.addEventListener("pointerup", lepas);
    el.addEventListener("pointercancel", lepas);

    handleFont.addEventListener("pointerdown", function (ev) {
      ev.stopPropagation();
      ev.preventDefault();
      modeAktif = { mode: "besar", y0: ev.clientY, of: pos.font };
      handleFont.setPointerCapture(ev.pointerId);
    });
    handleFont.addEventListener("pointermove", gerak);
    handleFont.addEventListener("pointerup", lepas);
    handleFont.addEventListener("pointercancel", lepas);

    handleLebar.addEventListener("pointerdown", function (ev) {
      ev.stopPropagation();
      ev.preventDefault();
      modeAktif = { mode: "lebar", x0: ev.clientX, ol: pos.lebar };
      handleLebar.setPointerCapture(ev.pointerId);
    });
    handleLebar.addEventListener("pointermove", gerak);
    handleLebar.addEventListener("pointerup", lepas);
    handleLebar.addEventListener("pointercancel", lepas);

    wrapEl.appendChild(el);
  });
}

// ======================= PANEL "Kartu Peserta" & "Kartu Peserta Futsal/Tim" =======================
// Keduanya per kombinasi Cabang Lomba x Jenis Kelamin -- lihat komentar di
// bagian atas file ini.
function panelKartuPerLombaHTML(jenis, judul) {
  return (
    '<div class="form-shell" id="panel-' + jenis + '" style="margin-bottom:20px;">' +
      '<h3>' + judul + '</h3>' +
      '<div style="display:flex;gap:12px;flex-wrap:wrap;">' +
        '<div class="field"><label>Cabang Lomba</label><select id="pilih-lomba-' + jenis + '"></select></div>' +
        '<div class="field"><label>Jenis Kelamin</label><select id="pilih-gender-' + jenis + '">' +
          '<option value="laki-laki">Laki-laki</option><option value="perempuan">Perempuan</option>' +
        '</select></div>' +
      '</div>' +
      '<p class="hint" id="status-kombo-' + jenis + '"></p>' +
      '<div class="field">' +
        '<label>Template (PNG) untuk kombinasi ini</label>' +
        '<input type="file" id="input-template-' + jenis + '" accept=".png,image/png" />' +
      '</div>' +
      '<button type="button" class="btn btn--ghost" id="btn-upload-template-' + jenis + '" style="margin-bottom:10px;">Upload/Ganti Template</button>' +
      '<div id="drag-wrap-' + jenis + '"></div>' +
      '<p class="hint">Geser langsung kotak (area putus-putus biru) untuk mengatur posisi; pakai tombol <strong>A−/A+</strong> di pojok kanan-atas kotak atau seret bulatan hijau di pojok kanan-bawah untuk mengubah ukuran huruf; seret pegangan biru di tepi kanan untuk mengubah lebar kotaknya. Pratinjau di atas memakai gambar PERSIS SAMA dengan hasil cetak (bukan tiruan HTML) -- posisi yang terlihat di sini presisi sama dengan kartu yang akan dicetak. Begitu nama peserta lebih panjang dari lebar kotak ini, hurufnya otomatis mengecil dulu lalu disingkat kalau masih belum cukup saat kartu dicetak.</p>' +
      '<button type="button" class="btn btn--primary" id="btn-simpan-posisi-' + jenis + '" style="margin-top:6px;">Simpan Posisi &amp; Template Ini</button>' +
      '<span class="hint" id="status-posisi-' + jenis + '" style="margin-left:10px;"></span>' +
      '<div id="ringkasan-' + jenis + '" style="margin-top:16px;"></div>' +
    '</div>'
  );
}

async function setupKartuPerLomba(jenis, fields, daftarLomba, templatesSemua) {
  const panel = document.getElementById("panel-" + jenis);
  if (!daftarLomba || daftarLomba.length === 0) {
    panel.innerHTML += '<p class="hint" style="padding:0 20px 16px;">Belum ada cabang lomba ' +
      (jenis === "pesertaTim" ? "bertipe tim" : "individu") + ' yang terdaftar di "Kelola Lomba".</p>';
    return;
  }

  const selLomba = document.getElementById("pilih-lomba-" + jenis);
  const selGender = document.getElementById("pilih-gender-" + jenis);
  selLomba.innerHTML = daftarLomba.map(function (r) {
    return '<option value="' + r.id + '">' + r.nama + '</option>';
  }).join("");

  if (!templatesSemua[jenis]) templatesSemua[jenis] = {};

  let layoutAktif = null;

  function renderRingkasanKombo() {
    const el = document.getElementById("ringkasan-" + jenis);
    if (!el) return;
    const baris = [];
    daftarLomba.forEach(function (r) {
      ["laki-laki", "perempuan"].forEach(function (g) {
        const ada = !!(templatesSemua[jenis][kunciKartu(r.id, g)] && templatesSemua[jenis][kunciKartu(r.id, g)].url);
        baris.push(
          '<span style="display:inline-block;margin:2px 8px 2px 0;padding:3px 9px;border-radius:999px;font-size:12px;' +
          (ada ? 'background:#d8f5df;color:#0f7b3e;' : 'background:#fde3e3;color:#b23b3b;') + '">' +
          escapeHTML(r.nama) + ' · ' + (g === "laki-laki" ? "L" : "P") + ' ' + (ada ? "✓" : "–") +
          '</span>'
        );
      });
    });
    el.innerHTML = '<p class="hint" style="margin-bottom:6px;">Status template per kombinasi:</p>' + baris.join("");
  }

  function muatKombo() {
    const lombaId = selLomba.value;
    const gender = selGender.value;
    if (!lombaId) return;
    const kunci = kunciKartu(lombaId, gender);
    const existing = templatesSemua[jenis][kunci];
    const url = existing ? existing.url : null;
    layoutAktif = Object.assign(layoutDefaultBaru(jenis, fields), existing ? existing.layout : {});

    document.getElementById("status-kombo-" + jenis).textContent =
      url ? "Template sudah diunggah untuk kombinasi ini." : "Belum ada template untuk kombinasi ini -- upload dulu di bawah.";

    buatEditorDrag(document.getElementById("drag-wrap-" + jenis), url, fields, layoutAktif, function () {});
    renderRingkasanKombo();
  }

  selLomba.addEventListener("change", muatKombo);
  selGender.addEventListener("change", muatKombo);

  document.getElementById("btn-upload-template-" + jenis).addEventListener("click", async function () {
    const fileInput = document.getElementById("input-template-" + jenis);
    const file = fileInput.files[0];
    if (!file) { alert("Pilih file PNG dulu."); return; }
    if (file.type !== "image/png") { alert("File harus berformat PNG."); return; }
    const lombaId = selLomba.value, gender = selGender.value;
    if (!lombaId) { alert("Pilih cabang lomba dulu."); return; }

    const btn = this;
    btn.disabled = true;
    btn.textContent = "Mengunggah...";

    const kunci = kunciKartu(lombaId, gender);
    const path = "kartu/" + jenis + "-" + kunci.replace(/[^a-z0-9]/gi, "-") + "-" + Date.now() + ".png";
    const { error: upErr } = await supabaseClient.storage.from("aset-situs").upload(path, file, { contentType: "image/png" });
    btn.disabled = false;
    btn.textContent = "Upload/Ganti Template";
    if (upErr) { alert("Gagal mengunggah: " + upErr.message); return; }

    const { data: pub } = supabaseClient.storage.from("aset-situs").getPublicUrl(path);
    templatesSemua[jenis][kunci] = { url: pub.publicUrl, layout: layoutAktif || layoutDefaultBaru(jenis, fields) };
    const { error: updErr } = await simpanKartuTemplates(templatesSemua);
    if (updErr) { alert("Berkas terunggah tapi gagal menyimpan pengaturan: " + updErr.message); return; }
    muatKombo();
  });

  document.getElementById("btn-simpan-posisi-" + jenis).addEventListener("click", async function () {
    const lombaId = selLomba.value, gender = selGender.value;
    if (!lombaId) { alert("Pilih cabang lomba dulu."); return; }
    const kunci = kunciKartu(lombaId, gender);
    if (!templatesSemua[jenis][kunci] || !templatesSemua[jenis][kunci].url) {
      alert("Upload template untuk kombinasi ini dulu sebelum menyimpan posisi.");
      return;
    }
    templatesSemua[jenis][kunci].layout = layoutAktif;
    const { error } = await simpanKartuTemplates(templatesSemua);
    const statusEl = document.getElementById("status-posisi-" + jenis);
    statusEl.textContent = error ? ("Gagal: " + error.message) : "Tersimpan.";
    setTimeout(function () { statusEl.textContent = ""; }, 3000);
  });

  muatKombo();
}

// ======================= PANEL "Kartu Pendamping" (satu template global) =======================
function panelKartuPendampingHTML() {
  return (
    '<div class="form-shell" style="margin-bottom:20px;">' +
      '<h3>Kartu Pendamping / Penanggung Jawab</h3>' +
      '<div class="field">' +
        '<label>Template (PNG)</label>' +
        '<input type="file" id="input-template-pendamping" accept=".png,image/png" />' +
      '</div>' +
      '<button type="button" class="btn btn--ghost" id="btn-upload-template-pendamping" style="margin-bottom:10px;">Upload/Ganti Template</button>' +
      '<div id="drag-wrap-pendamping"></div>' +
      '<p class="hint">Geser langsung kotak (area putus-putus biru) untuk mengatur posisi; pakai tombol <strong>A−/A+</strong> di pojok kanan-atas kotak atau seret bulatan hijau di pojok kanan-bawah untuk mengubah ukuran huruf; seret pegangan biru di tepi kanan untuk mengubah lebar kotaknya. Pratinjau di atas memakai gambar PERSIS SAMA dengan hasil cetak (bukan tiruan HTML) -- posisi yang terlihat di sini presisi sama dengan kartu yang akan dicetak. Begitu nama peserta lebih panjang dari lebar kotak ini, hurufnya otomatis mengecil dulu lalu disingkat kalau masih belum cukup saat kartu dicetak.</p>' +
      '<button type="button" class="btn btn--primary" id="btn-simpan-posisi-pendamping" style="margin-top:6px;">Simpan Posisi &amp; Template</button>' +
      '<span class="hint" id="status-posisi-pendamping" style="margin-left:10px;"></span>' +
    '</div>'
  );
}

function setupKartuPendamping(fields, templatesSemua) {
  if (!templatesSemua.pendamping) templatesSemua.pendamping = { url: null, layout: layoutDefaultBaru("pendamping", fields) };
  const layoutAktif = Object.assign(layoutDefaultBaru("pendamping", fields), templatesSemua.pendamping.layout || {});
  templatesSemua.pendamping.layout = layoutAktif;

  const wrap = document.getElementById("drag-wrap-pendamping");
  buatEditorDrag(wrap, templatesSemua.pendamping.url, fields, layoutAktif, function () {});

  document.getElementById("btn-upload-template-pendamping").addEventListener("click", async function () {
    const fileInput = document.getElementById("input-template-pendamping");
    const file = fileInput.files[0];
    if (!file) { alert("Pilih file PNG dulu."); return; }
    if (file.type !== "image/png") { alert("File harus berformat PNG."); return; }

    const btn = this;
    btn.disabled = true;
    btn.textContent = "Mengunggah...";
    const path = "kartu/pendamping-" + Date.now() + ".png";
    const { error: upErr } = await supabaseClient.storage.from("aset-situs").upload(path, file, { contentType: "image/png" });
    btn.disabled = false;
    btn.textContent = "Upload/Ganti Template";
    if (upErr) { alert("Gagal mengunggah: " + upErr.message); return; }

    const { data: pub } = supabaseClient.storage.from("aset-situs").getPublicUrl(path);
    templatesSemua.pendamping.url = pub.publicUrl;
    const { error: updErr } = await simpanKartuTemplates(templatesSemua);
    if (updErr) { alert("Berkas terunggah tapi gagal menyimpan pengaturan: " + updErr.message); return; }
    buatEditorDrag(wrap, pub.publicUrl, fields, layoutAktif, function () {});
  });

  document.getElementById("btn-simpan-posisi-pendamping").addEventListener("click", async function () {
    if (!templatesSemua.pendamping.url) { alert("Upload template dulu sebelum menyimpan posisi."); return; }
    templatesSemua.pendamping.layout = layoutAktif;
    const { error } = await simpanKartuTemplates(templatesSemua);
    const statusEl = document.getElementById("status-posisi-pendamping");
    statusEl.textContent = error ? ("Gagal: " + error.message) : "Tersimpan.";
    setTimeout(function () { statusEl.textContent = ""; }, 3000);
  });
}

// ======================= PANEL "Sertifikat" (SATU templat generik, BARU) =======================
// Beda dari ketiga jenis Kartu di atas (per Cabang Lomba x Jenis Kelamin,
// atau satu templat global khusus Pendamping) -- Sertifikat SATU-SATUNYA
// templat untuk SEMUA penerima (peserta individu, tiap anggota tim, &
// pendamping yang mengunduh lewat link publik, lihat cetakSertifikatPDF()
// & "Link Sertifikat Pendamping" di popup detail Data Pendaftar) -- cuma
// isi teksnya (Nama/Cabang Lomba/Nomor Pendaftaran) yang beda per orang.
// Memakai editor drag-and-drop YANG SAMA (buatEditorDrag()) dengan Kartu,
// cuma dioper opsi kanvas A4 landscape lewat parameter "opsi" di akhir.
function panelSertifikatHTML() {
  return (
    '<div class="form-shell" style="margin-bottom:20px;">' +
      '<h3>🎓 Sertifikat (templat generik, untuk semua penerima)</h3>' +
      '<p>Satu desain sertifikat ini dipakai untuk SEMUA penerima -- peserta individu, tiap anggota tim, dan pendamping -- cuma teks Nama/Cabang Lomba/Nomor Pendaftaran yang berbeda-beda per orang. Idealnya berukuran/rasio A4 LANDSCAPE (' + SERTIFIKAT_LEBAR_CM + ' × ' + SERTIFIKAT_TINGGI_CM + ' cm).</p>' +
      '<div class="field">' +
        '<label>Template (PNG)</label>' +
        '<input type="file" id="input-template-sertifikat" accept=".png,image/png" />' +
      '</div>' +
      '<button type="button" class="btn btn--ghost" id="btn-upload-template-sertifikat" style="margin-bottom:10px;">Upload/Ganti Template</button>' +
      '<div id="drag-wrap-sertifikat"></div>' +
      '<p class="hint">Geser langsung kotak (area putus-putus biru) untuk mengatur posisi; pakai tombol <strong>A−/A+</strong> di pojok kanan-atas kotak atau seret bulatan hijau di pojok kanan-bawah untuk mengubah ukuran huruf; seret pegangan biru di tepi kanan untuk mengubah lebar kotaknya. Pratinjau di atas memakai gambar PERSIS SAMA dengan hasil cetak -- posisi yang terlihat di sini presisi sama dengan sertifikat yang akan dicetak/diunduh.</p>' +
      '<button type="button" class="btn btn--primary" id="btn-simpan-posisi-sertifikat" style="margin-top:6px;">Simpan Posisi &amp; Template</button>' +
      '<span class="hint" id="status-posisi-sertifikat" style="margin-left:10px;"></span>' +
    '</div>'
  );
}

function setupSertifikat(fields, templatesSemua) {
  if (!templatesSemua.sertifikat) templatesSemua.sertifikat = { url: null, layout: layoutDefaultBaru("sertifikat", fields) };
  const layoutAktif = Object.assign(layoutDefaultBaru("sertifikat", fields), templatesSemua.sertifikat.layout || {});
  templatesSemua.sertifikat.layout = layoutAktif;

  const opsiKanvas = { lebarPx: SERTIFIKAT_LEBAR_PX, tinggiPx: SERTIFIKAT_TINGGI_PX, displayLebar: SERTIFIKAT_DISPLAY_LEBAR };

  const wrap = document.getElementById("drag-wrap-sertifikat");
  buatEditorDrag(wrap, templatesSemua.sertifikat.url, fields, layoutAktif, function () {}, opsiKanvas);

  document.getElementById("btn-upload-template-sertifikat").addEventListener("click", async function () {
    const fileInput = document.getElementById("input-template-sertifikat");
    const file = fileInput.files[0];
    if (!file) { alert("Pilih file PNG dulu."); return; }
    if (file.type !== "image/png") { alert("File harus berformat PNG."); return; }

    const btn = this;
    btn.disabled = true;
    btn.textContent = "Mengunggah...";
    const path = "kartu/sertifikat-" + Date.now() + ".png";
    const { error: upErr } = await supabaseClient.storage.from("aset-situs").upload(path, file, { contentType: "image/png" });
    btn.disabled = false;
    btn.textContent = "Upload/Ganti Template";
    if (upErr) { alert("Gagal mengunggah: " + upErr.message); return; }

    const { data: pub } = supabaseClient.storage.from("aset-situs").getPublicUrl(path);
    templatesSemua.sertifikat.url = pub.publicUrl;
    const { error: updErr } = await simpanKartuTemplates(templatesSemua);
    if (updErr) { alert("Berkas terunggah tapi gagal menyimpan pengaturan: " + updErr.message); return; }
    buatEditorDrag(wrap, pub.publicUrl, fields, layoutAktif, function () {}, opsiKanvas);
  });

  document.getElementById("btn-simpan-posisi-sertifikat").addEventListener("click", async function () {
    if (!templatesSemua.sertifikat.url) { alert("Upload template dulu sebelum menyimpan posisi."); return; }
    templatesSemua.sertifikat.layout = layoutAktif;
    const { error } = await simpanKartuTemplates(templatesSemua);
    const statusEl = document.getElementById("status-posisi-sertifikat");
    statusEl.textContent = error ? ("Gagal: " + error.message) : "Tersimpan.";
    setTimeout(function () { statusEl.textContent = ""; }, 3000);
  });
}

async function cetakKartuPDF(jenis) {
  const statusEl = document.getElementById("cetak-status");
  const lombaFilter = document.getElementById("cetak-filter-lomba").value;

  const templatesSemua = await ambilKartuTemplates();
  const fields = jenis === "pendamping" ? FIELD_PENDAMPING : (jenis === "pesertaTim" ? FIELD_PESERTA_TIM : FIELD_PESERTA);

  // Hanya pendaftar berstatus "Diterima" (sudah TERVERIFIKASI panitia) yang
  // ikut dicetak -- permintaan panitia, supaya kartu tidak sampai tercetak
  // untuk pendaftar yang masih "Menunggu Verifikasi"/"Perlu Verifikasi
  // Usia"/"Perlu Tambah Nomor Punggung", apalagi yang sudah "Ditolak".
  let query = supabaseClient.from("pendaftaran").select("*").eq("status", "Diterima");
  if (lombaFilter) query = query.eq("lomba_id", lombaFilter);
  // "peserta" (individu) & "pesertaTim" (Futsal/tim) saling eksklusif lewat
  // kolom `tipe` -- permintaan panitia: kartu peserta individu biasa TIDAK
  // lagi mengikutkan pendaftar tim sama sekali, karena tim punya jenis
  // kartunya sendiri (satu kartu per ANGGOTA, lihat di bawah).
  if (jenis === "peserta") query = query.neq("tipe", "tim");
  if (jenis === "pesertaTim") query = query.eq("tipe", "tim");
  const { data: rows, error } = await query;
  if (error) { alert("Gagal memuat data: " + error.message); return; }
  if (!rows || rows.length === 0) { alert("Tidak ada data pendaftar berstatus \"Diterima\" yang cocok dengan filter ini."); return; }

  // Tiap item daftarData membawa `_kunci` -- untuk "peserta"/"pesertaTim"
  // berarti "<lomba_id>|<jenis_kelamin>", dipakai untuk memilih
  // template+layout yang cocok per kartu (bisa beda-beda per lomba &
  // gender, lihat komentar di bagian atas file ini); untuk "pendamping"
  // selalu "pendamping" (satu template global).
  let daftarData;
  if (jenis === "peserta") {
    daftarData = rows.map(function (r) {
      return { nama: r.nama_lengkap, nomor_pendaftaran: r.nomor_pendaftaran, _kunci: kunciKartu(r.lomba_id, r.jenis_kelamin) };
    });
  } else if (jenis === "pesertaTim") {
    // SATU KARTU PER ANGGOTA tim (bukan satu kartu per baris pendaftaran
    // tim) -- permintaan panitia. Anggota diambil lewat satu query per tim
    // yang cocok filter di atas (jumlah tim biasanya tidak banyak, jadi
    // aman dilakukan berurutan, tidak perlu Promise.all).
    daftarData = [];
    for (const r of rows) {
      const { data: anggota, error: errAnggota } = await supabaseClient
        .from("anggota_tim").select("nama,nomor_punggung").eq("nomor_pendaftaran", r.nomor_pendaftaran).order("created_at");
      if (errAnggota) { alert("Gagal memuat anggota tim \"" + r.nama_tim + "\": " + errAnggota.message); return; }
      const kunci = kunciKartu(r.lomba_id, r.jenis_kelamin);
      (anggota || []).forEach(function (a) {
        // Nomor Pendaftaran di kartu ANGGOTA tim = nomor pendaftaran TIM-nya
        // digabung nomor punggung ANGGOTA itu sendiri, dipisah "/" --
        // permintaan panitia, supaya satu nomor di kartu cukup untuk
        // mengenali baik timnya (nomor pendaftaran) maupun pemainnya sendiri
        // (nomor punggung) tanpa dua kartu/field terpisah. "-" kalau nomor
        // punggung anggota itu belum diisi.
        const punggung = (a.nomor_punggung != null && a.nomor_punggung !== "") ? a.nomor_punggung : "-";
        daftarData.push({
          nama_tim: r.nama_tim,
          nama_anggota: a.nama,
          nomor_pendaftaran: r.nomor_pendaftaran + "/" + punggung,
          _kunci: kunci
        });
      });
    }
    if (daftarData.length === 0) {
      alert("Tidak ada data anggota tim yang cocok.");
      return;
    }
  } else {
    const sudahAda = {};
    daftarData = [];
    rows.forEach(function (r) {
      const namaPj = r.pembina || r.penanggung_jawab_lembaga;
      if (!namaPj) return;
      const kunciDedup = namaPj.trim().toLowerCase() + "|" + (r.asal_sekolah || "").trim().toLowerCase();
      if (sudahAda[kunciDedup]) return;
      sudahAda[kunciDedup] = true;
      daftarData.push({ nama: namaPj, lomba: r.lomba_nama + " · " + r.asal_sekolah, _kunci: "pendamping" });
    });
    if (daftarData.length === 0) {
      alert("Tidak ada data penanggung jawab/pendamping pada data yang cocok (Futsal punya guru pendamping, pendaftaran Perwakilan Lembaga punya penanggung jawab).");
      return;
    }
  }

  // Pastikan SEMUA kombinasi lomba+gender yang muncul di data sudah punya
  // template -- kalau ada yang belum, batalkan cetak & sebutkan persis
  // kombinasi mana yang kurang, supaya tidak ada kartu yang diam-diam
  // kelewat dari hasil cetak PDF-nya.
  const kunciDibutuhkan = Array.from(new Set(daftarData.map(function (d) { return d._kunci; })));
  const kurang = kunciDibutuhkan.filter(function (k) {
    const entri = jenis === "pendamping" ? templatesSemua.pendamping : (templatesSemua[jenis] && templatesSemua[jenis][k]);
    return !entri || !entri.url;
  });
  if (kurang.length > 0) {
    alert("Belum ada template untuk kombinasi berikut -- upload dulu di atas sebelum mencetak:\n\n" + kurang.join("\n"));
    return;
  }

  statusEl.textContent = "Menyiapkan " + daftarData.length + " kartu, mohon tunggu...";

  // Muat gambar tiap template SEKALI saja (banyak kartu bisa berbagi
  // kombinasi lomba+gender yang sama), simpan ke cache per kunci.
  const cacheTemplate = {};
  async function ambilTemplate(kunci) {
    if (cacheTemplate[kunci]) return cacheTemplate[kunci];
    const entri = jenis === "pendamping" ? templatesSemua.pendamping : templatesSemua[jenis][kunci];
    const img = await muatGambar(entri.url);
    cacheTemplate[kunci] = { img: img, layout: entri.layout || DEFAULT_LAYOUT_KARTU[jenis] };
    return cacheTemplate[kunci];
  }

  const canvas = document.createElement("canvas");
  const { jsPDF } = window.jspdf;
  // Satuan "cm" dipakai langsung (bukan "px") supaya ukuran fisik tiap
  // kartu di PDF-nya SELALU presisi 8,5 x 11,5 cm (portrait) begitu
  // dicetak, tidak tergantung resolusi/DPI gambar kanvas yang dihasilkan.
  //
  // 4 kartu dicetak sekaligus per lembar A4 PORTRAIT (grid 2 kolom x 2
  // baris), bukan satu kartu per halaman -- lebih hemat kertas/biaya cetak
  // untuk jumlah peserta yang banyak. Sisa ruang di luar keempat kartu (A4
  // portrait 21 x 29,7 cm dikurangi 2x lebar & 2x tinggi kartu, dikurangi
  // lagi jarak antar-kartu KARTU_GAP_CM) dibagi rata jadi margin SIMETRIS
  // di semua sisi -- garis putus-putus abu-abu (panduan gunting/pemotong)
  // digambar PAS DI TENGAH jarak antar-kartu ini, BUKAN menempel di tepi
  // kartu seperti sebelumnya (permintaan panitia: sebelumnya kartu saling
  // bersisian tanpa jarak sama sekali, jadi garis panduannya "masuk" ke
  // kartu/menimpa isinya begitu digunting agak melenceng sedikit saja) --
  // dengan jarak tipis ini, meleset sedikit saat menggunting masih aman
  // tidak memotong isi kartu.
  const KARTU_GAP_CM = 0.2;
  const A4_LEBAR_CM = 21;
  const A4_TINGGI_CM = 29.7;
  const marginX = (A4_LEBAR_CM - (2 * KARTU_LEBAR_CM + KARTU_GAP_CM)) / 2;
  const marginY = (A4_TINGGI_CM - (2 * KARTU_TINGGI_CM + KARTU_GAP_CM)) / 2;

  const doc = new jsPDF({ unit: "cm", format: "a4", orientation: "portrait" });
  const totalHalaman = Math.ceil(daftarData.length / 4);

  for (let h = 0; h < totalHalaman; h++) {
    if (h > 0) doc.addPage("a4", "portrait");

    for (let slot = 0; slot < 4; slot++) {
      const idx = h * 4 + slot;
      if (idx >= daftarData.length) break;
      const data = daftarData[idx];
      let tpl;
      try {
        tpl = await ambilTemplate(data._kunci);
      } catch (e) {
        statusEl.textContent = "";
        alert("Gagal memuat gambar template untuk \"" + data._kunci + "\".");
        return;
      }
      gambarKartu(canvas, tpl.img, tpl.layout, data, fields);
      const imgData = canvas.toDataURL("image/png");
      const col = slot % 2, row = Math.floor(slot / 2);
      const x = marginX + col * (KARTU_LEBAR_CM + KARTU_GAP_CM);
      const y = marginY + row * (KARTU_TINGGI_CM + KARTU_GAP_CM);
      doc.addImage(imgData, "PNG", x, y, KARTU_LEBAR_CM, KARTU_TINGGI_CM);
    }

    // Garis panduan potong (putus-putus, abu-abu) PAS DI TENGAH jarak
    // antar-kartu (lihat KARTU_GAP_CM di atas) -- murni bantuan visual
    // untuk menggunting, tidak ikut ke hasil cetak kalau dirasa tidak
    // perlu (bisa diabaikan/dihapus manual saat memotong).
    const tengahGapX = marginX + KARTU_LEBAR_CM + KARTU_GAP_CM / 2;
    const tengahGapY = marginY + KARTU_TINGGI_CM + KARTU_GAP_CM / 2;
    doc.setDrawColor(190);
    // Hairline (0,01 cm = 0,1 mm) -- sebelumnya memakai lebar garis BAWAAN
    // jsPDF yang relatif tebal untuk sekadar garis panduan gunting, jadi
    // terlihat kasar/kurang rapi di atas kartu. Pola putus-putusnya juga
    // dirapatkan sedikit (0,1 cm/0,1 cm, dari 0,15/0,15) supaya sebanding
    // dengan garis yang sekarang jauh lebih tipis.
    doc.setLineWidth(0.01);
    doc.setLineDashPattern([0.1, 0.1], 0);
    doc.line(tengahGapX, marginY - 0.3, tengahGapX, marginY + 2 * KARTU_TINGGI_CM + KARTU_GAP_CM + 0.3);
    doc.line(marginX - 0.3, tengahGapY, marginX + 2 * KARTU_LEBAR_CM + KARTU_GAP_CM + 0.3, tengahGapY);
    doc.setLineDashPattern([], 0);
    doc.setLineWidth(0.2); // kembalikan ke bawaan jsPDF, jaga-jaga kalau ada gambar lain setelah ini di versi mendatang
  }

  doc.save("kartu-" + jenis + "-alif5.pdf");
  statusEl.textContent = "Selesai — " + daftarData.length + " kartu (" + totalHalaman + " lembar A4) terunduh.";
}

// ======================= CETAK SERTIFIKAT (PDF, BARU) =======================
// Mencetak SATU sertifikat PER HALAMAN A4 landscape (beda dari Kartu yang
// 4-per-halaman) untuk peserta INDIVIDU dan tiap ANGGOTA tim (status
// "Diterima" saja, sama seperti Kartu) -- TIDAK mengikutkan Pendamping di
// sini (pendamping mengunduh sertifikatnya SENDIRI lewat link token publik,
// lihat "Link Sertifikat Pendamping" di popup detail Data Pendaftar &
// migrasi 0055 -- bukan dicetak massal panitia). Memakai SATU templat
// generik (templatesSemua.sertifikat), bukan per lomba+gender seperti Kartu.
async function cetakSertifikatPDF() {
  const statusEl = document.getElementById("cetak-status");
  const lombaFilter = document.getElementById("cetak-filter-lomba").value;

  const templatesSemua = await ambilKartuTemplates();
  if (!templatesSemua.sertifikat || !templatesSemua.sertifikat.url) {
    alert('Upload template Sertifikat dulu di panel "🎓 Sertifikat" di atas sebelum mencetak.');
    return;
  }

  let query = supabaseClient.from("pendaftaran").select("*").eq("status", "Diterima");
  if (lombaFilter) query = query.eq("lomba_id", lombaFilter);
  const { data: rows, error } = await query;
  if (error) { alert("Gagal memuat data: " + error.message); return; }
  if (!rows || rows.length === 0) { alert("Tidak ada data pendaftar berstatus \"Diterima\" yang cocok dengan filter ini."); return; }

  // SATU sertifikat per peserta individu, DAN satu sertifikat per ANGGOTA
  // tim (bukan satu per tim) -- pola yang sama dengan Kartu Peserta
  // Futsal/Tim (cetakKartuPDF, jenis "pesertaTim").
  const daftarData = [];
  rows.filter(function (r) { return r.tipe !== "tim"; }).forEach(function (r) {
    daftarData.push({ nama: r.nama_lengkap, lomba_sertifikat: r.lomba_nama, nomor_pendaftaran: r.nomor_pendaftaran });
  });
  for (const r of rows.filter(function (r) { return r.tipe === "tim"; })) {
    const { data: anggota, error: errAnggota } = await supabaseClient
      .from("anggota_tim").select("nama").eq("nomor_pendaftaran", r.nomor_pendaftaran).order("created_at");
    if (errAnggota) { alert("Gagal memuat anggota tim \"" + r.nama_tim + "\": " + errAnggota.message); return; }
    (anggota || []).forEach(function (a) {
      daftarData.push({ nama: a.nama, lomba_sertifikat: r.lomba_nama, nomor_pendaftaran: r.nomor_pendaftaran });
    });
  }

  if (daftarData.length === 0) {
    alert("Tidak ada data peserta yang cocok untuk dicetak sertifikatnya.");
    return;
  }

  statusEl.textContent = "Menyiapkan " + daftarData.length + " sertifikat, mohon tunggu...";

  let templateImg;
  try {
    templateImg = await muatGambar(templatesSemua.sertifikat.url);
  } catch (e) {
    statusEl.textContent = "";
    alert("Gagal memuat gambar template Sertifikat.");
    return;
  }
  const layout = templatesSemua.sertifikat.layout || DEFAULT_LAYOUT_KARTU.sertifikat;

  const canvas = document.createElement("canvas");
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "cm", format: "a4", orientation: "landscape" });

  daftarData.forEach(function (data, i) {
    if (i > 0) doc.addPage("a4", "landscape");
    gambarKartu(canvas, templateImg, layout, data, FIELD_SERTIFIKAT, SERTIFIKAT_LEBAR_PX, SERTIFIKAT_TINGGI_PX);
    const imgData = canvas.toDataURL("image/png");
    doc.addImage(imgData, "PNG", 0, 0, SERTIFIKAT_LEBAR_CM, SERTIFIKAT_TINGGI_CM);
  });

  doc.save("sertifikat-peserta-alif5.pdf");
  statusEl.textContent = "Selesai — " + daftarData.length + " sertifikat (" + daftarData.length + " lembar A4) terunduh.";
}

async function loadTabKartu() {
  const content = document.getElementById("admin-content");
  content.innerHTML = '<p class="hint">Memuat...</p>';

  try {
    await pastikanLibKartu();
  } catch (e) {
    content.innerHTML = "<p>Gagal memuat pustaka PDF — periksa koneksi internet, lalu buka tab ini lagi.</p>";
    return;
  }

  const templatesSemua = await ambilKartuTemplates();
  if (!templatesSemua.peserta) templatesSemua.peserta = {};
  if (!templatesSemua.pesertaTim) templatesSemua.pesertaTim = {};
  if (!templatesSemua.pendamping) templatesSemua.pendamping = { url: null, layout: {} };
  if (!templatesSemua.sertifikat) templatesSemua.sertifikat = { url: null, layout: {} };

  const { data: rulesData } = await supabaseClient.from("lomba_rules").select("id,nama,tipe").order("urutan");
  const semuaLomba = rulesData || [];
  const lombaIndividu = semuaLomba.filter(function (r) { return r.tipe !== "tim"; });
  const lombaTim = semuaLomba.filter(function (r) { return r.tipe === "tim"; });
  const opsiLombaCetak = semuaLomba.map(function (r) {
    return '<option value="' + r.id + '">' + r.nama + '</option>';
  }).join("");

  content.innerHTML =
    '<div class="form-shell" style="margin-bottom:20px;">' +
      '<h3>🪪 Kartu Peserta &amp; Pendamping</h3>' +
      '<p>Tiap <strong>Cabang Lomba &times; Jenis Kelamin</strong> bisa punya desain kartu (template PNG) sendiri-sendiri. Pilih kombinasinya di bawah, upload templatenya, lalu atur posisi Nama/Nomor Pendaftaran dengan MENGGESER LANGSUNG tulisan contohnya di atas pratinjau (gaya drag-and-drop seperti Canva) — tidak perlu input angka X/Y manual lagi. Seret bulatan kecil di pojok kanan-bawah tiap tulisan untuk mengubah ukuran hurufnya. Ukuran cetaknya SELALU tetap ' + KARTU_LEBAR_CM + ' × ' + KARTU_TINGGI_CM + ' cm (portrait) — template otomatis disesuaikan supaya pas mengisi penuh.</p>' +
    '</div>' +
    panelKartuPerLombaHTML("peserta", "Kartu Peserta (individu)") +
    panelKartuPerLombaHTML("pesertaTim", "Kartu Peserta Futsal/Tim") +
    panelKartuPendampingHTML() +
    panelSertifikatHTML() +
    '<div class="form-shell" style="margin-top:20px;max-width:560px;">' +
      '<h3>Cetak Kartu &amp; Sertifikat</h3>' +
      '<div class="field"><label>Cabang Lomba</label><select id="cetak-filter-lomba"><option value="">Semua Lomba</option>' + opsiLombaCetak + '</select></div>' +
      '<div style="display:flex;gap:10px;flex-wrap:wrap;">' +
        '<button type="button" class="btn btn--primary" id="btn-cetak-peserta">Unduh Kartu Peserta (PDF)</button>' +
        '<button type="button" class="btn btn--primary" id="btn-cetak-peserta-tim">Unduh Kartu Peserta Futsal/Tim (PDF)</button>' +
        '<button type="button" class="btn btn--ghost" id="btn-cetak-pendamping">Unduh Kartu Pendamping (PDF)</button>' +
      '</div>' +
      '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:10px;">' +
        '<button type="button" class="btn btn--primary" id="btn-cetak-sertifikat">🎓 Unduh Sertifikat Peserta (PDF)</button>' +
      '</div>' +
      '<p class="hint">"Kartu Peserta" di atas HANYA mengikutkan pendaftar individu; "Kartu Peserta Futsal/Tim" mencetak SATU KARTU PER ANGGOTA tim (bukan satu per tim). Filter "Cabang Lomba" berlaku untuk semua tombol. Kalau ada kombinasi lomba+jenis kelamin yang templatenya belum diunggah, proses cetak dibatalkan dan akan diberi tahu kombinasi mana yang kurang. <strong>"Unduh Sertifikat Peserta"</strong> mencetak SATU sertifikat per peserta individu dan SATU per anggota tim (status "Diterima" saja) jadi satu PDF (satu sertifikat per halaman A4 landscape) -- sertifikat untuk PENDAMPING TIDAK ikut tercetak di sini, melainkan diunduh sendiri lewat link token yang dibuat dari popup detail pendaftar (tab "Data Pendaftar") -- lihat bagian 12 README.</p>' +
      '<p class="hint" id="cetak-status"></p>' +
    '</div>';

  await setupKartuPerLomba("peserta", FIELD_PESERTA, lombaIndividu, templatesSemua);
  await setupKartuPerLomba("pesertaTim", FIELD_PESERTA_TIM, lombaTim, templatesSemua);
  setupKartuPendamping(FIELD_PENDAMPING, templatesSemua);
  setupSertifikat(FIELD_SERTIFIKAT, templatesSemua);

  document.getElementById("btn-cetak-peserta").addEventListener("click", function () { cetakKartuPDF("peserta"); });
  document.getElementById("btn-cetak-peserta-tim").addEventListener("click", function () { cetakKartuPDF("pesertaTim"); });
  document.getElementById("btn-cetak-pendamping").addEventListener("click", function () { cetakKartuPDF("pendamping"); });
  document.getElementById("btn-cetak-sertifikat").addEventListener("click", function () { cetakSertifikatPDF(); });
}

/* ==================== TAB 6: NOTIFIKASI WA (FONNTE) ==================== */

function escapeHTML(teks) {
  const div = document.createElement("div");
  div.textContent = teks == null ? "" : teks;
  return div.innerHTML;
}

// Keempat status yang memicu pengiriman WA -- sejak migrasi 0036, MASING-
// MASING punya pesan sendiri yang bisa diedit panitia sendiri (sebelumnya
// cuma satu pesan global untuk semuanya). Urutan di sini menentukan urutan
// tampil kotak teksnya di tab "Notifikasi WA".
const STATUS_WA_LIST = ["Diterima", "Ditolak", "Perlu Verifikasi Usia", "Perlu Tambah Nomor Punggung"];

// Placeholder yang bisa dipakai di tiap pesan status. Sejak migrasi 0028,
// link grup WA SUDAH TIDAK dibedakan per lomba lagi -- SATU link berlaku
// untuk SEMUA lomba (fitur "Pesan per Lomba" dari migrasi 0019 dihapus,
// karena semua pendaftar memang diarahkan ke grup WA yang sama). {grup}
// diganti link grup WA dari kotak "Link Grup WA" di bawah, TAPI HANYA kalau
// status pendaftaran itu "Diterima" (untuk status lain selalu kosong,
// dicek otomatis di Edge Function). {anggota_usia} -- khusus lomba tim
// (Futsal), diganti dengan nama-nama anggota yang usianya di luar syarat
// jenjang (dipisah koma); kosong untuk pendaftar individu atau kalau semua
// anggota tim usianya sesuai syarat. {alasan} -- sejak migrasi 0036, diganti
// alasan penolakan yang dipilih panitia lewat dropdown wajib, TAPI HANYA
// kalau statusnya "Ditolak" (kosong untuk status lain).
const WA_PLACEHOLDER_HINT =
  'Placeholder yang bisa dipakai (otomatis diganti saat dikirim): <code>{nama}</code>, <code>{nomor}</code>, <code>{lomba}</code>, <code>{status}</code>, <code>{grup}</code> (link grup WA di bawah — cuma terisi kalau statusnya "Diterima", kosong untuk status lain; khusus pendaftar Lomba Futsal otomatis dialihkan ke "Link Grup WA (khusus Futsal)" di bawah kalau sudah diisi), <code>{anggota_usia}</code> (khusus lomba tim: nama anggota yang perlu verifikasi usia, dipisah koma — kosong untuk pendaftar individu), <code>{link_lengkapi}</code> (link khusus buat pendamping tim melengkapi nomor punggung — cuma terisi kalau statusnya "Perlu Tambah Nomor Punggung", kosong untuk status lain, butuh "URL Situs" di bawah sudah diisi), <code>{alasan}</code> (alasan penolakan yang dipilih panitia — cuma terisi kalau statusnya "Ditolak", kosong untuk status lain).';

async function loadTabNotifWa() {
  const content = document.getElementById("admin-content");
  content.innerHTML = '<p class="hint">Memuat pengaturan notifikasi WA...</p>';

  const { data: settingsData } = await supabaseClient
    .from("site_settings")
    .select("wa_notif_template, wa_template_per_status, link_grup_wa, link_grup_wa_futsal, site_url, alasan_penolakan_list")
    .eq("id", 1).single();

  const templateLama = (settingsData && settingsData.wa_notif_template) || "";
  const templatePerStatus = (settingsData && settingsData.wa_template_per_status) || {};
  const linkGrupDefault = (settingsData && settingsData.link_grup_wa) || "";
  const linkGrupFutsalDefault = (settingsData && settingsData.link_grup_wa_futsal) || "";
  const siteUrlDefault = (settingsData && settingsData.site_url) || "";
  const alasanList = Array.isArray(settingsData && settingsData.alasan_penolakan_list)
    ? settingsData.alasan_penolakan_list
    : [];

  // Tiap status dapat kotak teksnya sendiri -- diisi dari templatePerStatus
  // kalau sudah pernah disimpan panitia, kalau belum jatuh ke templateLama
  // (pesan global dari sebelum migrasi 0036) supaya tidak kosong begitu
  // tab ini pertama kali dibuka setelah migrasi.
  const kotakStatusHTML = STATUS_WA_LIST.map(function (status, i) {
    const isi = (templatePerStatus && templatePerStatus[status]) || templateLama;
    const inputId = "wa-template-status-" + i;
    return (
      '<div class="field" style="margin-top:' + (i === 0 ? "0" : "22") + 'px;">' +
        '<label for="' + inputId + '">Pesan untuk status "' + status + '"</label>' +
        '<textarea id="' + inputId + '" data-status="' + escapeHTML(status) + '" rows="7">' + escapeHTML(isi) + '</textarea>' +
      '</div>'
    );
  }).join("");

  content.innerHTML =
    '<div class="form-shell" style="max-width:640px;">' +
      '<h3>💬 Notifikasi WhatsApp (tombol "Kirim WA")</h3>' +
      '<p>Pesan DISUSUN otomatis begitu status pendaftaran dipilih jadi <strong>Diterima</strong>, <strong>Ditolak</strong>, <strong>Perlu Verifikasi Usia</strong>, atau <strong>Perlu Tambah Nomor Punggung</strong> di dropdown tab "Data Pendaftar" — berlaku untuk <strong>semua lomba</strong>, individu maupun tim. Tapi pesannya TIDAK terkirim sendiri: muncul tombol <strong>"📲 Kirim WA"</strong> yang, kalau diklik, membuka WhatsApp (app/web) dengan nomor & pesan yang sudah terisi lewat link <code>wa.me</code> — panitia sendiri yang menekan kirim di sana. Pesan tiap status bisa diedit terpisah di bawah.</p>' +
      kotakStatusHTML +
      '<div class="hint" style="margin-top:14px;">' + WA_PLACEHOLDER_HINT + '</div>' +
      '<div class="field" style="margin-top:22px;">' +
        '<label for="wa-link-grup">Link Grup WA</label>' +
        '<input type="text" id="wa-link-grup" value="' + escapeHTML(linkGrupDefault) + '" placeholder="https://chat.whatsapp.com/..." />' +
        '<div class="hint">Dikirim lewat placeholder <code>{grup}</code> di atas, tapi HANYA untuk pendaftar yang statusnya diubah jadi "Diterima" — pendaftar yang Ditolak (atau status lain) tidak pernah menerima link ini. Berlaku untuk semua lomba individu, serta pendaftar Futsal kalau kotak khusus Futsal di bawah masih dikosongkan.</div>' +
      '</div>' +
      '<div class="field">' +
        '<label for="wa-link-grup-futsal">Link Grup WA (khusus Futsal) ⚽</label>' +
        '<input type="text" id="wa-link-grup-futsal" value="' + escapeHTML(linkGrupFutsalDefault) + '" placeholder="https://chat.whatsapp.com/... (opsional)" />' +
        '<div class="hint">Grup WA TERPISAH khusus untuk pendamping/tim yang mendaftar <strong>Lomba Futsal</strong> (koordinasi tim biasanya beda dari peserta perorangan) — kalau diisi, pendaftar Futsal yang diterima akan menerima link INI (bukan "Link Grup WA" umum di atas) lewat placeholder <code>{grup}</code>. Kosongkan kalau pendaftar Futsal cukup digabung ke grup WA umum seperti lomba lain.</div>' +
      '</div>' +
      '<div class="field">' +
        '<label for="wa-site-url">URL Situs</label>' +
        '<input type="text" id="wa-site-url" value="' + escapeHTML(siteUrlDefault) + '" placeholder="https://alif5.vercel.app" />' +
        '<div class="hint">Alamat website ini sendiri (TANPA garis miring/slash di akhir). Dipakai untuk merangkai link lengkap pada placeholder <code>{link_lengkapi}</code> di atas, misalnya <code>https://alif5.vercel.app/lengkapi?token=...</code>.</div>' +
      '</div>' +
      '<div class="form-error" id="wa-template-error" style="display:none;"></div>' +
      '<div class="submit-row" style="display:flex;gap:10px;">' +
        '<button type="button" class="btn btn--primary" id="btn-simpan-wa-template">Simpan</button>' +
      '</div>' +
      '<p class="hint" id="wa-template-status" style="margin-top:10px;"></p>' +
    '</div>' +
    '<div class="form-shell" style="max-width:640px;margin-top:20px;">' +
      '<h3>🚫 Alasan Penolakan</h3>' +
      '<p>Daftar pilihan yang muncul di dropdown wajib saat panitia mengubah status pendaftaran jadi <strong>Ditolak</strong> (tab "Data Pendaftar") — satu per baris. Selain pilihan di bawah, panitia juga selalu bisa memilih "Lainnya (tulis sendiri)" untuk kasus yang tidak ada di daftar.</p>' +
      '<div class="field">' +
        '<label for="alasan-penolakan-list-text">Daftar Alasan <span style="font-weight:400;">(satu per baris)</span></label>' +
        '<textarea id="alasan-penolakan-list-text" rows="6">' + escapeHTML(alasanList.join("\n")) + '</textarea>' +
      '</div>' +
      '<div class="form-error" id="alasan-penolakan-list-error" style="display:none;"></div>' +
      '<div class="submit-row" style="display:flex;gap:10px;">' +
        '<button type="button" class="btn btn--primary" id="btn-simpan-alasan-penolakan-list">Simpan Daftar Alasan</button>' +
      '</div>' +
      '<p class="hint" id="alasan-penolakan-list-status" style="margin-top:10px;"></p>' +
    '</div>' +
    '<div class="form-shell" style="max-width:640px;margin-top:20px;">' +
      '<h3>⚙️ Tentang Fonnte</h3>' +
      '<p class="hint">Sejak pembaruan ini, notifikasi WA TIDAK LAGI butuh layanan Fonnte untuk pemakaian normal — tombol "Kirim WA" di atas memakai link <code>wa.me</code> langsung dari browser panitia, tanpa API berbayar apa pun. Edge Function <code>kirim-notifikasi-wa</code> & secret <code>FONNTE_TOKEN</code> sengaja dibiarkan ada (tidak dihapus) kalau suatu saat ingin diaktifkan lagi, tapi tidak dipanggil dari halaman ini. Lihat README.md bagian "Setup Notifikasi WhatsApp" untuk detail arsitektur barunya.</p>' +
    '</div>';

  document.getElementById("btn-simpan-wa-template").addEventListener("click", async function () {
    const btn = this;
    const errEl = document.getElementById("wa-template-error");
    const statusEl = document.getElementById("wa-template-status");
    errEl.style.display = "none";

    const templateBaruPerStatus = {};
    let adaKosong = false;
    STATUS_WA_LIST.forEach(function (status, i) {
      const teks = document.getElementById("wa-template-status-" + i).value;
      if (!teks.trim()) adaKosong = true;
      templateBaruPerStatus[status] = teks;
    });
    if (adaKosong) {
      errEl.textContent = "Pesan untuk setiap status tidak boleh kosong.";
      errEl.style.display = "block";
      return;
    }

    const linkGrup = document.getElementById("wa-link-grup").value.trim();
    const linkGrupFutsal = document.getElementById("wa-link-grup-futsal").value.trim();
    const siteUrl = document.getElementById("wa-site-url").value.trim().replace(/\/+$/, "");

    btn.disabled = true;
    btn.textContent = "Menyimpan...";
    const { error } = await supabaseClient
      .from("site_settings")
      .update({ wa_template_per_status: templateBaruPerStatus, link_grup_wa: linkGrup || null, link_grup_wa_futsal: linkGrupFutsal || null, site_url: siteUrl || null })
      .eq("id", 1);
    btn.disabled = false;
    btn.textContent = "Simpan";

    if (error) {
      errEl.textContent = "Gagal menyimpan: " + error.message;
      errEl.style.display = "block";
      return;
    }
    _cacheSiteSettingsWALomba = null; // supaya link "Kirim WA" berikutnya langsung pakai template baru, tanpa perlu reload halaman
    statusEl.textContent = "Tersimpan.";
    setTimeout(function () { statusEl.textContent = ""; }, 3000);
  });

  document.getElementById("btn-simpan-alasan-penolakan-list").addEventListener("click", async function () {
    const btn = this;
    const errEl = document.getElementById("alasan-penolakan-list-error");
    const statusEl = document.getElementById("alasan-penolakan-list-status");
    errEl.style.display = "none";

    const daftarBaru = document.getElementById("alasan-penolakan-list-text").value
      .split("\n")
      .map(function (s) { return s.trim(); })
      .filter(Boolean);
    if (daftarBaru.length === 0) {
      errEl.textContent = "Isi minimal satu alasan penolakan.";
      errEl.style.display = "block";
      return;
    }

    btn.disabled = true;
    btn.textContent = "Menyimpan...";
    const { error } = await supabaseClient
      .from("site_settings")
      .update({ alasan_penolakan_list: daftarBaru })
      .eq("id", 1);
    btn.disabled = false;
    btn.textContent = "Simpan Daftar Alasan";

    if (error) {
      errEl.textContent = "Gagal menyimpan: " + error.message;
      errEl.style.display = "block";
      return;
    }
    statusEl.textContent = "Tersimpan.";
    setTimeout(function () { statusEl.textContent = ""; }, 3000);
  });
}

window.ViewAdmin = { template: ADMIN_TEMPLATE, init: initAdmin };
