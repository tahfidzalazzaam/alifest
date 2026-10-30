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

// Token KELOMPOK ("#/sertifikat?grup=...", migrasi 0057) -- link sertifikat
// PESERTA per cabang lomba + jenis kelamin + jenjang. Sengaja memakai rute
// "#/sertifikat" yang sama dengan link pendamping (beda parameter saja).
function ambilGrupDariUrlSertifikat() {
  const dariQuery = new URLSearchParams(window.location.search).get("grup");
  if (dariQuery) return dariQuery.trim();
  const hash = window.location.hash || "";
  const tandaTanya = hash.indexOf("?");
  if (tandaTanya === -1) return "";
  return (new URLSearchParams(hash.slice(tandaTanya + 1)).get("grup") || "").trim();
}

async function initSertifikatGrupPublik(root, grup) {
  root.innerHTML = '<div class="form-shell"><p class="hint">Memuat...</p></div>';
  const { data, error } = await supabaseClient.rpc("ambil_grup_sertifikat", { p_token: grup });
  if (error || !data || !data.success) {
    root.innerHTML =
      '<div class="form-shell"><h1>Link Belum Tersedia</h1><p>' +
      escapeHTMLSertifikatPublik((data && data.message) || (error && error.message) || "Link ini tidak valid atau belum dibuka panitia.") +
      '</p></div>';
    return;
  }

  const jk = data.jenis_kelamin === "laki-laki" ? "Laki-laki" : data.jenis_kelamin === "perempuan" ? "Perempuan" : "";
  root.innerHTML =
    '<div class="form-shell">' +
      '<h1>🎓 Sertifikat Peserta</h1>' +
      '<p><strong>' + escapeHTMLSertifikatPublik(data.lomba) + '</strong>' +
        (data.jenjang ? ' &middot; ' + escapeHTMLSertifikatPublik(data.jenjang) : '') +
        (jk ? ' &middot; ' + jk : '') + '</p>' +
      '<div class="field"><label for="sertifikat-cari-nama">Ketik nama kamu (minimal 3 huruf)</label>' +
        '<input type="text" id="sertifikat-cari-nama" autocomplete="off" placeholder="Contoh: Ahmad" /></div>' +
      '<div class="submit-row"><button type="button" class="btn btn--primary" id="btn-cari-sertifikat">Cari</button></div>' +
      '<p id="sertifikat-cari-pesan" class="hint" style="margin-top:10px;"></p>' +
      '<div id="sertifikat-cari-hasil"></div>' +
      '<div id="sertifikat-pratinjau" style="margin-top:14px;"></div>' +
    '</div>';

  const input = document.getElementById("sertifikat-cari-nama");
  const pesan = document.getElementById("sertifikat-cari-pesan");
  const hasil = document.getElementById("sertifikat-cari-hasil");
  const pratinjau = document.getElementById("sertifikat-pratinjau");

  async function cari() {
    pesan.textContent = "";
    hasil.innerHTML = "";
    pratinjau.innerHTML = "";
    const kata = input.value.trim();
    if (kata.length < 3) { pesan.textContent = "Ketik minimal 3 huruf dari nama kamu."; return; }
    pesan.textContent = "Mencari...";
    const { data: res, error: err } = await supabaseClient.rpc("cari_peserta_sertifikat", { p_token: grup, p_kata: kata });
    if (err || !res || !res.success) {
      pesan.textContent = (res && res.message) || (err && err.message) || "Gagal mencari.";
      return;
    }
    if (!res.nama || res.nama.length === 0) {
      pesan.textContent = "Nama tidak ditemukan di kelompok ini. Cek ejaan, atau hubungi panitia kalau kamu yakin sudah ikut lomba.";
      return;
    }
    pesan.textContent = res.nama.length === 1 ? "Ditemukan 1 nama:" : "Ditemukan " + res.nama.length + " nama, pilih namamu:";
    hasil.innerHTML = res.nama.map(function (n, i) {
      return '<button type="button" class="btn btn--ghost btn-pilih-nama-sertifikat" data-i="' + i + '" style="margin:4px 6px 4px 0;">' + escapeHTMLSertifikatPublik(n) + '</button>';
    }).join("");
    hasil.querySelectorAll(".btn-pilih-nama-sertifikat").forEach(function (b) {
      b.addEventListener("click", function () { tampilkanPratinjau(res.nama[Number(b.dataset.i)]); });
    });
    if (res.nama.length === 1) tampilkanPratinjau(res.nama[0]);
  }

  async function tampilkanPratinjau(nama) {
    pratinjau.innerHTML = '<p class="hint">Menyiapkan pratinjau...</p>';
    try {
      await pastikanLibKartu();
      const templatesSemua = await ambilKartuTemplates();
      if (!templatesSemua.sertifikat || !templatesSemua.sertifikat.url) {
        pratinjau.innerHTML = '<p class="hint">Templat sertifikat belum disiapkan panitia. Mohon hubungi panitia.</p>';
        return;
      }
      const templateImg = await muatGambar(templatesSemua.sertifikat.url);
      const layout = templatesSemua.sertifikat.layout || DEFAULT_LAYOUT_KARTU.sertifikat;
      const canvas = document.createElement("canvas");
      gambarKartu(
        canvas, templateImg, layout,
        { nama: nama, peserta: "Peserta", lomba_sertifikat: singkatNamaLomba(data.lomba) },
        FIELD_SERTIFIKAT, SERTIFIKAT_LEBAR_PX, SERTIFIKAT_TINGGI_PX
      );
      canvas.style.cssText = "width:100%;height:auto;border:1px solid #ccc;border-radius:6px;";
      pratinjau.innerHTML =
        '<p><strong>' + escapeHTMLSertifikatPublik(nama) + '</strong></p>';
      pratinjau.appendChild(canvas);
      const baris = document.createElement("div");
      baris.className = "submit-row";
      baris.style.marginTop = "10px";
      baris.innerHTML = '<button type="button" class="btn btn--primary" id="btn-unduh-sertifikat-grup">Unduh Sertifikat (PDF)</button>';
      pratinjau.appendChild(baris);
      const status = document.createElement("p");
      status.className = "hint";
      pratinjau.appendChild(status);

      baris.querySelector("button").addEventListener("click", function () {
        try {
          const { jsPDF } = window.jspdf;
          const doc = new jsPDF({ unit: "cm", format: "a4", orientation: "landscape" });
          doc.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, SERTIFIKAT_LEBAR_CM, SERTIFIKAT_TINGGI_CM);
          doc.save("sertifikat-" + nama.trim().replace(/[^a-z0-9]+/gi, "-") + "-alif5.pdf");
          status.textContent = "✓ Selesai -- sertifikat terunduh.";
        } catch (e) {
          status.textContent = "Gagal membuat sertifikat: " + e.message;
        }
      });
    } catch (e) {
      pratinjau.innerHTML = '<p class="hint">Gagal menyiapkan pratinjau: ' + escapeHTMLSertifikatPublik(e.message) + '</p>';
    }
  }

  document.getElementById("btn-cari-sertifikat").addEventListener("click", cari);
  input.addEventListener("keydown", function (e) { if (e.key === "Enter") cari(); });
}

async function initSertifikatPublik() {
  const root = document.getElementById("sertifikat-publik-root");
  const grup = ambilGrupDariUrlSertifikat();
  if (grup) { initSertifikatGrupPublik(root, grup); return; }
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

      // Field "peserta" (label peran) SELALU "Peserta" untuk semua -- sama
      // seperti cetakSertifikatPDF() di view-admin.js. "lomba_sertifikat"
      // dilewatkan dulu ke singkatNamaLomba() (global, didefinisikan di
      // view-admin.js) untuk membuang kata "Lomba" di depan nama cabangnya,
      // supaya hasilnya identik dengan sertifikat yang dicetak massal
      // panitia. Field "nomor_pendaftaran" sudah DIHAPUS dari Sertifikat.
      const canvas = document.createElement("canvas");
      gambarKartu(
        canvas, templateImg, layout,
        { nama: data.nama, peserta: "Peserta", lomba_sertifikat: singkatNamaLomba(data.lomba) },
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
