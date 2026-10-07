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
      '<button type="button" class="admin-tab" data-tab="denah">Denah Stand</button>' +
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
      if (nama === "denah") loadTabDenahBazar();
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

  const [{ data, error }, { data: standData }] = await Promise.all([
    supabaseClient.from("bazar_tenant").select("*").order("created_at", { ascending: false }),
    supabaseClient.from("bazar_stand").select("kode,tenant_id").not("tenant_id", "is", null)
  ]);
  if (error) {
    content.innerHTML = "<p>Gagal memuat data tenant: " + error.message + "</p>";
    return;
  }

  let rows = data || [];

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

      const kodeList = kodeStandPerTenant[r.id] || [];
      return (
        '<tr>' +
          '<td>' + r.nomor_pendaftaran + '</td>' +
          '<td class="col-truncate" title="' + escapeHTMLBazarAdmin(r.nama_usaha) + '">' + escapeHTMLBazarAdmin(r.nama_usaha) + '</td>' +
          '<td class="col-truncate" title="' + escapeHTMLBazarAdmin(r.jenis_produk) + '">' + escapeHTMLBazarAdmin(r.jenis_produk) + '</td>' +
          '<td>' + escapeHTMLBazarAdmin(r.jenis_stand || r.kategori_stand || "-") + (kodeList.length ? ('<br/><span class="hint">' + kodeList.join(", ") + '</span>') : '') + '</td>' +
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

  const [{ data: standData, error }, { data: tenantData }, { data: elemenData, error: errorElemen }] = await Promise.all([
    supabaseClient.from("bazar_stand").select("id,jenis,area,nomor,kode,tenant_id,pos_x,pos_y,lebar,tinggi,rotasi").order("jenis").order("area").order("nomor"),
    supabaseClient.from("bazar_tenant").select("id,nama_usaha,nomor_pendaftaran,status"),
    supabaseClient.from("bazar_denah_elemen").select("*").order("urutan")
  ]);
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

  const totalTerisi = standList.filter(function (s) { return !!s.tenant_id; }).length;

  content.innerHTML =
    '<div class="admin-tabs" style="margin-bottom:16px;">' +
      '<button type="button" class="admin-tab is-active" data-subtab="daftar" style="font-size:14px;">📋 Tampilan Daftar</button>' +
      '<button type="button" class="admin-tab" data-subtab="visual" style="font-size:14px;">🖼️ Edit Denah Visual</button>' +
    '</div>' +
    '<p class="hint">' + totalTerisi + ' dari ' + standList.length + ' stand terisi. Stand otomatis dibebaskan lagi begitu status tenant penyewanya diubah jadi "Ditolak".</p>' +
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
          const sisa = standArea.filter(function (s) { return !s.tenant_id; }).length;
          return (
            '<div style="margin-bottom:14px;">' +
              '<p class="hint" style="margin:0 0 6px;font-weight:700;color:#1C2541;">' + escapeHTMLBazarAdmin(area) + ' <span style="font-weight:400;">(sisa ' + sisa + '/' + standArea.length + ')</span></p>' +
              '<div style="display:flex;flex-wrap:wrap;gap:8px;">' +
                standArea.map(function (s) {
                  const tenant = s.tenant_id ? tenantById[s.tenant_id] : null;
                  const terisi = !!s.tenant_id;
                  return (
                    '<div style="padding:8px 12px;border:1.5px solid ' + (terisi ? "#FBD9DA" : "#F6E3A8") + ';border-radius:8px;background:' + (terisi ? "#FDF3F3" : "#FFFFFF") + ';font-size:13px;min-width:120px;">' +
                      '<div style="font-weight:700;color:#1C2541;">' + escapeHTMLBazarAdmin(s.kode) + '</div>' +
                      (terisi
                        ? ('<div class="hint" style="margin:2px 0;">' + escapeHTMLBazarAdmin(tenant ? tenant.nama_usaha : "-") + '</div>' +
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
          const { error: errLepas } = await supabaseClient.from("bazar_stand").update({ tenant_id: null }).eq("id", id);
          if (errLepas) {
            alert("Gagal membebaskan stand: " + errLepas.message);
            btn.disabled = false;
            btn.textContent = "Kosongkan";
            return;
          }
          stand.tenant_id = null;
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

    subEl.innerHTML =
      '<p class="hint">Geser kotak untuk memindahkan lokasinya, tarik pojok kanan-bawah kotak untuk membesarkan/mengecilkan ukurannya, atau tarik BULATAN KECIL di atas kotak untuk memutar/memiringkannya (berlaku untuk kotak STAND maupun LABEL). Kode stand sendiri tetap tidak bisa diubah teksnya di sini -- klik sebuah LABEL bangunan/area (bukan menariknya) untuk mengedit teks, emoji, warna, atau menghapusnya.</p>' +
      '<div class="submit-row" style="margin-bottom:10px;flex-wrap:wrap;gap:8px;">' +
        '<button type="button" class="btn btn--primary" id="btn-simpan-denah-visual">💾 Simpan Tata Letak</button>' +
        '<button type="button" class="btn btn--ghost" id="btn-tambah-label-denah">➕ Tambah Kotak/Label</button>' +
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
        '<div id="denah-visual-outer" style="width:100%;max-width:900px;overflow:visible;position:relative;border:2px dashed #b9d9c2;border-radius:16px;background:#eef7ec;">' +
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

    function buatKotak(opsi) {
      // `el` sendiri TIDAK diberi `overflow:hidden` (beda dari sebelumnya) --
      // supaya handle resize & handle rotasi yang posisinya ada di PINGGIR/LUAR
      // kotak (pojok kanan-bawah, bulatan di atas kotak) tidak ikut terpotong.
      // Pembatasan teks supaya tidak meluber keluar kotak sekarang jadi
      // tanggung jawab `isiEl` (wrapper di dalamnya) yang overflow-nya
      // memang `hidden`.
      const el = document.createElement("div");
      el.setAttribute("data-id", opsi.id);
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

      el.addEventListener("pointerdown", function (e) {
        if (e.target !== el) return; // bukan drag kotak kalau yang diklik adalah handle resize/rotasi anaknya
        e.preventDefault();
        dragging = true;
        el.setPointerCapture(e.pointerId);
        startX = e.clientX; startY = e.clientY;
        startPosX = parseFloat(el.style.left); startPosY = parseFloat(el.style.top);
        el.style.cursor = "grabbing";
        el.style.zIndex = "50";
      });
      el.addEventListener("pointermove", function (e) {
        if (!dragging) return;
        // Menggeser kotak SELALU mengikuti arah mouse di layar apa adanya,
        // TIDAK perlu dikoreksi sudut rotasi -- beda dari resize di bawah
        // (lihat komentar di situ) karena menggeser cuma mengubah
        // `left`/`top`, bukan menghitung ulang sisi kotak yang sudah miring.
        const dx = (e.clientX - startX) / scale;
        const dy = (e.clientY - startY) / scale;
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
          const baruW = Math.max(30, startW + dxLokal);
          const baruH = Math.max(24, startH + dyLokal);
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
          bukaPanelEditLabel(opsi.id);
        });
      }

      return el;
    }

    function gambarSemua() {
      innerEl.innerHTML = "";
      elemenList.forEach(function (elm) {
        innerEl.appendChild(buatKotak({
          id: elm.id, tipe: "elemen",
          x: elm.pos_x, y: elm.pos_y, w: elm.lebar, h: elm.tinggi,
          rotasi: elm.rotasi,
          warnaBg: elm.warna_bg, warnaTeks: elm.warna_teks,
          label: elm.teks, sublabel: elm.emoji, bisaResize: true
        }));
      });
      standList.forEach(function (s) {
        const warna = WARNA_JENIS_DENAH[s.jenis] || "#777777";
        innerEl.appendChild(buatKotak({
          id: s.id, tipe: "stand",
          x: s.pos_x != null ? s.pos_x : 20, y: s.pos_y != null ? s.pos_y : 20,
          w: s.lebar || 54, h: s.tinggi || 40,
          rotasi: s.rotasi,
          warnaBg: s.tenant_id ? "#fde8e8" : warna,
          warnaTeks: s.tenant_id ? "#b91c1c" : "#ffffff",
          label: s.kode, bisaResize: true
        }));
      });
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

      '<h3 style="margin-top:28px;">Pengaturan Pendaftaran</h3>' +

      '<div class="field">' +
        '<label style="display:flex;align-items:center;gap:10px;cursor:pointer;">' +
          '<input type="checkbox" id="bazar-toggle-dibuka" ' + (settings.pendaftaran_dibuka !== false ? "checked" : "") + ' />' +
          '<span>Pendaftaran bazar dibuka untuk publik</span>' +
        '</label>' +
        '<p class="hint" style="margin-top:4px;">Kalau dimatikan, halaman form "/daftar-bazar" menampilkan pesan tertutup -- tapi halaman info "/bazar" TETAP bisa dibuka siapa saja (cuma tombol "Daftar Stand"-nya yang dikunci). Untuk menutup KEDUANYA sekaligus, pakai saklar di bawah.</p>' +
      '</div>' +

      '<div class="field">' +
        '<label style="display:flex;align-items:center;gap:10px;cursor:pointer;">' +
          '<input type="checkbox" id="bazar-toggle-tutup-total" ' + (settings.tutup_total === true ? "checked" : "") + ' />' +
          '<span>🔒 Tutup TOTAL Bazar (termasuk halaman info publik)</span>' +
        '</label>' +
        '<p class="hint" style="margin-top:4px;">Kalau dinyalakan, halaman "/bazar" (info) DAN "/daftar-bazar" (form) sama-sama disembunyikan dari pengunjung biasa -- diganti pesan "Bazar belum dibuka". Hanya panitia yang sudah login di browser ini (akun yang sama dengan "/admin"/"/adminbazar") yang tetap bisa melihat kedua halaman itu apa adanya, untuk keperluan pratinjau/pengecekan. Saklar "Pendaftaran bazar dibuka" di atas jadi tidak relevan selama ini aktif (semuanya sudah tertutup).</p>' +
      '</div>' +

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
      pendaftaran_dibuka: document.getElementById("bazar-toggle-dibuka").checked,
      tutup_total: document.getElementById("bazar-toggle-tutup-total").checked,
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

window.ViewAdminBazar = { template: ADMINBAZAR_TEMPLATE, init: initAdminBazar };
