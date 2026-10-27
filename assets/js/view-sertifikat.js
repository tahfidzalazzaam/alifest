// View: Unduh Sertifikat Pendamping ("#/sertifikat?token=..." ATAU
// "/sertifikat?token=...") -- halaman PUBLIK, tidak butuh login, diakses
// pendamping lewat link khusus yang DIBUAT & DIKIRIM MANUAL oleh panitia
// (tombol "🎓 Buat/Lihat Link Sertifikat" di popup detail Data Pendaftar,
// lihat renderTombolSertifikatPendamping() di assets/js/view-admin.js &
// migrasi 0055). TIDAK ditautkan di navbar mana pun -- hanya bisa dicapai
// lewat link itu sendiri.
//
// Sama seperti "/lengkapi" (lihat view-lengkapi.js untuk alasan lengkapnya),
// linknya memakai bentuk HASH ("#/sertifikat?token=...") sebagai jalur
// UTAMA -- rute hash SELALU berfungsi murni di browser tanpa butuh
// konfigurasi rewrite apa pun di sisi hosting, berbeda dari path langsung
// yang bergantung pada "rewrites" vercel.json. Dukungan path langsung
// ("/sertifikat?token=...") tetap ada di router.js/vercel.json sebagai
// alternatif, tapi link yang DIBAGIKAN panitia selalu memakai bentuk hash.
//
// Alurnya:
//  1. Baca token lewat ambilTokenDariUrlSertifikat().
//  2. Panggil RPC ambil_sertifikat(token) -- HANYA berhasil kalau token
//     cocok DAN status pendaftaran terkait PERSIS "Diterima" (gating di
//     SERVER, migrasi 0055 -- "ini hanya bagi peserta yang terverifikasi
//     saja"); kalau sukses, tampilkan nama pendamping & tombol unduh.
//  3. Begitu tombol "Unduh Sertifikat (PDF)" ditekan, templat generik
//     Sertifikat (site_settings.kartu_templates.sertifikat -- diatur
//     panitia di panel "🎓 Sertifikat", tab Kartu Peserta) dimuat & PDF-nya
//     di-GENERATE LANGSUNG di browser pendamping sendiri (satu halaman A4
//     landscape) memakai fungsi gambar YANG SAMA dengan punya panitia --
//     gambarKartu(), FIELD_SERTIFIKAT, SERTIFIKAT_LEBAR_PX/TINGGI_PX/
//     LEBAR_CM/TINGGI_CM, DEFAULT_LAYOUT_KARTU, ambilKartuTemplates(),
//     muatGambar(), pastikanLibKartu() -- semuanya SUDAH GLOBAL lewat
//     assets/js/view-admin.js (dimuat di SEMUA halaman situs ini, lihat
//     index.html), jadi TIDAK ADA duplikasi logika gambar/auto-mengecilkan
//     teks sama sekali -- hasilnya pasti identik dengan yang dicetak massal
//     panitia untuk peserta.

const SERTIFIKAT_PUBLIK_TEMPLATE = `
<main class="admin-page container">
  <div id="sertifikat-publik-root" style="max-width:640px;margin:0 auto;"></div>
</main>
`;

function escapeHTMLSertifikatPublik(teks) {
  const div = document.createElement("div");
  div.textContent = String(teks == null ? "" : teks);
  return div.innerHTML;
}

function ambilTokenDariUrlSertifikat() {
  // 1) Query string ASLI -- berlaku kalau halaman ini diakses lewat path
  //    langsung "/sertifikat?token=..." dan rewrite vercel.json-nya berhasil.
  const dariQuery = new URLSearchParams(window.location.search).get("token");
  if (dariQuery) return dariQuery.trim();

  // 2) Bagian "?..." DI DALAM hash -- berlaku untuk bentuk utama
  //    "#/sertifikat?token=...": semua yang di belakang "#" tidak pernah
  //    dikirim ke server sama sekali (murni ditangani browser), jadi
  //    window.location.search akan selalu kosong untuk bentuk ini -- perlu
  //    diuraikan manual dari window.location.hash.
  const hash = window.location.hash || "";
  const tandaTanya = hash.indexOf("?");
  if (tandaTanya === -1) return "";
  return (new URLSearchParams(hash.slice(tandaTanya + 1)).get("token") || "").trim();
}

async function initSertifikatPublik() {
  const root = document.getElementById("sertifikat-publik-root");
  const token = ambilTokenDariUrlSertifikat();

  if (!token) {
    root.innerHTML =
      '<div class="form-shell">' +
        '<h1>Link Tidak Lengkap</h1>' +
        '<p>Link ini tidak menyertakan token. Mohon buka lagi link yang diberikan panitia, atau hubungi panitia kalau link tetap bermasalah.</p>' +
      '</div>';
    return;
  }

  root.innerHTML = '<div class="form-shell"><p class="hint">Memuat data sertifikat...</p></div>';

  const { data, error } = await supabaseClient.rpc("ambil_sertifikat", { p_token: token });

  if (error || !data || !data.success) {
    root.innerHTML =
      '<div class="form-shell">' +
        '<h1>Link Tidak Berlaku</h1>' +
        '<p>' + escapeHTMLSertifikatPublik((data && data.message) || (error && error.message) || "Link ini tidak valid atau sudah tidak berlaku.") + '</p>' +
      '</div>';
    return;
  }

  renderUnduhSertifikatPublik(root, data);
}

function renderUnduhSertifikatPublik(root, data) {
  root.innerHTML =
    '<div class="form-shell">' +
      '<h1>🎓 Sertifikat Pendamping</h1>' +
      '<p><strong>Nama:</strong> ' + escapeHTMLSertifikatPublik(data.nama || "-") + '<br/>' +
        '<strong>Cabang Lomba:</strong> ' + escapeHTMLSertifikatPublik(data.lomba || "-") + '<br/>' +
        '<strong>Nomor Pendaftaran:</strong> ' + escapeHTMLSertifikatPublik(data.nomor_pendaftaran || "-") + '</p>' +
      '<p class="hint">Sertifikat akan dibuat & diunduh langsung di perangkat ini, format PDF (satu halaman A4 landscape).</p>' +
      '<div class="submit-row"><button type="button" class="btn btn--primary" id="btn-unduh-sertifikat-publik">Unduh Sertifikat (PDF)</button></div>' +
      '<p id="sertifikat-publik-status" class="hint" style="margin-top:10px;"></p>' +
    '</div>';

  document.getElementById("btn-unduh-sertifikat-publik").addEventListener("click", async function () {
    const btn = this;
    const labelAsli = btn.textContent;
    const statusEl = document.getElementById("sertifikat-publik-status");
    btn.disabled = true;
    btn.textContent = "Menyiapkan...";
    statusEl.textContent = "";

    try {
      await pastikanLibKartu();
      const templatesSemua = await ambilKartuTemplates();
      if (!templatesSemua.sertifikat || !templatesSemua.sertifikat.url) {
        statusEl.textContent = "Templat sertifikat belum disiapkan panitia. Mohon hubungi panitia.";
        return;
      }

      const templateImg = await muatGambar(templatesSemua.sertifikat.url);
      const layout = templatesSemua.sertifikat.layout || DEFAULT_LAYOUT_KARTU.sertifikat;

      const canvas = document.createElement("canvas");
      gambarKartu(
        canvas, templateImg, layout,
        { nama: data.nama, lomba_sertifikat: data.lomba, nomor_pendaftaran: data.nomor_pendaftaran },
        FIELD_SERTIFIKAT, SERTIFIKAT_LEBAR_PX, SERTIFIKAT_TINGGI_PX
      );

      const imgData = canvas.toDataURL("image/png");
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ unit: "cm", format: "a4", orientation: "landscape" });
      doc.addImage(imgData, "PNG", 0, 0, SERTIFIKAT_LEBAR_CM, SERTIFIKAT_TINGGI_CM);
      doc.save("sertifikat-" + (data.nama || "pendamping").trim().replace(/[^a-z0-9]+/gi, "-") + "-alif5.pdf");
      statusEl.textContent = "✓ Selesai -- sertifikat terunduh.";
    } catch (e) {
      statusEl.textContent = "Gagal membuat sertifikat: " + e.message + " -- coba lagi, atau hubungi panitia kalau terus gagal.";
    } finally {
      btn.disabled = false;
      btn.textContent = labelAsli;
    }
  });
}

window.ViewSertifikat = { template: SERTIFIKAT_PUBLIK_TEMPLATE, init: initSertifikatPublik };
