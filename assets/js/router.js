// Router SPA sederhana berbasis hash — satu file HTML (index.html), tapi
// terasa seperti berpindah halaman (Beranda <-> Daftar Lomba), sama seperti
// pola yang dipakai di Al-Hafizh.
//
// Rute yang dikenal: "#/" (Beranda) dan "#/daftar" (Form Pendaftaran).
// Halaman Panitia sengaja TIDAK ditautkan di navbar — dibuka lewat path
// tersembunyi "/admin" (lihat cekAksesLangsungAdmin di bawah), atau lewat
// hash "#/admin" kalau perlu.
// Hash lain (mis. "#lomba" dari tautan anchor di halaman Beranda) sengaja
// TIDAK ditangani di sini, supaya perilaku scroll-ke-anchor bawaan browser
// tetap jalan normal tanpa bentrok dengan router.

const ROUTES = {
  "#/": window.ViewBeranda,
  "#/daftar": window.ViewDaftar,
  "#/admin": window.ViewAdmin
};

function normalisasiHash() {
  const h = window.location.hash;
  return h === "" || h === "#" ? "#/" : h;
}

function setNavAktif(hash) {
  document.querySelectorAll(".nav-link[data-route]").forEach(function (link) {
    link.classList.toggle("is-active", link.getAttribute("data-route") === hash);
  });
}

function router() {
  const hash = normalisasiHash();
  const view = ROUTES[hash];
  if (!view) return; // bukan rute SPA (mis. anchor "#lomba") — biarkan browser yang urus
  tampilkanView(view, hash);
}

function tampilkanView(view, hashUntukNav) {
  const app = document.getElementById("app");
  app.innerHTML = view.template;
  setNavAktif(hashUntukNav || "");
  window.scrollTo(0, 0);

  // Restart animasi fade-in tiap navigasi (lihat komentar .app-enter di style.css).
  app.classList.remove("app-enter");
  void app.offsetWidth; // paksa reflow
  app.classList.add("app-enter");

  if (typeof view.init === "function") view.init();
}

// Akses tersembunyi ke halaman Panitia: buka "/admin" langsung (bukan lewat
// link navbar, karena sengaja disembunyikan dari pengunjung biasa). Perlu
// rewrite di vercel.json supaya path "/admin" tidak 404 di hosting statis.
// Ini cuma soal kemudahan akses, BUKAN lapisan keamanan — keamanan
// sesungguhnya tetap dari login Supabase Auth di dalam halamannya.
function cekAksesLangsungAdmin() {
  const path = window.location.pathname.replace(/\/+$/, "");
  if (path === "/admin") {
    tampilkanView(window.ViewAdmin, "");
    return true;
  }
  return false;
}

function muatAwal() {
  if (cekAksesLangsungAdmin()) return;
  router();
}

window.addEventListener("hashchange", router);
window.addEventListener("DOMContentLoaded", muatAwal);
window.addEventListener("DOMContentLoaded", muatLogoNavbar);

// Navigasi terprogram — dipakai tombol seperti "Daftar Peserta Lain".
// Kalau hash tujuan sama dengan hash sekarang, hashchange TIDAK akan
// otomatis terpicu oleh browser, jadi di sini kita panggil router() manual
// supaya view tetap ter-render ulang (form ter-reset).
window.gotoRoute = function (hash) {
  if (window.location.hash === hash) {
    router();
  } else {
    window.location.hash = hash;
  }
};

// ---------------------------------------------------------------------------
// Logo navbar — bagian shell (index.html), bukan bagian view mana pun, jadi
// dimuat sekali di sini, terpisah dari router(). Kalau panitia sudah upload
// logo lewat "#/admin", tampilkan sebagai <img> apa adanya (TIDAK dipotong
// bulat) menggantikan ikon bulan bawaan.
// ---------------------------------------------------------------------------
async function muatLogoNavbar() {
  const { data } = await supabaseClient.from("site_settings").select("logo_url").eq("id", 1).single();
  if (data && data.logo_url) window.terapkanLogo(data.logo_url);
}

window.terapkanLogo = function (url) {
  const mark = document.getElementById("site-logo-mark");
  if (!mark) return;
  if (url) {
    mark.outerHTML = '<img src="' + url + '" alt="Logo" class="navbar__brand-logo" id="site-logo-mark" />';
  } else {
    mark.outerHTML = '<span class="mark" id="site-logo-mark">🌙</span>';
  }
};
