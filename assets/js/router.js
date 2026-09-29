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
// Logo navbar & status buka/tutup pendaftaran — bagian shell (index.html),
// bukan bagian view mana pun, jadi dimuat sekali di sini, terpisah dari
// router(). Kalau panitia sudah upload logo lewat "#/admin", tampilkan
// sebagai <img> apa adanya (TIDAK dipotong bulat) menggantikan ikon bulan
// bawaan. Kalau pendaftaran ditutup, tombol "Daftar Lomba" di navbar diberi
// ikon gembok.
// ---------------------------------------------------------------------------
async function muatLogoNavbar() {
  const { data } = await supabaseClient.from("site_settings").select("logo_url,pendaftaran_dibuka,tanggal_tutup_pendaftaran").eq("id", 1).single();
  if (data && data.logo_url) window.terapkanLogo(data.logo_url);
  window.terapkanStatusPendaftaran(window.hitungStatusPendaftaranAsli(data).dibuka);
}

// ---------------------------------------------------------------------------
// Status "buka/tutup" pendaftaran yang SEBENARNYA -- menggabungkan toggle
// manual panitia (site_settings.pendaftaran_dibuka, migrasi 0013) DENGAN
// tanggal tutup otomatis (site_settings.tanggal_tutup_pendaftaran, migrasi
// 0022): pendaftaran dianggap TERTUTUP kalau salah satu dari keduanya bilang
// tertutup. Dipakai di sini (navbar, gerbang) dan oleh view-beranda.js /
// view-daftar.js supaya logikanya SATU tempat saja, tidak dobel-dobel dan
// berisiko beda hasil antar halaman. `data` adalah baris site_settings (atau
// null/undefined kalau gagal dimuat -- dianggap dibuka, gagal-aman ke arah
// yang tidak mengunci situs kalau query bermasalah).
window.hitungStatusPendaftaranAsli = function (data) {
  const manualDibuka = !data || data.pendaftaran_dibuka !== false;
  const tanggalTutup = (data && data.tanggal_tutup_pendaftaran) || null;
  const otomatisLewat = !!(tanggalTutup && new Date() > new Date(tanggalTutup));
  return {
    dibuka: manualDibuka && !otomatisLewat,
    tanggalTutup: tanggalTutup,
    otomatisLewat: otomatisLewat
  };
};

// ---------------------------------------------------------------------------
// Countdown mundur sampai tanggal_tutup_pendaftaran -- dipakai Beranda &
// halaman Daftar (elemen mana pun, asal punya id yang dioper). Diperbarui
// tiap detik lewat setInterval; otomatis disembunyikan begitu waktunya lewat
// (status buka/tutup sebenarnya tetap ditentukan server, ini murni tampilan).
window.pasangCountdownTutup = function (el, tanggalTutupIso) {
  if (!el) return function () {};
  if (!tanggalTutupIso) {
    el.style.display = "none";
    return function () {};
  }

  let timer = null;

  function tick() {
    const target = new Date(tanggalTutupIso).getTime();
    const diff = target - Date.now();

    if (isNaN(target) || diff <= 0) {
      el.style.display = "none";
      if (timer) clearInterval(timer);
      return;
    }

    const detik = Math.floor(diff / 1000);
    const hari = Math.floor(detik / 86400);
    const jam = Math.floor((detik % 86400) / 3600);
    const menit = Math.floor((detik % 3600) / 60);
    const sisaDetik = detik % 60;

    const bagian = [];
    if (hari > 0) bagian.push(hari + (hari === 1 ? " hari" : " hari"));
    bagian.push(String(jam).padStart(2, "0") + " jam");
    bagian.push(String(menit).padStart(2, "0") + " menit");
    bagian.push(String(sisaDetik).padStart(2, "0") + " detik");

    el.style.display = "block";
    el.textContent = "⏳ Pendaftaran ditutup dalam " + bagian.join(" : ");
  }

  tick();
  timer = setInterval(tick, 1000);
  return function () { if (timer) clearInterval(timer); };
};

// Favicon default (ikon bulan) — direkam sekali di awal supaya bisa
// dikembalikan lagi kalau logo dihapus lewat halaman Panitia.
const FAVICON_DEFAULT = document.getElementById("site-favicon")
  ? document.getElementById("site-favicon").getAttribute("href")
  : "";

window.terapkanLogo = function (url) {
  const mark = document.getElementById("site-logo-mark");
  if (mark) {
    if (url) {
      mark.outerHTML = '<img src="' + url + '" alt="Logo" class="navbar__brand-logo" id="site-logo-mark" />';
    } else {
      mark.outerHTML = '<span class="mark" id="site-logo-mark">🌙</span>';
    }
  }

  const favicon = document.getElementById("site-favicon");
  if (favicon) {
    favicon.setAttribute("href", url || FAVICON_DEFAULT);
    if (url) {
      favicon.setAttribute("type", "image/png");
    } else {
      favicon.removeAttribute("type");
    }
  }
};

// Dipanggil saat halaman dimuat (navbar) dan oleh view Beranda/Daftar untuk
// menyamakan tampilan tombol pendaftaran di seluruh situs.
window.terapkanStatusPendaftaran = function (dibuka) {
  const navCta = document.getElementById("nav-cta-daftar");
  if (navCta) {
    navCta.classList.toggle("is-locked", !dibuka);
    navCta.innerHTML = dibuka ? "Daftar Lomba" : "🔒 Daftar Lomba";
  }
};

// ---------------------------------------------------------------------------
// "Gerbang" pendaftaran ditutup -- muncul sekali per sesi browser, di
// halaman mana pun, kalau site_settings.pendaftaran_dibuka = false. Panitia
// tetap bisa masuk & uji coba (BENAR-BENAR submit ke database, bukan cuma
// pratinjau) lewat kode PIN -- kode yang sama juga dicek ULANG di database
// lewat parameter p_kode_uji_coba pada submit_pendaftaran (migrasi 0020),
// supaya bukan cuma tipuan tampilan browser yang bisa dilewati begitu saja.
//
// Kode "80801998" sengaja ditulis apa adanya (hardcode) di sini DAN di
// migrasi 0020 -- ini murni gerbang kemudahan untuk internal panitia, BUKAN
// lapisan keamanan yang ketat (siapa pun yang buka source code situs bisa
// membacanya). Kalau nanti kodenya mau diganti, cari & ganti string
// "80801998" di KEDUA tempat itu.
// ---------------------------------------------------------------------------
const KODE_UJI_COBA_PANITIA = "80801998";

const PESAN_LUCU_TUTUP = [
  "Pendaftarannya lagi tidur siang dulu, nanti bangun sendiri kok. Sabar ya, jangan digedor-gedor. 😴",
  "Loketnya lagi ngopi dulu ☕ — pendaftaran ALIF 5.0 belum dibuka. Coba mampir lagi nanti, ya!",
  "Waduh, kamu kepagian! Pendaftarannya masih mimpi indah. Coba lagi lain waktu ya~ 😪",
  "Pintunya masih dikunci panitia, kuncinya juga lagi dicari-cari. 🔑😅 Sabar dulu, ya!",
  "Pendaftarannya lagi di-charge dulu biar ngebut begitu dibuka nanti. 🔋 Ditunggu kabarnya!",
  "Tenang, bukan situsnya rusak kok — cuma pendaftarannya belum dibangunkan panitia. 🛌"
];

// Dipakai view-daftar.js untuk tahu apakah mode uji coba sedang aktif di
// sesi browser ini (supaya form pendaftaran tetap ditampilkan & submitnya
// menyertakan kode PIN), dan oleh gerbang ini sendiri supaya tidak muncul
// lagi berulang-ulang selama sesi masih sama.
window.ujiCobaAktif = function () {
  try { return sessionStorage.getItem("alif_uji_coba_pin") === KODE_UJI_COBA_PANITIA; }
  catch (e) { return false; } // mis. browser mode private yang memblokir sessionStorage
};
window.KODE_UJI_COBA_PANITIA = KODE_UJI_COBA_PANITIA;

// Halaman Panitia (path "/admin" ATAU hash "#/admin") sengaja TIDAK pernah
// menampilkan gerbang ini -- panitia sendiri yang mengatur buka/tutup
// pendaftaran, jadi tidak perlu ditanyai/diganggu pesan lucu + PIN uji coba
// tiap kali mereka membuka halaman admin.
function sedangDiHalamanAdmin() {
  const path = window.location.pathname.replace(/\/+$/, "");
  return path === "/admin" || window.location.hash === "#/admin";
}

async function cekGerbangTutup() {
  if (sedangDiHalamanAdmin()) return; // halaman panitia tidak ikut ditutup
  if (window.ujiCobaAktif()) return; // panitia sudah masuk mode uji coba sesi ini, tidak usah tampil lagi

  const { data } = await supabaseClient.from("site_settings").select("pendaftaran_dibuka,tanggal_tutup_pendaftaran").eq("id", 1).single();
  if (window.hitungStatusPendaftaranAsli(data).dibuka) return;

  const overlay = document.getElementById("gate-overlay");
  if (!overlay) return;
  const pesanEl = document.getElementById("gate-pesan");
  if (pesanEl) pesanEl.textContent = PESAN_LUCU_TUTUP[Math.floor(Math.random() * PESAN_LUCU_TUTUP.length)];
  overlay.classList.add("is-visible");
}

function pasangGerbangTutup() {
  const overlay = document.getElementById("gate-overlay");
  if (!overlay) return;

  const btnTutup = document.getElementById("gate-btn-tutup");
  const btnPanitia = document.getElementById("gate-btn-panitia");
  const pinWrap = document.getElementById("gate-pin-wrap");
  const pinInput = document.getElementById("gate-pin-input");
  const pinError = document.getElementById("gate-pin-error");

  btnTutup.addEventListener("click", function () {
    overlay.classList.remove("is-visible");
  });

  btnPanitia.addEventListener("click", function () {
    pinWrap.style.display = "block";
    pinInput.focus();
  });

  function cobaMasukUjiCoba() {
    const val = pinInput.value.trim();
    if (val === KODE_UJI_COBA_PANITIA) {
      pinError.style.display = "none";
      try { sessionStorage.setItem("alif_uji_coba_pin", val); } catch (e) { /* tetap lanjut walau gagal disimpan -- cuma tidak awet lintas halaman */ }
      overlay.classList.remove("is-visible");
      router(); // render ulang halaman aktif, supaya form pendaftaran (kalau lagi di halaman Daftar) langsung muncul normal
    } else {
      pinError.style.display = "block";
    }
  }

  document.getElementById("gate-pin-submit").addEventListener("click", cobaMasukUjiCoba);
  pinInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") cobaMasukUjiCoba();
  });
}

window.addEventListener("DOMContentLoaded", pasangGerbangTutup);
window.addEventListener("DOMContentLoaded", cekGerbangTutup);
