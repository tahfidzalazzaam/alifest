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
  root.innerHTML =
    '<div class="admin-header">' +
      '<div><h1>Panel Panitia Bazar</h1><p>Masuk sebagai ' + session.user.email + '</p></div>' +
      '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">' +
        '<button type="button" class="btn btn--ghost" id="btn-logout-bazar">Keluar</button>' +
      '</div>' +
    '</div>' +
    '<div class="admin-tabs">' +
      '<button type="button" class="admin-tab is-active" data-tab="tenant">Data Tenant</button>' +
      '<button type="button" class="admin-tab" data-tab="pengaturan">Pengaturan Bazar</button>' +
    '</div>' +
    '<div id="adminbazar-content"></div>';

  document.getElementById("btn-logout-bazar").addEventListener("click", async function () {
    await supabaseClient.auth.signOut();
    renderLoginBazar(root);
  });

  const tabs = root.querySelectorAll(".admin-tab");
  tabs.forEach(function (tab) {
    tab.addEventListener("click", function () {
      tabs.forEach(function (t) { t.classList.remove("is-active"); });
      tab.classList.add("is-active");
      const nama = tab.getAttribute("data-tab");
      if (nama === "tenant") loadTabTenant();
      if (nama === "pengaturan") loadTabPengaturanBazar();
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

  const { data, error } = await supabaseClient.from("bazar_tenant").select("*").order("created_at", { ascending: false });
  if (error) {
    content.innerHTML = "<p>Gagal memuat data tenant: " + error.message + "</p>";
    return;
  }

  let rows = data || [];

  content.innerHTML =
    '<div class="rekap-grid" id="bazar-rekap-grid"></div>' +
    '<div class="admin-filters">' +
      '<input type="text" id="filter-cari-bazar" placeholder="Cari nama usaha / nomor pendaftaran..." />' +
    '</div>' +
    '<p class="hint" id="jumlah-hint-bazar"></p>' +
    '<div class="table-wrap"><table class="admin-table" id="tabel-tenant"><thead><tr>' +
      '<th>Nomor</th><th>Nama Usaha</th><th>Jenis Produk</th><th>Kategori</th><th>PJ / WA</th><th>Berkas</th><th>Pembayaran</th><th>Status</th><th></th>' +
    '</tr></thead><tbody></tbody></table></div>';

  function renderRekapBazar() {
    const rekapEl = document.getElementById("bazar-rekap-grid");
    if (!rekapEl) return;
    const lunas = rows.filter(function (r) { return r.status_pembayaran === "Lunas"; }).length;
    const diterima = rows.filter(function (r) { return r.status === "Diterima"; }).length;
    rekapEl.innerHTML =
      '<div class="rekap-card is-active" data-filter=""><div class="rekap-card__label">Semua Tenant</div><div class="rekap-card__total">' + rows.length + '</div></div>' +
      '<div class="rekap-card" data-filter="lunas"><div class="rekap-card__label">💰 Lunas</div><div class="rekap-card__total">' + lunas + '</div></div>' +
      '<div class="rekap-card" data-filter="diterima"><div class="rekap-card__label">✅ Diterima</div><div class="rekap-card__total">' + diterima + '</div></div>';
  }

  let filterAktif = "";

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
      const fotoList = Array.isArray(r.url_foto_produk) ? r.url_foto_produk : [];
      const berkasCell =
        fotoList.map(function (u, i) { return '<a href="' + u + '" target="_blank" rel="noopener">Foto #' + (i + 1) + '</a>'; }).join(" · ") +
        (r.url_bukti_bayar ? ((fotoList.length ? " · " : "") + '<a href="' + r.url_bukti_bayar + '" target="_blank" rel="noopener">Bukti Bayar</a>') : "");

      return (
        '<tr>' +
          '<td>' + r.nomor_pendaftaran + '</td>' +
          '<td class="col-truncate" title="' + escapeHTMLBazarAdmin(r.nama_usaha) + '">' + escapeHTMLBazarAdmin(r.nama_usaha) + '</td>' +
          '<td class="col-truncate" title="' + escapeHTMLBazarAdmin(r.jenis_produk) + '">' + escapeHTMLBazarAdmin(r.jenis_produk) + '</td>' +
          '<td>' + escapeHTMLBazarAdmin(r.kategori_stand) + '</td>' +
          '<td>' + escapeHTMLBazarAdmin(r.nama_penanggung_jawab) + '<br/>' + escapeHTMLBazarAdmin(r.whatsapp) + '</td>' +
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
          '</select></td>' +
          '<td><button type="button" class="btn-remove btn-hapus-tenant" data-id="' + r.id + '">Hapus</button></td>' +
        '</tr>'
      );
    }).join("");

    tbody.querySelectorAll(".status-select").forEach(function (sel) {
      sel.addEventListener("change", async function () {
        const id = sel.getAttribute("data-id");
        const field = sel.getAttribute("data-field");
        const nilaiBaru = sel.value;
        const payload = {};
        payload[field] = nilaiBaru;
        const { error } = await supabaseClient.from("bazar_tenant").update(payload).eq("id", id);
        if (error) {
          alert("Gagal mengubah " + field + ": " + error.message);
          return;
        }
        const row = rows.find(function (r) { return r.id === id; });
        if (row) row[field] = nilaiBaru;
        renderRekapBazar();
      });
    });

    tbody.querySelectorAll(".btn-hapus-tenant").forEach(function (btn) {
      btn.addEventListener("click", async function () {
        const id = btn.getAttribute("data-id");
        const row = rows.find(function (r) { return r.id === id; });
        const label = row ? (row.nama_usaha + " (" + row.nomor_pendaftaran + ")") : "";
        if (!confirm('Hapus pendaftaran tenant "' + label + '"? Berkas yang sudah diunggah (foto produk, bukti bayar) juga akan ikut terhapus permanen. Tindakan ini tidak bisa dibatalkan.')) return;

        btn.disabled = true;
        btn.textContent = "Menghapus...";

        if (row) {
          const fotoList = Array.isArray(row.url_foto_produk) ? row.url_foto_produk : [];
          const pathBerkas = fotoList.concat([row.url_bukti_bayar])
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
      });
    });
  }

  renderRekapBazar();
  renderBarisBazar();
  document.getElementById("filter-cari-bazar").addEventListener("input", renderBarisBazar);

  document.querySelectorAll("#bazar-rekap-grid .rekap-card").forEach(function (card) {
    card.addEventListener("click", function () {
      document.querySelectorAll("#bazar-rekap-grid .rekap-card").forEach(function (c) { c.classList.remove("is-active"); });
      card.classList.add("is-active");
      filterAktif = card.getAttribute("data-filter");
      renderBarisBazar();
    });
  });
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

  const kategoriList = Array.isArray(settings.kategori_list) ? settings.kategori_list : [];

  content.innerHTML =
    '<div class="form-shell" style="max-width:640px;">' +
      '<div class="field">' +
        '<label style="display:flex;align-items:center;gap:10px;cursor:pointer;">' +
          '<input type="checkbox" id="bazar-toggle-dibuka" ' + (settings.pendaftaran_dibuka !== false ? "checked" : "") + ' />' +
          '<span>Pendaftaran bazar dibuka untuk publik</span>' +
        '</label>' +
      '</div>' +

      '<div class="field">' +
        '<label for="bazar-kuota-total">Kuota Total Stand <span style="font-weight:400;">(kosongkan = tidak dibatasi)</span></label>' +
        '<input type="number" id="bazar-kuota-total" min="0" value="' + (settings.kuota_total != null ? settings.kuota_total : "") + '" />' +
      '</div>' +

      '<div class="field">' +
        '<label for="bazar-kategori-text">Daftar Kategori/Ukuran Stand <span style="font-weight:400;">(satu per baris)</span></label>' +
        '<textarea id="bazar-kategori-text" rows="4">' + escapeHTMLBazarAdmin(kategoriList.join("\n")) + '</textarea>' +
        '<p class="hint" style="margin-top:4px;">Ini pilihan yang akan muncul di formulir pendaftaran publik "/bazar". Ubah kapan saja, langsung berlaku untuk pendaftar berikutnya (data tenant yang sudah daftar tidak ikut berubah).</p>' +
      '</div>' +

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

    const kuotaRaw = document.getElementById("bazar-kuota-total").value.trim();
    const kuotaTotal = kuotaRaw === "" ? null : parseInt(kuotaRaw, 10);
    if (kuotaRaw !== "" && (isNaN(kuotaTotal) || kuotaTotal < 0)) {
      errorEl.textContent = "Kuota total harus angka 0 atau lebih (atau dikosongkan).";
      errorEl.style.display = "block";
      return;
    }

    const kategoriBaru = document.getElementById("bazar-kategori-text").value
      .split("\n")
      .map(function (s) { return s.trim(); })
      .filter(Boolean);
    if (kategoriBaru.length === 0) {
      errorEl.textContent = "Isi minimal satu kategori/ukuran stand.";
      errorEl.style.display = "block";
      return;
    }

    btn.disabled = true;
    btn.textContent = "Menyimpan...";

    const { error: errSimpan } = await supabaseClient.from("bazar_settings").update({
      pendaftaran_dibuka: document.getElementById("bazar-toggle-dibuka").checked,
      kuota_total: kuotaTotal,
      kategori_list: kategoriBaru,
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

window.ViewAdminBazar = { template: ADMINBAZAR_TEMPLATE, init: initAdminBazar };
