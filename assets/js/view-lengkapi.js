// View: Lengkapi Nomor Punggung ("#/lengkapi?token=..." ATAU "/lengkapi?token=...")
// -- halaman PUBLIK, tidak butuh login, diakses pendaftar lewat link khusus
// yang dikirim panitia lewat WhatsApp (placeholder {link_lengkapi}, lihat
// Edge Function kirim-notifikasi-wa & migrasi 0032). TIDAK ditautkan di
// navbar mana pun -- hanya bisa dicapai lewat link itu sendiri.
//
// Linknya memakai bentuk HASH ("#/lengkapi?token=...") sebagai JALUR UTAMA
// (lihat kirim-notifikasi-wa/index.ts) -- BUKAN path langsung
// ("/lengkapi?token=..."), karena rute hash SELALU berfungsi murni di
// browser tanpa butuh konfigurasi rewrite apa pun di sisi hosting, sedangkan
// rute path langsung bergantung pada "rewrites" di vercel.json yang
// ternyata TIDAK SELALU bisa diandalkan tergantung pengaturan project
// Vercel masing-masing (pernah ditemukan kasus production 404 walau
// vercel.json & kode sudah 100% benar). Dukungan path langsung TETAP
// dipertahankan di router.js/vercel.json sebagai alternatif kalau memang
// berhasil, tapi link yang DIKIRIM selalu memakai bentuk hash yang lebih
// bisa diandalkan.
//
// Karena itu, `ambilTokenDariUrl()` di bawah membaca token dari KEDUA
// kemungkinan tempat: query string asli (window.location.search, untuk
// akses lewat path langsung) ATAU dari bagian "?..." di DALAM hash
// (window.location.hash, untuk akses lewat "#/lengkapi?token=...") --
// yang mana saja yang terisi duluan dipakai.
//
// Alurnya:
//  1. Baca token lewat ambilTokenDariUrl().
//  2. Panggil RPC ambil_tim_untuk_lengkapi(token) -- kalau sukses, tampilkan
//     nama tim & daftar anggotanya dengan input nomor punggung (prefilled
//     kalau sudah pernah diisi sebelumnya).
//  3. Validasi ringan di sisi klien (angka 1-99, tidak boleh kosong/dobel)
//     sebelum submit -- validasi SEBENARNYA tetap di server lewat RPC
//     submit_nomor_punggung (migrasi 0032), jadi validasi di sini murni
//     supaya pendaftar dapat feedback cepat tanpa bolak-balik ke server.
//  4. Panggil RPC submit_nomor_punggung(token, [...]) -- kalau sukses,
//     tampilkan pesan selesai (link ini otomatis tidak berlaku lagi karena
//     status pendaftaran sudah berubah di server).

const LENGKAPI_TEMPLATE = `
<main class="admin-page container">
  <div id="lengkapi-root" style="max-width:640px;margin:0 auto;"></div>
</main>
`;

function escapeHTMLLengkapi(teks) {
  const div = document.createElement("div");
  div.textContent = String(teks == null ? "" : teks);
  return div.innerHTML;
}

function ambilTokenDariUrl() {
  // 1) Query string ASLI -- berlaku kalau halaman ini diakses lewat path
  //    langsung "/lengkapi?token=..." dan rewrite vercel.json-nya berhasil.
  const dariQuery = new URLSearchParams(window.location.search).get("token");
  if (dariQuery) return dariQuery.trim();

  // 2) Bagian "?..." DI DALAM hash -- berlaku untuk bentuk utama
  //    "#/lengkapi?token=...": semua yang di belakang "#" tidak pernah
  //    dikirim ke server sama sekali (murni ditangani browser), jadi
  //    window.location.search akan selalu kosong untuk bentuk ini -- perlu
  //    diuraikan manual dari window.location.hash.
  const hash = window.location.hash || "";
  const tandaTanya = hash.indexOf("?");
  if (tandaTanya === -1) return "";
  return (new URLSearchParams(hash.slice(tandaTanya + 1)).get("token") || "").trim();
}

async function initLengkapi() {
  const root = document.getElementById("lengkapi-root");
  const token = ambilTokenDariUrl();

  if (!token) {
    root.innerHTML =
      '<div class="form-shell">' +
        '<h1>Link Tidak Lengkap</h1>' +
        '<p>Link ini tidak menyertakan token. Mohon buka lagi link yang dikirim panitia lewat WhatsApp, atau hubungi panitia kalau link tetap bermasalah.</p>' +
      '</div>';
    return;
  }

  root.innerHTML = '<div class="form-shell"><p class="hint">Memuat data tim...</p></div>';

  const { data, error } = await supabaseClient.rpc("ambil_tim_untuk_lengkapi", { p_token: token });

  if (error || !data || !data.success) {
    root.innerHTML =
      '<div class="form-shell">' +
        '<h1>Link Tidak Berlaku</h1>' +
        '<p>' + escapeHTMLLengkapi((data && data.message) || (error && error.message) || "Link ini tidak valid atau sudah tidak berlaku.") + '</p>' +
      '</div>';
    return;
  }

  renderFormLengkapi(root, token, data);
}

function renderFormLengkapi(root, token, data) {
  const anggota = Array.isArray(data.anggota) ? data.anggota : [];

  root.innerHTML =
    '<div class="form-shell">' +
      '<h1>Lengkapi Nomor Punggung</h1>' +
      '<p><strong>Tim:</strong> ' + escapeHTMLLengkapi(data.nama_tim || "-") + '<br/>' +
        '<strong>Nomor Pendaftaran:</strong> ' + escapeHTMLLengkapi(data.nomor_pendaftaran || "-") + '<br/>' +
        '<strong>Lomba:</strong> ' + escapeHTMLLengkapi(data.lomba_nama || "-") + '</p>' +
      '<p class="hint">Isi nomor punggung (1-99) untuk SEMUA anggota tim di bawah ini, lalu ketuk "Simpan". Setiap anggota harus punya nomor yang berbeda satu sama lain.</p>' +
      '<form id="form-lengkapi-punggung" novalidate>' +
        '<div id="lengkapi-anggota-list">' +
          anggota.map(function (a, i) {
            return (
              '<div class="field lengkapi-anggota-row" data-id="' + escapeHTMLLengkapi(a.id) + '" style="display:grid;grid-template-columns:1fr 120px;gap:10px;align-items:end;margin-bottom:10px;">' +
                '<div>' +
                  '<label>' + (i + 1) + '. ' + escapeHTMLLengkapi(a.nama) + ' <span style="font-weight:400;">(' + escapeHTMLLengkapi(a.kelas || "-") + ')</span></label>' +
                '</div>' +
                '<input type="number" min="1" max="99" class="lengkapi-punggung-input" value="' + (a.nomor_punggung != null ? a.nomor_punggung : "") + '" required />' +
              '</div>'
            );
          }).join("") +
        '</div>' +
        '<div class="form-error" id="lengkapi-error" style="display:none;"></div>' +
        '<div class="submit-row">' +
          '<button type="submit" class="btn btn--primary" id="btn-simpan-lengkapi">Simpan</button>' +
        '</div>' +
      '</form>' +
    '</div>';

  const form = document.getElementById("form-lengkapi-punggung");
  const errorEl = document.getElementById("lengkapi-error");
  const btn = document.getElementById("btn-simpan-lengkapi");

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    errorEl.style.display = "none";

    const rows = Array.from(document.querySelectorAll(".lengkapi-anggota-row"));
    const payload = [];
    const dipakai = [];

    for (const row of rows) {
      const id = row.getAttribute("data-id");
      const input = row.querySelector(".lengkapi-punggung-input");
      const raw = input.value.trim();

      if (!raw) {
        errorEl.textContent = "Mohon isi nomor punggung untuk SEMUA anggota tim.";
        errorEl.style.display = "block";
        return;
      }
      const nomor = parseInt(raw, 10);
      if (isNaN(nomor) || nomor < 1 || nomor > 99) {
        errorEl.textContent = "Nomor punggung harus berupa angka 1-99.";
        errorEl.style.display = "block";
        return;
      }
      if (dipakai.indexOf(nomor) !== -1) {
        errorEl.textContent = "Nomor punggung " + nomor + " dipakai lebih dari satu anggota. Mohon pastikan semua nomor berbeda.";
        errorEl.style.display = "block";
        return;
      }
      dipakai.push(nomor);
      payload.push({ id: id, nomor_punggung: nomor });
    }

    btn.disabled = true;
    btn.textContent = "Menyimpan...";

    const { data: hasil, error } = await supabaseClient.rpc("submit_nomor_punggung", { p_token: token, p_nomor: payload });

    btn.disabled = false;
    btn.textContent = "Simpan";

    if (error || !hasil || !hasil.success) {
      errorEl.textContent = (hasil && hasil.message) || (error && error.message) || "Gagal menyimpan. Coba lagi.";
      errorEl.style.display = "block";
      return;
    }

    root.innerHTML =
      '<div class="form-shell">' +
        '<h1>✓ Tersimpan</h1>' +
        '<p>Nomor punggung semua anggota tim sudah tersimpan. Terima kasih! Panitia akan memeriksa ulang data ini.</p>' +
      '</div>';
  });
}

window.ViewLengkapi = { template: LENGKAPI_TEMPLATE, init: initLengkapi };
