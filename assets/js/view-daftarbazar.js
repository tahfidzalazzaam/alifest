// View: Form Pendaftaran Bazar ("#/daftar-bazar") -- pindahan PERSIS dari
// isi "#/bazar" versi lama (form pendaftaran stand/tenant lengkap dengan
// validasi & upload berkas), TIDAK ADA perubahan logika/data. "#/bazar"
// sendiri sekarang jadi halaman INFO Bazar terpisah (lihat view-bazar.js),
// dengan tombol "Daftar Stand Sekarang" yang menuju ke sini.
//
// Tetap TERPISAH TOTAL dari halaman pendaftaran lomba ("#/daftar"): tabel,
// fungsi RPC, status buka/tutup, dan kuotanya sendiri-sendiri (lihat migrasi
// 0030). Satu halaman form sederhana (tidak ada langkah/wizard seperti form
// lomba, karena datanya lebih sedikit & seragam untuk semua tenant).
//
// Sejak migrasi 0037: kategori stand teks bebas (Kecil/Sedang/Besar) DIGANTI
// TOTAL oleh "Denah Stand" -- 3 JENIS baku (A/B/C, lihat
// `bazar_settings.jenis_stand_info`) yang MASING-MASING punya AREA & KUOTA
// PASTI (tabel `bazar_stand`, satu baris per petak stand fisik). Tenant
// pilih SATU jenis dulu, lalu pilih SATU ATAU LEBIH lokasi/kode stand dari
// jenis itu (boleh sewa lebih dari satu stand sekaligus, asal jenisnya
// sama -- mau jenis lain, daftar lagi terpisah). Belum ada gambar denah
// visualnya (menyusul kalau panitia sudah punya gambar kasarnya) -- untuk
// sekarang dipilih lewat daftar/grid kode per area.

const DAFTAR_BAZAR_TEMPLATE = `
<main class="form-page container">
  <div class="form-header">
    <h1>Pendaftaran Stand/Tenant Bazar</h1>
    <p>${EVENT_FULL_NAME} — isi data usaha/stand Anda untuk ikut meramaikan bazar ALIF 5.0. Belum lihat info lengkap Bazar? <a href="#/bazar">Kembali ke halaman Bazar</a>.</p>
  </div>

  <div class="form-shell">
    <div class="notice" id="bazar-info-biaya" style="display:none;"></div>
    <div class="notice" id="bazar-info-rekening" style="display:none;"></div>

    <form id="form-bazar" novalidate>

      <fieldset>
        <legend>Data Usaha/Stand</legend>

        <div class="field">
          <label for="bazarNamaUsaha">Nama Usaha/Stand</label>
          <input type="text" id="bazarNamaUsaha" name="bazarNamaUsaha" placeholder="mis. Warung Kopi Berkah" />
          <div class="form-error">Nama usaha/stand wajib diisi.</div>
        </div>

        <div class="field">
          <label for="bazarJenisProduk">Jenis Produk/Dagangan</label>
          <input type="text" id="bazarJenisProduk" name="bazarJenisProduk" placeholder="mis. Makanan ringan, minuman, pakaian, dll" />
          <div class="form-error">Jenis produk/dagangan wajib diisi.</div>
        </div>

        <div class="field" id="bazar-jenis-field">
          <label>Pilih Jenis Stand</label>
          <div class="lomba-choices" id="bazar-jenis-choices"></div>
          <div class="form-error" id="bazar-jenis-error" style="margin-top:10px;">Pilih salah satu jenis stand.</div>
        </div>

        <div class="field" id="bazar-lokasi-field" style="display:none;">
          <label>Pilih Lokasi Stand <span style="font-weight:400;">(klik langsung kotaknya di denah di bawah -- boleh pilih lebih dari satu kalau mau sewa beberapa stand sekaligus)</span></label>
          <div id="bazar-denah-legenda"></div>
          <div id="bazar-denah-pad" style="padding:18px 14px 14px 14px;">
            <div id="bazar-denah-outer" style="width:100%;max-width:900px;overflow:visible;position:relative;border:2px dashed #b9d9c2;border-radius:16px;background:#eef7ec;margin:0 auto;">
              <div id="bazar-denah-inner" style="position:relative;transform-origin:top left;"></div>
            </div>
          </div>
          <p class="hint" id="bazar-lokasi-total" style="margin-top:8px;"></p>
          <div class="form-error" id="bazar-lokasi-error" style="margin-top:10px;">Pilih minimal satu lokasi stand.</div>
        </div>
      </fieldset>

      <fieldset>
        <legend>Penanggung Jawab</legend>

        <div class="field-row">
          <div class="field">
            <label for="bazarPenanggungJawab">Nama Penanggung Jawab</label>
            <input type="text" id="bazarPenanggungJawab" name="bazarPenanggungJawab" />
            <div class="form-error">Nama penanggung jawab wajib diisi.</div>
          </div>
          <div class="field">
            <label for="bazarWhatsapp">No. WhatsApp Aktif</label>
            <input type="tel" id="bazarWhatsapp" name="bazarWhatsapp" placeholder="08xxxxxxxxxx" />
            <div class="form-error">Nomor WhatsApp wajib diisi.</div>
          </div>
        </div>
      </fieldset>

      <fieldset>
        <legend>Unggah Berkas</legend>

        <div class="field">
          <label>Foto Produk/Logo Usaha</label>
          <p class="hint" style="margin-top:-4px;">Unggah satu atau beberapa foto produk/logo usaha Anda (dipakai panitia untuk verifikasi & promosi bazar).</p>
          <div class="upload-field" id="upload-bazar-foto">
            <label class="upload-trigger" for="bazarFileFoto">Pilih berkas (boleh lebih dari satu, JPG/PNG, maks 4MB/file)</label>
            <input type="file" id="bazarFileFoto" name="bazarFileFoto" accept=".jpg,.jpeg,.png" multiple />
            <div class="filename" id="filename-bazar-foto">Belum ada berkas dipilih.</div>
          </div>
          <div class="form-error">Foto produk/logo usaha wajib diunggah.</div>
        </div>

        <div class="field" id="bazar-bukti-bayar-wrap">
          <label id="bazar-bukti-bayar-label">Bukti Pembayaran Sewa Stand</label>
          <p class="hint" style="margin-top:-4px;" id="bazar-bukti-bayar-hint">Transfer biaya sewa stand sesuai jenis & jumlah lokasi yang dipilih di atas, lalu unggah screenshot/foto bukti transfernya di sini.</p>
          <div class="upload-field" id="upload-bazar-bukti">
            <label class="upload-trigger" for="bazarFileBukti">Pilih berkas (JPG/PNG/PDF, maks 4MB)</label>
            <input type="file" id="bazarFileBukti" name="bazarFileBukti" accept=".jpg,.jpeg,.png,.pdf" />
            <div class="filename" id="filename-bazar-bukti">Belum ada berkas dipilih.</div>
          </div>
          <div class="form-error">Bukti pembayaran wajib diunggah.</div>
        </div>
      </fieldset>

      <fieldset>
        <label class="checkbox-field">
          <input type="checkbox" id="bazarKonfirmasi" name="bazarKonfirmasi" required />
          <span>Saya menyatakan data yang diisi sudah benar dan bersedia mematuhi ketentuan bazar ALIF 5.0.</span>
        </label>
        <div class="form-error" id="bazar-konfirmasi-error">Centang pernyataan ini sebelum mengirim.</div>
      </fieldset>

      <div class="submit-row">
        <button type="submit" class="btn btn--primary" id="btn-submit-bazar">Kirim Pendaftaran Bazar</button>
      </div>
    </form>

    <div class="result-panel" id="result-panel-bazar">
      <div class="result-panel__icon">✅</div>
      <h2>Pendaftaran stand berhasil dikirim</h2>
      <p>Simpan nomor pendaftaran berikut sebagai bukti:</p>
      <div class="reg-number" id="reg-number-bazar">—</div>
      <p>Panitia bazar akan memverifikasi data & pembayaran, lalu menghubungi lewat WhatsApp.</p>
      <button type="button" class="btn btn--ghost" id="btn-daftar-bazar-lagi">Daftar Stand Lain</button>
    </div>
  </div>
</main>
`;

// Pesan lucu bertema "lagi maintenance, ngumpulin cakra dulu" untuk saklar
// "Tutup Total Bazar" (bazar_settings.tutup_total, migrasi 0035) -- dipilih
// acak tiap kali form ini dirender. ISI-nya SAMA PERSIS dengan yang ada di
// view-bazar.js (kalau mau diubah, ganti di KEDUA tempat itu supaya tetap
// konsisten) -- tapi NAMA KONSTANTANYA SENGAJA DIBEDAKAN (diberi akhiran
// `_DAFTAR` di sini, `_INFO` di view-bazar.js) karena kedua file ini sama-
// sama dimuat sebagai <script> klasik di index.html dan berbagi SATU scope
// global yang sama -- dua `const` dengan nama IDENTIK di dua file berbeda
// akan membuat browser melempar `SyntaxError: Identifier '...' has already
// been declared` saat file kedua dimuat, yang GAGAL TOTAL me-load seluruh
// isi file itu (termasuk `window.ViewDaftarBazar` di baris paling akhir) --
// inilah sebab nyata laporan "tombol Daftar Stand Sekarang tidak bisa
// pindah halaman" (bukan soal file basi di GitHub seperti dugaan awal).
const PESAN_LUCU_BAZAR_TUTUP_TOTAL_DAFTAR = [
  "Bazar-nya lagi mode pertapaan dulu, ngumpulin cakra sebanyak-banyaknya biar pas dibuka nanti langsung ngegas. 🌀 Sabar ya, chakra-nya baru keisi separuh.",
  "Maintenance dulu, Ninja! Panitia lagi menghimpun cakra di seluruh penjuru pondok sebelum Bazar resmi dibuka ke publik. 🥷⚡",
  "Error 404: Cakra belum cukup. Sedang dalam proses pengisian ulang, balik lagi nanti kalau sudah full tank ya. 🔋",
  "Lagi semedi di Air Terjun Kebenaran sambil ngumpulin cakra buat Bazar ALIF 5.0. Jangan diganggu dulu, nanti juga muncul sendiri. 🏞️🧘",
  "Rasengan Bazar-nya masih dalam proses pembentukan cakra, belum stabil kalau dibuka sekarang. Ditunggu ya sampai sempurna. 🌀",
  "Mode Sage lagi aktif: panitia sedang menyerap cakra alam demi persiapan Bazar yang maksimal. Coba mampir lagi nanti. 🍃"
];

// Urutan tampil jenis stand -- tetap A, B, C apa pun urutan key di jsonb.
const URUTAN_JENIS_STAND = ["A", "B", "C"];

// -------- Denah visual READ-ONLY untuk memilih lokasi stand (publik) --------
// Dipakai menggantikan grid checkbox lama -- pengunjung klik LANGSUNG kotak
// stand-nya di kanvas (bukan ketik/centang dari daftar teks) untuk memilih
// lokasi, mirip tampilan "Edit Denah Visual" di `/adminbazar`
// (`view-adminbazar.js`) tapi versi lihat-&-klik-saja: TIDAK ada drag,
// resize, atau rotate-handle sama sekali di sini (posisi/ukuran/rotasi
// kotak MURNI dibaca dari `pos_x`/`pos_y`/`lebar`/`tinggi`/`rotasi` yang
// sudah diatur panitia lewat editor admin, bukan hasil interaksi
// pengunjung). Konstanta kanvas & warna jenis SENGAJA diberi nama sendiri
// yang BERBEDA dari `DENAH_CANVAS_W`/`DENAH_CANVAS_H`/`WARNA_JENIS_DENAH`
// milik `view-adminbazar.js` -- kedua file itu sama-sama dimuat sebagai
// <script> klasik berbagi satu scope global, jadi nama yang identik akan
// tabrakan `SyntaxError: Identifier '...' has already been declared` persis
// seperti bug `PESAN_LUCU_BAZAR_TUTUP_TOTAL` yang pernah terjadi (lihat
// catatan di atas) -- ini bukan duplikasi ceroboh, tapi penghindaran
// tabrakan nama yang disengaja.
const DENAH_PUBLIK_CANVAS_W = 760;
const DENAH_PUBLIK_CANVAS_H = 600;
const WARNA_JENIS_DENAH_PUBLIK = { A: "#e08a2e", B: "#3f7fb0", C: "#d1588f" };

// Sama seperti `_denahResizeHandler` di `view-adminbazar.js` -- dipegang di
// scope modul (bukan di dalam `initDaftarBazar`) supaya listener "resize"
// window dari render sebelumnya SELALU bisa dicopot sebelum render
// berikutnya menambah yang baru (mis. pengunjung klik "Daftar Stand Lain"
// lalu kembali ke form ini, me-render ulang `initDaftarBazar()` dari awal).
let _denahPublikResizeHandler = null;

function formatRupiahDaftarBazar(angka) {
  return "Rp" + Number(angka || 0).toLocaleString("id-ID");
}

function initDaftarBazar() {
  const form = document.getElementById("form-bazar");
  const jenisChoicesEl = document.getElementById("bazar-jenis-choices");
  const jenisErrorEl = document.getElementById("bazar-jenis-error");
  const lokasiFieldEl = document.getElementById("bazar-lokasi-field");
  const legendaEl = document.getElementById("bazar-denah-legenda");
  const lokasiTotalEl = document.getElementById("bazar-lokasi-total");
  const lokasiErrorEl = document.getElementById("bazar-lokasi-error");
  const btnSubmit = document.getElementById("btn-submit-bazar");
  const resultPanel = document.getElementById("result-panel-bazar");
  const regNumberEl = document.getElementById("reg-number-bazar");

  let jenisStandInfo = {};
  let standList = []; // semua baris bazar_stand: {id, jenis, area, nomor, kode, tenant_id, pos_x, pos_y, lebar, tinggi, rotasi}
  let elemenList = []; // label konteks denah (Masjid/Sekretariat PSB/Asrama dkk) -- murni visual, read-only di sini
  let jenisTerpilih = null;
  let pendaftaranDibuka = true;
  // Kode stand yang DIPILIH pengunjung lewat klik di denah -- pengganti
  // langsung dari NodeList checkbox lama (`lokasiAreasEl.querySelectorAll
  // ('input[name="bazarLokasi"]:checked')`), dibaca validateForm()/submit
  // persis sama seperti sebelumnya, cuma sumbernya sekarang Set ini.
  let kodeTerpilihSet = new Set();

  function escapeHTMLDaftarBazar(teks) {
    const div = document.createElement("div");
    div.textContent = String(teks == null ? "" : teks);
    return div.innerHTML;
  }

  /* ---------------- Pilihan Jenis Stand (A/B/C, dari bazar_settings.jenis_stand_info) ---------------- */
  function renderJenisChoices() {
    jenisChoicesEl.innerHTML = URUTAN_JENIS_STAND.filter(function (j) { return jenisStandInfo[j]; }).map(function (j) {
      const info = jenisStandInfo[j];
      const standJenisIni = standList.filter(function (s) { return s.jenis === j; });
      const sisa = standJenisIni.filter(function (s) { return !s.tenant_id; }).length;
      const penuh = sisa === 0;
      return (
        '<div class="lomba-choice' + (penuh ? " is-disabled" : "") + '">' +
          '<label>' +
            '<input type="radio" name="bazarJenis" value="' + j + '"' + (penuh ? " disabled" : "") + ' />' +
            '<span class="lomba-choice__icon">🏪</span>' +
            '<span class="lomba-choice__text"><strong>' + escapeHTMLDaftarBazar(info.nama || ("Jenis " + j)) + '</strong>' +
              '<br/>' + escapeHTMLDaftarBazar(info.ukuran || "-") + ' · ' + formatRupiahDaftarBazar(info.harga) +
              '<br/>' + (penuh ? '<span style="color:#b42318;">Penuh, tidak ada stand tersisa</span>' : ('Sisa ' + sisa + ' dari ' + standJenisIni.length + ' stand')) +
            '</span>' +
          '</label>' +
        '</div>'
      );
    }).join("");

    jenisChoicesEl.querySelectorAll('input[name="bazarJenis"]').forEach(function (radio) {
      radio.addEventListener("change", function () {
        jenisTerpilih = radio.value;
        renderLokasiPicker();
      });
    });
  }

  /* ---------------- Pilihan Lokasi Stand -- klik langsung di denah visual ---------------- */
  // Satu kotak kecil per stand (posisi/ukuran/rotasi dibaca dari
  // `bazar_stand`, hasil pengaturan panitia lewat "Edit Denah Visual" di
  // `/adminbazar`), digambar di atas kanvas virtual tetap
  // `DENAH_PUBLIK_CANVAS_W × DENAH_PUBLIK_CANVAS_H`, discaling ke lebar
  // kontainer sebenarnya persis pola `terapkanSkala()` di
  // `view-adminbazar.js` -- BEDANYA di sini TIDAK ADA drag/resize/rotate,
  // cuma satu `click` listener per kotak stand yang statusnya boleh dipilih
  // (jenis-nya cocok DENGAN jenis yang sedang dipilih di atas, dan belum
  // terisi tenant lain) untuk menambah/melepas kode stand itu dari
  // `kodeTerpilihSet`. Kotak jenis LAIN & kotak yang sudah terisi tetap
  // digambar (supaya denahnya terasa utuh, bukan bolong-bolong) tapi
  // dibuat pudar/non-interaktif. Label konteks (`elemenList` -- Masjid,
  // Sekretariat PSB, Asrama) digambar paling belakang, statis, cuma
  // penanda arah di denah.
  //
  // Tulisan DI DALAM kotak sengaja diringkas jadi "<kode area>-<nomor>" (mis.
  // "B-DA-07" -> "DA-7", "C-PSB-03" -- "PSB-3") -- kode LENGKAP (dengan
  // awalan jenis A/B/C) tetap dipakai apa adanya untuk segala sesuatu yang
  // BUKAN tulisan di kotak: `title` (tooltip saat kotaknya di-hover/ditahan),
  // isi `kodeTerpilihSet` yang dikirim ke `submit_bazar`, dan ringkasan "X
  // stand dipilih (...)" di bawah kanvas -- cuma TAMPILAN di dalam kotaknya
  // saja yang dipendekkan, supaya tidak kepotong/kekecilan di kotak yang
  // ukurannya kecil, terutama di layar HP.
  function labelRingkasKodeBazarPublik(kode) {
    const bagian = String(kode || "").split("-");
    if (bagian.length >= 3) {
      // Format "B-DA-07"/"C-PSB-03" -- buang awalan jenis (A/B/C), gabung
      // sisanya ("DA"/"PSB") dengan nomor urutnya TANPA angka nol di depan.
      const nomor = parseInt(bagian[bagian.length - 1], 10);
      return bagian.slice(1, -1).join("-") + "-" + (isNaN(nomor) ? bagian[bagian.length - 1] : nomor);
    }
    if (bagian.length === 2) {
      // Format "A-01" (Jenis A cuma satu area "Depan Masjid", tidak ada
      // kode area terpisah tertanam di `kode`-nya sendiri) -- pakai
      // singkatan tetap "DM" (Depan Masjid) supaya gayanya tetap konsisten
      // dengan Jenis B/C.
      const nomor = parseInt(bagian[1], 10);
      return "DM-" + (isNaN(nomor) ? bagian[1] : nomor);
    }
    return kode; // format kode tak dikenal -- jatuh balik tampilkan apa adanya
  }

  function buatKotakLokasiPublik(opsi) {
    const el = document.createElement("div");
    el.style.position = "absolute";
    el.style.left = opsi.x + "px";
    el.style.top = opsi.y + "px";
    el.style.width = opsi.w + "px";
    el.style.height = opsi.h + "px";
    el.style.transformOrigin = "50% 50%";
    el.style.transform = "rotate(" + (opsi.rotasi || 0) + "deg)";
    el.style.borderRadius = "6px";
    el.style.display = "flex";
    el.style.flexDirection = "column";
    el.style.alignItems = "center";
    el.style.justifyContent = "center";
    el.style.textAlign = "center";
    el.style.fontWeight = "700";
    el.style.lineHeight = "1.15";
    el.style.padding = "2px";
    el.style.boxSizing = "border-box";
    el.style.fontSize = Math.max(8, Math.min(26, Math.min(opsi.w, opsi.h) / 3.2)) + "px";
    el.style.border = "1.5px solid rgba(0,0,0,0.15)";
    el.style.userSelect = "none";
    el.style.touchAction = "manipulation";

    if (opsi.tipeLabel) {
      // Label konteks (bangunan/area) -- statis & dipudarkan, bukan target klik.
      el.style.background = opsi.warnaBg || "#eef3ea";
      el.style.color = opsi.warnaTeks || "#4b5f4d";
      el.style.opacity = "0.6";
      el.innerHTML =
        (opsi.sublabel ? ('<span style="display:block;font-size:1.3em;">' + escapeHTMLDaftarBazar(opsi.sublabel) + '</span>') : "") +
        '<span>' + escapeHTMLDaftarBazar(opsi.label) + '</span>';
      return el;
    }

    const warnaDasar = WARNA_JENIS_DENAH_PUBLIK[opsi.jenis] || "#777777";
    el.textContent = labelRingkasKodeBazarPublik(opsi.kode);

    if (opsi.terisi) {
      el.style.background = "#fde8e8";
      el.style.color = "#b91c1c";
      el.style.cursor = "not-allowed";
      el.title = opsi.kode + " -- sudah terisi tenant lain.";
      return el;
    }

    if (!opsi.selectable) {
      // Jenis LAIN dari yang sedang dipilih -- tetap kelihatan bentuknya
      // (supaya denah terasa utuh), tapi pudar & tidak bisa diklik.
      el.style.background = warnaDasar;
      el.style.color = "#ffffff";
      el.style.opacity = "0.28";
      el.style.cursor = "default";
      el.title = opsi.kode + " (Jenis " + opsi.jenis + " -- pilih Jenis " + opsi.jenis + " dulu di atas untuk memilih lokasi ini).";
      return el;
    }

    // Kotak yang BOLEH diklik (jenisnya cocok & belum terisi).
    el.style.background = warnaDasar;
    el.style.color = "#ffffff";
    el.style.cursor = "pointer";
    el.title = "Klik untuk pilih/batalkan stand " + opsi.kode + ".";

    function terapkanGayaTerpilih() {
      const dipilih = kodeTerpilihSet.has(opsi.kode);
      el.style.outline = dipilih ? "3px solid #1E7A4C" : "none";
      el.style.outlineOffset = dipilih ? "1px" : "0";
      el.style.boxShadow = dipilih ? "0 2px 6px rgba(0,0,0,0.3)" : "none";
    }
    terapkanGayaTerpilih();

    el.addEventListener("click", function () {
      if (kodeTerpilihSet.has(opsi.kode)) kodeTerpilihSet.delete(opsi.kode);
      else kodeTerpilihSet.add(opsi.kode);
      terapkanGayaTerpilih();
      perbaruiTotalLokasi();
    });

    return el;
  }

  function renderLokasiPicker() {
    if (!jenisTerpilih) {
      lokasiFieldEl.style.display = "none";
      return;
    }
    lokasiFieldEl.style.display = "block";
    // Reset pilihan tiap kali jenis diganti -- kode stand milik jenis lama
    // sudah tidak relevan begitu jenisnya berubah (submit_bazar hanya
    // menerima SATU jenis sekaligus per pengiriman, lihat migrasi 0037).
    kodeTerpilihSet = new Set();

    const warnaJenisAktif = WARNA_JENIS_DENAH_PUBLIK[jenisTerpilih] || "#777777";
    legendaEl.innerHTML =
      '<div style="display:flex;flex-wrap:wrap;gap:14px;margin:8px 0 2px;font-size:12.5px;color:#4b5563;">' +
        '<span style="display:inline-flex;align-items:center;gap:5px;"><span style="width:14px;height:14px;border-radius:3px;background:' + warnaJenisAktif + ';display:inline-block;"></span>Tersedia (klik untuk pilih)</span>' +
        '<span style="display:inline-flex;align-items:center;gap:5px;"><span style="width:14px;height:14px;border-radius:3px;background:' + warnaJenisAktif + ';outline:2.5px solid #1E7A4C;outline-offset:1px;display:inline-block;"></span>Dipilih</span>' +
        '<span style="display:inline-flex;align-items:center;gap:5px;"><span style="width:14px;height:14px;border-radius:3px;background:#fde8e8;border:1px solid #f3b4b4;display:inline-block;"></span>Terisi</span>' +
        '<span style="display:inline-flex;align-items:center;gap:5px;"><span style="width:14px;height:14px;border-radius:3px;background:#999;opacity:0.28;display:inline-block;"></span>Jenis lain</span>' +
      '</div>';

    const outerEl = document.getElementById("bazar-denah-outer");
    const innerEl = document.getElementById("bazar-denah-inner");
    innerEl.style.width = DENAH_PUBLIK_CANVAS_W + "px";
    innerEl.style.height = DENAH_PUBLIK_CANVAS_H + "px";

    innerEl.innerHTML = "";
    elemenList.forEach(function (elm) {
      innerEl.appendChild(buatKotakLokasiPublik({
        tipeLabel: true,
        x: elm.pos_x, y: elm.pos_y, w: elm.lebar, h: elm.tinggi, rotasi: elm.rotasi,
        warnaBg: elm.warna_bg, warnaTeks: elm.warna_teks,
        label: elm.teks, sublabel: elm.emoji
      }));
    });
    standList.forEach(function (s) {
      innerEl.appendChild(buatKotakLokasiPublik({
        kode: s.kode, jenis: s.jenis,
        x: s.pos_x != null ? s.pos_x : 20, y: s.pos_y != null ? s.pos_y : 20,
        w: s.lebar || 54, h: s.tinggi || 40, rotasi: s.rotasi || 0,
        terisi: !!s.tenant_id,
        selectable: s.jenis === jenisTerpilih && !s.tenant_id
      }));
    });

    function terapkanSkalaDenahPublik() {
      if (!outerEl.clientWidth) return;
      const scale = outerEl.clientWidth / DENAH_PUBLIK_CANVAS_W;
      innerEl.style.transform = "scale(" + scale + ")";
      outerEl.style.height = (DENAH_PUBLIK_CANVAS_H * scale) + "px";
    }
    terapkanSkalaDenahPublik();

    if (_denahPublikResizeHandler) window.removeEventListener("resize", _denahPublikResizeHandler);
    _denahPublikResizeHandler = terapkanSkalaDenahPublik;
    window.addEventListener("resize", _denahPublikResizeHandler);

    perbaruiTotalLokasi();
  }

  function perbaruiTotalLokasi() {
    const dipilih = kodeTerpilihSet.size;
    const harga = jenisTerpilih && jenisStandInfo[jenisTerpilih] ? (jenisStandInfo[jenisTerpilih].harga || 0) : 0;
    lokasiTotalEl.textContent = dipilih === 0
      ? "Belum ada lokasi dipilih."
      : (dipilih + " stand dipilih (" + Array.from(kodeTerpilihSet).sort().join(", ") + ") × " + formatRupiahDaftarBazar(harga) + " = " + formatRupiahDaftarBazar(dipilih * harga) + ".");
  }

  /* ---------------- Muat pengaturan bazar (buka/tutup, jenis & denah stand, info biaya/rekening) ---------------- */
  async function muatPengaturanBazar() {
    const [{ data: settings }, { data: standData }, { data: elemenData }, { data: sesi }] = await Promise.all([
      supabaseClient.from("bazar_settings").select("pendaftaran_dibuka,tutup_total,jenis_stand_info,info_biaya,info_rekening").eq("id", 1).single(),
      supabaseClient.from("bazar_stand").select("id,jenis,area,nomor,kode,tenant_id,pos_x,pos_y,lebar,tinggi,rotasi").order("jenis").order("nomor"),
      supabaseClient.from("bazar_denah_elemen").select("*").order("urutan"),
      supabaseClient.auth.getSession()
    ]);

    // "Tutup Total Bazar" (bazar_settings.tutup_total, migrasi 0035) --
    // sama seperti di view-bazar.js: form ini juga ikut disembunyikan dari
    // pengunjung biasa (bukan cuma pesan "pendaftaran ditutup" seperti
    // pendaftaran_dibuka=false), kecuali panitia yang sedang login.
    const panitiaLogin = !!(sesi && sesi.session);
    if (settings && settings.tutup_total === true && !panitiaLogin) {
      const shell = document.querySelector(".form-shell");
      if (shell) {
        const pesan = PESAN_LUCU_BAZAR_TUTUP_TOTAL_DAFTAR[Math.floor(Math.random() * PESAN_LUCU_BAZAR_TUTUP_TOTAL_DAFTAR.length)];
        shell.innerHTML =
          '<div style="text-align:center;padding:20px 0;">' +
            '<div style="font-size:2.4rem;margin-bottom:12px;">🌀</div>' +
            '<h2>Bazar Belum Dibuka</h2>' +
            '<p>' + escapeHTMLDaftarBazar(pesan) + '</p>' +
          '</div>';
      }
      return;
    }

    // Panitia yang login tetap melihat form ini seperti biasa walau
    // tutup_total aktif (supaya bisa pratinjau) -- banner pengingat di atas.
    if (settings && settings.tutup_total === true && panitiaLogin) {
      const shell = document.querySelector(".form-shell");
      if (shell) {
        const banner = document.createElement("div");
        banner.className = "notice notice--error";
        banner.style.marginBottom = "16px";
        banner.textContent = "🔒 Mode Pratinjau Panitia: halaman ini sedang DISEMBUNYIKAN dari publik (\"Tutup Total Bazar\" aktif di /adminbazar).";
        shell.insertBefore(banner, shell.firstChild);
      }
    }

    pendaftaranDibuka = !settings || settings.pendaftaran_dibuka !== false;
    jenisStandInfo = (settings && settings.jenis_stand_info) || {};
    standList = standData || [];
    elemenList = elemenData || [];
    // Kuota sekarang per jenis/area, otomatis dibatasi oleh jumlah fisik
    // baris `bazar_stand` (migrasi 0037) -- "penuh total" cuma kalau SEMUA
    // jenis sudah tidak ada sisa sama sekali (dicek lewat renderJenisChoices,
    // yang menonaktifkan radio tiap jenis yang sudah penuh satu per satu).
    const semuaPenuh = standList.length > 0 && standList.every(function (s) { return !!s.tenant_id; });

    renderJenisChoices();

    const infoBiayaEl = document.getElementById("bazar-info-biaya");
    if (settings && settings.info_biaya) {
      infoBiayaEl.textContent = "💰 " + settings.info_biaya;
      infoBiayaEl.style.display = "block";
    }

    const infoRekeningEl = document.getElementById("bazar-info-rekening");
    if (settings && settings.info_rekening) {
      infoRekeningEl.textContent = "🏦 " + settings.info_rekening;
      infoRekeningEl.style.display = "block";
    }

    if (!pendaftaranDibuka || semuaPenuh) {
      const shell = document.querySelector(".form-shell");
      const pesan = !pendaftaranDibuka
        ? "Mohon maaf, pendaftaran stand/tenant bazar ALIF 5.0 sedang tidak dibuka sementara oleh panitia. Silakan cek kembali nanti atau hubungi panitia untuk informasi lebih lanjut."
        : "Mohon maaf, seluruh stand bazar ALIF 5.0 (semua jenis) sudah penuh terisi. Silakan hubungi panitia untuk informasi lebih lanjut.";
      if (shell) {
        shell.innerHTML =
          '<div style="text-align:center;padding:20px 0;">' +
            '<div style="font-size:2.4rem;margin-bottom:12px;">' + (!pendaftaranDibuka ? "🔒" : "🚫") + '</div>' +
            '<h2>' + (!pendaftaranDibuka ? "Pendaftaran Bazar Sedang Ditutup" : "Stand Penuh") + '</h2>' +
            '<p>' + pesan + '</p>' +
            '<p><a href="#/bazar" class="btn btn--ghost">Kembali ke halaman Bazar</a></p>' +
          '</div>';
      }
    }
  }

  /* ---------------- Upload berkas (pola sama dengan view-daftar.js, bucket & prefix "bazar/" supaya terpisah rapi) ---------------- */
  function ekstensi(file) {
    const bagian = file.name.split(".");
    return bagian.length > 1 ? bagian.pop() : "bin";
  }

  async function uploadKeStorageBazar(file, label) {
    const path = "bazar/" + Date.now() + "-" + Math.random().toString(36).slice(2) + "-" + label + "." + ekstensi(file);
    const { error } = await supabaseClient.storage.from(STORAGE_BUCKET).upload(path, file, {
      contentType: file.type,
      upsert: false
    });
    if (error) {
      console.error("Detail error upload (" + label + "):", error);
      throw new Error("Gagal mengunggah " + label + ": " + error.message);
    }
    const { data } = supabaseClient.storage.from(STORAGE_BUCKET).getPublicUrl(path);
    return data.publicUrl;
  }

  function setupUploadMulti(inputId, boxId, filenameId) {
    const input = document.getElementById(inputId);
    const box = document.getElementById(boxId);
    const filenameEl = document.getElementById(filenameId);

    input.addEventListener("change", function () {
      const files = Array.from(input.files || []);
      if (files.length === 0) {
        box.classList.remove("has-file");
        filenameEl.textContent = "Belum ada berkas dipilih.";
        return;
      }
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const sizeOk = file.size <= MAX_FILE_SIZE_MB * 1024 * 1024;
        const typeOk = ALLOWED_FILE_TYPES.indexOf(file.type) !== -1;
        if (!sizeOk || !typeOk) {
          filenameEl.textContent = !sizeOk
            ? ('Berkas "' + file.name + '" melebihi ' + MAX_FILE_SIZE_MB + 'MB. Pilih ulang berkas.')
            : ('Format "' + file.name + '" tidak didukung.');
          box.classList.remove("has-file");
          input.value = "";
          return;
        }
      }
      filenameEl.textContent = files.length === 1
        ? files[0].name
        : (files.length + " berkas dipilih: " + files.map(function (f) { return f.name; }).join(", "));
      box.classList.add("has-file");
    });
  }

  function setupUploadSingle(inputId, boxId, filenameId) {
    const input = document.getElementById(inputId);
    const box = document.getElementById(boxId);
    const filenameEl = document.getElementById(filenameId);

    input.addEventListener("change", function () {
      const file = input.files && input.files[0];
      if (!file) {
        box.classList.remove("has-file");
        filenameEl.textContent = "Belum ada berkas dipilih.";
        return;
      }
      const sizeOk = file.size <= MAX_FILE_SIZE_MB * 1024 * 1024;
      const typeOk = ALLOWED_FILE_TYPES.indexOf(file.type) !== -1;
      if (!sizeOk || !typeOk) {
        filenameEl.textContent = !sizeOk
          ? ("Berkas melebihi " + MAX_FILE_SIZE_MB + "MB. Pilih ulang berkas.")
          : "Format tidak didukung. Gunakan JPG, PNG, atau PDF.";
        box.classList.remove("has-file");
        input.value = "";
        return;
      }
      filenameEl.textContent = file.name;
      box.classList.add("has-file");
    });
  }

  setupUploadMulti("bazarFileFoto", "upload-bazar-foto", "filename-bazar-foto");
  setupUploadSingle("bazarFileBukti", "upload-bazar-bukti", "filename-bazar-bukti");

  /* ---------------- Validasi & kirim ---------------- */
  function setFieldError(fieldEl, hasError) {
    fieldEl.classList.toggle("has-error", hasError);
  }

  function validateForm() {
    let valid = true;

    ["bazarNamaUsaha", "bazarJenisProduk", "bazarPenanggungJawab", "bazarWhatsapp"].forEach(function (id) {
      const input = document.getElementById(id);
      const fieldEl = input.closest(".field");
      const ok = input.value.trim() !== "";
      setFieldError(fieldEl, !ok);
      if (!ok) valid = false;
    });

    const jenisChecked = jenisChoicesEl.querySelector('input[name="bazarJenis"]:checked');
    jenisErrorEl.style.display = jenisChecked ? "none" : "block";
    if (!jenisChecked) valid = false;

    const lokasiKosong = kodeTerpilihSet.size === 0;
    lokasiErrorEl.style.display = (jenisChecked && lokasiKosong) ? "block" : "none";
    if (jenisChecked && lokasiKosong) valid = false;

    const fotoInput = document.getElementById("bazarFileFoto");
    const fotoOk = fotoInput.files && fotoInput.files.length > 0;
    setFieldError(fotoInput.closest(".field"), !fotoOk);
    if (!fotoOk) valid = false;

    const buktiInput = document.getElementById("bazarFileBukti");
    const buktiOk = !!(buktiInput.files && buktiInput.files[0]);
    setFieldError(buktiInput.closest(".field"), !buktiOk);
    if (!buktiOk) valid = false;

    const konfirmasi = document.getElementById("bazarKonfirmasi");
    document.getElementById("bazar-konfirmasi-error").style.display = konfirmasi.checked ? "none" : "block";
    if (!konfirmasi.checked) valid = false;

    return valid;
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (!validateForm()) {
      const firstError = form.querySelector(".has-error, #bazar-jenis-error[style*='block'], #bazar-lokasi-error[style*='block']");
      if (firstError) firstError.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    btnSubmit.disabled = true;
    btnSubmit.textContent = "Mengirim...";

    const fotoList = Array.from(document.getElementById("bazarFileFoto").files || []);
    const fileBukti = document.getElementById("bazarFileBukti").files[0];
    const jenisChecked = jenisChoicesEl.querySelector('input[name="bazarJenis"]:checked');
    const kodeDipilih = Array.from(kodeTerpilihSet);

    Promise.all([
      Promise.all(fotoList.map(function (f, i) { return uploadKeStorageBazar(f, "foto-produk-" + (i + 1)); })),
      uploadKeStorageBazar(fileBukti, "bukti-bayar")
    ])
      .then(function (hasil) {
        return supabaseClient.rpc("submit_bazar", {
          p_nama_usaha: document.getElementById("bazarNamaUsaha").value.trim(),
          p_jenis_produk: document.getElementById("bazarJenisProduk").value.trim(),
          p_nama_penanggung_jawab: document.getElementById("bazarPenanggungJawab").value.trim(),
          p_whatsapp: document.getElementById("bazarWhatsapp").value.trim(),
          p_jenis_stand: jenisChecked ? jenisChecked.value : "",
          p_kode_stand: kodeDipilih,
          p_url_foto_produk: hasil[0],
          p_url_bukti_bayar: hasil[1]
        });
      })
      .then(function (res) {
        if (res.error) throw new Error(res.error.message);
        const data = res.data;
        if (data.success) {
          form.style.display = "none";
          regNumberEl.textContent = data.nomor_pendaftaran || "-";
          resultPanel.classList.add("is-visible");
          resultPanel.scrollIntoView({ behavior: "smooth", block: "start" });
        } else {
          // Salah satu stand yang dipilih baru saja diambil pendaftar lain
          // (lihat gating "for update" di submit_bazar, migrasi 0037) --
          // muat ulang daftar denah supaya status terisi/tersedia langsung
          // sinkron, bukan cuma tampil alert generik.
          alert("Pendaftaran gagal: " + (data.message || "Terjadi kesalahan, coba lagi."));
          btnSubmit.disabled = false;
          btnSubmit.textContent = "Kirim Pendaftaran Bazar";
          muatPengaturanBazar();
        }
      })
      .catch(function (err) {
        console.error(err);
        alert("Gagal mengirim data: " + err.message);
        btnSubmit.disabled = false;
        btnSubmit.textContent = "Kirim Pendaftaran Bazar";
      });
  });

  document.getElementById("btn-daftar-bazar-lagi").addEventListener("click", function () {
    window.gotoRoute("#/daftar-bazar");
  });

  muatPengaturanBazar();
}

window.ViewDaftarBazar = { template: DAFTAR_BAZAR_TEMPLATE, init: initDaftarBazar };
