// View: Mode Maintenance ("#/timadmin" atau path "/timadmin") -- halaman
// TERSEMBUNYI (tidak ditautkan di navbar mana pun, sama seperti
// "/admin"/"/adminbazar"/"/adminprofil") khusus untuk menyalakan/mematikan
// "Mode Maintenance" (migrasi 0045, site_settings.mode_maintenance) --
// begitu AKTIF, SELURUH halaman situs (termasuk "/admin", "/adminbazar",
// "/adminprofil", Beranda, Lomba, Bazar, form pendaftaran, dst) diganti
// pesan pemeliharaan (lihat terapkanModeMaintenance() di router.js) --
// SATU-SATUNYA halaman yang TETAP bisa diakses selama Mode Maintenance aktif
// adalah halaman ini sendiri, supaya selalu ada jalan untuk mematikannya lagi.
//
// Login pakai akun Supabase Auth yang SAMA dengan panitia lomba/bazar/
// profil (role `authenticated`, TIDAK ADA tabel/role akun baru) -- pola &
// markup login disalin PERSIS dari view-adminprofil.js (yang paling
// sederhana, satu formulir tanpa tab), semua nama diberi akhiran
// "TimAdmin" supaya tidak bentrok dengan punya halaman admin lain (satu
// scope global JS yang sama, lihat Catatan Teknis README).

const TIMADMIN_TEMPLATE = `
<main class="admin-page container">
  <div id="timadmin-root"></div>
</main>
`;

async function initTimAdmin() {
  const root = document.getElementById("timadmin-root");
  root.innerHTML = '<p class="hint">Memeriksa sesi masuk...</p>';

  const { data } = await supabaseClient.auth.getSession();
  if (data && data.session) {
    renderDashboardTimAdmin(root, data.session);
  } else {
    renderLoginTimAdmin(root);
  }
}

/* ==================== LOGIN (akun sama dengan panitia lomba/bazar/profil) ==================== */

function renderLoginTimAdmin(root) {
  root.innerHTML =
    '<div class="form-shell admin-login">' +
      '<h1>Masuk -- Mode Maintenance</h1>' +
      '<p>Pakai akun panitia yang sama dengan halaman Panitia lomba/bazar/profil. Belum punya akun? Minta dibuatkan oleh pengelola situs.</p>' +
      '<form id="form-login-timadmin" novalidate>' +
        '<div class="field">' +
          '<label for="timadmin-email">Email</label>' +
          '<input type="email" id="timadmin-email" required />' +
        '</div>' +
        '<div class="field">' +
          '<label for="timadmin-password">Kata Sandi</label>' +
          '<input type="password" id="timadmin-password" required />' +
        '</div>' +
        '<div class="form-error" id="logintimadmin-error" style="display:none;"></div>' +
        '<div class="submit-row">' +
          '<button type="submit" class="btn btn--primary" id="btn-login-timadmin">Masuk</button>' +
        '</div>' +
      '</form>' +
    '</div>';

  const form = document.getElementById("form-login-timadmin");
  const errorEl = document.getElementById("logintimadmin-error");
  const btn = document.getElementById("btn-login-timadmin");

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    errorEl.style.display = "none";
    btn.disabled = true;
    btn.textContent = "Memeriksa...";

    const email = document.getElementById("timadmin-email").value.trim();
    const password = document.getElementById("timadmin-password").value;
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email: email, password: password });

    btn.disabled = false;
    btn.textContent = "Masuk";

    if (error) {
      errorEl.textContent = "Gagal masuk: email atau kata sandi salah.";
      errorEl.style.display = "block";
      return;
    }
    renderDashboardTimAdmin(root, data.session);
  });
}

/* ==================== DASHBOARD (satu tombol besar saja, tanpa tab) ==================== */

async function renderDashboardTimAdmin(root, session) {
  root.innerHTML =
    '<div class="admin-header">' +
      '<div><h1>Mode Maintenance</h1><p>Masuk sebagai ' + session.user.email + '</p></div>' +
      '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">' +
        '<button type="button" class="btn btn--ghost" id="btn-logout-timadmin">Keluar</button>' +
      '</div>' +
    '</div>' +
    '<div id="timadmin-content"></div>';

  document.getElementById("btn-logout-timadmin").addEventListener("click", async function () {
    await supabaseClient.auth.signOut();
    renderLoginTimAdmin(root);
  });

  loadPanelMaintenance();
}

/* ==================== PANEL: TOGGLE MODE MAINTENANCE ==================== */

async function loadPanelMaintenance() {
  const content = document.getElementById("timadmin-content");
  content.innerHTML = '<p class="hint">Memuat status situs...</p>';

  const { data, error } = await supabaseClient.from("site_settings").select("mode_maintenance").eq("id", 1).single();
  if (error) {
    content.innerHTML = "<p>Gagal memuat status: " + error.message + "</p>";
    return;
  }

  let aktif = !!(data && data.mode_maintenance);

  content.innerHTML =
    '<div class="form-shell" style="max-width:640px;">' +
      '<h3>Mode Maintenance Seluruh Situs</h3>' +
      '<p>Kalau diaktifkan, SELURUH halaman situs ini (termasuk Beranda, Lomba, Bazar, form pendaftaran, dan SEMUA halaman Panitia lain -- "/admin", "/adminbazar", "/adminprofil") akan menampilkan pesan pemeliharaan ke siapa pun yang membukanya. Halaman ini ("/timadmin") sengaja dikecualikan, supaya selalu ada jalan untuk mematikannya lagi kapan saja.</p>' +
      '<div class="submit-row" style="margin:18px 0;">' +
        '<button type="button" id="btn-toggle-maintenance" style="font-size:1.05rem;padding:14px 22px;"></button>' +
      '</div>' +
      '<p class="hint" id="status-maintenance-hint"></p>' +
    '</div>';

  const btn = document.getElementById("btn-toggle-maintenance");
  const hintEl = document.getElementById("status-maintenance-hint");

  function perbaruiTampilanToggle() {
    btn.className = "btn " + (aktif ? "btn--primary" : "btn--ghost");
    btn.textContent = aktif ? "🛠️ Mode Maintenance AKTIF -- Ketuk untuk Matikan" : "🟢 Situs Normal -- Ketuk untuk Aktifkan Maintenance";
    hintEl.textContent = aktif
      ? "Situs sedang tertutup untuk semua orang kecuali lewat halaman ini."
      : "Situs berjalan normal, semua halaman bisa diakses seperti biasa.";
  }
  perbaruiTampilanToggle();

  btn.addEventListener("click", async function () {
    const aksi = aktif ? "MEMATIKAN" : "MENGAKTIFKAN";
    if (!confirm('Yakin ingin ' + aksi + ' Mode Maintenance? ' + (aktif ? "" : "Seluruh situs (termasuk halaman Panitia lain) akan langsung tertutup untuk semua orang.") )) return;

    btn.disabled = true;
    const { error: errSimpan } = await supabaseClient.from("site_settings").update({ mode_maintenance: !aktif }).eq("id", 1);
    btn.disabled = false;

    if (errSimpan) {
      alert("Gagal menyimpan: " + errSimpan.message);
      return;
    }
    aktif = !aktif;
    perbaruiTampilanToggle();
  });
}

window.ViewTimAdmin = { template: TIMADMIN_TEMPLATE, init: initTimAdmin };
