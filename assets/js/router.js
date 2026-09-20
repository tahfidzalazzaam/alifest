// Router SPA sederhana berbasis hash — satu file HTML (index.html), tapi
// terasa seperti berpindah halaman (Beranda <-> Daftar Lomba), sama seperti
// pola yang dipakai di Al-Hafizh.
//
// Rute yang dikenal: "#/" (Beranda) dan "#/daftar" (Form Pendaftaran).
// Hash lain (mis. "#lomba" dari tautan anchor di halaman Beranda) sengaja
// TIDAK ditangani di sini, supaya perilaku scroll-ke-anchor bawaan browser
// tetap jalan normal tanpa bentrok dengan router.

const ROUTES = {
  "#/": window.ViewBeranda,
  "#/daftar": window.ViewDaftar
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

  const app = document.getElementById("app");
  app.innerHTML = view.template;
  setNavAktif(hash);
  window.scrollTo(0, 0);

  // Restart animasi fade-in tiap navigasi (lihat komentar .app-enter di style.css).
  app.classList.remove("app-enter");
  void app.offsetWidth; // paksa reflow
  app.classList.add("app-enter");

  if (typeof view.init === "function") view.init();
}

window.addEventListener("hashchange", router);
window.addEventListener("DOMContentLoaded", router);

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
