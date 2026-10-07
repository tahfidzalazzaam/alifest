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
        '<button type="button" id="btn-toggle-pendaftaran"></button>' +
        '<button type="button" class="btn btn--ghost" id="btn-logout">Keluar</button>' +
      '</div>' +
    '</div>' +
    '<div class="admin-tabs">' +
      '<button type="button" class="admin-tab is-active" data-tab="pendaftar">Data Pendaftar</button>' +
      '<button type="button" class="admin-tab" data-tab="lomba">Kelola Lomba</button>' +
      '<button type="button" class="admin-tab" data-tab="logo">Logo Situs</button>' +
      '<button type="button" class="admin-tab" data-tab="juknis">Petunjuk Teknis</button>' +
      '<button type="button" class="admin-tab" data-tab="kartu">Kartu Peserta</button>' +
      '<button type="button" class="admin-tab" data-tab="notifwa">Notifikasi WA</button>' +
    '</div>' +
    '<div id="admin-content"></div>' +
    '<div class="modal-overlay" id="modal-overlay" style="display:none;">' +
      '<div class="modal-box" id="modal-box"></div>' +
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

  const tabs = root.querySelectorAll(".admin-tab");
  tabs.forEach(function (tab) {
    tab.addEventListener("click", function () {
      tabs.forEach(function (t) { t.classList.remove("is-active"); });
      tab.classList.add("is-active");
      const nama = tab.getAttribute("data-tab");
      if (nama === "pendaftar") loadTabPendaftar();
      if (nama === "lomba") loadTabLomba();
      if (nama === "logo") loadTabLogo();
      if (nama === "juknis") loadTabJuknis();
      if (nama === "kartu") loadTabKartu();
      if (nama === "notifwa") loadTabNotifWa();
    });
  });

  loadTabPendaftar();
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

/* -------- Popup detail tim (Futsal): dibuka dengan mengetuk baris -------- */
// "rule" (opsional) = baris lomba_rules yang cocok dengan row.lomba_id --
// dipakai untuk menyorot anggota yang usianya di luar syarat jenjang tim itu
// (lihat migrasi 0018), murni bantuan visual di popup ini. Kalau tidak
// disediakan (mis. dipanggil dari tempat lain), popup tetap tampil normal
// tanpa penyorotan.
async function bukaModalTim(row, rule) {
  const statusClass = (row.status === "Perlu Verifikasi Usia" || row.status === "Perlu Tambah Nomor Punggung") ? " modal-status--warn" : "";
  const infoHTML =
    '<div class="modal-tim-info">' +
      '<div><strong>Nama Tim/Sekolah:</strong> ' + row.nama_tim + '</div>' +
      '<div><strong>Nama Pendamping:</strong> ' + (row.pembina || "-") + '</div>' +
      '<div><strong>No. WA Pendamping:</strong> ' + row.whatsapp + '</div>' +
      '<div><strong>Nomor Pendaftaran:</strong> ' + row.nomor_pendaftaran + '</div>' +
      '<div><strong>Status:</strong> <span class="modal-status' + statusClass + '">' + row.status + '</span></div>' +
    '</div>' +
    (row.status === "Perlu Verifikasi Usia"
      ? '<p class="hint modal-status-hint">Ada anggota tim yang usianya di luar syarat jenjang lomba ini (disorot merah di tabel bawah) -- silakan cek Surat Delegasi sebelum memutuskan status akhirnya.</p>'
      : "") +
    (row.status === "Perlu Tambah Nomor Punggung"
      ? '<p class="hint modal-status-hint">Link "Lengkapi Nomor Punggung" sudah/akan dikirim ke pendamping lewat WA -- status otomatis balik ke "Menunggu Verifikasi" begitu mereka selesai mengisi semua nomor punggung lewat link itu.</p>'
      : "") +
    (row.status === "Ditolak" && row.alasan_penolakan
      ? '<p class="hint modal-status-hint"><strong>Alasan Penolakan:</strong> ' + escapeHTML(row.alasan_penolakan) + '</p>'
      : "") +
    '<div class="modal-tim-berkas">' +
      '<strong>Berkas:</strong> ' +
      (row.url_surat_delegasi ? '<a href="' + row.url_surat_delegasi + '" target="_blank" rel="noopener">Surat Delegasi</a>' : '<span class="hint">Delegasi -</span>') +
      ' · Bukti IG: ' + renderDaftarBerkasTim(row.url_bukti_follow_ig) +
      ' · Kartu Anggota: ' + renderDaftarBerkasTim(row.url_berkas_tim) +
    '</div>' +
    '<h4 style="margin-top:16px;">Anggota Tim</h4>' +
    '<div id="modal-tim-anggota"><p class="hint">Memuat data anggota tim...</p></div>';

  bukaModal("Detail Tim — " + row.nama_tim, infoHTML);

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

function renderDaftarBerkasTim(urlBerkasTim) {
  const daftar = Array.isArray(urlBerkasTim) ? urlBerkasTim : [];
  if (daftar.length === 0) return '<span class="hint">-</span>';
  return daftar.map(function (url, i) {
    return '<a href="' + url + '" target="_blank" rel="noopener">#' + (i + 1) + '</a>';
  }).join(" · ");
}

/* -------- Popup detail peserta INDIVIDU: dibuka dengan mengetuk baris -------- */
// Sejak migrasi 0027, baris peserta individu juga bisa diketuk (sebelumnya
// cuma baris tim/Futsal yang bisa) supaya panitia bisa lihat data lengkapnya,
// termasuk field "Nama Pendamping" yang SENGAJA TIDAK ditampilkan sebagai
// kolom di tabel Data Pendaftar (biar tabelnya tetap ramping). Tidak perlu
// query tambahan ke database -- semua field sudah ada di `row` (hasil
// select("*") pada `pendaftaran`), jadi fungsi ini sinkron (tidak seperti
// bukaModalTim yang harus memuat anggota_tim secara async).
function bukaModalIndividu(row) {
  const statusClass = row.status === "Perlu Verifikasi Usia" ? " modal-status--warn" : "";
  const infoHTML =
    '<div class="modal-tim-info">' +
      '<div><strong>Nama Lengkap Peserta:</strong> ' + row.nama_lengkap + '</div>' +
      '<div><strong>Nama Pendamping:</strong> ' + (row.nama_pendamping || "-") + '</div>' +
      '<div><strong>Jenjang/Kelas:</strong> ' + row.jenjang + '/' + row.kelas + '</div>' +
      '<div><strong>Jenis Kelamin:</strong> ' + (row.jenis_kelamin === "perempuan" ? "Perempuan" : row.jenis_kelamin === "laki-laki" ? "Laki-laki" : "-") + '</div>' +
      '<div><strong>Tanggal Lahir:</strong> ' + formatTanggalLahir(row.tanggal_lahir) + (row.usia != null ? " (" + row.usia + " th)" : "") + '</div>' +
      '<div><strong>Asal Sekolah:</strong> ' + row.asal_sekolah + '</div>' +
      '<div><strong>No. WhatsApp:</strong> ' + row.whatsapp + '</div>' +
      '<div><strong>Email:</strong> ' + (row.email || "-") + '</div>' +
      '<div><strong>Nomor Pendaftaran:</strong> ' + row.nomor_pendaftaran + '</div>' +
      '<div><strong>Status:</strong> <span class="modal-status' + statusClass + '">' + row.status + '</span></div>' +
    '</div>' +
    (row.status === "Perlu Verifikasi Usia"
      ? '<p class="hint modal-status-hint">Usia peserta ini di luar syarat jenjang lomba pada tanggal pelaksanaan -- silakan cek data sebelum memutuskan status akhirnya.</p>'
      : "") +
    (row.status === "Ditolak" && row.alasan_penolakan
      ? '<p class="hint modal-status-hint"><strong>Alasan Penolakan:</strong> ' + escapeHTML(row.alasan_penolakan) + '</p>'
      : "") +
    '<div class="modal-tim-berkas">' +
      '<strong>Berkas:</strong> ' +
      (row.url_kartu_pelajar ? '<a href="' + row.url_kartu_pelajar + '" target="_blank" rel="noopener">Kartu Pelajar</a>' : '<span class="hint">Kartu -</span>') +
      ' · Bukti IG: ' + renderDaftarBerkasTim(row.url_bukti_follow_ig) +
    '</div>';

  bukaModal("Detail Peserta — " + row.nama_lengkap, infoHTML);
}

/* -------- Kirim notifikasi WA (Fonnte) lewat Edge Function, dipanggil saat
   status pendaftaran diubah jadi "Diterima" atau "Ditolak" -------- */
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
      '<th>Nomor</th><th>Nama</th><th>Lomba</th><th>Jenjang/Kelas</th><th>Lahir/Usia</th><th>Tipe</th><th>Sekolah</th><th>WA</th><th>Berkas</th><th>Status</th><th></th>' +
    '</tr></thead><tbody></tbody></table></div>';

  /* -------- Kuota efektif per sel (jenjang x gender), sama dengan rumus di server -------- */
  function kuotaEfektifRule(r) {
    if (r.kuota == null) return null;
    const n = (r.jenjang && r.jenjang.length) || 1;
    return Math.floor(r.kuota / n);
  }

  /* -------- Rekap kartu (jumlah per lomba + jenis kelamin) --------
     Ditampilkan sebagai "terisi/kapasitas" per jenjang & gender (bukan
     angka kuota yang sudah dibagi begitu saja) supaya tidak ambigu. */
  function renderRekap() {
    const rekapEl = document.getElementById("rekap-grid");
    if (!rekapEl) return;

    const perLomba = {};
    rules.forEach(function (r) { perLomba[r.id] = { total: 0, l: 0, p: 0, perJenjang: {} }; });
    let totalL = 0, totalP = 0;
    rows.forEach(function (r) {
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
      '<div class="rekap-card__total">' + rows.length + '</div>' +
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
      tbody.innerHTML = '<tr><td colspan="11">Tidak ada data yang cocok.</td></tr>';
      return;
    }

    tbody.innerHTML = tampil.map(function (r) {
      const isTim = r.tipe === "tim";
      const tombolTim = isTim
        ? ' <span class="lp-badge lp-badge--tim">TIM · ketuk baris</span>'
        : ' <span class="lp-badge">ketuk untuk detail</span>';
      const lpBadge = r.jenis_kelamin === "perempuan" ? "P" : r.jenis_kelamin === "laki-laki" ? "L" : "-";
      const tipeIkon = r.tipe_pendaftar === "lembaga" ? "🏫" : "🎓";
      const tipeJudul = r.tipe_pendaftar === "lembaga"
        ? ("Perwakilan Lembaga" + (r.penanggung_jawab_lembaga ? " · PJ: " + r.penanggung_jawab_lembaga : ""))
        : "Peserta Individu";
      const lahirUsia = isTim ? "-" : (formatTanggalLahir(r.tanggal_lahir) + (r.usia != null ? " (" + r.usia + "th)" : ""));
      const kelasLabel = isTim ? "-" : (r.jenjang + '/' + r.kelas);

      const berkasCell = isTim
        ? ('<button type="button" class="btn-link btn-lihat-tim" data-id="' + r.id + '">Lihat berkas</button>')
        : ('<a href="' + r.url_kartu_pelajar + '" target="_blank" rel="noopener">Kartu</a> · IG: ' + renderDaftarBerkasTim(r.url_bukti_follow_ig));

      return (
        '<tr class="row-clickable" data-id="' + r.id + '">' +
          '<td>' + r.nomor_pendaftaran + '</td>' +
          '<td class="col-truncate" title="' + r.nama_lengkap + '">' + r.nama_lengkap + ' <span class="lp-badge">' + lpBadge + '</span>' + tombolTim + '</td>' +
          '<td>' + r.lomba_nama + '</td>' +
          '<td>' + kelasLabel + '</td>' +
          '<td>' + lahirUsia + '</td>' +
          '<td title="' + tipeJudul + '">' + tipeIkon + '</td>' +
          '<td class="col-truncate" title="' + r.asal_sekolah + '">' + r.asal_sekolah + '</td>' +
          '<td>' + r.whatsapp + '</td>' +
          '<td>' + berkasCell + '</td>' +
          '<td><select class="status-select" data-id="' + r.id + '">' +
            (isTim
              ? ["Menunggu Verifikasi", "Perlu Verifikasi Usia", "Perlu Tambah Nomor Punggung", "Diterima", "Ditolak"]
              : ["Menunggu Verifikasi", "Perlu Verifikasi Usia", "Diterima", "Ditolak"]
            ).map(function (s) {
              return '<option value="' + s + '"' + (s === r.status ? " selected" : "") + '>' + s + "</option>";
            }).join("") +
          '</select> <span class="wa-status-note" data-note-for="' + r.id + '"></span></td>' +
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
          bukaModalIndividu(row);
        }
      });
    });

    tbody.querySelectorAll(".btn-lihat-tim").forEach(function (btn) {
      btn.addEventListener("click", function () {
        const id = btn.getAttribute("data-id");
        const row = rows.find(function (r) { return r.id === id; });
        if (row) bukaModalTim(row, rules.find(function (l) { return l.id === row.lomba_id; }));
      });
    });

    // Fungsi bersama yang benar-benar MENYIMPAN perubahan status ke database
    // -- dipakai baik untuk status biasa (langsung) maupun status "Ditolak"
    // (baru dipanggil SETELAH panitia memilih alasan penolakan lewat modal,
    // lihat bukaModalAlasanPenolakan di bawah). `alasanPenolakan` cuma
    // dikirim kalau statusBaru === "Ditolak"; untuk status lain selalu null
    // (mis. tidak menimpa alasan lama kalau panitia pernah menolak lalu
    // mengubah lagi ke status lain, biar riwayatnya tetap ada kalau nanti
    // ditolak ulang -- lihat bukaModalAlasanPenolakan, alasan lama dipakai
    // sebagai nilai awal dropdown-nya).
    async function commitPerubahanStatus(id, sel, statusBaru, alasanPenolakan) {
      // "Perlu Tambah Nomor Punggung" butuh token link /lengkapi -- dipastikan
      // (dibuat kalau belum ada) LEBIH DULU lewat RPC pastikan_token_lengkapi
      // (migrasi 0032, SECURITY DEFINER, khusus panitia) sebelum status di
      // baris ini diubah, supaya begitu notifikasi WA dikirim, tokennya sudah
      // pasti tersedia buat dirangkai jadi {link_lengkapi} di Edge Function.
      if (statusBaru === "Perlu Tambah Nomor Punggung") {
        const { error: tokenError } = await supabaseClient.rpc("pastikan_token_lengkapi", { p_id: id });
        if (tokenError) {
          alert("Gagal menyiapkan link lengkapi nomor punggung: " + tokenError.message);
          sel.value = (rows.find(function (r) { return r.id === id; }) || {}).status || sel.value;
          return;
        }
      }

      const payload = { status: statusBaru };
      if (statusBaru === "Ditolak") payload.alasan_penolakan = alasanPenolakan;

      const { error } = await supabaseClient.from("pendaftaran").update(payload).eq("id", id);
      if (error) {
        alert("Gagal mengubah status: " + error.message);
        sel.value = (rows.find(function (r) { return r.id === id; }) || {}).status || sel.value;
        return;
      }
      const row = rows.find(function (r) { return r.id === id; });
      if (row) {
        row.status = statusBaru;
        if (statusBaru === "Ditolak") row.alasan_penolakan = alasanPenolakan;
      }
      renderRekap();

      // "Perlu Verifikasi Usia" dan "Perlu Tambah Nomor Punggung" juga
      // mengirim notifikasi WA (sama seperti Diterima/Ditolak) begitu panitia
      // MEMILIH status ini di dropdown -- untuk lomba tim (Futsal), pesannya
      // otomatis menyebut nama anggota yang usianya di luar syarat lewat
      // placeholder {anggota_usia}, atau link lengkapi nomor punggung lewat
      // placeholder {link_lengkapi}, atau (khusus "Ditolak") alasan
      // penolakan lewat placeholder {alasan} (dihitung di Edge Function
      // kirim-notifikasi-wa, lihat file itu). Ini cuma perubahan kode
      // (frontend + Edge Function), tidak perlu migrasi SQL baru lagi.
      if (statusBaru === "Diterima" || statusBaru === "Ditolak" || statusBaru === "Perlu Verifikasi Usia" || statusBaru === "Perlu Tambah Nomor Punggung") {
        kirimNotifikasiWA(id, sel);
      }
    }

    // Modal wajib pilih alasan penolakan, dibuka saat panitia memilih
    // "Ditolak" di dropdown status -- daftar pilihannya diambil dari
    // site_settings.alasan_penolakan_list (diedit panitia sendiri lewat tab
    // "Notifikasi WA", lihat loadTabNotifWa), ditambah satu opsi tetap
    // "Lainnya (tulis sendiri)" untuk kasus yang tidak ada di daftar.
    async function bukaModalAlasanPenolakan(id, sel, statusLama) {
      const row = rows.find(function (r) { return r.id === id; });
      const { data: settingsRow } = await supabaseClient
        .from("site_settings").select("alasan_penolakan_list").eq("id", 1).single();
      const daftarAlasan = (settingsRow && Array.isArray(settingsRow.alasan_penolakan_list))
        ? settingsRow.alasan_penolakan_list
        : [];
      const alasanLama = row ? row.alasan_penolakan : null;

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

      bukaModal("Alasan Penolakan — " + (row ? (row.nama_tim || row.nama_lengkap) : ""), isiHTML);

      const selectEl = document.getElementById("alasan-penolakan-select");
      const lainnyaWrap = document.getElementById("alasan-penolakan-lainnya-wrap");
      const lainnyaInput = document.getElementById("alasan-penolakan-lainnya");

      function syncLainnyaVisibility() {
        lainnyaWrap.style.display = selectEl.value === "__lainnya__" ? "block" : "none";
      }
      syncLainnyaVisibility();
      selectEl.addEventListener("change", syncLainnyaVisibility);

      document.getElementById("btn-batal-alasan-penolakan").addEventListener("click", function () {
        sel.value = statusLama || sel.value;
        tutupModal();
      });

      document.getElementById("btn-simpan-alasan-penolakan").addEventListener("click", function () {
        const alasanDipilih = selectEl.value === "__lainnya__"
          ? lainnyaInput.value.trim()
          : selectEl.value;
        if (!alasanDipilih) {
          alert("Alasan penolakan wajib diisi.");
          return;
        }
        tutupModal();
        commitPerubahanStatus(id, sel, "Ditolak", alasanDipilih);
      });
    }

    tbody.querySelectorAll(".status-select").forEach(function (sel) {
      sel.addEventListener("change", async function () {
        const id = sel.getAttribute("data-id");
        const statusBaru = sel.value;
        const statusLama = (rows.find(function (r) { return r.id === id; }) || {}).status;

        // Status "Ditolak" WAJIB menyertakan alasan -- panitia harus pilih
        // dulu lewat modal (dropdown + opsi tulis sendiri) sebelum status-nya
        // benar-benar tersimpan. Modal ini juga yang memanggil
        // commitPerubahanStatus begitu panitia menekan "Tandai Ditolak", dan
        // yang mengembalikan dropdown ke status lama kalau panitia menekan
        // "Batal".
        if (statusBaru === "Ditolak") {
          bukaModalAlasanPenolakan(id, sel, statusLama);
          return;
        }

        commitPerubahanStatus(id, sel, statusBaru, null);
      });
    });

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
   Rasio POSTER_LEBAR_PX:POSTER_TINGGI_PX = 2:3 (setara "6:9" sesuai yang
   diminta), resolusi asli dibuat besar (1200x1800) supaya tetap tajam kalau
   diunggah ke Instagram dsb walau pratinjaunya di modal ditampilkan kecil. */
const POSTER_LEBAR_PX = 1200;
const POSTER_TINGGI_PX = 1800;

// Hitung ulang rekap per lomba (total, laki-laki/perempuan, per jenjang) --
// SENGAJA dihitung terpisah dari renderRekap() (bukan dipakai bersama)
// supaya perubahan di salah satu fungsi tidak berisiko mematahkan fungsi
// lain; keduanya memakai data `rows`/`rules` yang sama jadi hasilnya selalu
// konsisten dengan kartu rekap yang terlihat di atas tabel.
function hitungRekapUntukPoster(rules, rows) {
  const perLomba = {};
  rules.forEach(function (r) { perLomba[r.id] = { total: 0, l: 0, p: 0, perJenjang: {} }; });
  rows.forEach(function (r) {
    const d = perLomba[r.lomba_id];
    if (!d) return;
    d.total++;
    if (r.jenis_kelamin === "laki-laki") d.l++;
    else if (r.jenis_kelamin === "perempuan") d.p++;
    if (!d.perJenjang[r.jenjang]) d.perJenjang[r.jenjang] = { l: 0, p: 0 };
    if (r.jenis_kelamin === "laki-laki") d.perJenjang[r.jenjang].l++;
    else if (r.jenis_kelamin === "perempuan") d.perJenjang[r.jenjang].p++;
  });
  return { perLomba: perLomba, totalPendaftar: rows.length };
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

// Karakter/maskot kecil per cabang lomba untuk hiasan poster rekap -- SELAIN
// `r.ikon` (yang tetap dipakai di sebelah nama lomba seperti sebelumnya),
// dipetakan dari `lomba_id` ke emoji "karakter" yang lebih hidup/menggambarkan
// kegiatannya, dipakai sebagai gambar watermark samar di tiap kartu. Kalau
// lomba_id tidak dikenali (lomba baru yang ditambah panitia sendiri lewat
// "Kelola Lomba"), jatuh balik ke `r.ikon` apa adanya -- tidak pernah kosong.
const KARAKTER_LOMBA = {
  adzan: "🕌",
  panahan: "🏹",
  mhq: "📖",
  kaligrafi: "🖋️",
  futsal: "⚽",
};

// Pita bendera-bendera kecil (bunting) warna-warni di tepi atas poster,
// senada dengan dekorasi ".bunting" yang sudah ada di navbar situs
// (index.html) -- murni hiasan meriah bertema festival, tidak menampilkan
// data apa pun.
function gambarBuntingAtas(ctx, W) {
  const warnaBendera = ["#ffc93c", "#ffffff", "#2fa84f", "#ffc93c", "#17914a", "#ffffff"];
  const lebarBendera = 46;
  const tinggiBendera = 56;
  const yTali = 16;

  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, yTali);
  ctx.lineTo(W, yTali);
  ctx.stroke();

  let i = 0;
  for (let x = -lebarBendera / 2; x < W; x += lebarBendera) {
    ctx.fillStyle = warnaBendera[i % warnaBendera.length];
    ctx.beginPath();
    ctx.moveTo(x, yTali);
    ctx.lineTo(x + lebarBendera, yTali);
    ctx.lineTo(x + lebarBendera / 2, yTali + tinggiBendera);
    ctx.closePath();
    ctx.fill();
    i++;
  }
  ctx.restore();
}

// Taburan confetti/bintang di area header hijau -- posisi & ukuran TETAP
// (bukan acak) supaya poster yang sama selalu tampil identik tiap digambar
// ulang (mis. setelah klik "Muat Ulang Data"). Sengaja ditaruh di kolom
// kiri/kanan saja (menjauhi logo & judul di tengah) supaya tidak mengganggu
// keterbacaan.
const KONFETI_HEADER = [
  { x: 150, y: 79, e: "✨", s: 40, o: 0.85 },
  { x: 95, y: 201, e: "⭐", s: 30, o: 0.7 },
  { x: 175, y: 333, e: "🎊", s: 42, o: 0.8 },
  { x: 110, y: 455, e: "🎉", s: 36, o: 0.75 },
  { x: 220, y: 525, e: "✨", s: 26, o: 0.65 },
  { x: 1050, y: 79, e: "🎉", s: 38, o: 0.8 },
  { x: 1105, y: 201, e: "✨", s: 28, o: 0.7 },
  { x: 1025, y: 333, e: "⭐", s: 34, o: 0.75 },
  { x: 1090, y: 455, e: "🎊", s: 40, o: 0.8 },
  { x: 980, y: 525, e: "✨", s: 26, o: 0.65 },
];

function gambarKonfetiHeader(ctx) {
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  KONFETI_HEADER.forEach(function (k) {
    ctx.globalAlpha = k.o;
    ctx.font = k.s + "px sans-serif";
    ctx.fillText(k.e, k.x, k.y);
  });
  ctx.restore();
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

function gambarPosterRekap(canvas, logoImg, rules, perLomba, totalPendaftar) {
  canvas.width = POSTER_LEBAR_PX;
  canvas.height = POSTER_TINGGI_PX;
  const ctx = canvas.getContext("2d");
  const W = POSTER_LEBAR_PX, H = POSTER_TINGGI_PX;
  const marginX = 70;

  // -------- Latar belakang: krem (sama seperti --page-bg web) + pita hijau
  // dekoratif atas-bawah, senada dengan warna situs (--green-700/--yellow-500).
  const tinggiHeader = 560;
  ctx.fillStyle = "#fffdf7";
  ctx.fillRect(0, 0, W, H);
  const gradAtas = ctx.createLinearGradient(0, 0, 0, tinggiHeader);
  gradAtas.addColorStop(0, "#0f7b3e");
  gradAtas.addColorStop(1, "#17914a");
  ctx.fillStyle = gradAtas;
  ctx.fillRect(0, 0, W, tinggiHeader);
  ctx.fillStyle = "#ffc93c";
  ctx.fillRect(0, tinggiHeader, W, 10);

  // -------- Hiasan meriah bertema festival: bendera bunting + confetti --------
  gambarBuntingAtas(ctx, W);
  gambarKonfetiHeader(ctx);

  ctx.textAlign = "center";

  // -------- Logo besar (apa adanya, TANPA latar/bingkai bulat), dibesarkan
  // lagi (520px -> 600px) sementara pita header hijau disempitkan
  // (640px -> 560px) supaya logo tetap jadi fokus utama TAPI kartu rekap di
  // bawahnya kebagian ruang vertikal lebih besar untuk teksnya -- tetap
  // object-fit: contain (utuh, tidak terpotong), tanpa latar/bingkai apa pun
  // di belakangnya.
  const logoSize = 600;
  const logoCx = W / 2, logoCy = 310;

  if (logoImg) {
    const skala = Math.min(logoSize / logoImg.width, logoSize / logoImg.height);
    const lw = logoImg.width * skala, lh = logoImg.height * skala;
    ctx.drawImage(logoImg, logoCx - lw / 2, logoCy - lh / 2, lw, lh);
  } else {
    ctx.font = (logoSize * 0.62) + "px sans-serif";
    ctx.textBaseline = "middle";
    ctx.fillText("🌙", logoCx, logoCy + 6);
  }

  // -------- Judul --------
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#ffffff";
  ctx.font = "800 60px 'Outfit', sans-serif";
  ctx.fillText("ALIF 5.0", W / 2, 525);
  ctx.font = "600 28px 'Plus Jakarta Sans', sans-serif";
  ctx.fillText("Al Azzaam Islamic Fair · Rekap Pendaftar", W / 2, 558);

  // -------- Kartu per cabang lomba --------
  const atasKartu = tinggiHeader + 16;
  const bawahKartu = H - 115;
  const celahKartu = 10;
  const tinggiTiapKartu = Math.floor((bawahKartu - atasKartu) / Math.max(rules.length, 1)) - celahKartu;

  let y = atasKartu;
  ctx.textAlign = "left";

  rules.forEach(function (r) {
    const d = perLomba[r.id] || { total: 0, l: 0, p: 0, perJenjang: {} };
    const genderTerkunci = r.gender_diizinkan && r.gender_diizinkan !== "semua";
    const jenjangList = r.jenjang && r.jenjang.length ? r.jenjang : ["-"];
    const karakter = KARAKTER_LOMBA[r.id] || r.ikon || "🏆";

    // Kartu putih dengan bayangan lembut, radius besar -- senada komponen
    // ".form-shell"/".rekap-card" di web (var(--radius-lg), var(--shadow-card)).
    ctx.save();
    ctx.shadowColor = "rgba(15, 61, 34, 0.12)";
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 6;
    ctx.fillStyle = "#ffffff";
    kotakBulat(ctx, marginX, y, W - marginX * 2, tinggiTiapKartu, 22);
    ctx.fill();
    ctx.restore();

    // Maskot/karakter sesuai cabang lomba -- watermark samar di sisi kanan
    // kartu, DIGAMBAR SEBELUM teks supaya teks tetap jelas terbaca di atasnya
    // (murni hiasan, tidak menampilkan data apa pun).
    ctx.save();
    ctx.globalAlpha = 0.12;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const ukuranMaskot = Math.min(tinggiTiapKartu - 16, 150);
    ctx.font = ukuranMaskot + "px sans-serif";
    ctx.fillText(karakter, W - marginX - 100, y + tinggiTiapKartu / 2);
    ctx.restore();

    const padKiri = marginX + 34;
    let ty = y + 44;

    ctx.textAlign = "left";
    ctx.fillStyle = "#12291c";
    ctx.font = "700 37px 'Outfit', sans-serif";
    ctx.fillText((r.ikon ? r.ikon + "  " : "") + r.nama, padKiri, ty);

    ctx.textAlign = "right";
    ctx.fillStyle = "#0f7b3e";
    ctx.font = "800 40px 'Outfit', sans-serif";
    ctx.fillText(String(d.total), W - marginX - 34, ty);
    ctx.textAlign = "left";

    // -------- Rincian per jenjang & jenis kelamin -- dirapikan jadi badge
    // (pil) jenjang + chip bertitik warna per jenis kelamin, kolomnya rata
    // (bukan satu kalimat panjang seperti sebelumnya), supaya lebih mudah
    // dipindai sekilas dan rapi walau jumlah jenjangnya beda-beda. Ukuran pil
    // & font rincian dibesarkan supaya lebih jelas terbaca di poster.
    const pillW = 100, pillH = 50;
    const kolom1X = padKiri + pillW + 22;
    const kolom2X = kolom1X + 250;

    ty += 20;
    jenjangList.forEach(function (j) {
      const jd = d.perJenjang[j] || { l: 0, p: 0 };
      const baseline = ty + 33;

      ctx.fillStyle = "#eafbe9";
      kotakBulat(ctx, padKiri, ty, pillW, pillH, pillH / 2);
      ctx.fill();
      ctx.fillStyle = "#0f7b3e";
      ctx.font = "700 27px 'Outfit', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(j, padKiri + pillW / 2, baseline);
      ctx.textAlign = "left";

      ctx.font = "600 29px 'Plus Jakarta Sans', sans-serif";

      if (genderTerkunci) {
        const terisi = r.gender_diizinkan === "laki-laki" ? jd.l : jd.p;
        const warnaDot = r.gender_diizinkan === "laki-laki" ? "#3f7fb0" : "#d1588f";
        const labelGender = r.gender_diizinkan === "laki-laki" ? "Laki-laki" : "Perempuan";
        ctx.fillStyle = warnaDot;
        ctx.beginPath();
        ctx.arc(kolom1X + 9, baseline - 9, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#12291c";
        ctx.fillText(labelGender + " " + terisi, kolom1X + 28, baseline);
      } else {
        ctx.fillStyle = "#3f7fb0";
        ctx.beginPath();
        ctx.arc(kolom1X + 9, baseline - 9, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#12291c";
        ctx.fillText("Laki-laki " + jd.l, kolom1X + 28, baseline);

        ctx.fillStyle = "#d1588f";
        ctx.beginPath();
        ctx.arc(kolom2X + 9, baseline - 9, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#12291c";
        ctx.fillText("Perempuan " + jd.p, kolom2X + 28, baseline);
      }

      ty += pillH + 12;
    });

    y += tinggiTiapKartu + celahKartu;
  });

  // -------- Footer: total keseluruhan + tanggal --------
  ctx.textAlign = "center";
  ctx.fillStyle = "#0f7b3e";
  ctx.font = "800 44px 'Outfit', sans-serif";
  ctx.fillText("Total Pendaftar: " + totalPendaftar, W / 2, H - 80);

  const tanggalCetak = new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
  ctx.fillStyle = "#7c9186";
  ctx.font = "500 22px 'Plus Jakarta Sans', sans-serif";
  ctx.fillText("Diperbarui " + tanggalCetak + " · PPTQ Al Azzaam", W / 2, H - 40);
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

  const { perLomba, totalPendaftar } = hitungRekapUntukPoster(rules, rows);
  const { data: settingsData } = await supabaseClient.from("site_settings").select("logo_url").eq("id", 1).single();
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
    '<p class="hint">Rasio 2:3 (setara "6:9"), resolusi ' + POSTER_LEBAR_PX + '×' + POSTER_TINGGI_PX + 'px — cukup tajam untuk diunggah ke Instagram/WhatsApp. Angkanya otomatis dari data "Data Pendaftar" saat ini.</p>' +
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

// Sejak pembaruan ini, field "Jenjang" dan "Lomba" pada Kartu Peserta
// digabung jadi SATU field (key "lomba_jenjang") -- tidak lagi dua tulisan
// terpisah di kartu, supaya tata letaknya lebih ringkas. Kartu Pendamping
// tidak berubah (memang sudah cuma satu field "Lomba/Sekolah").
const FIELD_PESERTA = [
  { key: "nama", label: "Nama" },
  { key: "lomba_jenjang", label: "Lomba & Jenjang" }
];
const FIELD_PENDAMPING = [
  { key: "nama", label: "Nama" },
  { key: "lomba", label: "Lomba/Sekolah" }
];

// Ukuran cetak KARTU PESERTA & KARTU PENDAMPING dibuat TETAP (bukan lagi
// ikut ukuran piksel PNG template yang diupload panitia) -- 8,5 x 12 cm,
// ukuran "cocard"/ID card berlanyard yang standar/umum dipakai jasa cetak di
// Indonesia. Berapa pun ukuran file PNG yang diupload, hasil pratinjau &
// PDF-nya SELALU pas di ukuran fisik ini (gambar template ditarik/disusutkan
// otomatis supaya penuh) -- lihat gambarKartu() & cetakKartuPDF(). Sebaiknya
// desain template dibuat dengan rasio 8,5:12 supaya tidak gepeng/melar.
const KARTU_LEBAR_CM = 8.5;
const KARTU_TINGGI_CM = 12;
const KARTU_DPI = 300; // dipakai buat kanvas pratinjau di layar; PDF-nya sendiri pakai satuan cm langsung (lihat cetakKartuPDF) supaya ukuran fisiknya presisi
const KARTU_LEBAR_PX = Math.round((KARTU_LEBAR_CM / 2.54) * KARTU_DPI);
const KARTU_TINGGI_PX = Math.round((KARTU_TINGGI_CM / 2.54) * KARTU_DPI);

const DEFAULT_LAYOUT_KARTU = {
  peserta: {
    nama: { x: 60, y: 680, font: 56 },
    lomba_jenjang: { x: 60, y: 760, font: 34 },
    qr: { x: 352, y: 850, size: 300 }
  },
  pendamping: {
    nama: { x: 60, y: 680, font: 56 },
    lomba: { x: 60, y: 760, font: 34 },
    qr: { x: 352, y: 850, size: 300 }
  }
};

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
  await muatScript("https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js");
  await muatScript("https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js");
  libKartuSiap = true;
}

function muatGambar(url) {
  return new Promise(function (resolve, reject) {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = function () { resolve(img); };
    img.onerror = function () { reject(new Error("Gagal memuat gambar template.")); };
    img.src = url;
  });
}

function gambarQR(ctx, teks, x, y, size) {
  const qr = window.qrcode(0, "M");
  qr.addData(teks);
  qr.make();
  const count = qr.getModuleCount();
  const cell = size / count;
  ctx.fillStyle = "#000000";
  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) {
      if (qr.isDark(r, c)) ctx.fillRect(x + c * cell, y + r * cell, cell, cell);
    }
  }
}

function gambarKartu(canvas, templateImg, layout, data, fields) {
  // Kanvas SELALU berukuran tetap (ukuran cocard standar, lihat
  // KARTU_LEBAR_PX/KARTU_TINGGI_PX di atas) -- template PNG yang diupload
  // panitia ditarik/disusutkan supaya pas mengisi penuh, berapa pun ukuran
  // piksel aslinya.
  canvas.width = KARTU_LEBAR_PX;
  canvas.height = KARTU_TINGGI_PX;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(templateImg, 0, 0, KARTU_LEBAR_PX, KARTU_TINGGI_PX);
  ctx.fillStyle = "#000000";
  ctx.textBaseline = "top";
  fields.forEach(function (f) {
    const pos = (layout && layout[f.key]) || { x: 40, y: 40, font: 22 };
    ctx.font = "600 " + pos.font + "px 'Plus Jakarta Sans', sans-serif";
    ctx.fillText(data[f.key] || "-", pos.x, pos.y);
  });
  const qrPos = (layout && layout.qr) || { x: 40, y: 170, size: 120 };
  gambarQR(ctx, data.qrText, qrPos.x, qrPos.y, qrPos.size);
}

function bacaLayoutDariInput(jenis, fields) {
  const layout = {};
  fields.forEach(function (f) {
    layout[f.key] = {
      x: parseInt(document.getElementById("pos-" + jenis + "-" + f.key + "-x").value, 10) || 0,
      y: parseInt(document.getElementById("pos-" + jenis + "-" + f.key + "-y").value, 10) || 0,
      font: parseInt(document.getElementById("pos-" + jenis + "-" + f.key + "-font").value, 10) || 20
    };
  });
  layout.qr = {
    x: parseInt(document.getElementById("pos-" + jenis + "-qr-x").value, 10) || 0,
    y: parseInt(document.getElementById("pos-" + jenis + "-qr-y").value, 10) || 0,
    size: parseInt(document.getElementById("pos-" + jenis + "-qr-size").value, 10) || 100
  };
  return layout;
}

function isiLayoutKeInput(jenis, fields, layoutTersimpan) {
  const layout = Object.assign({}, DEFAULT_LAYOUT_KARTU[jenis], layoutTersimpan || {});
  fields.forEach(function (f) {
    const pos = layout[f.key] || DEFAULT_LAYOUT_KARTU[jenis][f.key];
    document.getElementById("pos-" + jenis + "-" + f.key + "-x").value = pos.x;
    document.getElementById("pos-" + jenis + "-" + f.key + "-y").value = pos.y;
    document.getElementById("pos-" + jenis + "-" + f.key + "-font").value = pos.font;
  });
  const qrPos = layout.qr || DEFAULT_LAYOUT_KARTU[jenis].qr;
  document.getElementById("pos-" + jenis + "-qr-x").value = qrPos.x;
  document.getElementById("pos-" + jenis + "-qr-y").value = qrPos.y;
  document.getElementById("pos-" + jenis + "-qr-size").value = qrPos.size;
}

function kartuEditorHTML(jenis, judul, fields, existingUrl) {
  const inputsHTML = fields.map(function (f) {
    return (
      '<div class="kartu-pos-group">' +
        '<span class="kartu-pos-group__label">' + f.label + '</span>' +
        '<label>X <input type="number" id="pos-' + jenis + '-' + f.key + '-x" /></label>' +
        '<label>Y <input type="number" id="pos-' + jenis + '-' + f.key + '-y" /></label>' +
        '<label>Font <input type="number" id="pos-' + jenis + '-' + f.key + '-font" /></label>' +
      '</div>'
    );
  }).join("");

  return (
    '<div class="form-shell" style="margin-bottom:20px;">' +
      '<h3>' + judul + '</h3>' +
      '<div class="field">' +
        '<label>Template (PNG)</label>' +
        '<input type="file" id="input-template-' + jenis + '" accept=".png,image/png" />' +
      '</div>' +
      '<button type="button" class="btn btn--ghost" id="btn-upload-template-' + jenis + '" style="margin-bottom:16px;">Upload Template Baru</button>' +
      '<div class="kartu-preview-wrap" id="preview-wrap-' + jenis + '">' +
        (existingUrl ? '<canvas id="preview-' + jenis + '"></canvas>' : '<p class="hint">Belum ada template. Upload dulu untuk melihat pratinjau.</p>') +
      '</div>' +
      '<div class="kartu-pos-grid">' +
        inputsHTML +
        '<div class="kartu-pos-group">' +
          '<span class="kartu-pos-group__label">QR Code</span>' +
          '<label>X <input type="number" id="pos-' + jenis + '-qr-x" /></label>' +
          '<label>Y <input type="number" id="pos-' + jenis + '-qr-y" /></label>' +
          '<label>Ukuran <input type="number" id="pos-' + jenis + '-qr-size" /></label>' +
        '</div>' +
      '</div>' +
      '<button type="button" class="btn btn--primary" id="btn-simpan-posisi-' + jenis + '" style="margin-top:14px;">Simpan Posisi</button>' +
      '<span class="hint" id="status-posisi-' + jenis + '" style="margin-left:10px;"></span>' +
    '</div>'
  );
}

async function setupKartuEditor(jenis, fields, existingUrl, savedLayout) {
  isiLayoutKeInput(jenis, fields, savedLayout);

  let templateImg = null;

  function renderPratinjauSekarang() {
    if (!templateImg) return;
    const canvas = document.getElementById("preview-" + jenis);
    if (!canvas) return;
    const layout = bacaLayoutDariInput(jenis, fields);
    const sample = {};
    fields.forEach(function (f) { sample[f.key] = "Contoh " + f.label; });
    sample.qrText = "ALIF5-CONTOH";
    gambarKartu(canvas, templateImg, layout, sample, fields);
  }

  if (existingUrl) {
    try {
      templateImg = await muatGambar(existingUrl);
      renderPratinjauSekarang();
    } catch (e) {
      console.error(e);
    }
  }

  document.querySelectorAll('[id^="pos-' + jenis + '-"]').forEach(function (inp) {
    inp.addEventListener("input", renderPratinjauSekarang);
  });

  document.getElementById("btn-upload-template-" + jenis).addEventListener("click", async function () {
    const fileInput = document.getElementById("input-template-" + jenis);
    const file = fileInput.files[0];
    if (!file) { alert("Pilih file PNG dulu."); return; }
    if (file.type !== "image/png") { alert("File harus berformat PNG."); return; }

    const btn = this;
    btn.disabled = true;
    btn.textContent = "Mengunggah...";

    const path = "kartu/" + jenis + "-" + Date.now() + ".png";
    const { error: upErr } = await supabaseClient.storage.from("aset-situs").upload(path, file, { contentType: "image/png" });
    if (upErr) {
      btn.disabled = false;
      btn.textContent = "Upload Template Baru";
      alert("Gagal mengunggah: " + upErr.message);
      return;
    }

    const { data: pub } = supabaseClient.storage.from("aset-situs").getPublicUrl(path);
    const kolom = jenis === "peserta" ? "kartu_peserta_url" : "kartu_pendamping_url";
    const payload = {};
    payload[kolom] = pub.publicUrl;
    const { error: updErr } = await supabaseClient.from("site_settings").update(payload).eq("id", 1);

    btn.disabled = false;
    btn.textContent = "Upload Template Baru";

    if (updErr) {
      alert("Berkas terunggah tapi gagal menyimpan pengaturan: " + updErr.message);
      return;
    }
    loadTabKartu();
  });

  document.getElementById("btn-simpan-posisi-" + jenis).addEventListener("click", async function () {
    const layout = bacaLayoutDariInput(jenis, fields);
    const { data: current } = await supabaseClient.from("site_settings").select("kartu_layout").eq("id", 1).single();
    const merged = Object.assign({}, current ? current.kartu_layout : {});
    merged[jenis] = layout;
    const { error } = await supabaseClient.from("site_settings").update({ kartu_layout: merged }).eq("id", 1);
    const statusEl = document.getElementById("status-posisi-" + jenis);
    statusEl.textContent = error ? ("Gagal: " + error.message) : "Tersimpan.";
    setTimeout(function () { statusEl.textContent = ""; }, 3000);
  });
}

async function cetakKartuPDF(jenis) {
  const statusEl = document.getElementById("cetak-status");
  const lombaFilter = document.getElementById("cetak-filter-lomba").value;

  const { data: settings } = await supabaseClient.from("site_settings").select("kartu_peserta_url,kartu_pendamping_url,kartu_layout").eq("id", 1).single();
  const templateUrl = jenis === "peserta" ? (settings && settings.kartu_peserta_url) : (settings && settings.kartu_pendamping_url);
  if (!templateUrl) {
    alert("Upload template " + jenis + " dulu sebelum mencetak.");
    return;
  }
  const layout = (settings && settings.kartu_layout && settings.kartu_layout[jenis]) || DEFAULT_LAYOUT_KARTU[jenis];
  const fields = jenis === "peserta" ? FIELD_PESERTA : FIELD_PENDAMPING;

  let query = supabaseClient.from("pendaftaran").select("*");
  if (lombaFilter) query = query.eq("lomba_id", lombaFilter);
  const { data: rows, error } = await query;
  if (error) { alert("Gagal memuat data: " + error.message); return; }
  if (!rows || rows.length === 0) { alert("Tidak ada data pendaftar yang cocok."); return; }

  let daftarData;
  if (jenis === "peserta") {
    // "Lomba" dan "Jenjang" digabung jadi satu tulisan (field lomba_jenjang)
    // -- lihat FIELD_PESERTA di atas. r.jenjang bisa kosong untuk sebagian
    // baris tim (Futsal), jadi bagian itu cuma disisipkan kalau ada isinya.
    daftarData = rows.map(function (r) {
      const lombaJenjang = r.lomba_nama + (r.jenjang ? " · " + r.jenjang : "");
      return { nama: r.nama_lengkap, lomba_jenjang: lombaJenjang, qrText: "ALIF5-" + r.nomor_pendaftaran };
    });
  } else {
    const sudahAda = {};
    daftarData = [];
    rows.forEach(function (r) {
      const namaPj = r.pembina || r.penanggung_jawab_lembaga;
      if (!namaPj) return;
      const kunci = namaPj.trim().toLowerCase() + "|" + (r.asal_sekolah || "").trim().toLowerCase();
      if (sudahAda[kunci]) return;
      sudahAda[kunci] = true;
      daftarData.push({ nama: namaPj, lomba: r.lomba_nama + " · " + r.asal_sekolah, qrText: "ALIF5-" + r.nomor_pendaftaran + "-PJ" });
    });
    if (daftarData.length === 0) {
      alert("Tidak ada data penanggung jawab/pendamping pada data yang cocok (Futsal punya guru pendamping, pendaftaran Perwakilan Lembaga punya penanggung jawab).");
      return;
    }
  }

  statusEl.textContent = "Menyiapkan " + daftarData.length + " kartu, mohon tunggu...";

  let templateImg;
  try {
    templateImg = await muatGambar(templateUrl);
  } catch (e) {
    statusEl.textContent = "";
    alert("Gagal memuat gambar template kartu.");
    return;
  }

  const canvas = document.createElement("canvas");
  const { jsPDF } = window.jspdf;
  // Satuan "cm" dipakai langsung (bukan "px") supaya ukuran fisik kartu di
  // PDF-nya SELALU presisi 8,5 x 12 cm (ukuran cocard standar) begitu
  // dicetak, tidak tergantung resolusi/DPI gambar kanvas yang dihasilkan.
  const doc = new jsPDF({ unit: "cm", format: [KARTU_LEBAR_CM, KARTU_TINGGI_CM] });

  daftarData.forEach(function (data, i) {
    gambarKartu(canvas, templateImg, layout, data, fields);
    const imgData = canvas.toDataURL("image/png");
    if (i > 0) doc.addPage([KARTU_LEBAR_CM, KARTU_TINGGI_CM]);
    doc.addImage(imgData, "PNG", 0, 0, KARTU_LEBAR_CM, KARTU_TINGGI_CM);
  });

  doc.save("kartu-" + jenis + "-alif5.pdf");
  statusEl.textContent = "Selesai — " + daftarData.length + " kartu terunduh.";
}

async function loadTabKartu() {
  const content = document.getElementById("admin-content");
  content.innerHTML = '<p class="hint">Memuat...</p>';

  try {
    await pastikanLibKartu();
  } catch (e) {
    content.innerHTML = "<p>Gagal memuat pustaka QR/PDF — periksa koneksi internet, lalu buka tab ini lagi.</p>";
    return;
  }

  const { data: settings } = await supabaseClient.from("site_settings")
    .select("kartu_peserta_url,kartu_pendamping_url,kartu_layout").eq("id", 1).single();
  const layoutTersimpan = (settings && settings.kartu_layout) || {};

  const { data: rulesData } = await supabaseClient.from("lomba_rules").select("id,nama").order("urutan");
  const opsiLombaCetak = (rulesData || []).map(function (r) {
    return '<option value="' + r.id + '">' + r.nama + '</option>';
  }).join("");

  content.innerHTML =
    '<div class="form-shell" style="margin-bottom:20px;">' +
      '<h3>🪪 Kartu Peserta &amp; Pendamping</h3>' +
      '<p>Upload desain kartu (PNG), atur posisi nama/lomba+jenjang/QR lewat angka di bawah (pratinjau berubah langsung), lalu cetak kartu semua peserta sekaligus sebagai satu file PDF siap cetak. Ukuran cetaknya SELALU tetap ' + KARTU_LEBAR_CM + ' × ' + KARTU_TINGGI_CM + ' cm (ukuran cocard standar) — template PNG yang diupload otomatis disesuaikan supaya pas mengisi penuh, jadi sebaiknya didesain dengan rasio yang sama supaya tidak gepeng/melar. QR di tiap kartu berisi kode unik yang nanti dipakai untuk absen kedatangan & pemberian snack.</p>' +
    '</div>' +
    kartuEditorHTML("peserta", "Kartu Peserta", FIELD_PESERTA, settings && settings.kartu_peserta_url) +
    kartuEditorHTML("pendamping", "Kartu Pendamping / Penanggung Jawab", FIELD_PENDAMPING, settings && settings.kartu_pendamping_url) +
    '<div class="form-shell" style="margin-top:20px;max-width:520px;">' +
      '<h3>Cetak Kartu</h3>' +
      '<div class="field"><label>Cabang Lomba</label><select id="cetak-filter-lomba"><option value="">Semua Lomba</option>' + opsiLombaCetak + '</select></div>' +
      '<div style="display:flex;gap:10px;flex-wrap:wrap;">' +
        '<button type="button" class="btn btn--primary" id="btn-cetak-peserta">Unduh Kartu Peserta (PDF)</button>' +
        '<button type="button" class="btn btn--ghost" id="btn-cetak-pendamping">Unduh Kartu Pendamping (PDF)</button>' +
      '</div>' +
      '<p class="hint" id="cetak-status"></p>' +
    '</div>';

  setupKartuEditor("peserta", FIELD_PESERTA, settings && settings.kartu_peserta_url, layoutTersimpan.peserta);
  setupKartuEditor("pendamping", FIELD_PENDAMPING, settings && settings.kartu_pendamping_url, layoutTersimpan.pendamping);

  document.getElementById("btn-cetak-peserta").addEventListener("click", function () { cetakKartuPDF("peserta"); });
  document.getElementById("btn-cetak-pendamping").addEventListener("click", function () { cetakKartuPDF("pendamping"); });
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
  'Placeholder yang bisa dipakai (otomatis diganti saat dikirim): <code>{nama}</code>, <code>{nomor}</code>, <code>{lomba}</code>, <code>{status}</code>, <code>{grup}</code> (link grup WA di bawah — cuma terisi kalau statusnya "Diterima", kosong untuk status lain), <code>{anggota_usia}</code> (khusus lomba tim: nama anggota yang perlu verifikasi usia, dipisah koma — kosong untuk pendaftar individu), <code>{link_lengkapi}</code> (link khusus buat pendamping tim melengkapi nomor punggung — cuma terisi kalau statusnya "Perlu Tambah Nomor Punggung", kosong untuk status lain, butuh "URL Situs" di bawah sudah diisi), <code>{alasan}</code> (alasan penolakan yang dipilih panitia — cuma terisi kalau statusnya "Ditolak", kosong untuk status lain).';

async function loadTabNotifWa() {
  const content = document.getElementById("admin-content");
  content.innerHTML = '<p class="hint">Memuat pengaturan notifikasi WA...</p>';

  const { data: settingsData } = await supabaseClient
    .from("site_settings")
    .select("wa_notif_template, wa_template_per_status, link_grup_wa, site_url, alasan_penolakan_list")
    .eq("id", 1).single();

  const templateLama = (settingsData && settingsData.wa_notif_template) || "";
  const templatePerStatus = (settingsData && settingsData.wa_template_per_status) || {};
  const linkGrupDefault = (settingsData && settingsData.link_grup_wa) || "";
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
      '<h3>💬 Notifikasi WhatsApp (Fonnte)</h3>' +
      '<p>Pesan otomatis dikirim ke nomor WhatsApp pendaftar setiap kali status pendaftarannya dipilih jadi <strong>Diterima</strong>, <strong>Ditolak</strong>, <strong>Perlu Verifikasi Usia</strong>, atau <strong>Perlu Tambah Nomor Punggung</strong> di dropdown tab "Data Pendaftar" — berlaku untuk <strong>semua lomba</strong>, individu maupun tim. Sejak pembaruan ini, pesan tiap status bisa diedit terpisah di bawah.</p>' +
      kotakStatusHTML +
      '<div class="hint" style="margin-top:14px;">' + WA_PLACEHOLDER_HINT + '</div>' +
      '<div class="field" style="margin-top:22px;">' +
        '<label for="wa-link-grup">Link Grup WA</label>' +
        '<input type="text" id="wa-link-grup" value="' + escapeHTML(linkGrupDefault) + '" placeholder="https://chat.whatsapp.com/..." />' +
        '<div class="hint">Dikirim lewat placeholder <code>{grup}</code> di atas, tapi HANYA untuk pendaftar yang statusnya diubah jadi "Diterima" — pendaftar yang Ditolak (atau status lain) tidak pernah menerima link ini.</div>' +
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
      '<h3>⚙️ Setup Fonnte</h3>' +
      '<p class="hint">Notifikasi dikirim lewat layanan Fonnte. Pastikan token Fonnte sudah diisi sebagai secret Edge Function <code>FONNTE_TOKEN</code> lewat dashboard Supabase (Project Settings → Edge Functions → Secrets), dan Edge Function <code>kirim-notifikasi-wa</code> sudah di-deploy. Lihat README.md bagian "Setup Notifikasi WhatsApp (Fonnte)" untuk langkah lengkapnya.</p>' +
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
    const siteUrl = document.getElementById("wa-site-url").value.trim().replace(/\/+$/, "");

    btn.disabled = true;
    btn.textContent = "Menyimpan...";
    const { error } = await supabaseClient
      .from("site_settings")
      .update({ wa_template_per_status: templateBaruPerStatus, link_grup_wa: linkGrup || null, site_url: siteUrl || null })
      .eq("id", 1);
    btn.disabled = false;
    btn.textContent = "Simpan";

    if (error) {
      errEl.textContent = "Gagal menyimpan: " + error.message;
      errEl.style.display = "block";
      return;
    }
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
