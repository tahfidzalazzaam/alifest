// View: Panitia Bazar ("#/adminbazar" atau path "/adminbazar") — TERPISAH
// dari halaman Panitia lomba ("#/admin"), tapi login pakai AKUN YANG SAMA
// (Supabase Auth, role `authenticated`) -- lihat migrasi 0030. Dua tab:
// "Data Tenant" (lihat/verifikasi/hapus pendaftar stand) dan "Pengaturan
// Bazar" (buka/tutup, kuota, kategori stand, info biaya/rekening).

const ADMINBAZAR_TEMPLATE = `
<main class="admin-page container">
  <div id="adminbazar-root"></div>
</main>
`;

function escapeHTMLBazarAdmin(teks) {
  const div = document.createElement("div");
  div.textContent = String(teks == null ? "" : teks);
  return div.innerHTML;
}

// Migrasi 0043: status buka/tutup pendaftaran Bazar, disamakan PERSIS dengan
// pola satu-tombol di Panel Panitia Lomba (lihat `statusDibukaManual` di
// view-admin.js) -- hanya mengunci /daftar-bazar, TIDAK pernah menyembunyikan
// halaman info publik /bazar (yang kini selalu terbuka, lihat view-bazar.js).
let statusDibukaManualBazar = true; // bazar_settings.pendaftaran_dibuka

function perbaruiTombolToggleBazar() {
  const btnToggle = document.getElementById("btn-toggle-pendaftaran-bazar");
  if (!btnToggle) return;
  btnToggle.className = "btn " + (statusDibukaManualBazar ? "btn--primary" : "btn--ghost");
  btnToggle.textContent = statusDibukaManualBazar ? "🟢 Pendaftaran Dibuka" : "🔒 Pendaftaran Ditutup";
  btnToggle.title = statusDibukaManualBazar ? "Ketuk untuk menutup pendaftaran bazar" : "Ketuk untuk membuka pendaftaran bazar";
}

async function initAdminBazar() {
  const root = document.getElementById("adminbazar-root");
  root.innerHTML = '<p class="hint">Memeriksa sesi masuk...</p>';

  const { data } = await supabaseClient.auth.getSession();
  if (data && data.session) {
    renderDashboardBazar(root, data.session);
  } else {
    renderLoginBazar(root);
  }
}

/* ==================== LOGIN (akun sama dengan panitia lomba) ==================== */

function renderLoginBazar(root) {
  root.innerHTML =
    '<div class="form-shell admin-login">' +
      '<h1>Masuk Panitia Bazar</h1>' +
      '<p>Pakai akun panitia yang sama dengan halaman Panitia lomba. Belum punya akun? Minta dibuatkan oleh pengelola situs.</p>' +
      '<form id="form-login-bazar" novalidate>' +
        '<div class="field">' +
          '<label for="adminbazar-email">Email</label>' +
          '<input type="email" id="adminbazar-email" required />' +
        '</div>' +
        '<div class="field">' +
          '<label for="adminbazar-password">Kata Sandi</label>' +
          '<input type="password" id="adminbazar-password" required />' +
        '</div>' +
        '<div class="form-error" id="loginbazar-error" style="display:none;"></div>' +
        '<div class="submit-row">' +
          '<button type="submit" class="btn btn--primary" id="btn-login-bazar">Masuk</button>' +
        '</div>' +
      '</form>' +
    '</div>';

  const form = document.getElementById("form-login-bazar");
  const errorEl = document.getElementById("loginbazar-error");
  const btn = document.getElementById("btn-login-bazar");

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    errorEl.style.display = "none";
    btn.disabled = true;
    btn.textContent = "Memeriksa...";

    const email = document.getElementById("adminbazar-email").value.trim();
    const password = document.getElementById("adminbazar-password").value;
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email: email, password: password });

    btn.disabled = false;
    btn.textContent = "Masuk";

    if (error) {
      errorEl.textContent = "Gagal masuk: email atau kata sandi salah.";
      errorEl.style.display = "block";
      return;
    }
    renderDashboardBazar(root, data.session);
  });
}

/* ==================== DASHBOARD SHELL ==================== */

async function renderDashboardBazar(root, session) {
  const { data: settingsAwal } = await supabaseClient
    .from("bazar_settings")
    .select("pendaftaran_dibuka")
    .eq("id", 1)
    .maybeSingle();
  statusDibukaManualBazar = !settingsAwal || settingsAwal.pendaftaran_dibuka !== false;

  root.innerHTML =
    '<div class="admin-header">' +
      '<div><h1>Panel Panitia Bazar</h1><p>Masuk sebagai ' + session.user.email + '</p></div>' +
      '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">' +
        '<button type="button" id="btn-notif-realtime-bazar"></button>' +
        '<button type="button" id="btn-toggle-pendaftaran-bazar"></button>' +
        '<button type="button" class="btn btn--ghost" id="btn-logout-bazar">Keluar</button>' +
      '</div>' +
    '</div>' +
    '<div class="admin-tabs">' +
      '<button type="button" class="admin-tab is-active" data-tab="tenant">Data Tenant</button>' +
      '<button type="button" class="admin-tab" data-tab="denah">Denah Stand</button>' +
      '<button type="button" class="admin-tab" data-tab="pengaturan">Pengaturan Bazar</button>' +
      '<button type="button" class="admin-tab" data-tab="notifwa">Notifikasi WA</button>' +
    '</div>' +
    '<div id="adminbazar-content"></div>' +
    // ⚠️ PERBAIKAN: sebelumnya halaman ini TIDAK PUNYA elemen
    // `#modal-overlay`/`#modal-box` sama sekali -- padahal `bukaModal()`
    // (dipakai BERSAMA dari view-admin.js, satu scope global JS yang sama)
    // langsung memanggil `document.getElementById("modal-overlay").innerHTML
    // = ...` tanpa cek null. Akibatnya "🖼️ Buat Poster Rekap Stand" (yang
    // memanggil `bukaModal()` sebagai baris PERTAMA-nya) langsung melempar
    // error JS ("Cannot set properties of null") saat diklik -- SEBELUM
    // baris kode apa pun lain berjalan, jadi persis seperti "diklik tapi
    // tidak terjadi apa-apa". Markup di bawah ini SENGAJA disamakan PERSIS
    // dengan punya `/admin` (lihat `renderDashboard()` di view-admin.js)
    // supaya `bukaModal()`/`tutupModal()` jalan identik di kedua halaman.
    '<div class="modal-overlay" id="modal-overlay" style="display:none;">' +
      '<div class="modal-box" id="modal-box"></div>' +
    '</div>';

  const btnToggleBazar = document.getElementById("btn-toggle-pendaftaran-bazar");
  perbaruiTombolToggleBazar();
  btnToggleBazar.addEventListener("click", async function () {
    const aksi = statusDibukaManualBazar ? "menutup" : "membuka";
    if (!confirm('Yakin ingin ' + aksi + ' pendaftaran bazar? Perubahan langsung berlaku di situs publik.')) return;
    btnToggleBazar.disabled = true;
    const { error } = await supabaseClient.from("bazar_settings").update({ pendaftaran_dibuka: !statusDibukaManualBazar }).eq("id", 1);
    btnToggleBazar.disabled = false;
    if (error) { alert("Gagal mengubah status: " + error.message); return; }
    statusDibukaManualBazar = !statusDibukaManualBazar;
    perbaruiTombolToggleBazar();
  });

  document.getElementById("btn-logout-bazar").addEventListener("click", async function () {
    await supabaseClient.auth.signOut();
    renderLoginBazar(root);
  });

  // Notifikasi realtime tenant baru (migrasi 0051) -- lihat blok besar di
  // bawah file ini untuk detail lengkapnya.
  perbaruiTombolNotifikasiBazar();
  document.getElementById("btn-notif-realtime-bazar").addEventListener("click", aktifkanNotifikasiBazar);
  aktifkanRealtimePendaftarBaruBazar();

  const tabs = root.querySelectorAll(".admin-tab");
  tabs.forEach(function (tab) {
    tab.addEventListener("click", function () {
      tabs.forEach(function (t) { t.classList.remove("is-active"); });
      tab.classList.add("is-active");
      const nama = tab.getAttribute("data-tab");
      if (nama === "tenant") loadTabTenant();
      if (nama === "denah") loadTabDenahBazar();
      if (nama === "pengaturan") loadTabPengaturanBazar();
      if (nama === "notifwa") loadTabNotifWaBazar();
    });
  });

  loadTabTenant();
}

/* ==================== TAB 1: DATA TENANT ==================== */

// Ambil path relatif (di dalam bucket) dari URL publik Supabase Storage,
// supaya bisa dipakai storage.remove() -- sama persis pola ekstrakPathBerkas
// di view-admin.js, disalin di sini supaya file ini berdiri sendiri (tidak
// bergantung view-admin.js dimuat lebih dulu).
function ekstrakPathBerkasBazar(url) {
  const penanda = "/object/public/berkas-pendaftaran/";
  const idx = url.indexOf(penanda);
  if (idx === -1) return null;
  return decodeURIComponent(url.substring(idx + penanda.length));
}

async function loadTabTenant() {
  const content = document.getElementById("adminbazar-content");
  content.innerHTML = '<p class="hint">Memuat data tenant...</p>';

  const [{ data, error }, { data: standData }, { data: settingsPendapatan }] = await Promise.all([
    supabaseClient.from("bazar_tenant").select("*").order("created_at", { ascending: false }),
    supabaseClient.from("bazar_stand").select("kode,tenant_id").not("tenant_id", "is", null),
    supabaseClient.from("bazar_settings").select("jenis_stand_info").eq("id", 1).single()
  ]);
  if (error) {
    content.innerHTML = "<p>Gagal memuat data tenant: " + error.message + "</p>";
    return;
  }

  let rows = data || [];
  const jenisStandInfoPendapatan = (settingsPendapatan && settingsPendapatan.jenis_stand_info) || {};

  // Kode stand yang ditempati tiap tenant (migrasi 0037) -- satu tenant bisa
  // punya LEBIH DARI SATU kode kalau menyewa beberapa stand sekaligus,
  // dikumpulkan di sini supaya tabel di bawah tidak perlu query berulang.
  const kodeStandPerTenant = {};
  (standData || []).forEach(function (s) {
    if (!kodeStandPerTenant[s.tenant_id]) kodeStandPerTenant[s.tenant_id] = [];
    kodeStandPerTenant[s.tenant_id].push(s.kode);
  });

  content.innerHTML =
    '<div class="rekap-grid" id="bazar-rekap-grid"></div>' +
    '<div class="pendapatan-bazar-box" id="bazar-pendapatan-box"></div>' +
    '<div class="poster-rekap-toolbar" style="margin:4px 0 16px;display:flex;gap:10px;flex-wrap:wrap;">' +
      '<button type="button" class="btn btn--ghost" id="btn-buka-poster-rekap-bazar">🖼️ Buat Poster Rekap Stand</button>' +
      '<button type="button" class="btn btn--ghost" id="btn-unduh-xlsx-tenant">⬇️ Unduh Data Tenant (XLSX)</button>' +
    '</div>' +
    '<div class="admin-filters">' +
      '<input type="text" id="filter-cari-bazar" placeholder="Cari nama usaha / nomor pendaftaran..." />' +
    '</div>' +
    '<p class="hint" id="jumlah-hint-bazar"></p>' +
    '<div class="table-wrap"><table class="admin-table" id="tabel-tenant"><thead><tr>' +
      '<th>Nomor</th><th>Nama Usaha</th><th>Jenis Produk</th><th>Jenis/Lokasi Stand</th><th>PJ / WA</th><th>Berkas</th><th>Pembayaran</th><th>Status</th><th></th>' +
    '</tr></thead><tbody></tbody></table></div>';

  function renderRekapBazar() {
    const rekapEl = document.getElementById("bazar-rekap-grid");
    if (!rekapEl) return;
    // Pendaftaran yang ditandai "Milik Panitia" (migrasi 0050) DIKELUARKAN
    // dari kartu rekap jumlah di sini -- tetap tampil lengkap di tabel di
    // bawah (bisa diaudit/diedit seperti biasa), cuma tidak ikut dihitung
    // sebagai pendaftaran publik.
    const rowsRekap = rows.filter(function (r) { return !r.milik_panitia; });
    const lunas = rowsRekap.filter(function (r) { return r.status_pembayaran === "Lunas"; }).length;
    const diterima = rowsRekap.filter(function (r) { return r.status === "Diterima"; }).length;
    rekapEl.innerHTML =
      '<div class="rekap-card is-active" data-filter=""><div class="rekap-card__label">Semua Tenant</div><div class="rekap-card__total">' + rowsRekap.length + '</div></div>' +
      '<div class="rekap-card" data-filter="lunas"><div class="rekap-card__label">💰 Lunas</div><div class="rekap-card__total">' + lunas + '</div></div>' +
      '<div class="rekap-card" data-filter="diterima"><div class="rekap-card__label">✅ Diterima</div><div class="rekap-card__total">' + diterima + '</div></div>';
  }

  // -------- Rekap Total Pendapatan --------
  // "Pendapatan" (uang yang SUDAH diterima panitia) dihitung HANYA dari
  // tenant berstatus pembayaran "Lunas" -- tenant "Belum Lunas" belum
  // menyetor uangnya sama sekali, jadi tidak boleh ikut dihitung sebagai
  // pendapatan walau baris bazar_stand-nya sudah terisi/dikunci. Status
  // pendaftaran (Menunggu Verifikasi/Diterima/Ditolak) SENGAJA TIDAK ikut
  // jadi syarat di sini -- murni soal uangnya sudah masuk atau belum, bukan
  // soal pendaftarannya sudah diverifikasi atau belum (beda urusan dari
  // pengecualian status "Ditolak" di kartu rekap Lomba, lihat view-admin.js).
  //
  // Harga per stand = harga jenis itu (A/B/C, dari `bazar_settings.
  // jenis_stand_info`) -- satu tenant bisa menyewa LEBIH DARI SATU stand
  // sejenis (migrasi 0037), jadi totalnya per tenant = jumlah kode stand
  // miliknya × harga jenisnya, dijumlah ke subtotal per jenis + grand total.
  // "Potensi" (kolom kedua) = total KALAU SEMUA tenant yang sudah menempati
  // stand (lunas maupun belum) dianggap lunas -- buat panitia memperkirakan
  // sisa uang yang masih harus ditagih.
  function hitungPendapatanBazar() {
    const perJenis = { A: { jumlahLunas: 0, subtotalLunas: 0, jumlahPotensi: 0, subtotalPotensi: 0 },
                        B: { jumlahLunas: 0, subtotalLunas: 0, jumlahPotensi: 0, subtotalPotensi: 0 },
                        C: { jumlahLunas: 0, subtotalLunas: 0, jumlahPotensi: 0, subtotalPotensi: 0 } };
    let totalLunas = 0, totalPotensi = 0;

    rows.forEach(function (r) {
      if (r.milik_panitia) return; // pendaftaran milik panitia (migrasi 0050) tidak dihitung sebagai pendapatan/potensi
      const jenis = r.jenis_stand;
      if (!jenis || !perJenis[jenis]) return; // tenant lama (kategori_stand bebas, sebelum migrasi 0037) dilewati -- tidak punya jenis A/B/C baku
      const harga = Number((jenisStandInfoPendapatan[jenis] && jenisStandInfoPendapatan[jenis].harga) || 0);
      const jumlahStand = (kodeStandPerTenant[r.id] || []).length;
      if (jumlahStand === 0 || harga === 0) return;
      const subtotal = jumlahStand * harga;

      perJenis[jenis].jumlahPotensi += jumlahStand;
      perJenis[jenis].subtotalPotensi += subtotal;
      totalPotensi += subtotal;

      if (r.status_pembayaran === "Lunas") {
        perJenis[jenis].jumlahLunas += jumlahStand;
        perJenis[jenis].subtotalLunas += subtotal;
        totalLunas += subtotal;
      }
    });

    return { perJenis: perJenis, totalLunas: totalLunas, totalPotensi: totalPotensi };
  }

  function formatRupiahBazar(angka) {
    return "Rp" + Math.round(angka || 0).toLocaleString("id-ID");
  }

  function renderPendapatanBazar() {
    const box = document.getElementById("bazar-pendapatan-box");
    if (!box) return;
    const hasil = hitungPendapatanBazar();
    const URUTAN_JENIS_PENDAPATAN = ["A", "B", "C"];
    const sisaBelumLunas = hasil.totalPotensi - hasil.totalLunas;

    const barisJenisHTML = URUTAN_JENIS_PENDAPATAN
      .filter(function (j) { return jenisStandInfoPendapatan[j]; })
      .map(function (j) {
        const info = jenisStandInfoPendapatan[j] || {};
        const d = hasil.perJenis[j];
        return (
          '<div class="pendapatan-bazar-row">' +
            '<span class="pendapatan-bazar-row__label">Jenis ' + j + ' — ' + escapeHTMLBazarAdmin(info.nama || "") + '</span>' +
            '<span class="pendapatan-bazar-row__detail">' + d.jumlahLunas + ' stand lunas × ' + formatRupiahBazar(info.harga) + '</span>' +
            '<span class="pendapatan-bazar-row__subtotal">' + formatRupiahBazar(d.subtotalLunas) + '</span>' +
          '</div>'
        );
      }).join("");

    box.innerHTML =
      '<div class="pendapatan-bazar-head">' +
        '<div>' +
          '<div class="pendapatan-bazar-label">💵 Total Pendapatan (Lunas)</div>' +
          '<div class="pendapatan-bazar-total">' + formatRupiahBazar(hasil.totalLunas) + '</div>' +
        '</div>' +
        '<div class="pendapatan-bazar-sisa">' +
          '<div class="pendapatan-bazar-label">Potensi bila semua lunas</div>' +
          '<div class="pendapatan-bazar-total pendapatan-bazar-total--kecil">' + formatRupiahBazar(hasil.totalPotensi) + '</div>' +
          (sisaBelumLunas > 0 ? '<div class="hint">Masih ada ' + formatRupiahBazar(sisaBelumLunas) + ' yang belum lunas/disetor.</div>' : '') +
        '</div>' +
      '</div>' +
      '<div class="pendapatan-bazar-rincian">' + barisJenisHTML + '</div>';
  }

  // -------- Edit Pendaftar Stand (data + berkas) --------
  // SEBELUMNYA panitia cuma bisa mengubah status Pembayaran/status
  // pendaftaran lewat dropdown di tabel -- kalau ada typo nama
  // usaha/salah ketik WA, atau ADA BERKAS YANG PERLU DIGANTI (foto
  // buram, salah unggah, dll.), panitia tidak punya cara mengeditnya
  // sendiri, harus edit manual lewat Table Editor Supabase/minta
  // pendaftar daftar ulang. Tombol "Edit" ini membuka popup berisi
  // SEMUA field teks + SEMUA 5 berkas (Logo, Poster, Bukti IG #1/#2,
  // Bukti Bayar), masing-masing berkas bisa diganti SATU PER SATU lewat
  // kotak unggah -- dikosongkan berarti berkas lama tetap dipakai, tidak
  // wajib mengunggah ulang semuanya tiap kali edit.
  //
  // Jenis & lokasi stand (bazar_stand.tenant_id) SENGAJA TIDAK bisa
  // diubah lewat form ini -- mengubah itu butuh melepas kode stand lama
  // (kembalikan ke status kosong) & mengunci kode stand baru sekaligus,
  // plus mengecek stand barunya belum ditempati tenant lain; itu alur
  // tersendiri yang lebih cocok dikerjakan lewat SQL langsung oleh
  // panitia/pengembang untuk sekarang, supaya form edit ini tetap aman
  // dipakai tanpa risiko tenant lain kehilangan stand-nya karena
  // kekeliruan input.
  const BERKAS_SLOT_EDIT_BAZAR = [
    { kunci: "logo", label: "Logo Usaha", field: "url_foto_produk", indeks: 0 },
    { kunci: "poster", label: "Poster Promosi", field: "url_foto_produk", indeks: 1 },
    { kunci: "ig1", label: "Bukti Follow IG #1", field: "url_bukti_follow_ig", indeks: 0 },
    { kunci: "ig2", label: "Bukti Follow IG #2", field: "url_bukti_follow_ig", indeks: 1 },
    { kunci: "bukti_bayar", label: "Bukti Pembayaran", field: "url_bukti_bayar", indeks: null }
  ];

  function urlSlotEditBazar(row, slot) {
    if (slot.indeks === null) return row[slot.field] || null;
    const arr = Array.isArray(row[slot.field]) ? row[slot.field] : [];
    return arr[slot.indeks] || null;
  }

  // Unggah SATU berkas pengganti ke Storage (bucket & prefix "bazar/" SAMA
  // dengan punya form publik view-daftarbazar.js, supaya berkas lama/baru
  // tetap konsisten tempatnya) -- `upsert: true` aman dipakai di sini
  // (beda dari sebelum migrasi 0047, waktu itu Storage RLS cuma punya
  // policy INSERT, belum ada UPDATE/SELECT untuk bucket ini). Retry
  // ringan (3x) untuk jaga-jaga koneksi panitia sempat putus sebentar --
  // tidak sekompleks `uploadKeStorageBazar()` di view-daftarbazar.js
  // (yang sampai 6x percobaan + timeout 15 detik per percobaan, karena
  // itu untuk HP pendaftar di sinyal lapangan; di sini cukup untuk
  // koneksi panitia yang biasanya lebih stabil).
  async function unggahBerkasEditBazar(file, label) {
    const bagianNama = file.name.split(".");
    const ekstensiFile = bagianNama.length > 1 ? bagianNama.pop() : "bin";
    const path = "bazar/" + Date.now() + "-" + Math.random().toString(36).slice(2) + "-" + label + "." + ekstensiFile;
    const MAKS_PERCOBAAN_EDIT = 3;
    let error;
    for (let percobaan = 1; percobaan <= MAKS_PERCOBAAN_EDIT; percobaan++) {
      const hasil = await supabaseClient.storage.from(STORAGE_BUCKET).upload(path, file, { contentType: file.type, upsert: true });
      error = hasil.error;
      if (!error) {
        const { data } = supabaseClient.storage.from(STORAGE_BUCKET).getPublicUrl(path);
        return data.publicUrl;
      }
      if (percobaan < MAKS_PERCOBAAN_EDIT) await new Promise(function (r) { setTimeout(r, 1000 * percobaan); });
    }
    throw new Error("Gagal mengunggah " + label + ": " + (error && error.message));
  }

  function bukaModalEditTenantBazar(id) {
    const row = rows.find(function (r) { return r.id === id; });
    if (!row) return;

    function medanTeks(inputId, label, nilai) {
      return (
        '<div class="field">' +
          '<label for="' + inputId + '">' + label + '</label>' +
          '<input type="text" id="' + inputId + '" value="' + escapeHTMLBazarAdmin(nilai || "") + '" />' +
        '</div>'
      );
    }

    function medanBerkas(slot) {
      const urlSekarang = urlSlotEditBazar(row, slot);
      return (
        '<div class="field">' +
          '<label>' + slot.label + '</label>' +
          (urlSekarang
            ? '<div class="modal-berkas-row"><a class="modal-berkas-chip" href="' + urlSekarang + '" target="_blank" rel="noopener">📎 Lihat berkas saat ini</a></div>'
            : '<div class="hint" style="margin-bottom:6px;">Belum ada berkas.</div>') +
          '<input type="file" id="editbazar-file-' + slot.kunci + '" accept="image/*,.pdf" />' +
          '<div class="hint" id="editbazar-filename-' + slot.kunci + '">Kosongkan kalau tidak ingin mengganti berkas ini.</div>' +
        '</div>'
      );
    }

    const kodeList = kodeStandPerTenant[row.id] || [];

    const isiModal =
      '<p class="hint">Mengubah data pendaftar stand <strong>' + escapeHTMLBazarAdmin(row.nama_usaha) + '</strong> (' + row.nomor_pendaftaran + ').</p>' +
      medanTeks("editbazar-nama-usaha", "Nama Usaha", row.nama_usaha) +
      medanTeks("editbazar-jenis-produk", "Jenis Produk", row.jenis_produk) +
      medanTeks("editbazar-nama-pj", "Nama Penanggung Jawab", row.nama_penanggung_jawab) +
      medanTeks("editbazar-whatsapp", "No. WhatsApp", row.whatsapp) +
      '<div class="hint" style="margin:-6px 0 16px;">Jenis/Lokasi Stand: <strong>' + escapeHTMLBazarAdmin(row.jenis_stand || row.kategori_stand || "-") +
        (kodeList.length ? (" (" + kodeList.join(", ") + ")") : "") + '</strong> — tidak bisa diubah lewat form ini, hubungi pengembang kalau perlu dipindah stand.</div>' +
      '<div class="modal-section-title">Berkas</div>' +
      BERKAS_SLOT_EDIT_BAZAR.map(medanBerkas).join("") +
      '<div class="form-error" id="editbazar-error" style="display:none;"></div>' +
      '<div class="submit-row" style="display:flex;gap:10px;margin-top:4px;">' +
        '<button type="button" class="btn btn--primary" id="btn-simpan-edit-tenant">Simpan Perubahan</button>' +
      '</div>';

    bukaModal("✏️ Edit Pendaftar Stand", isiModal);

    BERKAS_SLOT_EDIT_BAZAR.forEach(function (slot) {
      const inputFile = document.getElementById("editbazar-file-" + slot.kunci);
      const hintEl = document.getElementById("editbazar-filename-" + slot.kunci);
      inputFile.addEventListener("change", function () {
        hintEl.textContent = inputFile.files[0]
          ? "Berkas baru dipilih: " + inputFile.files[0].name
          : "Kosongkan kalau tidak ingin mengganti berkas ini.";
      });
    });

    document.getElementById("btn-simpan-edit-tenant").addEventListener("click", async function () {
      const btn = this;
      const errEl = document.getElementById("editbazar-error");
      errEl.style.display = "none";

      const namaUsahaBaru = document.getElementById("editbazar-nama-usaha").value.trim();
      const jenisProdukBaru = document.getElementById("editbazar-jenis-produk").value.trim();
      const namaPjBaru = document.getElementById("editbazar-nama-pj").value.trim();
      const whatsappBaru = document.getElementById("editbazar-whatsapp").value.trim();

      if (!namaUsahaBaru || !jenisProdukBaru || !namaPjBaru || !whatsappBaru) {
        errEl.textContent = "Nama Usaha, Jenis Produk, Nama Penanggung Jawab, dan No. WhatsApp wajib diisi.";
        errEl.style.display = "block";
        return;
      }

      btn.disabled = true;
      btn.textContent = "Menyimpan...";

      try {
        // Unggah tiap berkas yang DIGANTI (kotak file-nya terisi) satu per
        // satu (bukan Promise.all -- jumlahnya cuma sampai 5 & jarang semua
        // diganti sekaligus, jadi bergantian lebih aman buat koneksi
        // panitia yang pas-pasan, sama alasannya dengan form publik).
        // URL LAMA tiap slot yang diganti disimpan dulu supaya bisa
        // dihapus dari Storage SETELAH update DB berhasil.
        const urlBaruPerSlot = {};
        const urlLamaDigantiPerSlot = {};
        for (const slot of BERKAS_SLOT_EDIT_BAZAR) {
          const inputFile = document.getElementById("editbazar-file-" + slot.kunci);
          const file = inputFile.files[0];
          if (!file) continue;
          const urlLama = urlSlotEditBazar(row, slot);
          const urlBaru = await unggahBerkasEditBazar(file, slot.kunci);
          urlBaruPerSlot[slot.kunci] = urlBaru;
          if (urlLama) urlLamaDigantiPerSlot[slot.kunci] = urlLama;
        }

        // Susun ulang array dari NILAI SEKARANG row, index yang diganti
        // ditimpa URL baru -- index yang TIDAK diganti tetap persis sama
        // (tidak menghapus berkas yang tidak disentuh panitia).
        const fotoBaru = Array.isArray(row.url_foto_produk) ? row.url_foto_produk.slice() : [];
        const igBaru = Array.isArray(row.url_bukti_follow_ig) ? row.url_bukti_follow_ig.slice() : [];
        if (urlBaruPerSlot.logo) fotoBaru[0] = urlBaruPerSlot.logo;
        if (urlBaruPerSlot.poster) fotoBaru[1] = urlBaruPerSlot.poster;
        if (urlBaruPerSlot.ig1) igBaru[0] = urlBaruPerSlot.ig1;
        if (urlBaruPerSlot.ig2) igBaru[1] = urlBaruPerSlot.ig2;
        const buktiBayarBaru = urlBaruPerSlot.bukti_bayar || row.url_bukti_bayar;

        const payload = {
          nama_usaha: namaUsahaBaru,
          jenis_produk: jenisProdukBaru,
          nama_penanggung_jawab: namaPjBaru,
          whatsapp: whatsappBaru,
          url_foto_produk: fotoBaru,
          url_bukti_follow_ig: igBaru,
          url_bukti_bayar: buktiBayarBaru
        };

        const { error } = await supabaseClient.from("bazar_tenant").update(payload).eq("id", id);
        if (error) throw error;

        // Data lokal & tabel di belakang modal disegarkan LANGSUNG (tanpa
        // reload tab) supaya perubahan langsung terlihat begitu modal
        // ditutup.
        Object.assign(row, payload);
        renderBarisBazar();

        // Hapus berkas LAMA yang sudah diganti dari Storage -- best-effort,
        // DIJALANKAN SETELAH update DB berhasil (bukan sebelum/bersamaan)
        // supaya kalau update DB-nya gagal, berkas lama yang masih
        // dipakai baris ini tidak ikut terhapus. Gagal hapus berkas lama
        // tidak membatalkan perubahan yang sudah tersimpan (cuma dicatat
        // di console), karena datanya sendiri sudah benar tersimpan.
        const pathLamaDiganti = Object.values(urlLamaDigantiPerSlot).map(ekstrakPathBerkasBazar).filter(Boolean);
        if (pathLamaDiganti.length > 0) {
          supabaseClient.storage.from("berkas-pendaftaran").remove(pathLamaDiganti).then(function (hasilHapus) {
            if (hasilHapus.error) console.error("Sebagian/semua berkas lama (yang baru saja diganti) gagal dihapus:", hasilHapus.error);
          });
        }

        tutupModal();
      } catch (err) {
        errEl.textContent = "Gagal menyimpan: " + ((err && err.message) || String(err));
        errEl.style.display = "block";
        btn.disabled = false;
        btn.textContent = "Simpan Perubahan";
      }
    });
  }

  let filterAktif = "";

  // Warna baris menyesuaikan status (lihat ".status-row--..." di
  // style.css) -- Bazar cuma punya 3 status (tidak ada "Perlu Verifikasi
  // Usia"/"Perlu Tambah Nomor Punggung" seperti Lomba), jadi tidak ada
  // kelompok "warn" di sini. Nama fungsi diberi akhiran "Bazar" supaya
  // tidak bentrok dengan versi Lomba di view-admin.js (satu scope global
  // JS yang sama, lihat Catatan Teknis README).
  function kelasBarisStatusBazar(status) {
    if (status === "Diterima") return "status-row--success";
    if (status === "Ditolak") return "status-row--danger";
    return "status-row--pending"; // "Menunggu Verifikasi"
  }

  function renderBarisBazar() {
    const cari = document.getElementById("filter-cari-bazar").value.toLowerCase();
    const tampil = rows.filter(function (r) {
      if (filterAktif === "lunas" && r.status_pembayaran !== "Lunas") return false;
      if (filterAktif === "diterima" && r.status !== "Diterima") return false;
      if (cari && r.nama_usaha.toLowerCase().indexOf(cari) === -1 &&
          r.nomor_pendaftaran.toLowerCase().indexOf(cari) === -1) return false;
      return true;
    });

    document.getElementById("jumlah-hint-bazar").textContent = "Menampilkan " + tampil.length + " dari " + rows.length + " tenant.";

    const tbody = document.querySelector("#tabel-tenant tbody");
    if (tampil.length === 0) {
      tbody.innerHTML = '<tr><td colspan="9">Tidak ada data yang cocok.</td></tr>';
      return;
    }

    tbody.innerHTML = tampil.map(function (r) {
      // BUG LAMA yang diperbaiki di sini: kolom "Berkas" cuma pernah
      // menampilkan `url_foto_produk` (Logo Usaha + Poster Promosi) dan
      // `url_bukti_bayar` -- `url_bukti_follow_ig` (migrasi 0042, array 2
      // URL) TIDAK PERNAH ikut ditampilkan sama sekali, walau datanya sudah
      // tersimpan benar di database. Sekarang SEMUA 5 berkas (Logo, Poster,
      // Bukti IG #1, Bukti IG #2, Bukti Bayar) ikut ditautkan di sini, label
      // masing-masing dibuat jelas (bukan generik "Foto #1/#2" lagi) sesuai
      // urutan index yang dipakai submit_bazar() (lihat migrasi 0042: index 0
      // url_foto_produk = Logo Usaha, index 1 = Poster Promosi).
      const fotoList = Array.isArray(r.url_foto_produk) ? r.url_foto_produk : [];
      const igList = Array.isArray(r.url_bukti_follow_ig) ? r.url_bukti_follow_ig : [];
      const labelBerkas = ["Logo", "Poster"];
      const labelIG = ["Bukti IG #1", "Bukti IG #2"];
      const berkasCell = [
        fotoList.map(function (u, i) { return u ? '<a href="' + u + '" target="_blank" rel="noopener">' + (labelBerkas[i] || ("Foto #" + (i + 1))) + '</a>' : ""; }).filter(Boolean).join(" · "),
        igList.map(function (u, i) { return u ? '<a href="' + u + '" target="_blank" rel="noopener">' + (labelIG[i] || ("Bukti IG #" + (i + 1))) + '</a>' : ""; }).filter(Boolean).join(" · "),
        r.url_bukti_bayar ? '<a href="' + r.url_bukti_bayar + '" target="_blank" rel="noopener">Bukti Bayar</a>' : ""
      ].filter(Boolean).join(" · ");

      const kodeList = kodeStandPerTenant[r.id] || [];
      return (
        '<tr class="' + kelasBarisStatusBazar(r.status) + '">' +
          '<td>' + r.nomor_pendaftaran + '</td>' +
          '<td class="col-truncate" title="' + escapeHTMLBazarAdmin(r.nama_usaha) + '">' + (r.milik_panitia ? '🏷️ ' : '') + escapeHTMLBazarAdmin(r.nama_usaha) + '</td>' +
          '<td class="col-truncate" title="' + escapeHTMLBazarAdmin(r.jenis_produk) + '">' + escapeHTMLBazarAdmin(r.jenis_produk) + '</td>' +
          '<td>' + escapeHTMLBazarAdmin(r.jenis_stand || r.kategori_stand || "-") + (kodeList.length ? ('<br/><span class="hint">' + kodeList.join(", ") + '</span>') : '') + '</td>' +
          '<td>' + escapeHTMLBazarAdmin(r.nama_penanggung_jawab) + '<br/>' + escapeHTMLBazarAdmin(r.whatsapp) + (r.wa_terkirim ? ' <span class="hint" title="Tombol Kirim WA sudah diklik untuk status saat ini">✅</span>' : '') + '</td>' +
          '<td>' + (berkasCell || "-") + '</td>' +
          '<td><select class="status-select" data-field="status_pembayaran" data-id="' + r.id + '">' +
            ["Belum Lunas", "Lunas"].map(function (s) {
              return '<option value="' + s + '"' + (s === r.status_pembayaran ? " selected" : "") + '>' + s + "</option>";
            }).join("") +
          '</select></td>' +
          '<td><select class="status-select" data-field="status" data-id="' + r.id + '">' +
            ["Menunggu Verifikasi", "Diterima", "Ditolak"].map(function (s) {
              return '<option value="' + s + '"' + (s === r.status ? " selected" : "") + '>' + s + "</option>";
            }).join("") +
          '</select><span class="wa-kirim-wrap-bazar" data-id="' + r.id + '"></span></td>' +
          '<td><button type="button" class="btn-link btn-edit-tenant" data-id="' + r.id + '">Edit</button> · ' +
            '<button type="button" class="btn-link btn-toggle-panitia-tenant" data-id="' + r.id + '">' + (r.milik_panitia ? "Batalkan Panitia" : "Tandai Panitia") + '</button> · ' +
            '<button type="button" class="btn-remove btn-hapus-tenant" data-id="' + r.id + '">Hapus</button></td>' +
        '</tr>'
      );
    }).join("");

    // Isi tombol "Kirim WA" (migrasi 0051) untuk SETIAP baris yang baru
    // dirender -- async, mengisi `.wa-kirim-wrap-bazar[data-id=...]` satu
    // per satu (lihat renderTombolWABazar() di bawah file ini).
    tampil.forEach(function (r) { renderTombolWABazar(r); });

    tbody.querySelectorAll(".status-select").forEach(function (sel) {
      sel.addEventListener("change", async function () {
        const id = sel.getAttribute("data-id");
        const field = sel.getAttribute("data-field");
        const nilaiBaru = sel.value;
        const payload = {};
        payload[field] = nilaiBaru;
        // Setiap kali status pendaftaran (bukan status pembayaran) berubah,
        // `wa_terkirim` direset ke false (migrasi 0051) -- supaya panitia
        // selalu diminta klik ulang "Kirim WA" untuk status yang baru,
        // persis seperti versi Lomba di view-admin.js.
        if (field === "status") payload.wa_terkirim = false;
        const { error } = await supabaseClient.from("bazar_tenant").update(payload).eq("id", id);
        if (error) {
          alert("Gagal mengubah " + field + ": " + error.message);
          return;
        }
        const row = rows.find(function (r) { return r.id === id; });
        if (row) {
          row[field] = nilaiBaru;
          if (field === "status") row.wa_terkirim = false;
        }
        renderRekapBazar();
        renderPendapatanBazar(); // status_pembayaran (atau status) berubah -- rekap pendapatan ikut disegarkan

        // Warna baris langsung diperbarui di tempat begitu status BERHASIL
        // tersimpan -- cuma untuk kolom status pendaftaran (bukan status
        // pembayaran, yang tidak punya pemetaan warna baris sendiri), sama
        // seperti versi Lomba di view-admin.js, supaya tidak perlu memuat
        // ulang tabel/halaman untuk melihat warnanya berubah.
        if (field === "status") {
          const trStatusBazar = sel.closest("tr");
          if (trStatusBazar) trStatusBazar.className = kelasBarisStatusBazar(nilaiBaru);

          // Notifikasi WA ke tenant TIDAK LAGI terkirim otomatis lewat
          // Fonnte (migrasi 0051) -- diganti tombol "Kirim WA" manual
          // (wa.me) yang dirangkai & disegarkan di sini, memakai template
          // yang sama dari `bazar_settings`.
          if (row) renderTombolWABazar(row);
        }
      });
    });

    tbody.querySelectorAll(".btn-edit-tenant").forEach(function (btn) {
      btn.addEventListener("click", function () {
        bukaModalEditTenantBazar(btn.getAttribute("data-id"));
      });
    });

    // Tandai/batalkan pendaftaran ini sebagai "Milik Panitia" (migrasi 0050,
    // menggantikan toggle yang SALAH TEMPAT di migrasi 0049 -- lihat komentar
    // panjang di migrasi itu). Dipakai untuk stand yang SUDAH terdaftar
    // tapi sebenarnya dipakai sendiri oleh panitia (bukan tenant luar),
    // supaya pendaftarannya TETAP tercatat lengkap di tabel ini tapi
    // dikeluarkan dari rekap/poster pendaftaran. Begitu disimpan, nilainya
    // disinkronkan juga ke SEMUA baris `bazar_stand` milik tenant ini --
    // itu yang membuat pengecualian rekap berbasis stand (poster, tab
    // "Denah Stand", halaman publik) ikut berlaku otomatis tanpa logika
    // terpisah.
    tbody.querySelectorAll(".btn-toggle-panitia-tenant").forEach(function (btn) {
      btn.addEventListener("click", async function () {
        const id = btn.getAttribute("data-id");
        const row = rows.find(function (r) { return r.id === id; });
        if (!row) return;
        const labelAwal = btn.textContent;
        const nilaiBaru = !row.milik_panitia;
        const kodeList = kodeStandPerTenant[id] || [];
        const konfirmasi = nilaiBaru
          ? ('Tandai pendaftaran "' + row.nama_usaha + '" (' + (kodeList.length ? kodeList.join(", ") : "tidak ada kode stand") + ') sebagai MILIK PANITIA? Datanya tetap ada di tabel ini, tapi akan dikeluarkan dari kartu rekap jumlah, Total Pendapatan, dan poster rekap pendaftaran.')
          : ('Batalkan tanda "Milik Panitia" pada pendaftaran "' + row.nama_usaha + '"? Pendaftaran ini akan ikut dihitung lagi di rekap/poster pendaftaran.');
        if (!confirm(konfirmasi)) return;

        btn.disabled = true;
        btn.textContent = "Menyimpan...";

        const { error: errTenant } = await supabaseClient.from("bazar_tenant").update({ milik_panitia: nilaiBaru }).eq("id", id);
        if (errTenant) {
          alert("Gagal menandai: " + errTenant.message);
          btn.disabled = false;
          btn.textContent = labelAwal;
          return;
        }

        // Sinkronkan ke bazar_stand -- best-effort: kalau ini gagal, data
        // tenant sudah tersimpan tapi rekap berbasis stand bisa belum
        // konsisten, jadi panitia diberi tahu secara eksplisit (bukan
        // dianggap gagal total, supaya tidak perlu mengulang dari awal).
        if (kodeList.length > 0) {
          const { error: errStand } = await supabaseClient.from("bazar_stand").update({ milik_panitia: nilaiBaru }).eq("tenant_id", id);
          if (errStand) {
            alert("Tanda panitia tersimpan di data tenant, tapi gagal disinkronkan ke stand terkait (" + kodeList.join(", ") + "): " + errStand.message + " -- rekap berbasis stand/poster mungkin belum konsisten, coba lagi.");
          }
        }

        row.milik_panitia = nilaiBaru;
        btn.disabled = false;
        renderBarisBazar();
        renderRekapBazar();
        renderPendapatanBazar();
      });
    });

    tbody.querySelectorAll(".btn-hapus-tenant").forEach(function (btn) {
      btn.addEventListener("click", async function () {
        const id = btn.getAttribute("data-id");
        const row = rows.find(function (r) { return r.id === id; });
        const label = row ? (row.nama_usaha + " (" + row.nomor_pendaftaran + ")") : "";
        if (!confirm('Hapus pendaftaran tenant "' + label + '"? Berkas yang sudah diunggah (logo, poster, bukti follow IG, bukti bayar) juga akan ikut terhapus permanen. Tindakan ini tidak bisa dibatalkan.')) return;

        btn.disabled = true;
        btn.textContent = "Menghapus...";

        if (row) {
          // BUG LAMA yang diperbaiki di sini juga: `url_bukti_follow_ig`
          // (migrasi 0042) TIDAK PERNAH ikut dihapus dari Storage saat
          // tenant dihapus -- cuma url_foto_produk & url_bukti_bayar yang
          // dibersihkan, jadi berkas bukti follow IG jadi "yatim" (tetap
          // ada di Storage walau tenantnya sudah tidak ada) setiap kali ada
          // tenant dihapus. Sekarang ikut dikumpulkan & dihapus juga.
          const fotoList = Array.isArray(row.url_foto_produk) ? row.url_foto_produk : [];
          const igList = Array.isArray(row.url_bukti_follow_ig) ? row.url_bukti_follow_ig : [];
          const pathBerkas = fotoList.concat(igList).concat([row.url_bukti_bayar])
            .filter(Boolean)
            .map(ekstrakPathBerkasBazar)
            .filter(Boolean);
          if (pathBerkas.length > 0) {
            const { error: errHapusBerkas } = await supabaseClient.storage.from("berkas-pendaftaran").remove(pathBerkas);
            if (errHapusBerkas) console.error("Sebagian/semua berkas gagal dihapus:", errHapusBerkas);
          }
        }

        const { error } = await supabaseClient.from("bazar_tenant").delete().eq("id", id);
        if (error) {
          alert("Gagal menghapus: " + error.message);
          btn.disabled = false;
          btn.textContent = "Hapus";
          return;
        }

        // Nomor pendaftaran tenant ini otomatis bebas dipakai ulang lewat
        // ambil_nomor_bazar_berikutnya() (migrasi 0030) -- tidak perlu
        // pencatatan manual apa pun di sini (lihat juga migrasi 0029 untuk
        // alasan kenapa pendekatan ini yang dipakai).
        rows = rows.filter(function (r) { return r.id !== id; });
        renderBarisBazar();
        renderRekapBazar();
        renderPendapatanBazar(); // tenant dihapus -- stand-nya (kalau lunas) ikut keluar dari hitungan pendapatan
      });
    });
  }

  renderRekapBazar();
  renderPendapatanBazar();
  renderBarisBazar();
  document.getElementById("filter-cari-bazar").addEventListener("input", renderBarisBazar);

  document.getElementById("btn-buka-poster-rekap-bazar").addEventListener("click", function () {
    bukaPosterRekapBazar(rows);
  });

  document.getElementById("btn-unduh-xlsx-tenant").addEventListener("click", function () {
    unduhXLSXTenant(this, rows, kodeStandPerTenant);
  });

  document.querySelectorAll("#bazar-rekap-grid .rekap-card").forEach(function (card) {
    card.addEventListener("click", function () {
      document.querySelectorAll("#bazar-rekap-grid .rekap-card").forEach(function (c) { c.classList.remove("is-active"); });
      card.classList.add("is-active");
      filterAktif = card.getAttribute("data-filter");
      renderBarisBazar();
    });
  });
}

/* -------- (TIDAK DIPAKAI LAGI sejak migrasi 0051, dibiarkan tanpa dihapus
   atas permintaan pengelola) Kirim notifikasi WA (Fonnte) ke TENANT, lewat
   Edge Function, dulu dipanggil otomatis saat status pendaftaran stand
   diubah jadi "Diterima" -- pola & nama fungsi sengaja disamakan dengan
   kirimNotifikasiWA() di view-admin.js (akhiran "Bazar" supaya tidak
   bentrok, satu scope global JS yang sama). Selektor `.wa-status-note-bazar`
   di bawah sudah tidak ada lagi di markup tabel (diganti
   `.wa-kirim-wrap-bazar`, lihat renderTombolWABazar()), jadi fungsi ini
   sekarang jadi no-op kalau entah bagaimana masih terpanggil. -------- */
async function kirimNotifikasiWABazar(id) {
  const noteEl = document.querySelector('.wa-status-note-bazar[data-note-for="' + id + '"]');
  if (noteEl) noteEl.textContent = " · mengirim WA...";
  try {
    const { data, error } = await supabaseClient.functions.invoke("kirim-notifikasi-wa-bazar", { body: { id: id } });
    if (error) throw error;
    if (data && data.success === false) throw new Error(data.message || "Gagal mengirim notifikasi WA.");
    if (noteEl) {
      noteEl.textContent = " · ✅ WA terkirim";
      setTimeout(function () { if (noteEl) noteEl.textContent = ""; }, 4000);
    }
  } catch (err) {
    console.error("Gagal mengirim notifikasi WA ke tenant:", err);
    if (noteEl) {
      noteEl.textContent = " · ⚠️ WA gagal terkirim";
      noteEl.title = (err && err.message) || String(err);
    }
  }
}

/* ==================== NOTIFIKASI WA TENANT via wa.me (migrasi 0051) ====================
   Menggantikan kirimNotifikasiWABazar() di atas -- bukan lagi dikirim
   otomatis dari server (Fonnte), tapi tombol "Kirim WA" manual yang
   membuka link `https://wa.me/<nomor>?text=<pesan>` di browser panitia
   sendiri. Pesannya direplikasi PERSIS dari Edge Function
   kirim-notifikasi-wa-bazar/index.ts (placeholder {usaha}/{nomor}/
   {penanggung_jawab}/{grup}), cuma HANYA untuk status "Diterima" (lebih
   sederhana dari versi Lomba yang punya 4 status notifiable) -- gaya
   penamaan fungsi (akhiran "Bazar") & pola sengaja disamakan dengan
   view-admin.js. */

// "08..." -> "628..." -- sama persis normalisasiNomorWA() di Edge Function.
function normalisasiNomorWABazar(nomor) {
  let bersih = String(nomor || "").replace(/[^0-9]/g, "");
  if (bersih.indexOf("0") === 0) bersih = "62" + bersih.slice(1);
  if (bersih.indexOf("8") === 0) bersih = "62" + bersih;
  return bersih;
}

function terapkanTemplateWABazar(template, data) {
  return String(template || "").replace(/\{(\w+)\}/g, function (m, key) {
    return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : m;
  });
}

function buatLinkWaMeBazar(nomor, pesan) {
  const tujuan = normalisasiNomorWABazar(nomor);
  if (!tujuan) return null;
  return "https://wa.me/" + tujuan + "?text=" + encodeURIComponent(pesan);
}

// Cache sederhana di level modul, sama pola dengan _cacheSiteSettingsWALomba
// -- dikosongkan lagi begitu panitia menyimpan template baru di tab
// "Notifikasi WA" (lihat loadTabNotifWaBazar), supaya tombol "Kirim WA"
// langsung memakai versi terbaru tanpa perlu memuat ulang halaman.
let _cacheBazarSettingsWABazar = null;
async function ambilBazarSettingsWABazar() {
  if (_cacheBazarSettingsWABazar) return _cacheBazarSettingsWABazar;
  const { data } = await supabaseClient
    .from("bazar_settings")
    .select("wa_template_diterima, link_grup_wa")
    .eq("id", 1).single();
  _cacheBazarSettingsWABazar = data || {};
  return _cacheBazarSettingsWABazar;
}

// Merangkai teks pesan WA untuk tenant `row` -- replikasi PERSIS template
// default & placeholder dari kirim-notifikasi-wa-bazar/index.ts.
async function bangunPesanWABazar(row) {
  const settings = await ambilBazarSettingsWABazar();
  const template = (settings && settings.wa_template_diterima) ||
    "Assalamu'alaikum {penanggung_jawab}, pendaftaran stand bazar Anda ({usaha}, nomor {nomor}) telah Diterima. Silakan bergabung ke grup WA: {grup}";
  return terapkanTemplateWABazar(template, {
    usaha: row.nama_usaha || "-",
    nomor: row.nomor_pendaftaran || "-",
    penanggung_jawab: row.nama_penanggung_jawab || "-",
    grup: (settings && settings.link_grup_wa) || ""
  });
}

// Mengisi `.wa-kirim-wrap-bazar[data-id=...]` (lihat renderBarisBazar()) --
// kosong kalau status tenant ini BUKAN "Diterima" (satu-satunya status
// notifiable untuk Bazar, beda dengan Lomba yang punya 4). Tombolnya SELALU
// bisa diklik ulang -- `wa_terkirim` cuma mengubah labelnya, sama seperti
// versi Lomba.
async function renderTombolWABazar(row) {
  const wrap = document.querySelector('.wa-kirim-wrap-bazar[data-id="' + row.id + '"]');
  if (!wrap) return;
  if (row.status !== "Diterima") { wrap.innerHTML = ""; return; }

  wrap.innerHTML = '<span class="hint">Menyiapkan tautan WA...</span>';
  let link;
  try {
    const pesan = await bangunPesanWABazar(row);
    link = buatLinkWaMeBazar(row.whatsapp, pesan);
  } catch (e) {
    wrap.innerHTML = '<span class="hint">⚠️ Gagal menyiapkan tautan WA.</span>';
    console.error("Gagal merangkai pesan WA bazar:", e);
    return;
  }
  if (!link) {
    wrap.innerHTML = '<span class="hint">⚠️ Nomor WhatsApp tidak valid, tidak bisa membuat tautan WA.</span>';
    return;
  }

  // Dicek ulang (bukan dianggap masih ada) karena fungsi ini ASYNC -- tabel
  // bisa saja sudah dirender ulang (filter/pencarian) selagi menunggu query
  // di atas, jadi `wrap` lama bisa sudah lepas dari DOM.
  const wrapTerkini = document.querySelector('.wa-kirim-wrap-bazar[data-id="' + row.id + '"]');
  if (!wrapTerkini) return;
  wrapTerkini.innerHTML =
    '<a href="' + link + '" target="_blank" rel="noopener" class="btn-link btn-kirim-wa-bazar" data-id="' + escapeHTMLBazarAdmin(row.id) + '">' +
      (row.wa_terkirim ? "✅ Kirim Ulang WA" : "📲 Kirim WA") +
    '</a>';

  wrapTerkini.querySelector(".btn-kirim-wa-bazar").addEventListener("click", async function () {
    // Link wa.me tetap dibuka APA ADANYA oleh browser (target="_blank") --
    // listener ini cuma menandai `wa_terkirim = true` SECARA PARALEL, tidak
    // pernah mem-preventDefault apa pun.
    if (row.wa_terkirim) return; // sudah ditandai sebelumnya, tidak perlu update lagi
    const { error } = await supabaseClient.from("bazar_tenant").update({ wa_terkirim: true }).eq("id", row.id);
    if (!error) {
      row.wa_terkirim = true;
      renderTombolWABazar(row);
    }
  });
}

/* ==================== NOTIFIKASI REALTIME TENANT BARU (migrasi 0051) ====================
   Sama persis polanya dengan aktifkanRealtimePendaftarBaruLomba() di
   view-admin.js (lihat komentar lengkap di sana) -- cuma berlangganan ke
   tabel `bazar_tenant`, bukan `pendaftaran`. Juga BUKAN notifikasi push ala
   PWA -- hanya aktif selama tab "/adminbazar" ini terbuka. */
let _realtimeChannelBazar = null;

function perbaruiTombolNotifikasiBazar() {
  const btn = document.getElementById("btn-notif-realtime-bazar");
  if (!btn) return;
  if (typeof Notification === "undefined") {
    btn.textContent = "🔕 Notifikasi tidak didukung browser ini";
    btn.className = "btn btn--ghost";
    btn.disabled = true;
    return;
  }
  if (Notification.permission === "granted") {
    btn.textContent = "🔔 Notifikasi Tenant Baru: Aktif";
    btn.className = "btn btn--ghost";
  } else if (Notification.permission === "denied") {
    btn.textContent = "🔕 Notifikasi diblokir (ubah di setelan situs browser)";
    btn.className = "btn btn--ghost";
  } else {
    btn.textContent = "🔔 Aktifkan Notifikasi Tenant Baru";
    btn.className = "btn btn--primary";
  }
}

async function aktifkanNotifikasiBazar() {
  if (typeof Notification === "undefined") return;
  if (Notification.permission === "default") {
    try { await Notification.requestPermission(); } catch (e) { /* abaikan, beberapa browser lama memakai API callback */ }
  }
  perbaruiTombolNotifikasiBazar();
}

function tampilkanBannerPendaftarBaruBazar(teks) {
  const lama = document.getElementById("banner-pendaftar-baru-bazar");
  if (lama) lama.remove();
  const banner = document.createElement("div");
  banner.id = "banner-pendaftar-baru-bazar";
  banner.className = "banner-pendaftar-baru";
  banner.innerHTML =
    '<span>🔔 ' + escapeHTMLBazarAdmin(teks) + '</span>' +
    '<span>' +
      '<button type="button" class="btn-link" id="btn-muat-ulang-banner-bazar">Muat Ulang</button> · ' +
      '<button type="button" class="btn-link" id="btn-tutup-banner-bazar">Tutup</button>' +
    '</span>';
  const content = document.getElementById("adminbazar-content");
  if (content && content.parentNode) content.parentNode.insertBefore(banner, content);
  document.getElementById("btn-tutup-banner-bazar").addEventListener("click", function () { banner.remove(); });
  document.getElementById("btn-muat-ulang-banner-bazar").addEventListener("click", function () {
    banner.remove();
    loadTabTenant();
  });
}

// Dipanggil SATU KALI per sesi dashboard terbuka (renderDashboardBazar) --
// cek `_realtimeChannelBazar` dulu supaya tidak dobel subscribe.
function aktifkanRealtimePendaftarBaruBazar() {
  if (_realtimeChannelBazar) return;
  _realtimeChannelBazar = supabaseClient
    .channel("realtime-pendaftar-baru-bazar")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "bazar_tenant" }, function (payload) {
      const r = payload.new || {};
      const teks = "Tenant baru: " + (r.nama_usaha || "-") + " (" + (r.nomor_pendaftaran || "-") + ")";
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        try { new Notification("ALIF 5.0 — Tenant Bazar Baru", { body: teks }); } catch (e) { console.warn("Gagal menampilkan notifikasi browser:", e); }
      }
      tampilkanBannerPendaftarBaruBazar(teks);
    })
    .subscribe();
}

/* -------- Unduh Data Tenant sebagai XLSX (murni client-side) --------
   Pola & pustaka SAMA dengan unduhXLSXPendaftar() di view-admin.js (SheetJS
   dimuat LAZY dari CDN, hanya saat tombol diklik) -- nama fungsi/variabel
   diberi akhiran "Bazar"/"Tenant" supaya tidak bentrok nama (satu scope
   global JS yang sama, lihat Catatan Teknis README). SATU sheet saja
   (tenant tidak punya sub-kelompok seperti jenjang/gender milik Lomba),
   SEMUA tenant yang sedang dimuat (tidak mengikuti filter kartu rekap/kotak
   cari, sama seperti versi Lomba -- selalu arsip utuh). */
let sheetJSPromiseBazar = null;
function muatSheetJSBazar() {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  if (sheetJSPromiseBazar) return sheetJSPromiseBazar;
  sheetJSPromiseBazar = new Promise(function (resolve, reject) {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";
    script.onload = function () { if (window.XLSX) resolve(window.XLSX); else reject(new Error("Pustaka XLSX gagal dimuat.")); };
    script.onerror = function () { reject(new Error("Gagal memuat pustaka XLSX dari CDN.")); };
    document.head.appendChild(script);
  });
  return sheetJSPromiseBazar;
}

const HEADER_TENANT_XLSX = [
  "Nomor Pendaftaran", "Nama Usaha", "Jenis Produk", "Jenis Stand", "Kode Stand",
  "Nama Penanggung Jawab", "No. WhatsApp", "Link Foto Produk", "Link Bukti Follow IG",
  "Link Bukti Bayar", "Status Pembayaran", "Status"
];

async function unduhXLSXTenant(btn, rows, kodeStandPerTenant) {
  const labelAsli = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Menyiapkan...";
  try {
    const XLSX = await muatSheetJSBazar();
    const barisTenant = rows.map(function (r) {
      return {
        "Nomor Pendaftaran": r.nomor_pendaftaran,
        "Nama Usaha": r.nama_usaha,
        "Jenis Produk": r.jenis_produk,
        "Jenis Stand": r.jenis_stand || r.kategori_stand || "",
        "Kode Stand": (kodeStandPerTenant[r.id] || []).join(", "),
        "Nama Penanggung Jawab": r.nama_penanggung_jawab,
        "No. WhatsApp": r.whatsapp,
        "Link Foto Produk": Array.isArray(r.url_foto_produk) ? r.url_foto_produk.join(", ") : (r.url_foto_produk || ""),
        "Link Bukti Follow IG": Array.isArray(r.url_bukti_follow_ig) ? r.url_bukti_follow_ig.join(", ") : (r.url_bukti_follow_ig || ""),
        "Link Bukti Bayar": r.url_bukti_bayar || "",
        "Status Pembayaran": r.status_pembayaran,
        "Status": r.status
      };
    });
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(barisTenant, { header: HEADER_TENANT_XLSX });
    XLSX.utils.book_append_sheet(wb, ws, "Data Tenant");
    XLSX.writeFile(wb, "data-tenant-bazar-alif5-" + new Date().toISOString().slice(0, 10) + ".xlsx");
  } catch (err) {
    alert("Gagal membuat file XLSX: " + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = labelAsli;
  }
}

/* ==================== TAB BARU: DENAH STAND (migrasi 0037 + 0038) ==================== */
// Dua sub-tampilan, dipilih lewat tombol kecil di atas:
//   "📋 Tampilan Daftar" -- grid/list per area (seperti sebelum migrasi 0038),
//                           dengan tombol "Kosongkan" untuk membebaskan stand
//                           secara manual (mis. kalau ada kekeliruan input) --
//                           normalnya stand dibebaskan OTOMATIS lewat trigger
//                           database begitu status tenant diubah jadi
//                           "Ditolak" (migrasi 0037), tombol ini jalan pintas
//                           manual untuk kasus di luar itu.
//   "🖼️ Edit Denah Visual" -- editor drag & drop ala Canva (migrasi 0038):
//                           tiap kotak stand & tiap label bangunan/area bisa
//                           digeser/diubah ukuran langsung di kanvas, lalu
//                           disimpan lewat tombol "Simpan Tata Letak".
const DENAH_CANVAS_W = 760;
const DENAH_CANVAS_H = 600;
const WARNA_JENIS_DENAH = { A: "#e08a2e", B: "#3f7fb0", C: "#d1588f" };

// Dipegang di scope modul (bukan di dalam loadTabDenahBazar) supaya listener
// "resize" window dari render sebelumnya selalu bisa dicopot sebelum render
// berikutnya menambah yang baru -- mencegah listener menumpuk tiap kali tab
// "Denah Stand" dibuka berulang kali (window tidak ikut hilang/dibuang
// seperti elemen DOM lain saat `content.innerHTML` diganti).
let _denahResizeHandler = null;

async function loadTabDenahBazar() {
  const content = document.getElementById("adminbazar-content");
  content.innerHTML = '<p class="hint">Memuat denah stand...</p>';

  if (_denahResizeHandler) {
    window.removeEventListener("resize", _denahResizeHandler);
    _denahResizeHandler = null;
  }

  const [{ data: standData, error }, { data: tenantData }, { data: elemenData, error: errorElemen }, { data: settingsData }] = await Promise.all([
    supabaseClient.from("bazar_stand").select("id,jenis,area,nomor,kode,tenant_id,milik_panitia,pos_x,pos_y,lebar,tinggi,rotasi").order("jenis").order("area").order("nomor"),
    supabaseClient.from("bazar_tenant").select("id,nama_usaha,nomor_pendaftaran,status"),
    supabaseClient.from("bazar_denah_elemen").select("*").order("urutan"),
    supabaseClient.from("bazar_settings").select("denah_background_url").eq("id", 1).single()
  ]);
  // Foto latar kanvas denah (opsional, migrasi 0044) -- `let` karena bisa
  // diganti/dihapus panitia lewat tombol di renderVisual() di bawah, lalu
  // dipakai ulang begitu renderVisual() dipanggil lagi (ganti sub-tab, atau
  // setelah upload baru).
  let denahBgUrl = settingsData ? settingsData.denah_background_url : null;
  if (error) {
    content.innerHTML = "<p>Gagal memuat denah stand: " + error.message + "</p>";
    return;
  }
  if (errorElemen) {
    content.innerHTML = "<p>Gagal memuat label denah: " + errorElemen.message + "</p>";
    return;
  }

  const standList = standData || [];
  let elemenList = elemenData || [];
  const tenantById = {};
  (tenantData || []).forEach(function (t) { tenantById[t.id] = t; });

  // Stand "milik panitia" (migrasi 0049) DIKELUARKAN dari total/terisi di
  // sini -- bukan bagian pendaftaran publik, lihat komentar panjang di
  // migrasi 0049 & di hitungRekapUntukPosterBazar().
  const standListPendaftaran = standList.filter(function (s) { return !s.milik_panitia; });
  const jumlahPanitia = standList.length - standListPendaftaran.length;
  const totalTerisi = standListPendaftaran.filter(function (s) { return !!s.tenant_id; }).length;

  content.innerHTML =
    '<div class="admin-tabs" style="margin-bottom:16px;">' +
      '<button type="button" class="admin-tab is-active" data-subtab="daftar" style="font-size:14px;">📋 Tampilan Daftar</button>' +
      '<button type="button" class="admin-tab" data-subtab="visual" style="font-size:14px;">🖼️ Edit Denah Visual</button>' +
    '</div>' +
    '<p class="hint">' + totalTerisi + ' dari ' + standListPendaftaran.length + ' stand terisi. Stand otomatis dibebaskan lagi begitu status tenant penyewanya diubah jadi "Ditolak".' +
      (jumlahPanitia > 0 ? (' (' + jumlahPanitia + ' stand lain ditandai "Milik Panitia", tidak dihitung di sini.)') : '') +
    '</p>' +
    '<div id="denah-bazar-subcontent"></div>';

  const subEl = document.getElementById("denah-bazar-subcontent");

  /* -------- Sub-tampilan 1: Daftar/grid (sama seperti sebelum migrasi 0038) -------- */
  function renderDaftar() {
    const jenisUrut = [];
    standList.forEach(function (s) { if (jenisUrut.indexOf(s.jenis) === -1) jenisUrut.push(s.jenis); });

    subEl.innerHTML = '<div id="denah-bazar-groups"></div>';
    const groupsEl = document.getElementById("denah-bazar-groups");

    function render() {
      groupsEl.innerHTML = jenisUrut.map(function (jenis) {
        const standJenis = standList.filter(function (s) { return s.jenis === jenis; });
        const areaUrut = [];
        standJenis.forEach(function (s) { if (areaUrut.indexOf(s.area) === -1) areaUrut.push(s.area); });

        const areaHTML = areaUrut.map(function (area) {
          const standArea = standJenis.filter(function (s) { return s.area === area; });
          // Stand "milik panitia" dikeluarkan dari hitungan sisa/total area
          // ini (bukan bagian pool pendaftaran publik) -- lihat migrasi 0049.
          const standAreaPendaftaran = standArea.filter(function (s) { return !s.milik_panitia; });
          const sisa = standAreaPendaftaran.filter(function (s) { return !s.tenant_id; }).length;
          return (
            '<div style="margin-bottom:14px;">' +
              '<p class="hint" style="margin:0 0 6px;font-weight:700;color:#1C2541;">' + escapeHTMLBazarAdmin(area) + ' <span style="font-weight:400;">(sisa ' + sisa + '/' + standAreaPendaftaran.length + ')</span></p>' +
              '<div style="display:flex;flex-wrap:wrap;gap:8px;">' +
                standArea.map(function (s) {
                  const tenant = s.tenant_id ? tenantById[s.tenant_id] : null;
                  const terisi = !!s.tenant_id;
                  // Sejak migrasi 0050, `milik_panitia` di SINI murni dibaca
                  // sebagai LABEL (disinkronkan otomatis dari tanda di tab
                  // "Data Tenant" begitu tenant penyewa stand ini ditandai
                  // panitia) -- TIDAK ADA tombol toggle di kartu ini lagi,
                  // supaya cuma satu tempat (Data Tenant) yang bisa
                  // menandai/membatalkannya, mencegah dua kontrol berbeda
                  // yang bisa saling tidak sinkron.
                  const panitia = !!s.milik_panitia;
                  return (
                    '<div style="padding:8px 12px;border:1.5px solid ' + (terisi ? "#FBD9DA" : "#F6E3A8") + ';border-radius:8px;background:' + (terisi ? "#FDF3F3" : "#FFFFFF") + ';font-size:13px;min-width:120px;">' +
                      '<div style="font-weight:700;color:#1C2541;">' + escapeHTMLBazarAdmin(s.kode) + '</div>' +
                      (terisi
                        ? ((panitia ? '<div class="hint" style="margin:2px 0;color:#6b5f3e;">🏷️ Panitia</div>' : '') +
                           '<div class="hint" style="margin:2px 0;">' + escapeHTMLBazarAdmin(tenant ? tenant.nama_usaha : "-") + '</div>' +
                           '<button type="button" class="btn-kosongkan-stand" data-id="' + s.id + '" style="font-size:12px;padding:4px 8px;margin-top:4px;">Kosongkan</button>')
                        : '<div class="hint" style="margin:2px 0;color:#1E7A4C;">Tersedia</div>') +
                    '</div>'
                  );
                }).join("") +
              '</div>' +
            '</div>'
          );
        }).join("");

        return (
          '<div class="form-shell" style="margin-bottom:20px;">' +
            '<h3>Jenis ' + escapeHTMLBazarAdmin(jenis) + '</h3>' +
            areaHTML +
          '</div>'
        );
      }).join("");

      groupsEl.querySelectorAll(".btn-kosongkan-stand").forEach(function (btn) {
        btn.addEventListener("click", async function () {
          const id = btn.getAttribute("data-id");
          const stand = standList.find(function (s) { return s.id === id; });
          if (!stand) return;
          if (!confirm('Bebaskan stand "' + stand.kode + '" ini? Tenant yang sebelumnya menempatinya TIDAK ikut terhapus/berubah statusnya -- cuma lokasinya yang dibebaskan supaya bisa dipesan pendaftar lain.')) return;

          btn.disabled = true;
          btn.textContent = "Membebaskan...";
          // `milik_panitia` ikut direset ke false di sini juga -- kalau
          // tidak, stand yang dibebaskan dari tenant panitia akan nyangkut
          // berstatus "milik panitia" padahal sudah tidak ada tenant-nya
          // sama sekali (lihat migrasi 0050: nilainya disinkronkan dari
          // tenant, jadi begitu keterkaitannya dilepas, tandanya ikut lepas).
          const { error: errLepas } = await supabaseClient.from("bazar_stand").update({ tenant_id: null, milik_panitia: false }).eq("id", id);
          if (errLepas) {
            alert("Gagal membebaskan stand: " + errLepas.message);
            btn.disabled = false;
            btn.textContent = "Kosongkan";
            return;
          }
          stand.tenant_id = null;
          stand.milik_panitia = false;
          render();
        });
      });

    }

    render();
  }

  /* -------- Sub-tampilan 2: Editor visual drag & drop ala Canva (migrasi 0038) -------- */
  function renderVisual() {
    let scale = 1;
    // Perubahan yang BELUM disimpan ke server -- dikumpulkan dulu di memori
    // (bukan langsung `update` tiap kali kotak digeser, supaya tidak membuat
    // satu request tiap piksel gerakan mouse) -- baru benar-benar ditulis ke
    // database saat tombol "Simpan Tata Letak" diklik.
    let perubahan = { stand: {}, elemen: {} };

    // -------- Seleksi berganda ala Canva --------
    // `selectedIds`: id-id kotak (stand ATAU label) yang sedang terpilih.
    // Diisi lewat shift+klik (tambah/lepas satu-satu) atau dengan men-drag
    // persegi seleksi ("marquee") di area kanvas yang kosong. Kalau isinya
    // lebih dari satu, men-drag salah satu kotak yang terpilih memindahkan
    // SEMUA kotak terpilih sekaligus, dan muncul kotak garis putus-putus
    // (`#denah-group-overlay`) membungkus semuanya dengan SATU handle resize
    // di pojok kanan-bawahnya untuk membesarkan/mengecilkan semuanya
    // sekaligus secara proporsional.
    // `kotakElMap`: id -> elemen `<div>` kotaknya di DOM saat ini -- dipakai
    // membaca posisi/ukuran TERKINI (termasuk yang belum disimpan) tanpa
    // perlu query ulang ke `standList`/`elemenList` yang bisa sudah basi.
    let selectedIds = new Set();
    let kotakElMap = {};

    subEl.innerHTML =
      '<p class="hint">Geser kotak untuk memindahkan lokasinya, tarik pojok kanan-bawah kotak untuk membesarkan/mengecilkan ukurannya, atau tarik BULATAN KECIL di atas kotak untuk memutar/memiringkannya (berlaku untuk kotak STAND maupun LABEL). Tahan <b>Shift</b> sambil klik untuk memilih BEBERAPA kotak sekaligus (atau tarik persegi di area kanvas yang kosong) -- kotak yang terpilih bisa digeser/dibesarkan-kecilkan BERSAMAAN. Kode stand sendiri tetap tidak bisa diubah teksnya di sini -- klik sebuah LABEL bangunan/area (bukan menariknya, dan tanpa Shift) untuk mengedit teks, emoji, warna, atau menghapusnya.</p>' +
      '<div class="submit-row" style="margin-bottom:10px;flex-wrap:wrap;gap:8px;">' +
        '<button type="button" class="btn btn--primary" id="btn-simpan-denah-visual">💾 Simpan Tata Letak</button>' +
        '<button type="button" class="btn btn--ghost" id="btn-tambah-label-denah">➕ Tambah Kotak/Label</button>' +
        '<button type="button" class="btn btn--ghost" id="btn-ganti-bg-denah">🖼️ ' + (denahBgUrl ? "Ganti" : "Pasang") + ' Background</button>' +
        (denahBgUrl ? '<button type="button" class="btn btn--ghost" id="btn-hapus-bg-denah">Hapus Background</button>' : "") +
        '<input type="file" id="input-bg-denah" accept="image/*" style="display:none;">' +
        '<span class="hint" id="denah-visual-status" style="margin-left:6px;"></span>' +
      '</div>' +
      // `#denah-visual-pad` membungkus kanvas dengan jarak kosong di semua
      // sisi (40px) -- supaya handle rotasi (mengambang di ATAS tiap kotak)
      // & handle resize (di pojok kanan-bawah) milik kotak yang posisinya
      // pas di pinggir kanvas TETAP punya tempat terlihat/bisa diklik,
      // tidak terpotong kanvas atau tertutup tombol-tombol di atasnya.
      // `#denah-visual-outer` SENGAJA `overflow:visible` (beda dari
      // sebelumnya yang `hidden`) dengan alasan yang sama -- konsekuensinya,
      // kotak yang digeser/diresize sampai sedikit melewati tepi kanvas akan
      // terlihat "bocor" keluar garis putus-putus, itu sengaja dibiarkan
      // (murni kosmetik) demi handle-nya tetap bisa dipakai.
      '<div id="denah-visual-pad" style="padding:40px 20px 20px 20px;">' +
        '<div id="denah-visual-outer" style="width:100%;max-width:900px;overflow:visible;position:relative;border:2px dashed #b9d9c2;border-radius:16px;' + (denahBgUrl ? ("background:center/cover no-repeat url('" + denahBgUrl + "'), #eef7ec;") : "background:#eef7ec;") + '">' +
          '<div id="denah-visual-inner" style="position:relative;width:' + DENAH_CANVAS_W + 'px;height:' + DENAH_CANVAS_H + 'px;transform-origin:top left;"></div>' +
        '</div>' +
      '</div>' +
      '<div id="denah-visual-panel"></div>';

    const outerEl = document.getElementById("denah-visual-outer");
    const innerEl = document.getElementById("denah-visual-inner");
    const statusEl = document.getElementById("denah-visual-status");
    const panelEl = document.getElementById("denah-visual-panel");

    function terapkanSkala() {
      if (!outerEl.clientWidth) return;
      scale = outerEl.clientWidth / DENAH_CANVAS_W;
      innerEl.style.transform = "scale(" + scale + ")";
      outerEl.style.height = (DENAH_CANVAS_H * scale) + "px";
    }

    function tandaiBerubah() {
      statusEl.textContent = "Ada perubahan belum disimpan.";
      statusEl.style.color = "#b45309";
    }

    // Baca posisi/ukuran TERKINI sebuah kotak langsung dari DOM-nya (bukan
    // dari `standList`/`elemenList` yang bisa sudah basi kalau kotak itu
    // baru saja digeser/diresize tapi belum disimpan).
    function rectVirtual(id) {
      const el = kotakElMap[id];
      if (!el) return null;
      return {
        x: parseFloat(el.style.left), y: parseFloat(el.style.top),
        w: parseFloat(el.style.width), h: parseFloat(el.style.height)
      };
    }

    function duaKotakBertumpuk(a, b) {
      return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    }

    // Tambah/lepas outline biru di kotak yang id-nya ada di `selectedIds` --
    // dipanggil tiap kali seleksi berubah ATAU tiap kali `gambarSemua()`
    // membangun ulang seluruh kotak dari awal (supaya seleksi tidak hilang
    // begitu saja setelah menambah/menghapus label, mis.).
    function terapkanSeleksiVisual() {
      Object.keys(kotakElMap).forEach(function (id) {
        const el = kotakElMap[id];
        el.style.outline = selectedIds.has(id) ? "2.5px solid #2b6cff" : "none";
        el.style.outlineOffset = selectedIds.has(id) ? "2px" : "0";
      });
    }

    // Kotak pembungkus garis putus-putus biru di sekeliling SEMUA kotak yang
    // terpilih (muncul hanya kalau terpilih lebih dari satu) -- punya SATU
    // handle resize di pojok kanan-bawahnya untuk membesarkan/mengecilkan
    // semua kotak terpilih sekaligus secara proporsional. `pointer-events`
    // kotak pembungkus ini sendiri SENGAJA `none` (supaya klik/drag ke kotak
    // di baliknya tetap tembus ke kotak itu seperti biasa), kecuali pada
    // handle resize-nya yang `auto`.
    let overlayGrupEl = null;
    let handleGrupEl = null;

    function pastikanOverlayGrup() {
      if (overlayGrupEl) return;
      overlayGrupEl = document.createElement("div");
      overlayGrupEl.style.position = "absolute";
      overlayGrupEl.style.border = "2px dashed #2b6cff";
      overlayGrupEl.style.borderRadius = "4px";
      overlayGrupEl.style.pointerEvents = "none";
      overlayGrupEl.style.zIndex = "40";

      handleGrupEl = document.createElement("div");
      handleGrupEl.style.position = "absolute";
      handleGrupEl.style.right = "-8px";
      handleGrupEl.style.bottom = "-8px";
      handleGrupEl.style.width = "16px";
      handleGrupEl.style.height = "16px";
      handleGrupEl.style.background = "#2b6cff";
      handleGrupEl.style.border = "2px solid #fff";
      handleGrupEl.style.borderRadius = "4px";
      handleGrupEl.style.cursor = "nwse-resize";
      handleGrupEl.style.touchAction = "none";
      handleGrupEl.style.pointerEvents = "auto";
      overlayGrupEl.appendChild(handleGrupEl);

      let resizingGrup = false, startX = 0, startY = 0;
      let kotakAwal = {}; // id -> {x,y,w,h} di awal drag
      let boundAwal = null; // {x,y,w,h} kotak pembungkus di awal drag

      handleGrupEl.addEventListener("pointerdown", function (e) {
        e.preventDefault();
        e.stopPropagation();
        resizingGrup = true;
        handleGrupEl.setPointerCapture(e.pointerId);
        startX = e.clientX; startY = e.clientY;
        boundAwal = hitungBoundingBoxTerpilih();
        kotakAwal = {};
        selectedIds.forEach(function (id) { kotakAwal[id] = rectVirtual(id); });
      });
      handleGrupEl.addEventListener("pointermove", function (e) {
        if (!resizingGrup || !boundAwal) return;
        const dx = (e.clientX - startX) / scale;
        const dy = (e.clientY - startY) / scale;
        const bw = Math.max(40, boundAwal.w + dx);
        const bh = Math.max(30, boundAwal.h + dy);
        const skalaX = bw / boundAwal.w;
        const skalaY = bh / boundAwal.h;
        // Stand yang ikut diseleksi tetap PERSEGI walau di-resize BARENGAN
        // lewat handle grup ini -- pakai skala seragam (terkecil dari
        // skalaX/skalaY) khusus untuk id stand, sisanya (label) tetap pakai
        // skala per-sumbu seperti biasa.
        const skalaSeragam = Math.min(skalaX, skalaY);

        selectedIds.forEach(function (id) {
          const r = kotakAwal[id];
          const el = kotakElMap[id];
          if (!r || !el) return;
          const stand = standList.some(function (s) { return s.id === id; });
          const sx = stand ? skalaSeragam : skalaX;
          const sy = stand ? skalaSeragam : skalaY;
          const baruX = boundAwal.x + (r.x - boundAwal.x) * sx;
          const baruY = boundAwal.y + (r.y - boundAwal.y) * sy;
          const baruW = Math.max(20, r.w * sx);
          const baruH = Math.max(16, r.h * sy);
          el.style.left = baruX + "px";
          el.style.top = baruY + "px";
          el.style.width = baruW + "px";
          el.style.height = baruH + "px";
          const isiEl = el.firstElementChild;
          if (isiEl) isiEl.style.fontSize = skalaFontKotak(baruW, baruH) + "px";
        });

        overlayGrupEl.style.left = boundAwal.x + "px";
        overlayGrupEl.style.top = boundAwal.y + "px";
        overlayGrupEl.style.width = bw + "px";
        overlayGrupEl.style.height = bh + "px";
      });
      handleGrupEl.addEventListener("pointerup", function (e) {
        if (!resizingGrup) return;
        resizingGrup = false;
        selectedIds.forEach(function (id) {
          const el = kotakElMap[id];
          if (!el) return;
          const idTipe = standList.some(function (s) { return s.id === id; }) ? "stand" : "elemen";
          const bucket = idTipe === "stand" ? perubahan.stand : perubahan.elemen;
          bucket[id] = Object.assign({}, bucket[id], {
            pos_x: Math.round(parseFloat(el.style.left)), pos_y: Math.round(parseFloat(el.style.top)),
            lebar: Math.round(parseFloat(el.style.width)), tinggi: Math.round(parseFloat(el.style.height))
          });
        });
        tandaiBerubah();
      });

      innerEl.appendChild(overlayGrupEl);
    }

    function hitungBoundingBoxTerpilih() {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      selectedIds.forEach(function (id) {
        const r = rectVirtual(id);
        if (!r) return;
        minX = Math.min(minX, r.x); minY = Math.min(minY, r.y);
        maxX = Math.max(maxX, r.x + r.w); maxY = Math.max(maxY, r.y + r.h);
      });
      if (minX === Infinity) return null;
      return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
    }

    function perbaruiOverlayGrup() {
      if (selectedIds.size <= 1) {
        if (overlayGrupEl) overlayGrupEl.style.display = "none";
        return;
      }
      pastikanOverlayGrup();
      const b = hitungBoundingBoxTerpilih();
      if (!b) { overlayGrupEl.style.display = "none"; return; }
      overlayGrupEl.style.display = "block";
      // Beri sedikit jarak (6px) di sekeliling bounding box asli supaya
      // garis putus-putusnya tidak menempel pas di tepi kotak-kotak di
      // dalamnya -- murni kosmetik.
      overlayGrupEl.style.left = (b.x - 6) + "px";
      overlayGrupEl.style.top = (b.y - 6) + "px";
      overlayGrupEl.style.width = (b.w + 12) + "px";
      overlayGrupEl.style.height = (b.h + 12) + "px";
    }

    // Ukuran tulisan di dalam kotak ikut membesar/mengecil mengikuti ukuran
    // kotaknya sendiri (gaya Canva: resize kotak = resize tulisannya juga,
    // bukan kotak & tulisan yang terasa lepas satu sama lain) -- dihitung dari
    // sisi TERKECIL (lebar ATAU tinggi, mana yang lebih kecil) supaya teks
    // tidak pernah meluber keluar kotak yang sempit, dibatasi [8px, 40px]
    // supaya tetap terbaca di kotak sekecil apa pun & tidak raksasa di kotak
    // sebesar apa pun.
    function skalaFontKotak(w, h) {
      return Math.max(8, Math.min(40, Math.min(w, h) / 3.4));
    }

    // Sudut (derajat) dibulatkan ke bilangan bulat & dinormalkan ke rentang
    // [0, 360) -- dipakai tiap kali rotasi baru dihitung/disimpan.
    function normalisasiSudut(derajat) {
      return Math.round(((derajat % 360) + 360) % 360);
    }

    // Tulisan DI DALAM kotak stand diringkas jadi "<kode area>-<nomor>" (mis.
    // "B-DA-07" -> "DA-7") supaya tidak kepotong/kekecilan di kotak yang
    // ukurannya kecil -- kode LENGKAPnya (dengan awalan jenis A/B/C) tetap
    // dipakai apa adanya di tempat lain (tooltip `title` lewat `kodeAsli`,
    // tabel "📋 Tampilan Daftar", tab "Data Tenant", dll), cuma tampilan di
    // kotak kanvas ini saja yang dipendekkan. Logika SAMA PERSIS dengan
    // `labelRingkasKodeBazarPublik()` di `view-daftarbazar.js` (dipakai
    // untuk kotak denah di form publik "/daftar-bazar") -- NAMA fungsinya
    // sengaja dibedakan (`_Admin` di sini) karena kedua file sama-sama
    // <script> klasik yang berbagi satu scope global (lihat catatan bug
    // `PESAN_LUCU_BAZAR_TUTUP_TOTAL` kalau mau tahu kenapa ini wajib).
    function labelRingkasKodeBazarAdmin(kode) {
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

    function buatKotak(opsi) {
      // `el` sendiri TIDAK diberi `overflow:hidden` (beda dari sebelumnya) --
      // supaya handle resize & handle rotasi yang posisinya ada di PINGGIR/LUAR
      // kotak (pojok kanan-bawah, bulatan di atas kotak) tidak ikut terpotong.
      // Pembatasan teks supaya tidak meluber keluar kotak sekarang jadi
      // tanggung jawab `isiEl` (wrapper di dalamnya) yang overflow-nya
      // memang `hidden`.
      const el = document.createElement("div");
      el.setAttribute("data-id", opsi.id);
      // Tulisan di dalam kotak stand (opsi.label) sudah diringkas pemanggil
      // jadi "<kode area>-<nomor>" (mis. "DA-7") -- `opsi.kodeAsli` (kalau
      // ada) menyimpan kode LENGKAPNYA ("B-DA-07") buat ditaruh di tooltip
      // `title`, supaya panitia tetap bisa lihat kode persis tanpa perlu
      // tulisan di kotaknya sendiri jadi panjang/kepotong.
      if (opsi.kodeAsli) el.title = opsi.kodeAsli;
      el.style.position = "absolute";
      el.style.left = opsi.x + "px";
      el.style.top = opsi.y + "px";
      el.style.width = opsi.w + "px";
      el.style.height = opsi.h + "px";
      el.style.cursor = "grab";
      el.style.userSelect = "none";
      el.style.touchAction = "none";
      el.style.transformOrigin = "50% 50%";

      let rotasi = normalisasiSudut(opsi.rotasi || 0);
      el.style.transform = "rotate(" + rotasi + "deg)";

      const isiEl = document.createElement("div");
      isiEl.style.position = "absolute";
      isiEl.style.inset = "0";
      isiEl.style.background = opsi.warnaBg;
      isiEl.style.color = opsi.warnaTeks;
      isiEl.style.border = "1.5px solid rgba(0,0,0,0.15)";
      isiEl.style.borderRadius = "6px";
      isiEl.style.display = "flex";
      isiEl.style.flexDirection = "column";
      isiEl.style.alignItems = "center";
      isiEl.style.justifyContent = "center";
      isiEl.style.fontSize = skalaFontKotak(opsi.w, opsi.h) + "px";
      isiEl.style.fontWeight = "700";
      isiEl.style.textAlign = "center";
      isiEl.style.boxShadow = "0 2px 4px rgba(0,0,0,0.15)";
      isiEl.style.lineHeight = "1.15";
      isiEl.style.overflow = "hidden";
      isiEl.style.padding = "2px";
      isiEl.style.pointerEvents = "none"; // klik/drag selalu ditangkap `el`, bukan isinya
      // Sublabel (emoji) sengaja dalam satuan `em` (bukan px tetap) supaya
      // ukurannya ikut skala `isiEl.style.fontSize` otomatis -- tidak perlu
      // dihitung ulang terpisah tiap kali kotak di-resize.
      isiEl.innerHTML =
        (opsi.sublabel ? ('<span style="font-size:1.4em;">' + escapeHTMLBazarAdmin(opsi.sublabel) + '</span>') : "") +
        '<span>' + escapeHTMLBazarAdmin(opsi.label) + '</span>';
      el.appendChild(isiEl);

      let dragging = false, startX = 0, startY = 0, startPosX = opsi.x, startPosY = opsi.y;
      // Posisi AWAL semua kotak yang ikut digeser bersama kotak ini (anggota
      // grup terpilih kalau lebih dari satu sedang terpilih, atau cuma kotak
      // ini sendiri) -- dicatat di awal drag (pointerdown), dipakai terus
      // selama pointermove supaya tiap kotak bergerak dengan jarak (dx, dy)
      // yang SAMA PERSIS, bukan dihitung ulang dari posisi sekarang tiap
      // event (yang bisa menumpuk galat pembulatan).
      let posisiAwalGrup = {};

      el.addEventListener("pointerdown", function (e) {
        if (e.target !== el) return; // bukan drag kotak kalau yang diklik adalah handle resize/rotasi anaknya
        e.preventDefault();

        if (e.shiftKey) {
          // Shift+klik CUMA mengubah seleksi (tambah/lepas kotak ini dari
          // grup terpilih) -- tidak langsung memulai drag, supaya orang bisa
          // memilih beberapa kotak dulu tanpa sengaja menggesernya.
          if (selectedIds.has(opsi.id)) selectedIds.delete(opsi.id);
          else selectedIds.add(opsi.id);
          terapkanSeleksiVisual();
          perbaruiOverlayGrup();
          return;
        }

        // Klik biasa (tanpa Shift): kalau kotak ini sudah bagian dari grup
        // yang sedang terpilih (lebih dari satu kotak), pertahankan seluruh
        // grup itu supaya bisa langsung digeser bersama -- kalau bukan,
        // seleksi direset jadi cuma kotak ini sendiri.
        if (!selectedIds.has(opsi.id) || selectedIds.size <= 1) {
          selectedIds = new Set([opsi.id]);
          terapkanSeleksiVisual();
          perbaruiOverlayGrup();
        }

        dragging = true;
        el.setPointerCapture(e.pointerId);
        startX = e.clientX; startY = e.clientY;
        startPosX = parseFloat(el.style.left); startPosY = parseFloat(el.style.top);
        el.style.cursor = "grabbing";
        el.style.zIndex = "50";

        posisiAwalGrup = {};
        selectedIds.forEach(function (id) {
          const r = rectVirtual(id);
          if (r) posisiAwalGrup[id] = r;
        });
      });
      el.addEventListener("pointermove", function (e) {
        if (!dragging) return;
        // Menggeser kotak SELALU mengikuti arah mouse di layar apa adanya,
        // TIDAK perlu dikoreksi sudut rotasi -- beda dari resize di bawah
        // (lihat komentar di situ) karena menggeser cuma mengubah
        // `left`/`top`, bukan menghitung ulang sisi kotak yang sudah miring.
        const dx = (e.clientX - startX) / scale;
        const dy = (e.clientY - startY) / scale;

        if (selectedIds.size > 1 && selectedIds.has(opsi.id)) {
          // Lebih dari satu kotak terpilih & kotak ini salah satunya --
          // geser SEMUA anggota grup dengan jarak (dx, dy) yang sama,
          // masing-masing tetap dibatasi supaya tidak keluar tepi kanvas.
          selectedIds.forEach(function (id) {
            const awal = posisiAwalGrup[id];
            const elLain = kotakElMap[id];
            if (!awal || !elLain) return;
            const baruXLain = Math.max(0, Math.min(DENAH_CANVAS_W - awal.w, awal.x + dx));
            const baruYLain = Math.max(0, Math.min(DENAH_CANVAS_H - awal.h, awal.y + dy));
            elLain.style.left = baruXLain + "px";
            elLain.style.top = baruYLain + "px";
          });
          perbaruiOverlayGrup();
          return;
        }

        const baruX = Math.max(0, Math.min(DENAH_CANVAS_W - parseFloat(el.style.width), startPosX + dx));
        const baruY = Math.max(0, Math.min(DENAH_CANVAS_H - parseFloat(el.style.height), startPosY + dy));
        el.style.left = baruX + "px";
        el.style.top = baruY + "px";
      });
      el.addEventListener("pointerup", function (e) {
        if (!dragging) return;
        dragging = false;
        el.style.cursor = "grab";
        el.style.zIndex = "";

        if (selectedIds.size > 1 && selectedIds.has(opsi.id)) {
          selectedIds.forEach(function (id) {
            const elLain = kotakElMap[id];
            if (!elLain) return;
            const idTipe = standList.some(function (s) { return s.id === id; }) ? "stand" : "elemen";
            const bucketLain = idTipe === "stand" ? perubahan.stand : perubahan.elemen;
            bucketLain[id] = Object.assign({}, bucketLain[id], { pos_x: Math.round(parseFloat(elLain.style.left)), pos_y: Math.round(parseFloat(elLain.style.top)) });
          });
          tandaiBerubah();
          return;
        }

        const bucket = opsi.tipe === "stand" ? perubahan.stand : perubahan.elemen;
        bucket[opsi.id] = Object.assign({}, bucket[opsi.id], { pos_x: Math.round(parseFloat(el.style.left)), pos_y: Math.round(parseFloat(el.style.top)) });
        tandaiBerubah();
      });

      if (opsi.bisaResize) {
        const handle = document.createElement("div");
        handle.style.position = "absolute";
        handle.style.right = "-6px";
        handle.style.bottom = "-6px";
        handle.style.width = "14px";
        handle.style.height = "14px";
        handle.style.background = "#fff";
        handle.style.border = "2px solid rgba(0,0,0,0.45)";
        handle.style.borderRadius = "3px";
        handle.style.cursor = "nwse-resize";
        handle.style.touchAction = "none";
        el.appendChild(handle);

        let resizing = false, startW = opsi.w, startH = opsi.h;
        handle.addEventListener("pointerdown", function (e) {
          e.preventDefault();
          e.stopPropagation();
          resizing = true;
          handle.setPointerCapture(e.pointerId);
          startX = e.clientX; startY = e.clientY;
          startW = parseFloat(el.style.width); startH = parseFloat(el.style.height);
        });
        handle.addEventListener("pointermove", function (e) {
          if (!resizing) return;
          // Kotak yang sudah diputar (rotasi != 0): pergeseran mouse di
          // layar (dxLayar/dyLayar, SUMBU GLOBAL) harus diputar BALIK
          // (-rotasi) dulu supaya jadi pergeseran di sumbu LOKAL kotak itu
          // sendiri -- baru hasil itu yang dipakai menambah lebar/tinggi.
          // Tanpa koreksi ini, menarik pojok kotak yang sedang miring akan
          // terasa "salah arah" (lebar/tinggi berubah tidak sesuai arah
          // tarikan mouse di layar).
          const dxLayar = (e.clientX - startX) / scale;
          const dyLayar = (e.clientY - startY) / scale;
          const rad = -(rotasi * Math.PI / 180);
          const dxLokal = dxLayar * Math.cos(rad) - dyLayar * Math.sin(rad);
          const dyLokal = dxLayar * Math.sin(rad) + dyLayar * Math.cos(rad);
          // Kotak STAND wajib tetap PERSEGI (permintaan panitia) -- pakai
          // tarikan TERBESAR dari dua arah (kanan ATAU bawah) supaya kedua
          // arah tarikan sama-sama terasa membesarkan, bukan cuma salah satu.
          // Label/elemen lain (bukan stand) tetap bebas jadi persegi panjang
          // seperti sebelumnya.
          const baruW = opsi.tipe === "stand"
            ? Math.max(30, startW + Math.max(dxLokal, dyLokal))
            : Math.max(30, startW + dxLokal);
          const baruH = opsi.tipe === "stand" ? baruW : Math.max(24, startH + dyLokal);
          el.style.width = baruW + "px";
          el.style.height = baruH + "px";
          // Tulisan di dalamnya ikut membesar/mengecil SAAT resize berlangsung
          // (bukan cuma setelah dilepas) supaya terasa langsung seperti Canva.
          isiEl.style.fontSize = skalaFontKotak(baruW, baruH) + "px";
        });
        handle.addEventListener("pointerup", function (e) {
          if (!resizing) return;
          resizing = false;
          const bucketResize = opsi.tipe === "stand" ? perubahan.stand : perubahan.elemen;
          bucketResize[opsi.id] = Object.assign({}, bucketResize[opsi.id], { lebar: Math.round(parseFloat(el.style.width)), tinggi: Math.round(parseFloat(el.style.height)) });
          tandaiBerubah();
        });
      }

      // -------- Handle ROTASI ala Canva: bulatan kecil mengambang di atas
      // kotak, dihubungkan garis tipis -- digeser memutar seluruh kotak di
      // sekeliling titik tengahnya sendiri. Dipasang untuk SEMUA kotak
      // (stand maupun label), bukan cuma yang `bisaResize`.
      const garisRotasi = document.createElement("div");
      garisRotasi.style.position = "absolute";
      garisRotasi.style.left = "50%";
      garisRotasi.style.top = "-22px";
      garisRotasi.style.width = "1px";
      garisRotasi.style.height = "20px";
      garisRotasi.style.background = "rgba(0,0,0,0.35)";
      garisRotasi.style.transform = "translateX(-50%)";
      garisRotasi.style.pointerEvents = "none";
      el.appendChild(garisRotasi);

      const handleRotasi = document.createElement("div");
      handleRotasi.style.position = "absolute";
      handleRotasi.style.left = "50%";
      handleRotasi.style.top = "-30px";
      handleRotasi.style.width = "14px";
      handleRotasi.style.height = "14px";
      handleRotasi.style.marginLeft = "-7px";
      handleRotasi.style.borderRadius = "50%";
      handleRotasi.style.background = "#fff";
      handleRotasi.style.border = "2px solid rgba(0,0,0,0.45)";
      handleRotasi.style.cursor = "grab";
      handleRotasi.style.touchAction = "none";
      el.appendChild(handleRotasi);

      let memutar = false;
      handleRotasi.addEventListener("pointerdown", function (e) {
        e.preventDefault();
        e.stopPropagation();
        memutar = true;
        handleRotasi.setPointerCapture(e.pointerId);
        handleRotasi.style.cursor = "grabbing";
      });
      handleRotasi.addEventListener("pointermove", function (e) {
        if (!memutar) return;
        // Titik tengah kotak di koordinat LAYAR (bukan koordinat kanvas
        // virtual) -- dipakai menghitung sudut dari tengah kotak ke posisi
        // mouse saat ini. `getBoundingClientRect()` selalu mengembalikan
        // kotak pembungkus (axis-aligned) dari bentuk yang SUDAH diputar,
        // tapi titik TENGAHNYA tidak pernah bergeser akibat rotasi di
        // sekeliling `transform-origin: 50% 50%` -- jadi aman dipanggil
        // ulang tiap gerakan mouse walau kotaknya sendiri sedang miring.
        const rect = el.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const sudutLayar = Math.atan2(e.clientY - cy, e.clientX - cx) * 180 / Math.PI;
        // Handle beristirahat di posisi "12 arah jam" (tepat di atas kotak)
        // saat rotasi = 0 -- posisi itu sesuai sudut layar -90°, jadi
        // ditambah 90° supaya rotasi = 0 saat mouse tepat di atas kotak.
        rotasi = normalisasiSudut(sudutLayar + 90);
        el.style.transform = "rotate(" + rotasi + "deg)";
      });
      handleRotasi.addEventListener("pointerup", function (e) {
        if (!memutar) return;
        memutar = false;
        handleRotasi.style.cursor = "grab";
        const bucketRotasi = opsi.tipe === "stand" ? perubahan.stand : perubahan.elemen;
        bucketRotasi[opsi.id] = Object.assign({}, bucketRotasi[opsi.id], { rotasi: rotasi });
        tandaiBerubah();
      });

      if (opsi.tipe === "elemen") {
        el.addEventListener("click", function (e) {
          if (e.target !== el) return;
          if (e.shiftKey) return; // Shift+klik cuma untuk seleksi, bukan membuka panel edit
          bukaPanelEditLabel(opsi.id);
        });
      }

      return el;
    }

    function gambarSemua() {
      innerEl.innerHTML = "";
      // `innerHTML = ""` di atas membuang SEMUA elemen anak sebelumnya,
      // termasuk kotak pembungkus seleksi grup (`overlayGrupEl`) kalau ada --
      // referensi JS-nya sendiri tidak hilang (cuma terlepas dari DOM), jadi
      // nanti dipasang ulang (bukan dibuat baru) lewat `pastikanOverlayGrup()`
      // + `appendChild` di akhir fungsi ini.
      kotakElMap = {};
      elemenList.forEach(function (elm) {
        const el = buatKotak({
          id: elm.id, tipe: "elemen",
          x: elm.pos_x, y: elm.pos_y, w: elm.lebar, h: elm.tinggi,
          rotasi: elm.rotasi,
          warnaBg: elm.warna_bg, warnaTeks: elm.warna_teks,
          label: elm.teks, sublabel: elm.emoji, bisaResize: true
        });
        innerEl.appendChild(el);
        kotakElMap[elm.id] = el;
      });
      standList.forEach(function (s) {
        const warna = WARNA_JENIS_DENAH[s.jenis] || "#777777";
        // Stand "milik panitia" (migrasi 0049, hanya bisa ditandai/dibatalkan
        // lewat sub-tampilan "Tampilan Daftar") ditampilkan abu-abu kusam di
        // sini, berbeda dari warna jenis normal maupun merah "terisi" --
        // cuma pembeda visual, tidak bisa diklik-toggle dari kanvas ini.
        const warnaBg = s.tenant_id ? "#fde8e8" : (s.milik_panitia ? "#d8d4c8" : warna);
        const warnaTeks = s.tenant_id ? "#b91c1c" : (s.milik_panitia ? "#5c5440" : "#ffffff");
        const el = buatKotak({
          id: s.id, tipe: "stand",
          x: s.pos_x != null ? s.pos_x : 20, y: s.pos_y != null ? s.pos_y : 20,
          w: s.lebar || 54, h: s.tinggi || 40,
          rotasi: s.rotasi,
          warnaBg: warnaBg,
          warnaTeks: warnaTeks,
          label: labelRingkasKodeBazarAdmin(s.kode), kodeAsli: s.kode, bisaResize: true
        });
        innerEl.appendChild(el);
        kotakElMap[s.id] = el;
      });

      // Buang id yang sudah tidak ada lagi (mis. label yang baru dihapus)
      // dari seleksi, baru terapkan ulang tampilan seleksi + kotak
      // pembungkus grup supaya tetap konsisten setelah kanvas digambar ulang.
      selectedIds.forEach(function (id) { if (!kotakElMap[id]) selectedIds.delete(id); });
      pastikanOverlayGrup();
      innerEl.appendChild(overlayGrupEl);
      terapkanSeleksiVisual();
      perbaruiOverlayGrup();
    }

    function bukaPanelEditLabel(id) {
      const data = elemenList.find(function (e) { return e.id === id; });
      if (!data) return;
      panelEl.innerHTML =
        '<div class="form-shell" style="max-width:420px;margin-top:14px;">' +
          '<h3>Edit Label</h3>' +
          '<div class="field"><label for="edit-label-emoji">Emoji</label><input type="text" id="edit-label-emoji" maxlength="4" value="' + escapeHTMLBazarAdmin(data.emoji || "") + '" style="width:70px;" /></div>' +
          '<div class="field"><label for="edit-label-teks">Teks</label><input type="text" id="edit-label-teks" value="' + escapeHTMLBazarAdmin(data.teks) + '" /></div>' +
          '<div class="field-row">' +
            '<div class="field"><label for="edit-label-bg">Warna Latar</label><input type="color" id="edit-label-bg" value="' + (data.warna_bg || "#dcecd7") + '" /></div>' +
            '<div class="field"><label for="edit-label-teks-warna">Warna Teks</label><input type="color" id="edit-label-teks-warna" value="' + (data.warna_teks || "#2b5c3b") + '" /></div>' +
          '</div>' +
          '<div class="submit-row">' +
            '<button type="button" class="btn btn--primary" id="btn-terapkan-label">Terapkan</button>' +
            '<button type="button" class="btn-remove" id="btn-hapus-label">Hapus Label</button>' +
            '<button type="button" class="btn btn--ghost" id="btn-tutup-panel-label">Tutup</button>' +
          '</div>' +
        '</div>';

      document.getElementById("btn-terapkan-label").addEventListener("click", function () {
        data.emoji = document.getElementById("edit-label-emoji").value.trim();
        data.teks = document.getElementById("edit-label-teks").value.trim() || "Label";
        data.warna_bg = document.getElementById("edit-label-bg").value;
        data.warna_teks = document.getElementById("edit-label-teks-warna").value;
        perubahan.elemen[id] = Object.assign({}, perubahan.elemen[id], {
          emoji: data.emoji, teks: data.teks, warna_bg: data.warna_bg, warna_teks: data.warna_teks
        });
        tandaiBerubah();
        gambarSemua();
        panelEl.innerHTML = "";
      });
      document.getElementById("btn-hapus-label").addEventListener("click", async function () {
        if (!confirm('Hapus label "' + data.teks + '"? Tindakan ini langsung permanen (TIDAK lewat tombol "Simpan Tata Letak" -- label terhapus seketika diklik "Hapus").')) return;
        const { error: errHapus } = await supabaseClient.from("bazar_denah_elemen").delete().eq("id", id);
        if (errHapus) {
          alert("Gagal menghapus label: " + errHapus.message);
          return;
        }
        elemenList = elemenList.filter(function (e) { return e.id !== id; });
        delete perubahan.elemen[id];
        gambarSemua();
        panelEl.innerHTML = "";
      });
      document.getElementById("btn-tutup-panel-label").addEventListener("click", function () {
        panelEl.innerHTML = "";
      });
    }

    document.getElementById("btn-tambah-label-denah").addEventListener("click", async function () {
      // Posisi awal kotak baru digeser sedikit tiap kali tombol ini diklik
      // berturut-turut (bukan selalu pas di (20,20)) -- supaya beberapa
      // kotak baru yang ditambah berurutan tidak numpuk persis di titik yang
      // sama, lebih enak langsung dilihat & dipisah manual oleh panitia.
      const geser = (elemenList.length % 6) * 25;
      const { data: baru, error: errBaru } = await supabaseClient.from("bazar_denah_elemen").insert({
        teks: "Kotak Baru", emoji: "📍", pos_x: 20 + geser, pos_y: 20 + geser, lebar: 120, tinggi: 60,
        warna_bg: "#dcecd7", warna_teks: "#2b5c3b", urutan: elemenList.length + 1
      }).select().single();
      if (errBaru) {
        alert("Gagal menambah kotak: " + errBaru.message);
        return;
      }
      elemenList.push(baru);
      gambarSemua();
    });

    // Background foto kanvas denah (migrasi 0044) -- pola upload sama
    // seperti logo navbar di loadTabLogo() (view-admin.js), bucket
    // "aset-situs" dipakai bersama.
    document.getElementById("btn-ganti-bg-denah").addEventListener("click", function () {
      document.getElementById("input-bg-denah").click();
    });
    document.getElementById("input-bg-denah").addEventListener("change", async function () {
      const file = this.files[0];
      if (!file) return;
      if (!file.type.startsWith("image/")) { alert("Pilih berkas gambar."); return; }
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = "bazar-denah-bg/bg-" + Date.now() + "." + ext;
      const { error: errUp } = await supabaseClient.storage.from("aset-situs").upload(path, file, { contentType: file.type });
      if (errUp) { alert("Gagal upload: " + errUp.message); return; }
      const { data: pub } = supabaseClient.storage.from("aset-situs").getPublicUrl(path);
      const { error: errUpdate } = await supabaseClient.from("bazar_settings").update({ denah_background_url: pub.publicUrl }).eq("id", 1);
      if (errUpdate) { alert("Gagal menyimpan background: " + errUpdate.message); return; }
      denahBgUrl = pub.publicUrl;
      renderVisual();
    });
    const btnHapusBg = document.getElementById("btn-hapus-bg-denah");
    if (btnHapusBg) {
      btnHapusBg.addEventListener("click", async function () {
        if (!confirm("Hapus background foto denah, kembali ke warna polos?")) return;
        const { error } = await supabaseClient.from("bazar_settings").update({ denah_background_url: null }).eq("id", 1);
        if (error) { alert("Gagal menghapus background: " + error.message); return; }
        denahBgUrl = null;
        renderVisual();
      });
    }

    document.getElementById("btn-simpan-denah-visual").addEventListener("click", async function () {
      const btn = this;
      const idStand = Object.keys(perubahan.stand);
      const idElemen = Object.keys(perubahan.elemen);
      if (idStand.length === 0 && idElemen.length === 0) {
        statusEl.textContent = "Tidak ada perubahan untuk disimpan.";
        statusEl.style.color = "";
        return;
      }
      btn.disabled = true;
      btn.textContent = "Menyimpan...";

      const tugas = idStand.map(function (id) {
        return supabaseClient.from("bazar_stand").update(perubahan.stand[id]).eq("id", id);
      }).concat(idElemen.map(function (id) {
        return supabaseClient.from("bazar_denah_elemen").update(perubahan.elemen[id]).eq("id", id);
      }));

      const hasil = await Promise.all(tugas);
      const gagal = hasil.filter(function (h) { return h.error; });

      btn.disabled = false;
      btn.textContent = "💾 Simpan Tata Letak";

      if (gagal.length > 0) {
        statusEl.textContent = "Sebagian gagal disimpan: " + gagal[0].error.message;
        statusEl.style.color = "#b91c1c";
        return;
      }

      perubahan = { stand: {}, elemen: {} };
      statusEl.textContent = "✓ Tata letak tersimpan.";
      statusEl.style.color = "#0f7b3e";
      setTimeout(function () { statusEl.textContent = ""; }, 2500);
    });

    // -------- Seleksi "marquee" (tarik persegi di area kanvas yang kosong) --
    // dipasang di `innerEl` sendiri, cuma aktif kalau yang diklik pertama
    // kali adalah kanvas kosong itu sendiri (`e.target === innerEl`) --
    // kalau yang diklik sebuah kotak/handle, listener pointerdown kotak itu
    // sendiri yang menangani (dan event tidak pernah mencapai sini sebagai
    // `target === innerEl`).
    let marqueeEl = null;
    let marqueeAktif = false;
    let marqueeStart = { x: 0, y: 0 };
    let marqueeBase = new Set();

    innerEl.addEventListener("pointerdown", function (e) {
      if (e.target !== innerEl) return;
      e.preventDefault();
      marqueeAktif = true;
      innerEl.setPointerCapture(e.pointerId);
      const rect = innerEl.getBoundingClientRect();
      marqueeStart = { x: (e.clientX - rect.left) / scale, y: (e.clientY - rect.top) / scale };

      if (!e.shiftKey) selectedIds = new Set();
      marqueeBase = new Set(selectedIds);
      terapkanSeleksiVisual();
      perbaruiOverlayGrup();

      if (!marqueeEl) {
        marqueeEl = document.createElement("div");
        marqueeEl.style.position = "absolute";
        marqueeEl.style.border = "1.5px dashed #2b6cff";
        marqueeEl.style.background = "rgba(43,108,255,0.08)";
        marqueeEl.style.pointerEvents = "none";
        marqueeEl.style.zIndex = "60";
      }
      innerEl.appendChild(marqueeEl);
      marqueeEl.style.left = marqueeStart.x + "px";
      marqueeEl.style.top = marqueeStart.y + "px";
      marqueeEl.style.width = "0px";
      marqueeEl.style.height = "0px";
      marqueeEl.style.display = "block";
    });
    innerEl.addEventListener("pointermove", function (e) {
      if (!marqueeAktif) return;
      const rect = innerEl.getBoundingClientRect();
      const curX = (e.clientX - rect.left) / scale;
      const curY = (e.clientY - rect.top) / scale;
      const x = Math.min(marqueeStart.x, curX);
      const y = Math.min(marqueeStart.y, curY);
      const w = Math.abs(curX - marqueeStart.x);
      const h = Math.abs(curY - marqueeStart.y);
      marqueeEl.style.left = x + "px";
      marqueeEl.style.top = y + "px";
      marqueeEl.style.width = w + "px";
      marqueeEl.style.height = h + "px";

      const kotakSeleksi = { x: x, y: y, w: w, h: h };
      const terkena = new Set(marqueeBase);
      Object.keys(kotakElMap).forEach(function (id) {
        const r = rectVirtual(id);
        if (r && duaKotakBertumpuk(kotakSeleksi, r)) terkena.add(id);
      });
      selectedIds = terkena;
      terapkanSeleksiVisual();
      perbaruiOverlayGrup();
    });
    innerEl.addEventListener("pointerup", function (e) {
      if (!marqueeAktif) return;
      marqueeAktif = false;
      if (marqueeEl) marqueeEl.style.display = "none";
    });

    terapkanSkala();
    gambarSemua();
    _denahResizeHandler = terapkanSkala;
    window.addEventListener("resize", _denahResizeHandler);
  }

  document.querySelectorAll('[data-subtab]').forEach(function (btn) {
    btn.addEventListener("click", function () {
      if (_denahResizeHandler) {
        window.removeEventListener("resize", _denahResizeHandler);
        _denahResizeHandler = null;
      }
      document.querySelectorAll('[data-subtab]').forEach(function (b) { b.classList.remove("is-active"); });
      btn.classList.add("is-active");
      const t = btn.getAttribute("data-subtab");
      if (t === "daftar") renderDaftar();
      if (t === "visual") renderVisual();
    });
  });

  renderDaftar();
}

/* ==================== TAB 2: PENGATURAN BAZAR ==================== */

async function loadTabPengaturanBazar() {
  const content = document.getElementById("adminbazar-content");
  content.innerHTML = '<p class="hint">Memuat pengaturan bazar...</p>';

  const { data: settings, error } = await supabaseClient.from("bazar_settings").select("*").eq("id", 1).single();
  if (error) {
    content.innerHTML = "<p>Gagal memuat pengaturan bazar: " + error.message + "</p>";
    return;
  }

  const jenisStandInfo = (settings.jenis_stand_info && typeof settings.jenis_stand_info === "object") ? settings.jenis_stand_info : {};
  const URUTAN_JENIS_PENGATURAN = ["A", "B", "C"];

  content.innerHTML =
    '<div class="form-shell" style="max-width:640px;">' +
      '<h3>Profil Halaman Bazar</h3>' +
      '<p>Ditampilkan di halaman info Bazar publik ("#/bazar"), sebelum pengunjung menuju form pendaftaran.</p>' +

      '<div class="field">' +
        '<label for="bazar-judul-text">Judul <span style="font-weight:400;">(kosongkan untuk pakai default "Bazar ALIF 5.0")</span></label>' +
        '<input type="text" id="bazar-judul-text" value="' + escapeHTMLBazarAdmin(settings.profil_judul || "") + '" placeholder="Bazar ALIF 5.0" />' +
      '</div>' +

      '<div class="field">' +
        '<label for="bazar-deskripsi-text">Deskripsi Ringkas <span style="font-weight:400;">(kosongkan untuk pakai teks default)</span></label>' +
        '<textarea id="bazar-deskripsi-text" rows="4" placeholder="Satu-dua kalimat singkat mengajak orang buka stand di Bazar ALIF 5.0...">' + escapeHTMLBazarAdmin(settings.profil_deskripsi || "") + '</textarea>' +
      '</div>' +

      '<p class="hint" style="margin-top:28px;">Buka/tutup pendaftaran bazar sekarang pakai tombol besar "🟢 Pendaftaran Dibuka"/"🔒 Pendaftaran Ditutup" di pojok kanan atas halaman ini (sekali klik, langsung berlaku) -- tidak perlu lagi dicentang di sini. Halaman info "/bazar" selalu bisa dibuka siapa saja; status ini hanya mengunci form "/daftar-bazar".</p>' +

      '<h3 style="margin-top:28px;">Jenis & Harga Stand</h3>' +
      '<p class="hint">Area & kuota tiap jenis sudah BAKU (lihat tab "Denah Stand" untuk daftar lengkapnya, tidak diedit di sini) -- yang bisa diubah di sini cuma nama, ukuran, dan harga tiap jenis. Berlaku langsung untuk pendaftar berikutnya (harga tenant yang sudah daftar tidak ikut berubah).</p>' +
      URUTAN_JENIS_PENGATURAN.map(function (j) {
        const info = jenisStandInfo[j] || {};
        return (
          '<div class="field-row" style="align-items:flex-start;">' +
            '<div class="field" style="flex:0 0 70px;"><label>Jenis</label><input type="text" value="' + j + '" disabled /></div>' +
            '<div class="field"><label for="bazar-jenis-' + j + '-nama">Nama</label><input type="text" id="bazar-jenis-' + j + '-nama" value="' + escapeHTMLBazarAdmin(info.nama || ("Jenis " + j)) + '" /></div>' +
            '<div class="field"><label for="bazar-jenis-' + j + '-ukuran">Ukuran</label><input type="text" id="bazar-jenis-' + j + '-ukuran" value="' + escapeHTMLBazarAdmin(info.ukuran || "") + '" placeholder="mis. 3x3 m" /></div>' +
            '<div class="field" style="flex:0 0 160px;"><label for="bazar-jenis-' + j + '-harga">Harga (Rp)</label><input type="number" id="bazar-jenis-' + j + '-harga" min="0" value="' + (info.harga != null ? info.harga : "") + '" /></div>' +
          '</div>'
        );
      }).join("") +

      '<div class="field">' +
        '<label for="bazar-info-biaya-text">Info Biaya Sewa <span style="font-weight:400;">(opsional, tampil di halaman pendaftaran)</span></label>' +
        '<textarea id="bazar-info-biaya-text" rows="3" placeholder="mis. Kecil: Rp150.000, Sedang: Rp250.000, Besar: Rp400.000">' + escapeHTMLBazarAdmin(settings.info_biaya || "") + '</textarea>' +
      '</div>' +

      '<div class="field">' +
        '<label for="bazar-info-rekening-text">Info Rekening/QRIS <span style="font-weight:400;">(opsional, tampil di halaman pendaftaran)</span></label>' +
        '<textarea id="bazar-info-rekening-text" rows="3" placeholder="mis. Transfer ke BCA 1234567890 a.n. Panitia ALIF 5.0">' + escapeHTMLBazarAdmin(settings.info_rekening || "") + '</textarea>' +
      '</div>' +

      '<div class="form-error" id="bazar-pengaturan-error" style="display:none;"></div>' +
      '<div class="submit-row">' +
        '<button type="button" class="btn btn--primary" id="btn-simpan-pengaturan-bazar">Simpan Pengaturan</button>' +
      '</div>' +
    '</div>';

  document.getElementById("btn-simpan-pengaturan-bazar").addEventListener("click", async function () {
    const btn = this;
    const errorEl = document.getElementById("bazar-pengaturan-error");
    errorEl.style.display = "none";

    const jenisStandBaru = {};
    for (let i = 0; i < URUTAN_JENIS_PENGATURAN.length; i++) {
      const j = URUTAN_JENIS_PENGATURAN[i];
      const nama = document.getElementById("bazar-jenis-" + j + "-nama").value.trim();
      const ukuran = document.getElementById("bazar-jenis-" + j + "-ukuran").value.trim();
      const hargaRaw = document.getElementById("bazar-jenis-" + j + "-harga").value.trim();
      const harga = hargaRaw === "" ? 0 : parseInt(hargaRaw, 10);
      if (!nama || !ukuran || hargaRaw === "" || isNaN(harga) || harga < 0) {
        errorEl.textContent = "Nama, ukuran, dan harga Jenis " + j + " wajib diisi dengan benar (harga angka 0 atau lebih).";
        errorEl.style.display = "block";
        return;
      }
      jenisStandBaru[j] = { nama: nama, ukuran: ukuran, harga: harga };
    }

    btn.disabled = true;
    btn.textContent = "Menyimpan...";

    const { error: errSimpan } = await supabaseClient.from("bazar_settings").update({
      profil_judul: document.getElementById("bazar-judul-text").value.trim() || null,
      profil_deskripsi: document.getElementById("bazar-deskripsi-text").value.trim() || null,
      jenis_stand_info: jenisStandBaru,
      info_biaya: document.getElementById("bazar-info-biaya-text").value.trim() || null,
      info_rekening: document.getElementById("bazar-info-rekening-text").value.trim() || null
    }).eq("id", 1);

    btn.disabled = false;
    btn.textContent = "Simpan Pengaturan";

    if (errSimpan) {
      errorEl.textContent = "Gagal menyimpan: " + errSimpan.message;
      errorEl.style.display = "block";
      return;
    }
    btn.textContent = "✓ Tersimpan";
    setTimeout(function () { btn.textContent = "Simpan Pengaturan"; }, 1500);
  });
}

/* ==================== TAB 4: NOTIFIKASI WA (migrasi 0046) ====================
   Dua pesan WA otomatis KHUSUS Bazar, terpisah dari tab "Notifikasi WA"
   milik Lomba di view-admin.js (tabel & Edge Function-nya beda):
     (A) ke TENANT -- saat status stand-nya diubah jadi "Diterima" (tab
         "Data Tenant") -- pesannya + Link Grup WA diatur di sini.
     (B) ke PANITIA -- otomatis saat ADA pendaftar stand baru -- pesannya
         diatur di sini, TAPI nomor/ID grup tujuannya diatur LEWAT SECRET
         Edge Function FONNTE_TARGET_PANITIA (dashboard Supabase), BUKAN di
         sini -- supaya tidak tersimpan di tabel yang bisa dibaca publik. */
const WA_BAZAR_PLACEHOLDER_HINT_DITERIMA =
  'Placeholder: <code>{usaha}</code>, <code>{nomor}</code>, <code>{penanggung_jawab}</code>, <code>{grup}</code> (Link Grup WA tenant di bawah).';
const WA_BAZAR_PLACEHOLDER_HINT_PANITIA =
  'Placeholder: <code>{usaha}</code>, <code>{nomor}</code>, <code>{jenis_produk}</code>, <code>{penanggung_jawab}</code>, <code>{whatsapp}</code>.';

async function loadTabNotifWaBazar() {
  const content = document.getElementById("adminbazar-content");
  content.innerHTML = '<p class="hint">Memuat pengaturan notifikasi WA...</p>';

  const { data: settings, error } = await supabaseClient
    .from("bazar_settings")
    .select("wa_template_diterima, link_grup_wa, wa_template_panitia_baru")
    .eq("id", 1).single();

  if (error) {
    content.innerHTML = "<p>Gagal memuat pengaturan notifikasi WA: " + error.message + "</p>";
    return;
  }

  const templateDiterima = (settings && settings.wa_template_diterima) || "";
  const linkGrup = (settings && settings.link_grup_wa) || "";
  const templatePanitiaBaru = (settings && settings.wa_template_panitia_baru) || "";

  content.innerHTML =
    '<div class="form-shell" style="max-width:640px;">' +
      '<h3>💬 Notifikasi WA ke Tenant (tombol "Kirim WA")</h3>' +
      '<p>Pesan DISUSUN otomatis begitu status stand dipilih jadi <strong>Diterima</strong> di tab "Data Tenant", tapi TIDAK terkirim sendiri: muncul tombol <strong>"📲 Kirim WA"</strong> yang membuka WhatsApp (app/web) lewat link <code>wa.me</code> dengan nomor & pesan penanggung jawab tenant yang sudah terisi — panitia sendiri yang menekan kirim di sana.</p>' +
      '<div class="field">' +
        '<label for="wabazar-template-diterima">Pesan</label>' +
        '<textarea id="wabazar-template-diterima" rows="8">' + escapeHTMLBazarAdmin(templateDiterima) + '</textarea>' +
      '</div>' +
      '<div class="hint" style="margin-top:6px;">' + WA_BAZAR_PLACEHOLDER_HINT_DITERIMA + '</div>' +
      '<div class="field" style="margin-top:18px;">' +
        '<label for="wabazar-link-grup">Link Grup WA Tenant</label>' +
        '<input type="text" id="wabazar-link-grup" value="' + escapeHTMLBazarAdmin(linkGrup) + '" placeholder="https://chat.whatsapp.com/..." />' +
        '<div class="hint">Dikirim lewat placeholder <code>{grup}</code> di atas, HANYA untuk tenant yang statusnya diubah jadi "Diterima".</div>' +
      '</div>' +
      '<div class="form-error" id="wabazar-diterima-error" style="display:none;"></div>' +
      '<div class="submit-row">' +
        '<button type="button" class="btn btn--primary" id="btn-simpan-wabazar-diterima">Simpan</button>' +
      '</div>' +
      '<p class="hint" id="wabazar-diterima-status" style="margin-top:10px;"></p>' +
    '</div>' +
    '<div class="form-shell" style="max-width:640px;margin-top:20px;">' +
      '<h3>📥 Notifikasi Panitia (pendaftar baru) — sekarang lewat Notifikasi Browser</h3>' +
      '<p>Sejak pembaruan ini, pesan WA otomatis ke panitia saat ada pendaftar stand bazar baru TIDAK dikirim lagi — diganti <strong>Notifikasi Browser real-time</strong> (tombol 🔔 di pojok kanan atas halaman ini) yang langsung muncul selama tab "/adminbazar" ini terbuka, tanpa perlu instal apa pun. Kotak pesan di bawah ini DIBIARKAN tersimpan (tidak dihapus) kalau suatu saat ingin diaktifkan lagi, tapi untuk saat ini tidak dipakai/dikirim ke mana pun.</p>' +
      '<div class="field">' +
        '<label for="wabazar-template-panitia">Pesan</label>' +
        '<textarea id="wabazar-template-panitia" rows="7">' + escapeHTMLBazarAdmin(templatePanitiaBaru) + '</textarea>' +
      '</div>' +
      '<div class="hint" style="margin-top:6px;">' + WA_BAZAR_PLACEHOLDER_HINT_PANITIA + '</div>' +
      '<div class="form-error" id="wabazar-panitia-error" style="display:none;"></div>' +
      '<div class="submit-row">' +
        '<button type="button" class="btn btn--primary" id="btn-simpan-wabazar-panitia">Simpan</button>' +
      '</div>' +
      '<p class="hint" id="wabazar-panitia-status" style="margin-top:10px;"></p>' +
    '</div>' +
    '<div class="form-shell" style="max-width:640px;margin-top:20px;">' +
      '<h3>⚙️ Tentang Fonnte</h3>' +
      '<p class="hint">Sejak pembaruan ini, notifikasi WA TIDAK LAGI butuh layanan Fonnte untuk pemakaian normal — notifikasi ke tenant memakai tombol "Kirim WA" (link <code>wa.me</code> langsung dari browser panitia), dan notifikasi pendaftar baru ke panitia memakai Notifikasi Browser real-time (bukan WA). Edge Function <code>kirim-notifikasi-wa-bazar</code>, <code>notifikasi-bazar-baru</code>, serta secret <code>FONNTE_TOKEN</code>/<code>FONNTE_TARGET_PANITIA</code> sengaja dibiarkan ada (tidak dihapus) kalau suatu saat ingin diaktifkan lagi, tapi tidak dipanggil dari halaman ini. Lihat README.md bagian "Setup Notifikasi WhatsApp" untuk detail arsitektur barunya.</p>' +
    '</div>';

  document.getElementById("btn-simpan-wabazar-diterima").addEventListener("click", async function () {
    const btn = this;
    const errEl = document.getElementById("wabazar-diterima-error");
    const statusEl = document.getElementById("wabazar-diterima-status");
    errEl.style.display = "none";

    const teks = document.getElementById("wabazar-template-diterima").value;
    if (!teks.trim()) {
      errEl.textContent = "Pesan tidak boleh kosong.";
      errEl.style.display = "block";
      return;
    }
    const linkGrupBaru = document.getElementById("wabazar-link-grup").value.trim();

    btn.disabled = true;
    btn.textContent = "Menyimpan...";
    const { error: errSimpan } = await supabaseClient
      .from("bazar_settings")
      .update({ wa_template_diterima: teks, link_grup_wa: linkGrupBaru || null })
      .eq("id", 1);
    btn.disabled = false;
    btn.textContent = "Simpan";

    if (errSimpan) {
      errEl.textContent = "Gagal menyimpan: " + errSimpan.message;
      errEl.style.display = "block";
      return;
    }
    _cacheBazarSettingsWABazar = null; // supaya link "Kirim WA" berikutnya langsung pakai template/link grup baru, tanpa perlu reload halaman
    statusEl.textContent = "Tersimpan.";
    setTimeout(function () { statusEl.textContent = ""; }, 3000);
  });

  document.getElementById("btn-simpan-wabazar-panitia").addEventListener("click", async function () {
    const btn = this;
    const errEl = document.getElementById("wabazar-panitia-error");
    const statusEl = document.getElementById("wabazar-panitia-status");
    errEl.style.display = "none";

    const teks = document.getElementById("wabazar-template-panitia").value;
    if (!teks.trim()) {
      errEl.textContent = "Pesan tidak boleh kosong.";
      errEl.style.display = "block";
      return;
    }

    btn.disabled = true;
    btn.textContent = "Menyimpan...";
    const { error: errSimpan } = await supabaseClient
      .from("bazar_settings")
      .update({ wa_template_panitia_baru: teks })
      .eq("id", 1);
    btn.disabled = false;
    btn.textContent = "Simpan";

    if (errSimpan) {
      errEl.textContent = "Gagal menyimpan: " + errSimpan.message;
      errEl.style.display = "block";
      return;
    }
    statusEl.textContent = "Tersimpan.";
    setTimeout(function () { statusEl.textContent = ""; }, 3000);
  });
}

/* ==================== POSTER REKAP PENDAFTAR STAND (tab "Data Tenant") ====================
   Desain "Editorial Gelap, Meriah" -- redesain total atas permintaan user
   (desain lama berupa header terakota terang dengan badge logo bulat & mini
   peta petak per stand sudah DIBUANG). SENGAJA dibuat beda total dari poster
   rekap Lomba (`gambarPosterRekap()` di view-admin.js), dan beda total juga
   dari poster Bazar versi sebelumnya:
     - Latar GELAP gradasi radial coklat-kehitaman (bukan krem terang) dengan
       bingkai garis emas tipis berlapis di tepi atas & bawah, ditaburi
       lentera (🏮) & bintang (✦) kecil bertema pasar malam -- bukan konfeti
       emoji pasar siang seperti versi lama.
     - Logo PNG FLAT, TANPA badge/latar bulat apa pun (langsung di atas latar
       gelap) -- user eksplisit minta "logo png saja tanpa background bulat",
       beda dari versi lama yang menaruh logo di dalam badge kartu putih
       bundar (lihat histori di git log kalau perlu bandingkan).
     - Judul gradasi emas-jingga + pita miring "STAND TERUS BERTAMBAH!" warna
       merah sebagai aksen meriah (ganti pita teal "SEWA STAND SEKARANG" di
       pojok kiri atas versi lama).
     - Angka TOTAL pendaftar besar dengan efek glow emas, rata kanan atas --
       bukan di footer kecil seperti versi lama.
     - Baris per JENIS STAND (A/B/C) menampilkan ikon + nama + angka
       terpakai/total + progress bar gradasi warna jenis -- TIDAK ADA lagi
       mini "peta petak" kotak-kotak kecil (user eksplisit minta "kotak
       stand tidak perlu tampil").
   Helper global yang DIPAKAI ULANG dari view-admin.js (file itu dimuat
   lebih dulu di index.html, berbagi satu scope global yang sama -- lihat
   catatan panjang soal ini di seluruh proyek): `bukaModal()`, `kotakBulat()`,
   `muatGambar()`, `escapeHTML()`. Nama konstanta/fungsi BARU di bawah ini
   semua diberi akhiran `Bazar`/`_BAZAR` supaya TIDAK bertabrakan dengan versi
   Lomba yang sudah ada (mis. `POSTER_BAZAR_LEBAR_PX` vs `POSTER_LEBAR_PX`). */

const POSTER_BAZAR_LEBAR_PX = 1080;
const POSTER_BAZAR_TINGGI_PX = 1350;

// Warna per jenis stand -- SAMA PERSIS dengan `WARNA_JENIS_DENAH_PUBLIK` di
// view-daftarbazar.js (biar konsisten dengan denah), tapi nama konstanta
// dibedakan (`_POSTER` di sini) karena berbagi scope global yang sama.
const WARNA_JENIS_POSTER = { A: "#e08a2e", B: "#3f7fb0", C: "#d1588f" };

// Taburan lentera (🏮) & bintang (✦) kecil bertema pasar malam di latar
// gelap -- pengganti konfeti emoji pasar siang milik versi lama. Posisi
// TETAP (bukan acak) supaya poster yang sama selalu identik tiap digambar
// ulang.
const KONFETI_HEADER_BAZAR = [
  { x: 950, y: 90, e: "🏮", s: 42, o: 0.9 },
  { x: 870, y: 190, e: "✦", s: 22, o: 0.7, c: "#e0a44e" },
  { x: 1000, y: 260, e: "🏮", s: 30, o: 0.7 },
  { x: 930, y: 330, e: "✦", s: 16, o: 0.6, c: "#e06aa8" },
  { x: 60, y: 520, e: "✦", s: 20, o: 0.55, c: "#4a9ad4" },
  { x: 1010, y: 600, e: "✦", s: 18, o: 0.5, c: "#e0a44e" },
  { x: 40, y: 780, e: "✦", s: 24, o: 0.5, c: "#e06aa8" },
  { x: 1020, y: 900, e: "✦", s: 16, o: 0.45, c: "#4a9ad4" },
  { x: 50, y: 1030, e: "✦", s: 20, o: 0.5, c: "#e0a44e" }
];

function gambarKonfetiHeaderBazar(ctx) {
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  KONFETI_HEADER_BAZAR.forEach(function (k) {
    ctx.globalAlpha = k.o;
    if (k.e === "✦") {
      ctx.fillStyle = k.c || "#e0a44e";
      ctx.font = "900 " + k.s + "px sans-serif";
    } else {
      ctx.fillStyle = "#000000"; // tidak dipakai (emoji berwarna sendiri), cuma biar fillStyle konsisten
      ctx.font = k.s + "px sans-serif";
    }
    ctx.fillText(k.e, k.x, k.y);
  });
  ctx.restore();
}

// Pita miring "STAND TERUS BERTAMBAH!" -- aksen meriah di bawah judul,
// ganti total dari pita CTA teal "SEWA STAND SEKARANG" pojok-kiri-atas
// milik versi lama.
function gambarPitaCTAPosterBazar(ctx) {
  ctx.save();
  ctx.translate(90, 430);
  ctx.rotate(-3 * Math.PI / 180);
  ctx.fillStyle = "#c23b3b";
  kotakBulat(ctx, 0, 0, 340, 54, 27);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.font = "800 21px 'Outfit', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("🎉 STAND TERUS BERTAMBAH!", 170, 34);
  ctx.restore();
}

// Hitung rekap per jenis stand (A/B/C) dari baris `bazar_tenant` (jumlah
// pendaftar) + baris `bazar_stand` (total & terpakai per jenis). `kodeList`
// tetap disimpan untuk kompatibilitas pemanggil lain yang mungkin
// memakainya, walau poster sendiri sudah tidak menggambar mini peta petak.
// Stand `milik_panitia` (migrasi 0049, disinkronkan otomatis dari tanda di
// tenant sejak migrasi 0050) SENGAJA dilewati total -- bukan bagian dari
// pendaftaran publik, jadi tidak boleh ikut menambah "total" maupun
// "terpakai" per jenis di rekap/poster ini. Tenant `milik_panitia` juga
// dilewati dari `totalPendaftar` untuk alasan yang sama.
function hitungRekapUntukPosterBazar(standRows, tenantRows) {
  const perJenis = {};
  (standRows || []).forEach(function (s) {
    if (s.milik_panitia) return;
    if (!perJenis[s.jenis]) perJenis[s.jenis] = { total: 0, terpakai: 0, kodeList: [] };
    perJenis[s.jenis].total++;
    if (s.tenant_id) perJenis[s.jenis].terpakai++;
    perJenis[s.jenis].kodeList.push(!!s.tenant_id);
  });
  const totalPendaftar = (tenantRows || []).filter(function (t) { return !t.milik_panitia; }).length;
  return { perJenis: perJenis, totalPendaftar: totalPendaftar };
}

function gambarPosterRekapBazar(canvas, logoImg, jenisStandInfo, perJenis, totalPendaftar) {
  canvas.width = POSTER_BAZAR_LEBAR_PX;
  canvas.height = POSTER_BAZAR_TINGGI_PX;
  const ctx = canvas.getContext("2d");
  const W = POSTER_BAZAR_LEBAR_PX, H = POSTER_BAZAR_TINGGI_PX;
  const marginX = 90;

  // -------- Latar gradasi gelap (bukan solid rata, biar lebih hidup) --------
  const bgGrad = ctx.createRadialGradient(W * 0.75, H * 0.08, 80, W * 0.5, H * 0.4, 1100);
  bgGrad.addColorStop(0, "#2a1d14");
  bgGrad.addColorStop(1, "#17100b");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  // -------- Bingkai dekor garis emas ganda di tepi atas & bawah --------
  ["top", "bottom"].forEach(function (pos) {
    const baseY = pos === "top" ? 0 : H;
    const dir = pos === "top" ? 1 : -1;
    for (let i = 0; i < 4; i++) {
      ctx.strokeStyle = "rgba(224,164,78," + (0.5 - i * 0.1) + ")";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, baseY + dir * (14 + i * 7));
      ctx.lineTo(W, baseY + dir * (14 + i * 7));
      ctx.stroke();
    }
  });

  gambarKonfetiHeaderBazar(ctx);

  // Lentera besar dekor pojok kanan bawah -- sangat tipis (opacity rendah)
  // & SENGAJA ditaruh di pojok kanan-bawah (bukan kiri-bawah) supaya tidak
  // pernah menimpa kartu jenis stand terakhir maupun teks footer.
  ctx.save();
  ctx.globalAlpha = 0.08;
  ctx.font = "260px sans-serif";
  ctx.textAlign = "right";
  ctx.textBaseline = "bottom";
  ctx.fillText("🏮", W + 70, H + 50);
  ctx.restore();

  // -------- Logo PNG FLAT, TANPA badge/latar bulat (sesuai permintaan) -----
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  const logoMaxW = 150, logoMaxH = 150, logoCx = 120, logoCy = 150;
  if (logoImg) {
    const skala = Math.min(logoMaxW / logoImg.width, logoMaxH / logoImg.height);
    const lw = logoImg.width * skala, lh = logoImg.height * skala;
    ctx.drawImage(logoImg, logoCx - lw / 2, logoCy - lh / 2, lw, lh);
  } else {
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#e0a44e";
    ctx.font = "84px sans-serif";
    ctx.fillText("🏪", logoCx, logoCy + 8);
    ctx.restore();
  }

  // -------- Judul --------
  ctx.textAlign = "left";
  ctx.fillStyle = "#f3e6d3";
  ctx.font = "700 22px 'Outfit', sans-serif";
  ctx.fillText("✦ ALIF 5.0 · AL AZZAAM ISLAMIC FAIR ✦", 90, 240);
  ctx.font = "900 60px 'Outfit', sans-serif";
  ctx.fillStyle = "#ffffff";
  ctx.fillText("Rekap Pendaftar", 90, 312);
  const gradTeks = ctx.createLinearGradient(90, 0, 520, 0);
  gradTeks.addColorStop(0, "#f3c26b");
  gradTeks.addColorStop(1, "#e0804e");
  ctx.fillStyle = gradTeks;
  ctx.fillText("Stand Bazar 🎪", 90, 382);

  gambarPitaCTAPosterBazar(ctx);

  // -------- Angka total dengan GLOW emas di belakangnya --------
  ctx.save();
  ctx.shadowColor = "rgba(224,164,78,0.65)";
  ctx.shadowBlur = 55;
  ctx.textAlign = "right";
  ctx.fillStyle = "#e0a44e";
  ctx.font = "900 260px 'Outfit', sans-serif";
  ctx.fillText(String(totalPendaftar), W - 90, 700);
  ctx.restore();
  ctx.textAlign = "right";
  ctx.font = "800 30px 'Outfit', sans-serif";
  ctx.fillStyle = "#f3e6d3";
  ctx.fillText("✦ PENDAFTAR STAND ✦", W - 90, 745);

  // -------- Garis pemisah gradasi (bukan solid polos) --------
  const gradGaris = ctx.createLinearGradient(90, 0, W - 90, 0);
  gradGaris.addColorStop(0, "rgba(224,164,78,0)");
  gradGaris.addColorStop(0.5, "rgba(224,164,78,0.6)");
  gradGaris.addColorStop(1, "rgba(224,164,78,0)");
  ctx.strokeStyle = gradGaris;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(90, 800);
  ctx.lineTo(W - 90, 800);
  ctx.stroke();

  // -------- Baris per jenis stand (A/B/C) -- ikon + angka + progress bar
  // gradasi warna jenis, TANPA mini peta petak kotak-kotak (dibuang sesuai
  // permintaan user) --------
  const URUTAN_JENIS_POSTER = ["A", "B", "C"];
  const daftarJenis = URUTAN_JENIS_POSTER.filter(function (j) { return jenisStandInfo[j]; });
  const ikonJenis = { A: "🏪", B: "🛍️", C: "🧺" };
  // Jarak antar-baris TETAP 150px (bukan dihitung dinamis dari sisa ruang) --
  // itu jarak yang sudah diverifikasi pas di sampel yang disetujui user.
  // `URUTAN_JENIS_POSTER` di atas selalu cuma A/B/C (3 jenis, hardcode),
  // jadi 3 baris x150px selalu muat di tinggi kanvas 1350px.
  const tinggiBaris = 150;

  let y = 870;
  daftarJenis.forEach(function (j) {
    const info = jenisStandInfo[j] || {};
    const d = perJenis[j] || { total: 0, terpakai: 0 };
    const warna = WARNA_JENIS_POSTER[j] || "#777777";

    ctx.textAlign = "left";
    ctx.font = "44px sans-serif";
    ctx.fillText(ikonJenis[j] || "🏪", 90, y + 16);
    ctx.fillStyle = warna;
    ctx.font = "800 38px 'Outfit', sans-serif";
    ctx.fillText("Jenis " + j + " — " + (info.nama || ("Jenis " + j)), 150, y);

    ctx.textAlign = "right";
    ctx.fillStyle = "#ffffff";
    ctx.font = "800 44px 'Outfit', sans-serif";
    ctx.fillText(d.terpakai + "/" + d.total, W - 90, y);

    const barY = y + 24, barW = W - 240;
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    kotakBulat(ctx, 150, barY, barW, 12, 6);
    ctx.fill();
    const proporsi = d.total > 0 ? Math.min(1, d.terpakai / d.total) : 0;
    if (proporsi > 0) {
      const gradBar = ctx.createLinearGradient(150, 0, 150 + barW, 0);
      gradBar.addColorStop(0, warna);
      gradBar.addColorStop(1, "#f3e6d3");
      ctx.fillStyle = gradBar;
      kotakBulat(ctx, 150, barY, barW * proporsi, 12, 6);
      ctx.fill();
    }

    ctx.textAlign = "left";
    ctx.font = "500 20px 'Plus Jakarta Sans', sans-serif";
    ctx.fillStyle = "#9a8a76";
    ctx.fillText((info.ukuran || "-") + " · Rp" + Number(info.harga || 0).toLocaleString("id-ID"), 150, barY + 46);

    y += tinggiBaris;
  });

  // -------- Footer --------
  ctx.textAlign = "center";
  ctx.fillStyle = "#b39a78";
  ctx.font = "500 22px 'Plus Jakarta Sans', sans-serif";
  const tanggalCetak = new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
  ctx.fillText("✦ Diperbarui " + tanggalCetak + " · PPTQ Al Azzaam ✦", W / 2, H - 50);
}

function buatCaptionPosterRekapBazar(jenisStandInfo, perJenis, totalPendaftar) {
  const tanggalCetak = new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
  const URUTAN_JENIS_POSTER = ["A", "B", "C"];
  const baris = URUTAN_JENIS_POSTER.filter(function (j) { return jenisStandInfo[j]; }).map(function (j) {
    const info = jenisStandInfo[j];
    const d = perJenis[j] || { total: 0, terpakai: 0 };
    return "🏪 Jenis " + j + " (" + (info.nama || "") + "): " + d.terpakai + "/" + d.total + " stand terisi";
  }).join("\n");

  return (
    "📢 REKAP PENDAFTAR STAND BAZAR ALIF 5.0 — Al Azzaam Islamic Fair\n" +
    "Update per " + tanggalCetak + "\n\n" +
    baris + "\n\n" +
    "Total pendaftar stand: " + totalPendaftar + "\n\n" +
    "Stand terbatas, yuk segera daftarkan usaha/produkmu! 🛍️🔥\n" +
    "#ALIF5 #BazarALIF #AlAzzaamIslamicFair #PPTQAlAzzaam"
  );
}

async function bukaPosterRekapBazar(tenantRows) {
  bukaModal(
    "🖼️ Poster Rekap Pendaftar Stand",
    '<p class="hint">Memuat logo & menyiapkan poster...</p>'
  );

  // Dibungkus try/catch -- lihat komentar yang sama di `bukaPosterRekap()`
  // versi Lomba (view-admin.js) untuk alasannya (supaya tidak macet
  // selamanya di pesan "Memuat logo..." kalau ada langkah yang gagal).
  try {
  const [{ data: settingsData }, { data: siteSettingsData }, { data: standRows }] = await Promise.all([
    supabaseClient.from("bazar_settings").select("jenis_stand_info").eq("id", 1).single(),
    supabaseClient.from("site_settings").select("logo_url").eq("id", 1).single(),
    supabaseClient.from("bazar_stand").select("jenis,kode,tenant_id,milik_panitia").order("jenis").order("nomor")
  ]);

  const jenisStandInfo = (settingsData && settingsData.jenis_stand_info) || {};
  const logoUrl = siteSettingsData ? siteSettingsData.logo_url : null;
  const { perJenis, totalPendaftar } = hitungRekapUntukPosterBazar(standRows || [], tenantRows);

  let logoImg = null;
  if (logoUrl) {
    try { logoImg = await muatGambar(logoUrl); }
    catch (e) { console.warn("Logo situs gagal dimuat untuk poster bazar, dipakai ikon toko sebagai gantinya:", e); }
  }

  const caption = buatCaptionPosterRekapBazar(jenisStandInfo, perJenis, totalPendaftar);

  const overlay = document.getElementById("modal-overlay");
  if (!overlay || overlay.style.display === "none") {
    return; // modal sudah ditutup sebelum logo selesai dimuat
  }

  bukaModal(
    "🖼️ Poster Rekap Pendaftar Stand",
    '<p class="hint">Rasio 4:5, resolusi ' + POSTER_BAZAR_LEBAR_PX + '×' + POSTER_BAZAR_TINGGI_PX + 'px — cukup tajam untuk diunggah ke Instagram/WhatsApp. Angkanya otomatis dari data "Data Tenant" saat ini.</p>' +
    '<div class="poster-rekap-preview-wrap">' +
      '<canvas id="poster-rekap-bazar-canvas"></canvas>' +
    '</div>' +
    '<div class="submit-row" style="display:flex;gap:10px;flex-wrap:wrap;margin-top:14px;">' +
      '<button type="button" class="btn btn--primary" id="btn-unduh-poster-rekap-bazar">⬇️ Unduh PNG</button>' +
      '<button type="button" class="btn btn--ghost" id="btn-ulang-poster-rekap-bazar">🔄 Muat Ulang Data</button>' +
    '</div>' +
    '<div class="field" style="margin-top:18px;">' +
      '<label for="poster-caption-bazar-text">Caption (bisa diedit sebelum disalin)</label>' +
      '<textarea id="poster-caption-bazar-text" rows="10">' + escapeHTML(caption) + '</textarea>' +
    '</div>' +
    '<div class="submit-row" style="display:flex;gap:10px;">' +
      '<button type="button" class="btn btn--ghost" id="btn-salin-caption-poster-bazar">📋 Salin Caption</button>' +
    '</div>' +
    '<p class="hint" id="poster-rekap-bazar-status" style="margin-top:8px;"></p>'
  );

  const canvas = document.getElementById("poster-rekap-bazar-canvas");
  gambarPosterRekapBazar(canvas, logoImg, jenisStandInfo, perJenis, totalPendaftar);

  document.getElementById("btn-unduh-poster-rekap-bazar").addEventListener("click", function () {
    canvas.toBlob(function (blob) {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "poster-rekap-bazar-alif5-" + new Date().toISOString().slice(0, 10) + ".png";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
    }, "image/png");
  });

  document.getElementById("btn-ulang-poster-rekap-bazar").addEventListener("click", async function () {
    const [{ data: tenantBaru }, { data: standBaru }] = await Promise.all([
      supabaseClient.from("bazar_tenant").select("*"),
      supabaseClient.from("bazar_stand").select("jenis,kode,tenant_id,milik_panitia").order("jenis").order("nomor")
    ]);
    const ulang = hitungRekapUntukPosterBazar(standBaru || [], tenantBaru || tenantRows);
    gambarPosterRekapBazar(canvas, logoImg, jenisStandInfo, ulang.perJenis, ulang.totalPendaftar);
    document.getElementById("poster-caption-bazar-text").value = buatCaptionPosterRekapBazar(jenisStandInfo, ulang.perJenis, ulang.totalPendaftar);
    const statusEl = document.getElementById("poster-rekap-bazar-status");
    statusEl.textContent = "Data diperbarui.";
    setTimeout(function () { statusEl.textContent = ""; }, 2500);
  });

  document.getElementById("btn-salin-caption-poster-bazar").addEventListener("click", async function () {
    const teks = document.getElementById("poster-caption-bazar-text").value;
    const statusEl = document.getElementById("poster-rekap-bazar-status");
    try {
      await navigator.clipboard.writeText(teks);
      statusEl.textContent = "Caption tersalin ke clipboard.";
    } catch (e) {
      const area = document.getElementById("poster-caption-bazar-text");
      area.focus();
      area.select();
      statusEl.textContent = "Tidak bisa menyalin otomatis -- teks sudah diseleksi, tekan Ctrl+C (atau Cmd+C).";
    }
    setTimeout(function () { statusEl.textContent = ""; }, 3500);
  });
  } catch (err) {
    console.error("Poster Rekap Stand gagal dibuat:", err);
    const overlayGagal = document.getElementById("modal-overlay");
    if (!overlayGagal || overlayGagal.style.display === "none") return;
    bukaModal(
      "🖼️ Poster Rekap Pendaftar Stand",
      '<p>Gagal menyiapkan poster: ' + escapeHTMLBazarAdmin((err && err.message) || String(err)) + '</p>' +
      '<p class="hint">Coba lagi -- biasanya ini karena koneksi lambat/putus sesaat saat memuat logo situs.</p>' +
      '<div class="submit-row"><button type="button" class="btn btn--primary" id="btn-coba-lagi-poster-bazar">🔄 Coba Lagi</button></div>'
    );
    document.getElementById("btn-coba-lagi-poster-bazar").addEventListener("click", function () {
      bukaPosterRekapBazar(tenantRows);
    });
  }
}

window.ViewAdminBazar = { template: ADMINBAZAR_TEMPLATE, init: initAdminBazar };
