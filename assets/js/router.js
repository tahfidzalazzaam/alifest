// Router SPA sederhana berbasis hash — satu file HTML (index.html), tapi
// terasa seperti berpindah halaman, sama seperti pola yang dipakai di
// Al-Hafizh.
//
// Rute publik yang ditautkan di navbar: "#/" (Beranda -- profil & info umum
// acara), "#/lomba" (info cabang lomba) dan "#/bazar" (info Bazar). Dari
// masing-masing ada tombol menuju form pendaftarannya: "#/daftar" (Lomba)
// dan "#/daftar-bazar" (Bazar) -- form-form ini sengaja TIDAK ditautkan
// langsung di navbar, cuma dicapai lewat tombol di halaman info-nya.
// Halaman Panitia (lomba, bazar, & profil Beranda) sengaja TIDAK ditautkan
// di navbar — dibuka lewat path tersembunyi "/admin"/"/adminbazar"/
// "/adminprofil" (lihat cekAksesLangsungAdmin di bawah), atau lewat hash
// kalau perlu. "/adminprofil" sengaja dipisah dari "/admin" (bukan jadi tab
// di dalamnya) supaya pengaturan profil Beranda tidak dicampur dengan
// pengelolaan data lomba -- tapi login-nya tetap pakai akun panitia yang
// sama (Supabase Auth, role `authenticated`).
// Hash lain (mis. "#lomba" dari tautan anchor di halaman Lomba) sengaja
// TIDAK ditangani di sini, supaya perilaku scroll-ke-anchor bawaan browser
// tetap jalan normal tanpa bentrok dengan router.

const ROUTES = {
  "#/": window.ViewBeranda,
  "#/lomba": window.ViewLomba,
  "#/daftar": window.ViewDaftar,
  "#/admin": window.ViewAdmin,
  "#/bazar": window.ViewBazar,
  "#/daftar-bazar": window.ViewDaftarBazar,
  "#/adminbazar": window.ViewAdminBazar,
  "#/adminprofil": window.ViewAdminProfil,
  "#/lengkapi": window.ViewLengkapi,
  "#/timadmin": window.ViewTimAdmin
};

function normalisasiHash() {
  const h = window.location.hash;
  if (h === "" || h === "#") return "#/";
  // Buang bagian "?..." kalau ada (dipakai "#/lengkapi?token=..." -- lihat
  // view-lengkapi.js) supaya tetap cocok dengan key di ROUTES di bawah,
  // yang tidak menyertakan query string apa pun.
  const tandaTanya = h.indexOf("?");
  return tandaTanya === -1 ? h : h.slice(0, tandaTanya);
}

function setNavAktif(hash) {
  document.querySelectorAll(".nav-link[data-route]").forEach(function (link) {
    link.classList.toggle("is-active", link.getAttribute("data-route") === hash);
  });
}

// Judul tab browser per halaman -- dicocokkan lewat IDENTITAS objek view
// (window.ViewXxx), BUKAN lewat hash, supaya tetap benar walau halaman
// dibuka lewat akses path langsung ("/admin", "/bazar", "/adminbazar" --
// lihat cekAksesLangsungAdmin) yang tidak selalu membawa hash. Logo/ikon tab
// (favicon) TIDAK ikut berubah di sini -- itu diatur terpisah lewat
// window.terapkanLogo (logo situs yang diupload panitia, sama untuk semua
// halaman).
function judulUntukView(view) {
  if (view === window.ViewBeranda) return "ALIF 5.0";
  if (view === window.ViewLomba || view === window.ViewDaftar) return "Lomba - ALIF 5.0";
  if (view === window.ViewAdmin) return "Panitia Lomba - ALIF 5.0";
  if (view === window.ViewBazar || view === window.ViewDaftarBazar) return "Bazar - ALIF 5.0";
  if (view === window.ViewAdminBazar) return "Panitia Bazar - ALIF 5.0";
  if (view === window.ViewAdminProfil) return "Panitia Beranda - ALIF 5.0";
  if (view === window.ViewLengkapi) return "Lengkapi Nomor Punggung - ALIF 5.0";
  if (view === window.ViewTimAdmin) return "Mode Maintenance - ALIF 5.0";
  return document.title; // view tak dikenal -- biarkan judul tab apa adanya
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
  document.title = judulUntukView(view);
  window.scrollTo(0, 0);

  // Restart animasi fade-in tiap navigasi (lihat komentar .app-enter di style.css).
  app.classList.remove("app-enter");
  void app.offsetWidth; // paksa reflow
  app.classList.add("app-enter");

  if (typeof view.init === "function") view.init();
}

// Akses lewat PATH langsung (bukan cuma hash) untuk halaman-halaman yang
// punya rewrite di vercel.json: "/admin" & "/adminbazar" sengaja TIDAK
// ditautkan di navbar (disembunyikan dari pengunjung biasa) -- keamanan
// sesungguhnya tetap dari login Supabase Auth di dalam halamannya, ini cuma
// soal kemudahan akses. "/lomba" & "/bazar" SUDAH ditautkan di navbar juga,
// path langsungnya cuma supaya linknya enak dibagikan/di-bookmark
// (mis. "alif5.com/bazar") tanpa perlu diawali "#/".
function cekAksesLangsungAdmin() {
  const path = window.location.pathname.replace(/\/+$/, "");
  if (path === "/admin") {
    tampilkanView(window.ViewAdmin, "");
    return true;
  }
  if (path === "/lomba") {
    tampilkanView(window.ViewLomba, "#/lomba");
    return true;
  }
  if (path === "/bazar") {
    tampilkanView(window.ViewBazar, "#/bazar");
    return true;
  }
  if (path === "/adminbazar") {
    tampilkanView(window.ViewAdminBazar, "");
    return true;
  }
  if (path === "/adminprofil") {
    tampilkanView(window.ViewAdminProfil, "");
    return true;
  }
  if (path === "/lengkapi") {
    tampilkanView(window.ViewLengkapi, "");
    return true;
  }
  if (path === "/timadmin") {
    tampilkanView(window.ViewTimAdmin, "");
    return true;
  }
  return false;
}

async function muatAwal() {
  if (await cekDanTerapkanMaintenance()) return; // seluruh situs tertutup -- lihat definisinya di bawah
  if (cekAksesLangsungAdmin()) return;
  router();
}

window.addEventListener("hashchange", async function () {
  if (await cekDanTerapkanMaintenance()) return;
  router();
});
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
// tertutup. Dipakai di sini (navbar, gerbang) dan oleh view-lomba.js /
// view-daftar.js / view-beranda.js supaya logikanya SATU tempat saja, tidak dobel-dobel dan
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

    // Selalu tampilkan keempat satuan (hari -> detik), termasuk "00 hari"
    // kalau tinggal kurang dari sehari -- supaya formatnya konsisten dan
    // jelas ini hitung mundur dari hari sampai detik, bukan cuma jam ke bawah.
    const bagian = [
      String(hari).padStart(2, "0") + " hari",
      String(jam).padStart(2, "0") + " jam",
      String(menit).padStart(2, "0") + " menit",
      String(sisaDetik).padStart(2, "0") + " detik"
    ];

    // Dua baris: label kecil di atas, angka waktunya sendiri di baris bawah
    // dengan ukuran font lebih besar (lihat .countdown-tutup__label dan
    // .countdown-tutup__waktu di style.css) -- innerHTML dipakai (bukan
    // textContent) supaya dua <span> ini bisa dibuat elemen block terpisah.
    el.style.display = "flex"; // cocok dengan .countdown-tutup { display:flex; flex-direction:column; } di style.css
    el.innerHTML =
      '<span class="countdown-tutup__label">⏳ Pendaftaran ditutup dalam</span>' +
      '<span class="countdown-tutup__waktu">' + bagian.join(" : ") + '</span>';
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
// Mode Maintenance (migrasi 0045, site_settings.mode_maintenance) -- saklar
// global yang menutup SELURUH situs (beda dari "Gerbang pendaftaran
// ditutup" di bawah, yang cuma menutup form Lomba) -- begitu AKTIF, SEMUA
// halaman diganti pesan pemeliharaan, TERMASUK "/admin"/"/adminbazar"/
// "/adminprofil" -- SATU-SATUNYA pengecualian adalah "/timadmin"
// (view-timadmin.js) sendiri, supaya selalu ada jalan menyalakan/mematikan
// mode ini. Dicek ULANG setiap navigasi (bukan cuma sekali di awal seperti
// "Gerbang pendaftaran ditutup" di bawah) -- lewat `muatAwal()` (saat
// halaman pertama dimuat) DAN tiap `hashchange` (saat pindah halaman lewat
// link navbar di SPA yang sama) -- supaya begitu panitia mengaktifkan mode
// ini, pengunjung yang sedang membuka tab lain situs ini & lanjut berpindah
// halaman ikut langsung terkena, bukan baru kena setelah me-refresh browser.
// ---------------------------------------------------------------------------
function halamanBebasMaintenance() {
  const path = window.location.pathname.replace(/\/+$/, "");
  const hash = window.location.hash;
  const hashTanpaQuery = hash.indexOf("?") === -1 ? hash : hash.slice(0, hash.indexOf("?"));
  return path === "/timadmin" || hashTanpaQuery === "#/timadmin";
}

// Sengaja dibuat terlihat seperti halaman eror sistem BENERAN (gelap, cuma
// teks, tanpa logo/emoji/branding ALIF) -- permintaan panitia supaya
// pengunjung mengira situs benar-benar bermasalah, bukan cuma "sedang
// istirahat", supaya tidak ada yang menghubungi panitia menanyakan kapan
// situs akan normal lagi. Elemen lain di luar #app (navbar, bunting,
// footer) ikut disembunyikan supaya seluruh layar jadi halaman eror itu
// sendiri, bukan cuma potongan konten di tengah situs ALIF yang biasa.
function tampilkanModeMaintenance() {
  const app = document.getElementById("app");
  if (!app) return;

  document.querySelectorAll(".bunting, .navbar, .footer").forEach(function (el) {
    el.style.display = "none";
  });
  document.documentElement.style.background = "#0a0a0b";
  document.body.style.background = "#0a0a0b";
  document.body.style.margin = "0";

  app.innerHTML =
    '<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;' +
      'padding:24px;background:#0a0a0b;color:#d4d4d8;' +
      'font-family:ui-monospace,SFMono-Regular,Consolas,\'Liberation Mono\',Menlo,monospace;">' +
      '<div style="max-width:620px;">' +
        '<div style="font-size:14px;color:#71717a;letter-spacing:.04em;margin:0 0 10px;">' +
          'Error 503' +
        '</div>' +
        '<h1 style="font-size:21px;font-weight:600;color:#e4e4e7;margin:0 0 14px;line-height:1.35;">' +
          'Service Temporarily Unavailable' +
        '</h1>' +
        '<p style="font-size:14px;line-height:1.7;color:#a1a1aa;margin:0;">' +
          'The server is currently unable to handle this request due to a temporary ' +
          'overloading or maintenance of the server. Please try again later.' +
        '</p>' +
      '</div>' +
    '</div>';
  document.title = "503 Service Unavailable";
  setNavAktif("");
}

// Mengembalikan `true` kalau situs SEDANG tertutup (dan halaman maintenance
// sudah ditampilkan, caller cukup `return` tanpa melanjutkan routing
// normal) -- `false` kalau situs normal/halaman ini dikecualikan, caller
// lanjut seperti biasa.
async function cekDanTerapkanMaintenance() {
  if (halamanBebasMaintenance()) return false;
  const { data } = await supabaseClient.from("site_settings").select("mode_maintenance").eq("id", 1).single();
  if (!data || !data.mode_maintenance) return false;
  tampilkanModeMaintenance();
  return true;
}

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

// Gerbang "pendaftaran LOMBA ditutup" ini sekarang HANYA relevan untuk
// halaman seputar lomba: "/lomba" & "/daftar" (dan "#/lomba"/"#/daftar").
// Dikecualikan untuk:
//  - "/admin", "/adminbazar", & "/adminprofil" -- panitia sendiri yang
//    mengatur buka/tutup, tidak perlu ditanyai/diganggu pesan lucu + PIN
//    uji coba tiap kali mereka membuka halaman admin.
//  - "/" (Beranda) -- sejak Beranda jadi halaman profil umum acara (bukan
//    lagi berisi info lomba), memaksa gerbang lomba tampil di sana tidak
//    relevan lagi untuk pengunjung yang mungkin cuma mau lihat info Bazar.
//  - "/bazar" & "/daftar-bazar" -- pendaftaran stand/tenant bazar ini
//    SEPENUHNYA independen dari status buka/tutup pendaftaran LOMBA
//    (site_settings.pendaftaran_dibuka). Status buka/tutup bazar sendiri
//    (bazar_settings.pendaftaran_dibuka) ditangani langsung di dalam
//    view-bazar.js/view-daftarbazar.js (muatPengaturanBazar), jadi gerbang
//    lomba ini tidak relevan sama sekali untuk halaman-halaman itu.
//  - "/lengkapi" -- halaman publik token-only (migrasi 0032) yang dibuka
//    pendaftar lewat link khusus di WhatsApp untuk melengkapi nomor
//    punggung tim Futsal yang sudah mendaftar; tidak relevan dipaksa lewat
//    gerbang pendaftaran lomba (pendaftarannya sendiri sudah pasti sudah
//    masuk, cuma melengkapi data).
function halamanTanpaGerbangLomba() {
  const path = window.location.pathname.replace(/\/+$/, "");
  const hash = window.location.hash;
  // Hash bisa berbentuk "#/lengkapi?token=..." (lihat view-lengkapi.js) --
  // buang bagian "?..."-nya dulu sebelum dibandingkan supaya tetap dikenali.
  const hashTanpaQuery = hash.indexOf("?") === -1 ? hash : hash.slice(0, hash.indexOf("?"));
  return (
    path === "/admin" || hashTanpaQuery === "#/admin" ||
    path === "/adminbazar" || hashTanpaQuery === "#/adminbazar" ||
    path === "/adminprofil" || hashTanpaQuery === "#/adminprofil" ||
    path === "" || path === "/" || hashTanpaQuery === "" || hashTanpaQuery === "#" || hashTanpaQuery === "#/" ||
    path === "/bazar" || hashTanpaQuery === "#/bazar" ||
    path === "/daftar-bazar" || hashTanpaQuery === "#/daftar-bazar" ||
    path === "/lengkapi" || hashTanpaQuery === "#/lengkapi"
  );
}

async function cekGerbangTutup() {
  if (halamanTanpaGerbangLomba()) return; // halaman di luar lomba tidak ikut ditutup
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
