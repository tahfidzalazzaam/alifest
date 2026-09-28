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

async function renderDashboard(root, session) {
  const { data: settings } = await supabaseClient.from("site_settings").select("pendaftaran_dibuka").eq("id", 1).single();
  let dibuka = !settings || settings.pendaftaran_dibuka !== false;

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
  function perbaruiTombolToggle() {
    btnToggle.className = "btn " + (dibuka ? "btn--primary" : "btn--ghost");
    btnToggle.textContent = dibuka ? "🟢 Pendaftaran Dibuka" : "🔒 Pendaftaran Ditutup";
    btnToggle.title = dibuka ? "Ketuk untuk menutup pendaftaran" : "Ketuk untuk membuka pendaftaran";
  }
  perbaruiTombolToggle();

  btnToggle.addEventListener("click", async function () {
    const aksi = dibuka ? "menutup" : "membuka";
    if (!confirm('Yakin ingin ' + aksi + ' pendaftaran? Perubahan langsung berlaku di situs publik.')) return;

    btnToggle.disabled = true;
    const { error } = await supabaseClient.from("site_settings").update({ pendaftaran_dibuka: !dibuka }).eq("id", 1);
    btnToggle.disabled = false;

    if (error) {
      alert("Gagal mengubah status: " + error.message);
      return;
    }
    dibuka = !dibuka;
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

// Ambil path relatif (di dalam bucket) dari URL publik Supabase Storage,
// supaya bisa dipakai untuk storage.remove().
function ekstrakPathBerkas(url) {
  const penanda = "/object/public/berkas-pendaftaran/";
  const idx = url.indexOf(penanda);
  if (idx === -1) return null;
  return decodeURIComponent(url.substring(idx + penanda.length));
}

// Nomor pendaftaran (mis. "MHQ-005") hanya dimundurkan kalau yang dihapus
// adalah nomor TERAKHIR untuk lomba itu — supaya tidak pernah membuat dua
// pendaftaran punya nomor yang sama. Kalau yang dihapus bukan nomor
// terakhir, urutan dibiarkan bolong (aman, tidak ada risiko tabrakan nomor).
// Efeknya: hapus semua data uji coba satu per satu (urutan bebas) akan
// otomatis mengembalikan hitungan ke 0.
async function mundurkanNomorJikaTerakhir(lombaId, nomorPendaftaran) {
  const bagian = nomorPendaftaran.split("-");
  const angka = parseInt(bagian[bagian.length - 1], 10);
  if (isNaN(angka)) return;

  const { data: counterRow } = await supabaseClient.from("lomba_counter").select("jumlah").eq("lomba_id", lombaId).single();
  if (!counterRow || counterRow.jumlah !== angka) return;

  await supabaseClient.from("lomba_counter").update({ jumlah: angka - 1 }).eq("lomba_id", lombaId);
}

/* -------- Popup detail tim (Futsal): dibuka dengan mengetuk baris -------- */
async function bukaModalTim(row) {
  const infoHTML =
    '<div class="modal-tim-info">' +
      '<div><strong>Nama Tim/Sekolah:</strong> ' + row.nama_tim + '</div>' +
      '<div><strong>Nama Pendamping:</strong> ' + (row.pembina || "-") + '</div>' +
      '<div><strong>No. WA Pendamping:</strong> ' + row.whatsapp + '</div>' +
      '<div><strong>Nomor Pendaftaran:</strong> ' + row.nomor_pendaftaran + '</div>' +
    '</div>' +
    '<div class="modal-tim-berkas">' +
      '<strong>Berkas:</strong> ' +
      (row.url_surat_delegasi ? '<a href="' + row.url_surat_delegasi + '" target="_blank" rel="noopener">Surat Delegasi</a>' : '<span class="hint">Delegasi -</span>') +
      ' · ' + (row.url_bukti_follow_ig ? '<a href="' + row.url_bukti_follow_ig + '" target="_blank" rel="noopener">Bukti IG</a>' : '<span class="hint">IG -</span>') +
      ' · Kartu Anggota: ' + renderDaftarBerkasTim(row.url_berkas_tim) +
    '</div>' +
    '<h4 style="margin-top:16px;">Anggota Tim</h4>' +
    '<div id="modal-tim-anggota"><p class="hint">Memuat data anggota tim...</p></div>';

  bukaModal("Detail Tim — " + row.nama_tim, infoHTML);

  const { data: anggota, error } = await supabaseClient
    .from("anggota_tim").select("*").eq("nomor_pendaftaran", row.nomor_pendaftaran).order("created_at");

  const wrap = document.getElementById("modal-tim-anggota");
  if (!wrap) return; // modal sudah ditutup sebelum data selesai dimuat

  wrap.innerHTML = error
    ? ('<p>Gagal memuat anggota tim: ' + error.message + '</p>')
    : (
      '<table class="admin-table modal-table"><thead><tr><th>#</th><th>Nama</th><th>Tempat, Tanggal Lahir</th><th>Kelas</th></tr></thead><tbody>' +
      (anggota && anggota.length ? anggota.map(function (a, i) {
        return '<tr><td>' + (i + 1) + '</td><td>' + a.nama + '</td><td>' + (a.tempat_tanggal_lahir || "-") + '</td><td>' + a.kelas + '</td></tr>';
      }).join("") : '<tr><td colspan="4">Belum ada data anggota.</td></tr>') +
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

  const rulesRes = await supabaseClient.from("lomba_rules").select("id,nama,ikon,jenjang,kuota").order("urutan");
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

      if (efektif !== null) {
        const kapasitasTotal = efektif * jenjangList.length * 2;
        totalLabel = d.total + ' / ' + kapasitasTotal;
        genderLabel = jenjangList.map(function (j) {
          const jd = d.perJenjang[j] || { l: 0, p: 0 };
          return '<span class="rekap-chip">' + j + ': L ' + jd.l + '/' + efektif + ' · P ' + jd.p + '/' + efektif + '</span>';
        }).join("");
      } else {
        genderLabel = '<span class="rekap-chip">L: ' + d.l + ' · P: ' + d.p + '</span>';
      }

      return '<div class="rekap-card' + (lombaFilter === r.id ? " is-active" : "") + '" data-lomba="' + r.id + '">' +
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
      const tombolTim = isTim ? ' <span class="lp-badge lp-badge--tim">TIM · ketuk baris</span>' : "";
      const lpBadge = r.jenis_kelamin === "perempuan" ? "P" : r.jenis_kelamin === "laki-laki" ? "L" : "-";
      const tipeIkon = r.tipe_pendaftar === "lembaga" ? "🏫" : "🎓";
      const tipeJudul = r.tipe_pendaftar === "lembaga"
        ? ("Perwakilan Lembaga" + (r.penanggung_jawab_lembaga ? " · PJ: " + r.penanggung_jawab_lembaga : ""))
        : "Peserta Individu";
      const lahirUsia = isTim ? "-" : (formatTanggalLahir(r.tanggal_lahir) + (r.usia != null ? " (" + r.usia + "th)" : ""));
      const kelasLabel = isTim ? "-" : (r.jenjang + '/' + r.kelas);

      const berkasCell = isTim
        ? ('<button type="button" class="btn-link btn-lihat-tim" data-id="' + r.id + '">Lihat berkas</button>')
        : ('<a href="' + r.url_kartu_pelajar + '" target="_blank" rel="noopener">Kartu</a> · ' +
            (r.url_bukti_follow_ig ? '<a href="' + r.url_bukti_follow_ig + '" target="_blank" rel="noopener">IG</a>' : '<span class="hint">IG -</span>'));

      return (
        '<tr class="' + (isTim ? "row-clickable" : "") + '" data-id="' + r.id + '">' +
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
            ["Menunggu Verifikasi", "Perlu Verifikasi Usia", "Diterima", "Ditolak"].map(function (s) {
              return '<option value="' + s + '"' + (s === r.status ? " selected" : "") + '>' + s + "</option>";
            }).join("") +
          '</select> <span class="wa-status-note" data-note-for="' + r.id + '"></span></td>' +
          '<td><button type="button" class="btn-remove btn-hapus-pendaftar" data-id="' + r.id + '">Hapus</button></td>' +
        '</tr>'
      );
    }).join("");

    // Baris tim (Futsal) bisa diketuk di mana saja untuk membuka popup detail
    // anggota tim -- kecuali kalau yang diketuk adalah tombol/dropdown di
    // dalam baris itu sendiri (status, hapus, lihat berkas), supaya tidak
    // bentrok dengan aksi masing-masing.
    tbody.querySelectorAll("tr.row-clickable").forEach(function (tr) {
      tr.addEventListener("click", function (e) {
        if (e.target.closest("select, button, a")) return;
        const id = tr.getAttribute("data-id");
        const row = rows.find(function (r) { return r.id === id; });
        if (row) bukaModalTim(row);
      });
    });

    tbody.querySelectorAll(".btn-lihat-tim").forEach(function (btn) {
      btn.addEventListener("click", function () {
        const id = btn.getAttribute("data-id");
        const row = rows.find(function (r) { return r.id === id; });
        if (row) bukaModalTim(row);
      });
    });

    tbody.querySelectorAll(".status-select").forEach(function (sel) {
      sel.addEventListener("change", async function () {
        const id = sel.getAttribute("data-id");
        const statusBaru = sel.value;
        const { error } = await supabaseClient.from("pendaftaran").update({ status: statusBaru }).eq("id", id);
        if (error) {
          alert("Gagal mengubah status: " + error.message);
          return;
        }
        const row = rows.find(function (r) { return r.id === id; });
        if (row) row.status = statusBaru;
        renderRekap();

        if (statusBaru === "Diterima" || statusBaru === "Ditolak") {
          kirimNotifikasiWA(id, sel);
        }
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
          const pathBerkas = [row.url_kartu_pelajar, row.url_bukti_follow_ig, row.url_surat_delegasi]
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

        if (row) await mundurkanNomorJikaTerakhir(row.lomba_id, row.nomor_pendaftaran);

        rows = rows.filter(function (r) { return r.id !== id; });
        renderBaris();
        renderRekap();
      });
    });

  }

  renderRekap();
  renderBaris();
  document.getElementById("filter-cari").addEventListener("input", renderBaris);
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
      '<th></th><th>Nama</th><th>Jenjang</th><th>Usia</th><th>Tipe</th><th>Gender</th><th>Kuota (jelas per jenjang &amp; gender)</th><th>Tgl. Pelaksanaan</th><th>Toleransi</th><th>Aktif</th><th></th>' +
    '</tr></thead><tbody></tbody></table></div>' +
    '<button type="button" class="btn btn--primary" id="btn-tambah-lomba" style="margin-top:16px;">+ Tambah Lomba</button>' +
    '<div id="form-lomba-wrap"></div>';

  // Kuota yang diisi admin dibagi rata per jenjang, lalu per gender --
  // ditampilkan gamblang per baris jenjang (bukan satu angka hasil bagi yang
  // ambigu), plus angka asli yang diisi panitia sebagai catatan kecil.
  function renderKuotaLomba(l) {
    if (l.kuota == null) return "Tanpa batas";
    const efektif = Math.floor(l.kuota / (l.jenjang.length || 1));
    const baris = l.jenjang.map(function (j) {
      return '<div>' + j + ': maks <strong>' + efektif + '</strong>/putra · <strong>' + efektif + '</strong>/putri</div>';
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
          '<td>' + (l.toleransi_tahun || 0) + ' th</td>' +
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
          '<div class="field-row">' +
            '<div class="field"><label>Tanggal Pelaksanaan</label><input type="date" id="lm-tanggal-pelaksanaan" value="' + (existing && existing.tanggal_pelaksanaan ? existing.tanggal_pelaksanaan : "") + '" />' +
              '<div class="hint">Acuan hitung usia peserta. Kosongkan untuk pakai tanggal hari ini.</div></div>' +
            '<div class="field"><label>Toleransi Usia (tahun)</label><input type="number" id="lm-toleransi" min="0" value="' + (existing && existing.toleransi_tahun != null ? existing.toleransi_tahun : 0) + '" />' +
              '<div class="hint">Selisih usia yang masih ditoleransi (masuk "Perlu Verifikasi Usia"), bukan langsung ditolak. 0 = tanpa toleransi.</div></div>' +
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
        toleransi_tahun: parseInt(document.getElementById("lm-toleransi").value, 10) || 0,
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

async function loadTabJuknis() {
  const content = document.getElementById("admin-content");
  content.innerHTML = '<p class="hint">Memuat data juknis...</p>';

  const { data } = await supabaseClient.from("site_settings").select("juknis_url,juknis_nama").eq("id", 1).single();
  const juknisUrl = data ? data.juknis_url : null;
  const juknisNama = data ? data.juknis_nama : null;

  content.innerHTML =
    '<div class="form-shell" style="max-width:480px;">' +
      '<h3>Petunjuk Teknis (Juknis)</h3>' +
      '<p>Format PDF saja. File ini akan muncul sebagai tombol unduh di Beranda dan halaman Daftar Lomba.</p>' +
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

const FIELD_PESERTA = [
  { key: "nama", label: "Nama" },
  { key: "jenjang", label: "Jenjang" },
  { key: "lomba", label: "Lomba" }
];
const FIELD_PENDAMPING = [
  { key: "nama", label: "Nama" },
  { key: "lomba", label: "Lomba/Sekolah" }
];
const DEFAULT_LAYOUT_KARTU = {
  peserta: {
    nama: { x: 40, y: 40, font: 28 },
    jenjang: { x: 40, y: 90, font: 20 },
    lomba: { x: 40, y: 125, font: 20 },
    qr: { x: 40, y: 170, size: 120 }
  },
  pendamping: {
    nama: { x: 40, y: 40, font: 28 },
    lomba: { x: 40, y: 90, font: 20 },
    qr: { x: 40, y: 140, size: 120 }
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
  canvas.width = templateImg.naturalWidth;
  canvas.height = templateImg.naturalHeight;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(templateImg, 0, 0);
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
    daftarData = rows.map(function (r) {
      return { nama: r.nama_lengkap, jenjang: r.jenjang, lomba: r.lomba_nama, qrText: "ALIF5-" + r.nomor_pendaftaran };
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
  const doc = new jsPDF({ unit: "px", format: [templateImg.naturalWidth, templateImg.naturalHeight] });

  daftarData.forEach(function (data, i) {
    gambarKartu(canvas, templateImg, layout, data, fields);
    const imgData = canvas.toDataURL("image/png");
    if (i > 0) doc.addPage([templateImg.naturalWidth, templateImg.naturalHeight]);
    doc.addImage(imgData, "PNG", 0, 0, templateImg.naturalWidth, templateImg.naturalHeight);
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
      '<p>Upload desain kartu (PNG), atur posisi nama/jenjang/lomba/QR lewat angka di bawah (pratinjau berubah langsung), lalu cetak kartu semua peserta sekaligus sebagai satu file PDF siap cetak. QR di tiap kartu berisi kode unik yang nanti dipakai untuk absen kedatangan & pemberian snack.</p>' +
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

async function loadTabNotifWa() {
  const content = document.getElementById("admin-content");
  content.innerHTML = '<p class="hint">Memuat pengaturan notifikasi WA...</p>';

  const { data } = await supabaseClient.from("site_settings").select("wa_notif_template").eq("id", 1).single();
  const template = (data && data.wa_notif_template) || "";

  content.innerHTML =
    '<div class="form-shell" style="max-width:640px;">' +
      '<h3>💬 Notifikasi WhatsApp (Fonnte)</h3>' +
      '<p>Pesan ini otomatis dikirim ke nomor WhatsApp pendaftar setiap kali status pendaftarannya diubah menjadi <strong>Diterima</strong> atau <strong>Ditolak</strong> di tab "Data Pendaftar". Anda bisa mengedit teksnya sendiri di sini kapan saja.</p>' +
      '<div class="field">' +
        '<label for="wa-template">Teks Pesan</label>' +
        '<textarea id="wa-template" rows="9">' + escapeHTML(template) + '</textarea>' +
        '<div class="hint">Placeholder yang bisa dipakai (otomatis diganti saat dikirim): <code>{nama}</code>, <code>{nomor}</code>, <code>{lomba}</code>, <code>{status}</code>.</div>' +
      '</div>' +
      '<div class="form-error" id="wa-template-error" style="display:none;"></div>' +
      '<div class="submit-row" style="display:flex;gap:10px;">' +
        '<button type="button" class="btn btn--primary" id="btn-simpan-wa-template">Simpan Pesan</button>' +
      '</div>' +
      '<p class="hint" id="wa-template-status" style="margin-top:10px;"></p>' +
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

    const teks = document.getElementById("wa-template").value;
    if (!teks.trim()) {
      errEl.textContent = "Pesan tidak boleh kosong.";
      errEl.style.display = "block";
      return;
    }

    btn.disabled = true;
    btn.textContent = "Menyimpan...";
    const { error } = await supabaseClient.from("site_settings").update({ wa_notif_template: teks }).eq("id", 1);
    btn.disabled = false;
    btn.textContent = "Simpan Pesan";

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
