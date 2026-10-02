// View: Panitia Profil Beranda ("#/adminprofil" atau path "/adminprofil")
// -- TERPISAH dari halaman Panitia lomba ("#/admin") dan Panitia Bazar
// ("#/adminbazar"), tapi login pakai AKUN YANG SAMA (Supabase Auth, role
// `authenticated`) -- sengaja dipisah sendiri (bukan jadi tab di dalam
// "#/admin") supaya tidak dicampur dengan pengelolaan data lomba. Cuma
// berisi satu formulir: profil Beranda ("#/") -- judul, deskripsi ringkas,
// dan link video dokumentasi YouTube opsional. Disimpan di
// site_settings.profil_judul / profil_deskripsi / profil_video_url
// (migrasi 0031). Beranda LAMA (daftar cabang lomba) sekarang ada di
// halaman terpisah "#/lomba" -- lihat view-lomba.js -- tidak diatur dari
// sini, tapi lewat tab "Kelola Lomba" di "#/admin" seperti biasa.

const ADMINPROFIL_TEMPLATE = `
<main class="admin-page container">
  <div id="adminprofil-root"></div>
</main>
`;

function escapeHTMLAdminProfil(teks) {
  const div = document.createElement("div");
  div.textContent = String(teks == null ? "" : teks);
  return div.innerHTML;
}

async function initAdminProfil() {
  const root = document.getElementById("adminprofil-root");
  root.innerHTML = '<p class="hint">Memeriksa sesi masuk...</p>';

  const { data } = await supabaseClient.auth.getSession();
  if (data && data.session) {
    renderDashboardProfil(root, data.session);
  } else {
    renderLoginProfil(root);
  }
}

/* ==================== LOGIN (akun sama dengan panitia lomba) ==================== */

function renderLoginProfil(root) {
  root.innerHTML =
    '<div class="form-shell admin-login">' +
      '<h1>Masuk Panitia -- Profil Beranda</h1>' +
      '<p>Pakai akun panitia yang sama dengan halaman Panitia lomba. Belum punya akun? Minta dibuatkan oleh pengelola situs.</p>' +
      '<form id="form-login-profil" novalidate>' +
        '<div class="field">' +
          '<label for="adminprofil-email">Email</label>' +
          '<input type="email" id="adminprofil-email" required />' +
        '</div>' +
        '<div class="field">' +
          '<label for="adminprofil-password">Kata Sandi</label>' +
          '<input type="password" id="adminprofil-password" required />' +
        '</div>' +
        '<div class="form-error" id="loginprofil-error" style="display:none;"></div>' +
        '<div class="submit-row">' +
          '<button type="submit" class="btn btn--primary" id="btn-login-profil">Masuk</button>' +
        '</div>' +
      '</form>' +
    '</div>';

  const form = document.getElementById("form-login-profil");
  const errorEl = document.getElementById("loginprofil-error");
  const btn = document.getElementById("btn-login-profil");

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    errorEl.style.display = "none";
    btn.disabled = true;
    btn.textContent = "Memeriksa...";

    const email = document.getElementById("adminprofil-email").value.trim();
    const password = document.getElementById("adminprofil-password").value;
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email: email, password: password });

    btn.disabled = false;
    btn.textContent = "Masuk";

    if (error) {
      errorEl.textContent = "Gagal masuk: email atau kata sandi salah.";
      errorEl.style.display = "block";
      return;
    }
    renderDashboardProfil(root, data.session);
  });
}

/* ==================== DASHBOARD SHELL (satu formulir saja, tanpa tab) ==================== */

async function renderDashboardProfil(root, session) {
  root.innerHTML =
    '<div class="admin-header">' +
      '<div><h1>Panel Panitia -- Profil Beranda</h1><p>Masuk sebagai ' + session.user.email + '</p></div>' +
      '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">' +
        '<button type="button" class="btn btn--ghost" id="btn-logout-profil">Keluar</button>' +
      '</div>' +
    '</div>' +
    '<div id="adminprofil-content"></div>';

  document.getElementById("btn-logout-profil").addEventListener("click", async function () {
    await supabaseClient.auth.signOut();
    renderLoginProfil(root);
  });

  loadFormProfilBeranda();
}

/* ==================== FORMULIR: PROFIL BERANDA ==================== */

async function loadFormProfilBeranda() {
  const content = document.getElementById("adminprofil-content");
  content.innerHTML = '<p class="hint">Memuat profil Beranda...</p>';

  const { data, error } = await supabaseClient.from("site_settings").select("profil_judul,profil_deskripsi,profil_video_url").eq("id", 1).single();
  if (error) {
    content.innerHTML = "<p>Gagal memuat profil Beranda: " + error.message + "</p>";
    return;
  }

  content.innerHTML =
    '<div class="form-shell" style="max-width:640px;">' +
      '<h3>Beranda / Profil Acara</h3>' +
      '<p>Ditampilkan di halaman Beranda ("#/") -- halaman pertama yang dilihat pengunjung, sebelum mereka pindah ke halaman Lomba atau Bazar.</p>' +

      '<div class="field">' +
        '<label for="beranda-judul-text">Judul <span style="font-weight:400;">(kosongkan untuk pakai default "ALIF 5.0")</span></label>' +
        '<input type="text" id="beranda-judul-text" value="' + escapeHTMLAdminProfil(data.profil_judul || "") + '" placeholder="ALIF 5.0" />' +
      '</div>' +

      '<div class="field">' +
        '<label for="beranda-deskripsi-text">Deskripsi Ringkas <span style="font-weight:400;">(kosongkan untuk pakai teks default)</span></label>' +
        '<textarea id="beranda-deskripsi-text" rows="5" placeholder="Satu-dua kalimat singkat tentang ALIF 5.0 secara umum...">' + escapeHTMLAdminProfil(data.profil_deskripsi || "") + '</textarea>' +
        '<p class="hint" style="margin-top:4px;">Cukup ringkas/umum saja -- info detail lomba & bazar sudah ada di halaman masing-masing.</p>' +
      '</div>' +

      '<div class="field">' +
        '<label for="beranda-video-text">Link Video Dokumentasi <span style="font-weight:400;">(opsional, link YouTube)</span></label>' +
        '<input type="text" id="beranda-video-text" value="' + escapeHTMLAdminProfil(data.profil_video_url || "") + '" placeholder="https://www.youtube.com/watch?v=..." />' +
        '<p class="hint" style="margin-top:4px;">Mis. video dokumentasi ALIF tahun lalu. Tempel link YouTube apa saja (watch, youtu.be, shorts) -- otomatis ditampilkan sebagai video di Beranda. Kosongkan untuk tidak menampilkan video.</p>' +
      '</div>' +

      '<div class="form-error" id="beranda-profil-error" style="display:none;"></div>' +
      '<div class="submit-row">' +
        '<button type="button" class="btn btn--primary" id="btn-simpan-profil-beranda">Simpan Profil Beranda</button>' +
      '</div>' +
    '</div>';

  document.getElementById("btn-simpan-profil-beranda").addEventListener("click", async function () {
    const btn = this;
    const errorEl = document.getElementById("beranda-profil-error");
    errorEl.style.display = "none";

    const videoRaw = document.getElementById("beranda-video-text").value.trim();
    if (videoRaw && !/^https?:\/\//i.test(videoRaw)) {
      errorEl.textContent = "Link video harus diawali http:// atau https:// (atau dikosongkan).";
      errorEl.style.display = "block";
      return;
    }

    btn.disabled = true;
    btn.textContent = "Menyimpan...";

    const { error: errSimpan } = await supabaseClient.from("site_settings").update({
      profil_judul: document.getElementById("beranda-judul-text").value.trim() || null,
      profil_deskripsi: document.getElementById("beranda-deskripsi-text").value.trim() || null,
      profil_video_url: videoRaw || null
    }).eq("id", 1);

    btn.disabled = false;
    btn.textContent = "Simpan Profil Beranda";

    if (errSimpan) {
      errorEl.textContent = "Gagal menyimpan: " + errSimpan.message;
      errorEl.style.display = "block";
      return;
    }
    btn.textContent = "✓ Tersimpan";
    setTimeout(function () { btn.textContent = "Simpan Profil Beranda"; }, 1500);
  });
}

window.ViewAdminProfil = { template: ADMINPROFIL_TEMPLATE, init: initAdminProfil };
