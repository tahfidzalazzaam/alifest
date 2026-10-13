// View: Form Pendaftaran Bazar ("#/daftar-bazar") -- sejak migrasi 0042,
// formulirnya WIZARD 4 LANGKAH yang digeser ke samping (bukan satu halaman
// panjang lagi seperti sebelumnya):
//   Langkah 1: Identitas Stand   -- nama usaha, jenis produk, logo usaha,
//                                    foto poster promosi, bukti follow IG,
//                                    nama & WhatsApp penanggung jawab.
//   Langkah 2: Jenis Stand       -- pilih SATU jenis (A/B/C).
//   Langkah 3: Penentuan Tempat  -- klik lokasi di denah (boleh lebih dari
//                                    satu); begitu klik "Lanjut" ke Langkah
//                                    4, lokasi yang dipilih DIKUNCI sementara
//                                    (reservasi 15 menit, migrasi 0042) biar
//                                    pendaftar lain tidak bisa ambil stand
//                                    yang sama selagi Langkah 4 diisi.
//   Langkah 4: Bukti Pembayaran  -- unggah bukti transfer, centang
//                                    pernyataan, kirim. Nomor pendaftaran
//                                    yang didapat = kode stand itu sendiri
//                                    (migrasi 0042), bukan "BAZAR-XXX" lagi.
//
// Tetap TERPISAH TOTAL dari halaman pendaftaran lomba ("#/daftar"): tabel,
// fungsi RPC, status buka/tutup, dan kuotanya sendiri-sendiri (lihat migrasi
// 0030, 0037, 0042).
//
// CATATAN PENTING soal "reservasi sementara" (migrasi 0042): itu CUMA
// lapisan UX yang mengurangi peluang bentrok -- perlindungan SEBENARNYA
// (supaya TIDAK PERNAH ada 2 tenant dobel-diterima untuk stand yang sama)
// tetap di `submit_bazar()` lewat row-lock `for update` (migrasi 0037,
// diperbaiki 0041). Jadi kalau pun reservasinya kedaluwarsa (15 menit) atau
// race condition aneh terjadi, submit final tetap aman -- paling jelek
// pendaftar diminta pilih ulang lokasi (lihat penanganan kode_bentrok di
// bawah, pola yang sama seperti migrasi 0040).

const DAFTAR_BAZAR_TEMPLATE = `
<main class="form-page container">
  <div class="form-header">
    <h1>Pendaftaran Stand/Tenant Bazar</h1>
    <p>${EVENT_FULL_NAME} — isi data usaha/stand Anda untuk ikut meramaikan bazar ALIF 5.0. Belum lihat info lengkap Bazar? <a href="#/bazar">Kembali ke halaman Bazar</a>.</p>
  </div>

  <div class="form-shell">
    <div class="notice" id="bazar-info-biaya" style="display:none;"></div>
    <!-- #bazar-info-rekening SENGAJA TIDAK ditaruh di sini (atas halaman,
         sebelum wizard) lagi -- permintaan panitia: info rekening/transfer
         cuma relevan pas Langkah 4 (saat benar-benar akan unggah bukti
         transfer), jadi dipindah ke dalam pane Langkah 4 sendiri (dekat
         kotak unggah Bukti Pembayaran, lihat di bawah) supaya tidak "numpuk"
         di atas tiap kali pindah Langkah 1-3 (sebelumnya elemen ini selalu
         ada di sini, ikut ter-scroll-ke-atas tiap kali perbaruiTampilanLangkah()
         jalan). id elemen TETAP SAMA ("bazar-info-rekening") supaya
         muatPengaturanBazar() di bawah tidak perlu diubah sama sekali --
         cuma lokasinya di HTML yang pindah. -->
    <div class="notice" id="bazar-draft-dipulihkan-hint" style="display:none;background:#eef6ff;border:1px solid #a9c9f5;color:#1d4e89;">
      ℹ️ Draf pendaftaran Anda yang terakhir berhasil dipulihkan. <strong>Catatan:</strong> berkas yang sudah dipilih sebelumnya (logo, poster, screenshot follow IG, bukti bayar) perlu dipilih ulang karena alasan keamanan browser -- isian lainnya (nama usaha, jenis stand, lokasi, dsb) sudah terisi otomatis.
    </div>

    <form id="form-bazar" novalidate>

      <div class="wizard-steps" id="bazar-wizard-steps">
        <div class="wizard-step" data-step="1"><span class="wizard-step__dot">1</span><span class="wizard-step__label">Identitas Stand</span></div>
        <div class="wizard-step" data-step="2"><span class="wizard-step__dot">2</span><span class="wizard-step__label">Jenis Stand</span></div>
        <div class="wizard-step" data-step="3"><span class="wizard-step__dot">3</span><span class="wizard-step__label">Penentuan Tempat</span></div>
        <div class="wizard-step" data-step="4"><span class="wizard-step__dot">4</span><span class="wizard-step__label">Pembayaran</span></div>
      </div>

      <div class="wizard-viewport">
        <div class="wizard-track" id="bazar-wizard-track">

          <!-- ============ Langkah 1: Identitas Stand ============ -->
          <div class="wizard-pane" data-pane="1">
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

              <div class="field-row">
                <div class="field">
                  <label>Logo Usaha</label>
                  <div class="upload-field" id="upload-bazar-logo">
                    <label class="upload-trigger" for="bazarFileLogo">Pilih berkas (foto, maks 12MB)</label>
                    <input type="file" id="bazarFileLogo" name="bazarFileLogo" accept="image/*" />
                    <div class="filename" id="filename-bazar-logo">Belum ada berkas dipilih.</div>
                  </div>
                  <div class="form-error">Logo usaha wajib diunggah.</div>
                </div>
                <div class="field">
                  <label>Foto Poster Promosi</label>
                  <div class="upload-field" id="upload-bazar-poster">
                    <label class="upload-trigger" for="bazarFilePoster">Pilih berkas (foto, maks 12MB)</label>
                    <input type="file" id="bazarFilePoster" name="bazarFilePoster" accept="image/*" />
                    <div class="filename" id="filename-bazar-poster">Belum ada berkas dipilih.</div>
                  </div>
                  <div class="form-error">Foto poster promosi wajib diunggah.</div>
                </div>
              </div>

              <div class="field">
                <label>Screenshot Bukti Follow Instagram</label>
                <p class="hint" style="margin-top:-4px;">Follow dulu 2 akun Instagram resmi: <a href="https://instagram.com/al.azzaam.id" target="_blank" rel="noopener">@al.azzaam.id</a> dan <a href="https://instagram.com/alifest.26" target="_blank" rel="noopener">@alifest.26</a>, lalu screenshot halaman profil MASING-MASING akun (terlihat tombol "Following"), satu screenshot per kotak di bawah ini.</p>
                <div class="field-row">
                  <div class="field" style="margin-bottom:0;">
                    <label style="font-weight:500;font-size:0.85rem;">Screenshot follow @al.azzaam.id</label>
                    <div class="upload-field" id="upload-bazar-ig1">
                      <label class="upload-trigger" for="bazarFileIg1">Pilih berkas (foto/PDF, maks 12MB)</label>
                      <input type="file" id="bazarFileIg1" name="bazarFileIg1" accept="image/*,.pdf" />
                      <div class="filename" id="filename-bazar-ig1">Belum ada berkas dipilih.</div>
                    </div>
                    <div class="form-error">Screenshot follow @al.azzaam.id wajib diunggah.</div>
                  </div>
                  <div class="field" style="margin-bottom:0;">
                    <label style="font-weight:500;font-size:0.85rem;">Screenshot follow @alifest.26</label>
                    <div class="upload-field" id="upload-bazar-ig2">
                      <label class="upload-trigger" for="bazarFileIg2">Pilih berkas (foto/PDF, maks 12MB)</label>
                      <input type="file" id="bazarFileIg2" name="bazarFileIg2" accept="image/*,.pdf" />
                      <div class="filename" id="filename-bazar-ig2">Belum ada berkas dipilih.</div>
                    </div>
                    <div class="form-error">Screenshot follow @alifest.26 wajib diunggah.</div>
                  </div>
                </div>
              </div>
            </fieldset>

            <fieldset>
              <legend>Penyewa</legend>
              <div class="field-row">
                <div class="field">
                  <!-- Label tampilan "Nama Penyewa" (permintaan user) -- id/name
                       elemen & nama kolom/parameter RPC di database SENGAJA
                       TETAP "bazarPenanggungJawab"/"nama_penanggung_jawab"
                       (tidak diubah) supaya tidak perlu migrasi, murni ganti
                       teks yang tampil ke pendaftar. -->
                  <label for="bazarPenanggungJawab">Nama Penyewa</label>
                  <input type="text" id="bazarPenanggungJawab" name="bazarPenanggungJawab" />
                  <div class="form-error">Nama penyewa wajib diisi.</div>
                </div>
                <div class="field">
                  <label for="bazarWhatsapp">No. WhatsApp Aktif</label>
                  <input type="tel" id="bazarWhatsapp" name="bazarWhatsapp" placeholder="08xxxxxxxxxx" />
                  <div class="form-error">Nomor WhatsApp wajib diisi.</div>
                </div>
              </div>
            </fieldset>
          </div>

          <!-- ============ Langkah 2: Jenis Stand ============ -->
          <div class="wizard-pane" data-pane="2">
            <fieldset>
              <legend>Pilih Jenis &amp; Jumlah Stand</legend>
              <div class="lomba-choices" id="bazar-jenis-choices"></div>
              <div class="form-error" id="bazar-jenis-error" style="margin-top:10px;">Pilih salah satu jenis stand.</div>

              <!-- Penentuan jumlah stand dipindah ke sini (bukan di Langkah 3
                   lagi) -- begitu jenis dipilih, pendaftar sekalian menentukan
                   MAU PESAN BERAPA stand jenis itu. Jumlah ini yang nanti
                   membatasi persis berapa kotak yang boleh diklik di denah
                   Langkah 3 (lihat renderJumlahSelector()/validasiLangkah3Lokal()).
                   Kontrolnya berupa stepper tombol -/+ ala GoFood/GrabFood
                   (permintaan panitia) -- BUKAN dropdown <select> lagi, supaya
                   lebih enak dipakai di HP (sentuh tombol besar, bukan buka
                   dropdown panjang). -->
              <div class="field" id="bazar-jumlah-wrap" style="display:none;margin-top:18px;">
                <label>Jumlah Stand yang Dipesan</label>
                <div class="qty-stepper" id="bazar-jumlah-stepper">
                  <button type="button" class="qty-stepper__btn" id="bazar-jumlah-kurang" aria-label="Kurangi jumlah stand">−</button>
                  <span class="qty-stepper__value" id="bazar-jumlah-angka">1</span>
                  <button type="button" class="qty-stepper__btn" id="bazar-jumlah-tambah" aria-label="Tambah jumlah stand">+</button>
                </div>
                <p class="hint" id="bazar-jumlah-maks-hint" style="margin-top:6px;"></p>
              </div>
            </fieldset>
          </div>

          <!-- ============ Langkah 3: Penentuan Tempat ============ -->
          <div class="wizard-pane" data-pane="3">
            <fieldset>
              <legend>Pilih Lokasi Stand</legend>
              <!-- Teks ini diisi ulang secara dinamis oleh renderLokasiPicker()
                   sesuai jumlah yang dipesan di Langkah 2 -- teks di bawah ini
                   cuma placeholder sebelum JS jalan. -->
              <p class="hint" id="bazar-lokasi-hint" style="margin-top:-10px;">Klik langsung kotaknya di denah di bawah. Begitu Anda klik "Lanjut", lokasi yang dipilih dikunci sementara (15 menit) supaya tidak diambil pendaftar lain selagi Anda mengisi Langkah 4.</p>
              <div id="bazar-denah-legenda"></div>
              <!-- #bazar-denah-outer SENGAJA overflow:hidden & #bazar-denah-inner
                   SENGAJA position:absolute (BUKAN "position:relative" seperti
                   versi sebelum wizard) -- bug "nabrak" yang ditemukan sambil
                   membangun wizard ini: kanvas virtualnya diberi lebar tetap
                   760px lewat JS (DENAH_PUBLIK_CANVAS_W) SEBELUM di-scale-kecil-
                   kan ke lebar kontainer sebenarnya (lihat terapkanSkalaDenahPublik()
                   di bawah). Kalau #bazar-denah-inner masih "position:relative"
                   (IKUT ALUR NORMAL dokumen), lebar 760px itu MEMBESARKAN kotak
                   induknya sendiri (karena elemen in-flow yang lebih lebar dari
                   kontainernya tetap mendorong ukuran kontainer tsb pada beberapa
                   konteks layout, termasuk flex item ".wizard-pane" di sini) --
                   akibatnya seluruh Langkah 3 (dan apa pun yang digeser
                   bersebelahan dengannya di ".wizard-track") ikut melebar 760px,
                   lalu BOCOR/TUMPANG TINDIH ke Langkah 4 di sebelahnya (tombol
                   & checkbox Langkah 4 jadi tidak bisa diklik -- ketutup kanvas
                   denah Langkah 3 yang bocor). Dengan "position:absolute", kanvas
                   dikeluarkan dari alur dokumen (tidak lagi memengaruhi ukuran
                   induknya sama sekali), dan "overflow:hidden" pada elemen
                   pembungkusnya memastikan sisa bocoran visual apa pun (kalau
                   pun ada) dipotong rapi, bukan menembus ke luar. -->
              <div id="bazar-denah-pad" style="padding:18px 14px 14px 14px;">
                <div id="bazar-denah-outer" style="width:100%;max-width:900px;overflow:hidden;position:relative;border:2px dashed #b9d9c2;border-radius:16px;background:#eef7ec;margin:0 auto;">
                  <div id="bazar-denah-inner" style="position:absolute;top:0;left:0;transform-origin:top left;"></div>
                </div>
              </div>
              <p class="hint" id="bazar-lokasi-total" style="margin-top:8px;"></p>
              <p class="hint" id="bazar-lokasi-batas-pesan" style="display:none;margin-top:4px;color:#92650a;font-weight:600;">Jumlah stand yang dipilih sudah sesuai pesanan Anda -- batalkan salah satu pilihan dulu (klik lagi kotaknya) kalau mau mengganti lokasi.</p>
              <div class="form-error" id="bazar-lokasi-error" style="margin-top:10px;">Pilih minimal satu lokasi stand.</div>
              <div class="form-error" id="bazar-reservasi-error" style="margin-top:10px;"></div>
            </fieldset>
          </div>

          <!-- ============ Langkah 4: Bukti Pembayaran ============ -->
          <div class="wizard-pane" data-pane="4">
            <fieldset>
              <legend>Bukti Pembayaran</legend>
              <div class="wizard-ringkasan" id="bazar-ringkasan-akhir"></div>

              <!-- Info rekening/transfer (dipindah ke sini dari atas halaman --
                   lihat catatan panjang dekat #bazar-info-biaya di atas) --
                   ditaruh PERSIS sebelum kotak unggah Bukti Pembayaran,
                   supaya pendaftar langsung lihat ke rekening mana harus
                   transfer TEPAT pada saat akan mengunggah buktinya, tanpa
                   perlu scroll balik ke atas. -->
              <div class="notice" id="bazar-info-rekening" style="display:none;margin-bottom:16px;"></div>

              <div class="field" id="bazar-bukti-bayar-wrap">
                <label id="bazar-bukti-bayar-label">Bukti Pembayaran Sewa Stand</label>
                <p class="hint" style="margin-top:-4px;" id="bazar-bukti-bayar-hint">Transfer biaya sewa stand sesuai jenis & jumlah lokasi yang dipilih, lalu unggah screenshot/foto bukti transfernya di sini.</p>
                <div class="upload-field" id="upload-bazar-bukti">
                  <label class="upload-trigger" for="bazarFileBukti">Pilih berkas (foto/PDF, maks 12MB)</label>
                  <input type="file" id="bazarFileBukti" name="bazarFileBukti" accept="image/*,.pdf" />
                  <div class="filename" id="filename-bazar-bukti">Belum ada berkas dipilih.</div>
                </div>
                <div class="form-error">Bukti pembayaran wajib diunggah.</div>
              </div>

              <label class="checkbox-field">
                <input type="checkbox" id="bazarKonfirmasi" name="bazarKonfirmasi" required />
                <span>Saya menyatakan data yang diisi sudah benar dan bersedia mematuhi ketentuan bazar ALIF 5.0.</span>
              </label>
              <div class="form-error" id="bazar-konfirmasi-error">Centang pernyataan ini sebelum mengirim.</div>

              <!-- Peringatan sinyal lemah (BARU) -- lihat pasangPemantauSinyalBazar()
                   di bawah. Tersembunyi secara default, HANYA dimunculkan kalau
                   browser mendukung Network Information API (navigator.connection,
                   umumnya Chrome Android) DAN sinyal/koneksinya terdeteksi lemah
                   -- supaya pendaftar tahu LEBIH AWAL (sebelum menekan "Kirim")
                   kalau unggahan berisiko lambat/gagal, bukan baru tahu setelah
                   gagal berkali-kali. -->
              <div class="hint" id="bazar-sinyal-lemah-hint" style="display:none;margin-top:14px;padding:10px 14px;border-radius:10px;background:#fff6e0;border:1px solid #f0cf7a;color:#7a5b00;">
                ⚠️ Sinyal/koneksi internet Anda saat ini terdeteksi lemah. Mengunggah berkas mungkin lambat atau gagal. Disarankan pindah ke tempat dengan sinyal/WiFi lebih kuat sebelum menekan "Kirim Pendaftaran Bazar".
              </div>
            </fieldset>
          </div>

        </div>
      </div>

      <div class="wizard-nav">
        <button type="button" class="btn btn--ghost" id="btn-wizard-kembali" style="display:none;">← Kembali</button>
        <div class="wizard-nav__spacer"></div>
        <button type="button" class="btn btn--primary" id="btn-wizard-lanjut">Lanjut →</button>
        <button type="submit" class="btn btn--primary" id="btn-submit-bazar" style="display:none;">Kirim Pendaftaran Bazar</button>
      </div>
    </form>

    <div class="result-panel" id="result-panel-bazar">
      <div class="result-panel__icon">✅</div>
      <h2>Pendaftaran stand berhasil dikirim</h2>
      <p>Simpan nomor pendaftaran berikut sebagai bukti (nomor ini sama dengan kode stand Anda):</p>
      <div class="reg-number" id="reg-number-bazar">—</div>
      <p>Panitia bazar akan memverifikasi data & pembayaran, lalu menghubungi lewat WhatsApp.</p>
      <button type="button" class="btn btn--ghost" id="btn-daftar-bazar-lagi">Daftar Stand Lain</button>
    </div>
  </div>
</main>
`;

// Migrasi 0043: "Tutup Total Bazar" (bazar_settings.tutup_total, migrasi
// 0035) DIHAPUS dari aplikasi -- lihat view-bazar.js untuk catatan yang
// sama. Form ini ("/daftar-bazar") sekarang satu-satunya yang bisa dikunci,
// lewat `bazar_settings.pendaftaran_dibuka` (tombol satu-klik di
// "/adminbazar"), DAN sekarang bisa dilewati lewat "kode uji coba" yang
// SAMA PERSIS dengan milik Lomba (migrasi 0020/0043, lihat `router.js`:
// `KODE_UJI_COBA_PANITIA`, `window.ujiCobaAktif()`, sessionStorage key
// "alif_uji_coba_pin") -- satu PIN yang sama membuka mode uji coba untuk
// Lomba MAUPUN Bazar sekaligus, tidak perlu 2 PIN terpisah.

// Urutan tampil jenis stand -- tetap A, B, C apa pun urutan key di jsonb.
const URUTAN_JENIS_STAND = ["A", "B", "C"];

// -------- Denah visual READ-ONLY untuk memilih lokasi stand (Langkah 3) --
// Konstanta kanvas & warna jenis SENGAJA diberi nama sendiri yang BERBEDA
// dari `DENAH_CANVAS_W`/`DENAH_CANVAS_H`/`WARNA_JENIS_DENAH` milik
// `view-adminbazar.js` dan `DENAH_INFO_CANVAS_W`/dst milik `view-bazar.js`
// -- ketiga file itu sama-sama dimuat sebagai <script> klasik berbagi satu
// scope global, jadi nama yang identik akan tabrakan `SyntaxError:
// Identifier '...' has already been declared` (lihat catatan panjang soal
// bug ini di atas).
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

// Token sesi acak -- dibuat BARU setiap kali form ini dibuka (bukan
// identitas pendaftar apa pun, murni label sementara di browser dia sendiri)
// -- dipakai RPC `bazar_reservasi_stand`/`bazar_lepas_reservasi` (migrasi
// 0042) supaya server tahu reservasi-reservasi mana yang "milik" sesi
// pengisian form yang sama, tanpa perlu login/akun.
function buatSesiTokenBazar() {
  try {
    if (window.crypto && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  } catch (e) { /* abaikan, pakai fallback di bawah */ }
  return "sesi-" + Date.now() + "-" + Math.random().toString(36).slice(2);
}

function initDaftarBazar() {
  // Dideklarasikan PALING ATAS (sebelum apa pun lain, termasuk sebelum
  // sesiToken dibuat di bawah) -- bacaDraftBazarTersimpan()/
  // simpanDraftBazar() dipakai SEGERA setelah ini (lihat deklarasi
  // _draftBazarAwal beberapa baris di bawah), dan keduanya butuh konstanta
  // ini. HARUS berupa `const` di titik PALING AWAL seperti ini (bukan di
  // dekat definisi fungsinya, lebih jauh ke bawah) -- kalau tidak, memanggil
  // bacaDraftBazarTersimpan() sebelum baris deklarasi `const` ini sempat
  // dieksekusi akan melempar ReferenceError ("cannot access before
  // initialization", lihat aturan temporal dead zone `const`/`let` di JS),
  // yang lalu DIAM-DIAM ditelan oleh try/catch di bacaDraftBazarTersimpan()
  // -- bug nyata yang sempat ditemukan lewat pengetesan Playwright saat
  // membangun fitur ini (draf selalu kembali null walau sessionStorage
  // sudah terisi benar).
  const BAZAR_DRAFT_KEY = "alif_draft_bazar_v1";
  const BAZAR_DRAFT_MAKS_UMUR_MS = 2 * 60 * 60 * 1000; // 2 jam -- draf lebih tua dari ini dianggap kedaluwarsa & diabaikan

  const form = document.getElementById("form-bazar");
  const jenisChoicesEl = document.getElementById("bazar-jenis-choices");
  const jenisErrorEl = document.getElementById("bazar-jenis-error");
  const legendaEl = document.getElementById("bazar-denah-legenda");
  const lokasiTotalEl = document.getElementById("bazar-lokasi-total");
  const lokasiErrorEl = document.getElementById("bazar-lokasi-error");
  const reservasiErrorEl = document.getElementById("bazar-reservasi-error");
  const btnSubmit = document.getElementById("btn-submit-bazar");
  const btnLanjut = document.getElementById("btn-wizard-lanjut");
  const btnKembali = document.getElementById("btn-wizard-kembali");
  const trackEl = document.getElementById("bazar-wizard-track");
  const stepsEl = document.getElementById("bazar-wizard-steps");
  const resultPanel = document.getElementById("result-panel-bazar");
  const regNumberEl = document.getElementById("reg-number-bazar");
  const ringkasanAkhirEl = document.getElementById("bazar-ringkasan-akhir");

  let jenisStandInfo = {};
  let denahBackgroundUrl = null;
  let standList = []; // semua baris bazar_stand: {id, jenis, area, nomor, kode, tenant_id, milik_panitia, direservasi_oleh, direservasi_sampai, pos_x, pos_y, lebar, tinggi, rotasi}
  let elemenList = []; // label konteks denah (Masjid/Sekretariat PSB/Asrama dkk) -- murni visual, read-only di sini
  let jenisTerpilih = null;
  // Jumlah stand yang dipesan -- ditentukan di Langkah 2 bareng jenisnya,
  // dipakai Langkah 3 sebagai BATAS PERSIS berapa kotak yang boleh diklik
  // di denah (lihat renderJumlahSelector(), buatKotakLokasiPublik(), dan
  // validasiLangkah3Lokal()). Direset ke 1 setiap kali jenis stand berganti.
  let jumlahDipesan = 1;
  let pendaftaranDibuka = true;
  let ujiCobaAktifBazar = false; // true kalau PIN uji coba (sama dengan Lomba) sedang aktif di sessionStorage
  // Kode stand yang DIPILIH pengunjung lewat klik di denah.
  let kodeTerpilihSet = new Set();
  // Draf tersimpan (kalau ada) dibaca SEKARANG, SEBELUM sesiToken dibuat --
  // supaya kalau pendaftar me-refresh halaman ini di tengah pengisian,
  // sesiToken yang dipakai TETAP SAMA dengan sebelum refresh (bukan token
  // acak baru), sehingga reservasi stand yang sempat terkunci atas nama
  // token lama (lihat bazar_reservasi_stand, migrasi 0042) masih bisa
  // dikenali/diperbarui server sebagai "milik sesi yang sama" kalau belum
  // kedaluwarsa -- lihat pulihkanDraftLanjutanBazar() & simpanDraftBazar()
  // di bawah untuk mekanisme penyimpanan/pemulihannya secara lengkap.
  const _draftBazarAwal = bacaDraftBazarTersimpan();
  const sesiToken = (_draftBazarAwal && _draftBazarAwal.sesiToken) ? _draftBazarAwal.sesiToken : buatSesiTokenBazar();
  let currentStep = 1;
  const TOTAL_STEP = 4;
  // Set true begitu reservasi Langkah 3 -> 4 berhasil, supaya kalau
  // pendaftar mundur lagi ke Langkah 3 lalu maju TANPA mengubah apa pun,
  // tidak perlu memanggil RPC reservasi ulang (biarkan reservasi lama yang
  // masih berlaku dipakai apa adanya) -- cuma dipanggil ulang kalau
  // pilihannya BERUBAH sejak reservasi terakhir.
  let reservasiTerakhirUntuk = null; // string gabungan kode terpilih saat reservasi terakhir berhasil

  function escapeHTMLDaftarBazar(teks) {
    const div = document.createElement("div");
    div.textContent = String(teks == null ? "" : teks);
    return div.innerHTML;
  }

  /* ---------------- Draf pengisian (sessionStorage) -- jaga isian tidak hilang kalau halaman di-refresh ----------------
     Permintaan panitia: "saat mencoba ulang setelah merefresh malah mengisi
     dari awal lagi" -- sebelum ini, SEMUA state wizard (currentStep,
     jenisTerpilih, kodeTerpilihSet, dan tiap isian <input>) murni variabel
     JS di memori, hilang total begitu halaman di-refresh/dimuat ulang (mis.
     tidak sengaja refresh, atau sengaja refresh karena mengira itu akan
     "membantu" setelah gagal unggah). Sekarang disalin ke `sessionStorage`
     (bertahan lewat refresh TAPI hilang begitu tab/jendela ditutup -- tidak
     dimaksudkan jadi draf permanen) setiap kali ada perubahan berarti, dan
     dipulihkan begitu form ini dibuka lagi.

     SATU KETERBATASAN YANG TIDAK BISA DIHINDARI (pembatasan keamanan
     browser, bukan bug): isian `<input type="file">` (logo, poster,
     screenshot follow IG, bukti bayar) TIDAK PERNAH bisa dipulihkan lewat
     JavaScript apa pun -- begitu halaman dimuat ulang, kelima berkas itu
     harus dipilih ulang oleh pendaftar. Makanya begitu draf berhasil
     dipulihkan, pendaftar diberi tahu lewat #bazar-draft-dipulihkan-hint
     (lihat pulihkanDraftLanjutanBazar() di bawah) supaya tidak bingung
     kenapa kotak unggahan masih kosong walau isian teks lain sudah terisi.

     Soal reservasi lokasi stand (migrasi 0042): draf TIDAK langsung
     memulihkan sampai Langkah 4 -- paling jauh balik ke Langkah 3 dengan
     lokasi yang sama sudah tercentang, supaya begitu pendaftar klik
     "Lanjut" lagi, lanjutDariLangkah3() memanggil ulang RPC
     bazar_reservasi_stand dan reservasinya tervalidasi/diperbarui FRESH ke
     server -- bukan dipercaya mentah-mentah dari draf lokal yang bisa saja
     sudah kedaluwarsa (lewat 15 menit) sejak sebelum refresh terjadi. */

  function bacaDraftBazarTersimpan() {
    try {
      const mentah = sessionStorage.getItem(BAZAR_DRAFT_KEY);
      if (!mentah) return null;
      const draft = JSON.parse(mentah);
      if (!draft || typeof draft !== "object") return null;
      if (!draft.disimpanPada || (Date.now() - draft.disimpanPada) > BAZAR_DRAFT_MAKS_UMUR_MS) {
        sessionStorage.removeItem(BAZAR_DRAFT_KEY);
        return null;
      }
      return draft;
    } catch (e) {
      return null; // mis. sessionStorage diblokir/tidak tersedia (mode privat dkk) -- murni best-effort, form tetap jalan normal tanpa draf
    }
  }

  function hapusDraftBazar() {
    try { sessionStorage.removeItem(BAZAR_DRAFT_KEY); } catch (e) { /* abaikan */ }
  }

  // Dipanggil dari BANYAK titik (lihat di bawah) setiap kali ada perubahan
  // berarti pada isian -- murah & sederhana (menyalin isian saat ini apa
  // adanya), jadi aman dipanggil sesering mungkin tanpa perlu debounce.
  function simpanDraftBazar() {
    try {
      const draft = {
        disimpanPada: Date.now(),
        sesiToken: sesiToken,
        currentStep: currentStep,
        jenisTerpilih: jenisTerpilih,
        jumlahDipesan: jumlahDipesan,
        kodeTerpilih: Array.from(kodeTerpilihSet),
        teks: {
          bazarNamaUsaha: (document.getElementById("bazarNamaUsaha") || {}).value || "",
          bazarJenisProduk: (document.getElementById("bazarJenisProduk") || {}).value || "",
          bazarPenanggungJawab: (document.getElementById("bazarPenanggungJawab") || {}).value || "",
          bazarWhatsapp: (document.getElementById("bazarWhatsapp") || {}).value || ""
        },
        konfirmasi: !!(document.getElementById("bazarKonfirmasi") && document.getElementById("bazarKonfirmasi").checked)
      };
      sessionStorage.setItem(BAZAR_DRAFT_KEY, JSON.stringify(draft));
    } catch (e) { /* abaikan -- murni best-effort, jangan sampai mengganggu pengisian formulir */ }
  }

  // Bagian draf yang TIDAK butuh data server (standList/jenisStandInfo
  // belum dimuat di titik ini) -- isian teks & centang konfirmasi langsung
  // dipulihkan sesaat setelah form dirender, tanpa menunggu
  // muatPengaturanBazar(). Bagian yang BUTUH data server (jenis/jumlah/
  // lokasi/langkah) dipulihkan belakangan oleh pulihkanDraftLanjutanBazar().
  if (_draftBazarAwal) {
    const t = _draftBazarAwal.teks || {};
    ["bazarNamaUsaha", "bazarJenisProduk", "bazarPenanggungJawab", "bazarWhatsapp"].forEach(function (id) {
      const el = document.getElementById(id);
      if (el && t[id]) el.value = t[id];
    });
    const konfirmasiEl = document.getElementById("bazarKonfirmasi");
    if (konfirmasiEl) konfirmasiEl.checked = !!_draftBazarAwal.konfirmasi;
  }

  // Simpan draf setiap kali isian teks/konfirmasi berubah -- listener
  // dipasang SEKALI di sini (bukan di dalam fungsi render yang bisa
  // dipanggil berulang) karena elemen-elemen ini tidak pernah dibuat ulang
  // lewat innerHTML sepanjang hidup form ini.
  ["bazarNamaUsaha", "bazarJenisProduk", "bazarPenanggungJawab", "bazarWhatsapp"].forEach(function (id) {
    const el = document.getElementById(id);
    if (el) el.addEventListener("input", simpanDraftBazar);
  });
  const bazarKonfirmasiEl = document.getElementById("bazarKonfirmasi");
  if (bazarKonfirmasiEl) bazarKonfirmasiEl.addEventListener("change", simpanDraftBazar);

  /* ---------------- Peringatan sinyal/koneksi lemah (Langkah 4) ----------------
     Memakai Network Information API (`navigator.connection`, didukung Chrome
     Android & sebagian besar browser Android lain -- TIDAK didukung Safari/
     iOS, jadi fungsi ini SELALU dibungkus pengecekan `"connection" in
     navigator` dan diam saja/tidak melakukan apa pun di browser yang tidak
     mendukungnya, bukan dianggap "sinyal bagus" begitu saja). Dipanggil
     setiap kali tampilan langkah diperbarui (lihat perbaruiTampilanLangkah()
     di bawah) DAN setiap kali koneksi berubah (event "change" pada
     `navigator.connection`, dipasang SEKALI saat form ini pertama dibuka,
     lihat dekat akhir fungsi init ini) -- supaya peringatannya ikut
     muncul/hilang otomatis kalau pendaftar berpindah dari WiFi lemah ke
     sinyal HP yang lebih kuat (atau sebaliknya) SELAGI mengisi formulir,
     tanpa perlu reload halaman. Ini murni INFORMASI (tidak memblokir tombol
     "Kirim") -- pendaftar tetap boleh mencoba kirim kapan saja, percobaan
     ulang otomatis di uploadKeStorageBazar() tetap jalan seperti biasa. */
  function sinyalTerdeteksiLemahBazar() {
    if (!("connection" in navigator) || !navigator.connection) return false;
    const c = navigator.connection;
    const tipeLemah = ["slow-2g", "2g", "3g"].indexOf(c.effectiveType) !== -1;
    const downlinkLemah = typeof c.downlink === "number" && c.downlink > 0 && c.downlink < 0.6; // Mbps
    return tipeLemah || downlinkLemah;
  }

  function perbaruiPeringatanSinyalBazar() {
    const hintEl = document.getElementById("bazar-sinyal-lemah-hint");
    if (!hintEl) return;
    hintEl.style.display = (currentStep === 4 && sinyalTerdeteksiLemahBazar()) ? "block" : "none";
  }

  /* ---------------- Mekanisme wizard (geser antar langkah) ---------------- */
  function perbaruiTampilanLangkah() {
    trackEl.style.transform = "translateX(-" + ((currentStep - 1) * 100) + "%)";
    stepsEl.querySelectorAll(".wizard-step").forEach(function (el) {
      const n = parseInt(el.getAttribute("data-step"), 10);
      el.classList.toggle("is-active", n === currentStep);
      el.classList.toggle("is-done", n < currentStep);
    });
    btnKembali.style.display = currentStep === 1 ? "none" : "inline-block";
    btnLanjut.style.display = currentStep === TOTAL_STEP ? "none" : "inline-block";
    btnSubmit.style.display = currentStep === TOTAL_STEP ? "inline-block" : "none";
    perbaruiPeringatanSinyalBazar();
    document.querySelector(".form-shell").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // Dipasang SEKALI saat form ini pertama dibuka -- lihat komentar di atas
  // sinyalTerdeteksiLemahBazar() untuk alasannya. `{ passive: true }` karena
  // listener ini cuma membaca & memperbarui tampilan, tidak pernah
  // memanggil preventDefault().
  if ("connection" in navigator && navigator.connection && typeof navigator.connection.addEventListener === "function") {
    navigator.connection.addEventListener("change", perbaruiPeringatanSinyalBazar, { passive: true });
  }

  /* ---------------- Pilihan Jenis Stand (A/B/C, dari bazar_settings.jenis_stand_info) ---------------- */
  function renderJenisChoices() {
    jenisChoicesEl.innerHTML = URUTAN_JENIS_STAND.filter(function (j) { return jenisStandInfo[j]; }).map(function (j) {
      const info = jenisStandInfo[j];
      // Stand "milik panitia" (migrasi 0049) dikeluarkan dari hitungan "dari
      // N stand" di sini -- bukan bagian pool pendaftaran publik, tidak
      // boleh ikut membuat jenis ini tampak lebih penuh dari yang
      // sebenarnya tersedia untuk didaftar.
      const standJenisIni = standList.filter(function (s) { return s.jenis === j && !s.milik_panitia; });
      const terpakai = standJenisIni.filter(function (s) { return !!s.tenant_id; }).length;
      const penuh = standJenisIni.length > 0 && terpakai === standJenisIni.length;
      return (
        '<div class="lomba-choice' + (penuh ? " is-disabled" : "") + '">' +
          '<label>' +
            '<input type="radio" name="bazarJenis" value="' + j + '"' + (penuh ? " disabled" : "") + (jenisTerpilih === j ? " checked" : "") + ' />' +
            '<span class="lomba-choice__icon">🏪</span>' +
            '<span class="lomba-choice__text"><strong>' + escapeHTMLDaftarBazar(info.nama || ("Jenis " + j)) + '</strong>' +
              '<br/>' + escapeHTMLDaftarBazar(info.ukuran || "-") + ' · ' + formatRupiahDaftarBazar(info.harga) +
              '<br/>' + (penuh ? '<span style="color:#b42318;">Penuh, tidak ada stand tersisa</span>' : ('Terpakai ' + terpakai + ' dari ' + standJenisIni.length + ' stand')) +
            '</span>' +
          '</label>' +
        '</div>'
      );
    }).join("");

    jenisChoicesEl.querySelectorAll('input[name="bazarJenis"]').forEach(function (radio) {
      radio.addEventListener("change", function () {
        if (jenisTerpilih !== radio.value) {
          jenisTerpilih = radio.value;
          jumlahDipesan = 1;
          kodeTerpilihSet = new Set();
          reservasiTerakhirUntuk = null;
          renderJumlahSelector();
          simpanDraftBazar();
        }
      });
    });

    renderJumlahSelector();
  }

  /* ---------------- Jumlah stand yang dipesan (Langkah 2, bareng jenis) ----------------
     Stepper tombol -/+ ala GoFood/GrabFood (bukan dropdown <select> lagi).
     jumlahMaksStepperBazar menyimpan batas atas yang berlaku SAAT INI (jenis
     stand terakhir dipilih) -- dihitung ulang tiap kali renderJumlahSelector()
     jalan (dipicu saat jenis stand berganti), lalu dipakai tombol +/- untuk
     tahu kapan harus berhenti/di-disable, tanpa perlu menghitung ulang
     standList tiap kali tombolnya diklik. */
  let jumlahMaksStepperBazar = 1;

  function renderJumlahSelector() {
    const wrap = document.getElementById("bazar-jumlah-wrap");
    if (!wrap) return;

    if (!jenisTerpilih) {
      wrap.style.display = "none";
      return;
    }

    // Batas atas stepper = jumlah stand jenis ini yang masih KOSONG
    // (tenant_id null) -- sama basisnya dengan hitungan "terpakai" di kartu
    // jenis, bukan ikut memperhitungkan reservasi sementara orang lain
    // (itu soal lain, dicek ulang di Langkah 3 & saat submit_bazar()).
    // Dibatasi maksimal 20 per pesanan supaya tetap wajar.
    const tersedia = standList.filter(function (s) { return s.jenis === jenisTerpilih && !s.tenant_id && !s.milik_panitia; }).length;
    jumlahMaksStepperBazar = Math.max(1, Math.min(tersedia, 20));
    if (jumlahDipesan > jumlahMaksStepperBazar) jumlahDipesan = jumlahMaksStepperBazar;

    perbaruiTampilanStepperJumlahBazar();
    wrap.style.display = "block";
  }

  // Menggambar ulang angka & status aktif/nonaktif kedua tombol stepper --
  // dipanggil baik dari renderJumlahSelector() (saat jenis berganti) maupun
  // dari klik tombol -/+ itu sendiri di bawah.
  function perbaruiTampilanStepperJumlahBazar() {
    const angkaEl = document.getElementById("bazar-jumlah-angka");
    const btnKurang = document.getElementById("bazar-jumlah-kurang");
    const btnTambah = document.getElementById("bazar-jumlah-tambah");
    const maksHintEl = document.getElementById("bazar-jumlah-maks-hint");
    if (!angkaEl || !btnKurang || !btnTambah) return;
    angkaEl.textContent = String(jumlahDipesan);
    btnKurang.disabled = jumlahDipesan <= 1;
    btnTambah.disabled = jumlahDipesan >= jumlahMaksStepperBazar;
    if (maksHintEl) {
      maksHintEl.textContent = "Maksimal " + jumlahMaksStepperBazar + " stand tersedia untuk jenis ini.";
    }
  }

  // Listener dipasang SEKALI di sini (elemen tombolnya sendiri tidak pernah
  // dibuat ulang lewat innerHTML seperti dropdown lama, jadi aman dipasang
  // sekali saja di luar renderJumlahSelector()).
  document.getElementById("bazar-jumlah-kurang").addEventListener("click", function () {
    if (jumlahDipesan <= 1) return;
    jumlahDipesan -= 1;
    // Ganti jumlah pesanan membatalkan pilihan lokasi lama (kalau ada) --
    // reservasi yang sempat terkunci (kalau pernah maju ke Langkah 3->4 lalu
    // mundur ke sini) sudah dilepas lewat listener "Kembali" di bawah.
    kodeTerpilihSet = new Set();
    reservasiTerakhirUntuk = null;
    perbaruiTampilanStepperJumlahBazar();
    simpanDraftBazar();
  });
  document.getElementById("bazar-jumlah-tambah").addEventListener("click", function () {
    if (jumlahDipesan >= jumlahMaksStepperBazar) return;
    jumlahDipesan += 1;
    kodeTerpilihSet = new Set();
    reservasiTerakhirUntuk = null;
    perbaruiTampilanStepperJumlahBazar();
    simpanDraftBazar();
  });

  /* ---------------- Pilihan Lokasi Stand -- klik langsung di denah visual (Langkah 3) ---------------- */
  function labelRingkasKodeBazarPublik(kode) {
    const bagian = String(kode || "").split("-");
    if (bagian.length >= 3) {
      const nomor = parseInt(bagian[bagian.length - 1], 10);
      return bagian.slice(1, -1).join("-") + "-" + (isNaN(nomor) ? bagian[bagian.length - 1] : nomor);
    }
    if (bagian.length === 2) {
      const nomor = parseInt(bagian[1], 10);
      return "DM-" + (isNaN(nomor) ? bagian[1] : nomor);
    }
    return kode;
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

    if (opsi.direservasiOrangLain) {
      el.style.background = "#fff3d6";
      el.style.color = "#92650a";
      el.style.cursor = "not-allowed";
      el.title = opsi.kode + " -- sedang dipegang sementara oleh pendaftar lain (reservasi 15 menit), coba lagi sebentar.";
      return el;
    }

    if (!opsi.selectable) {
      el.style.background = warnaDasar;
      el.style.color = "#ffffff";
      el.style.opacity = "0.28";
      el.style.cursor = "default";
      el.title = opsi.kode + " (Jenis " + opsi.jenis + " -- pilih Jenis " + opsi.jenis + " dulu di Langkah 2 untuk memilih lokasi ini).";
      return el;
    }

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
    // Disimpan di elemennya sendiri supaya bisa dipanggil dari LUAR (lewat
    // segarkanSemuaGayaPilihan()) saat seleksi lebih dari satu kotak berubah
    // SEKALIGUS -- mis. mode "pilih 1" yang menukar kotak terpilih lama ke
    // yang baru (lihat klik handler di bawah), closure milik kotak LAMA itu
    // sendiri yang harus dipanggil supaya outline-nya ikut hilang.
    el._segarkanGayaPilihan = terapkanGayaTerpilih;

    el.addEventListener("click", function () {
      if (kodeTerpilihSet.has(opsi.kode)) {
        // Batalkan pilihan yang sudah ada -- selalu boleh.
        kodeTerpilihSet.delete(opsi.kode);
        terapkanGayaTerpilih();
      } else if (kodeTerpilihSet.size < jumlahDipesan) {
        // Masih ada jatah sesuai jumlah yang dipesan di Langkah 2.
        kodeTerpilihSet.add(opsi.kode);
        terapkanGayaTerpilih();
      } else if (jumlahDipesan === 1) {
        // Mode "pesan 1 stand" -- berperilaku seperti radio: klik kotak lain
        // otomatis MENUKAR pilihan (tidak perlu batalkan manual dulu).
        kodeTerpilihSet.clear();
        kodeTerpilihSet.add(opsi.kode);
        segarkanSemuaGayaPilihan();
      } else {
        // Sudah mencapai jumlah yang dipesan (>1) -- JANGAN tambah, cuma
        // beri tahu lewat #bazar-lokasi-batas-pesan (lihat perbaruiTotalLokasi()).
        perbaruiTotalLokasi();
        return;
      }
      perbaruiTotalLokasi();
      simpanDraftBazar();
    });

    return el;
  }

  // Menyegarkan gaya outline SEMUA kotak yang sedang bisa dipilih sesuai isi
  // kodeTerpilihSet terbaru -- dipakai saat mode "pesan 1 stand" menukar
  // pilihan (lihat klik handler di buatKotakLokasiPublik()), supaya kotak
  // yang baru saja DIBATALKAN otomatis juga ikut kehilangan outline-nya
  // (bukan cuma kotak yang baru diklik).
  function segarkanSemuaGayaPilihan() {
    Object.keys(kotakStandElMap).forEach(function (kode) {
      const el = kotakStandElMap[kode];
      if (el && typeof el._segarkanGayaPilihan === "function") el._segarkanGayaPilihan();
    });
  }

  let kotakStandElMap = {};

  function renderLokasiPicker() {
    if (!jenisTerpilih) return;

    const hintEl = document.getElementById("bazar-lokasi-hint");
    if (hintEl) {
      hintEl.textContent = jumlahDipesan === 1
        ? "Klik salah satu kotak di denah di bawah untuk memilih lokasi stand Anda. Begitu Anda klik \"Lanjut\", lokasi yang dipilih dikunci sementara (15 menit) supaya tidak diambil pendaftar lain selagi Anda mengisi Langkah 4."
        : "Klik TEPAT " + jumlahDipesan + " kotak di denah di bawah, sesuai jumlah stand yang Anda pesan di Langkah 2. Begitu Anda klik \"Lanjut\", lokasi yang dipilih dikunci sementara (15 menit) supaya tidak diambil pendaftar lain selagi Anda mengisi Langkah 4.";
    }

    const warnaJenisAktif = WARNA_JENIS_DENAH_PUBLIK[jenisTerpilih] || "#777777";
    legendaEl.innerHTML =
      '<div style="display:flex;flex-wrap:wrap;gap:14px;margin:8px 0 2px;font-size:12.5px;color:#4b5563;">' +
        '<span style="display:inline-flex;align-items:center;gap:5px;"><span style="width:14px;height:14px;border-radius:3px;background:' + warnaJenisAktif + ';display:inline-block;"></span>Tersedia (klik untuk pilih)</span>' +
        '<span style="display:inline-flex;align-items:center;gap:5px;"><span style="width:14px;height:14px;border-radius:3px;background:' + warnaJenisAktif + ';outline:2.5px solid #1E7A4C;outline-offset:1px;display:inline-block;"></span>Dipilih</span>' +
        '<span style="display:inline-flex;align-items:center;gap:5px;"><span style="width:14px;height:14px;border-radius:3px;background:#fde8e8;border:1px solid #f3b4b4;display:inline-block;"></span>Terisi</span>' +
        '<span style="display:inline-flex;align-items:center;gap:5px;"><span style="width:14px;height:14px;border-radius:3px;background:#fff3d6;border:1px solid #f0d090;display:inline-block;"></span>Dipegang sementara pendaftar lain</span>' +
        '<span style="display:inline-flex;align-items:center;gap:5px;"><span style="width:14px;height:14px;border-radius:3px;background:#999;opacity:0.28;display:inline-block;"></span>Jenis lain</span>' +
      '</div>';

    const outerEl = document.getElementById("bazar-denah-outer");
    const innerEl = document.getElementById("bazar-denah-inner");
    outerEl.style.background = denahBackgroundUrl ? ("center/cover no-repeat url('" + denahBackgroundUrl + "'), #eef7ec") : "#eef7ec";
    innerEl.style.width = DENAH_PUBLIK_CANVAS_W + "px";
    innerEl.style.height = DENAH_PUBLIK_CANVAS_H + "px";

    innerEl.innerHTML = "";
    kotakStandElMap = {};
    const sekarang = Date.now();
    elemenList.forEach(function (elm) {
      innerEl.appendChild(buatKotakLokasiPublik({
        tipeLabel: true,
        x: elm.pos_x, y: elm.pos_y, w: elm.lebar, h: elm.tinggi, rotasi: elm.rotasi,
        warnaBg: elm.warna_bg, warnaTeks: elm.warna_teks,
        label: elm.teks, sublabel: elm.emoji
      }));
    });
    standList.forEach(function (s) {
      const direservasiOrangLain = !!s.direservasi_oleh && s.direservasi_oleh !== sesiToken &&
        !!s.direservasi_sampai && new Date(s.direservasi_sampai).getTime() > sekarang;
      const el = buatKotakLokasiPublik({
        kode: s.kode, jenis: s.jenis,
        x: s.pos_x != null ? s.pos_x : 20, y: s.pos_y != null ? s.pos_y : 20,
        w: s.lebar || 54, h: s.tinggi || 40, rotasi: s.rotasi || 0,
        // Stand "milik panitia" (migrasi 0049) ditampilkan SAMA seperti
        // stand terisi di denah publik -- publik tidak perlu tahu alasannya,
        // cukup tahu stand itu tidak bisa dipilih.
        terisi: !!s.tenant_id || !!s.milik_panitia,
        direservasiOrangLain: direservasiOrangLain,
        selectable: s.jenis === jenisTerpilih && !s.tenant_id && !s.milik_panitia && !direservasiOrangLain
      });
      innerEl.appendChild(el);
      kotakStandElMap[s.kode] = el;
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
      ? ("Belum ada lokasi dipilih (pilih " + jumlahDipesan + (jumlahDipesan === 1 ? " stand" : " stand") + " sesuai yang dipesan di Langkah 2).")
      : (dipilih + " dari " + jumlahDipesan + " stand dipilih (" + Array.from(kodeTerpilihSet).sort().join(", ") + ") × " + formatRupiahDaftarBazar(harga) + " = " + formatRupiahDaftarBazar(dipilih * harga) + ".");

    const batasEl = document.getElementById("bazar-lokasi-batas-pesan");
    if (batasEl) batasEl.style.display = (jumlahDipesan > 1 && dipilih >= jumlahDipesan) ? "block" : "none";
  }

  function highlightKodeBentrok(daftarKode) {
    if (!daftarKode || daftarKode.length === 0) return;
    let kotakPertama = null;
    daftarKode.forEach(function (kode) {
      const el = kotakStandElMap[kode];
      if (!el) return;
      if (!kotakPertama) kotakPertama = el;
      let kedip = 0;
      const interval = setInterval(function () {
        kedip++;
        el.style.boxShadow = (kedip % 2 === 1) ? "0 0 0 4px rgba(220,38,38,0.7)" : "none";
        if (kedip >= 6) {
          clearInterval(interval);
          el.style.boxShadow = "none";
        }
      }, 280);
    });
    if (kotakPertama && kotakPertama.scrollIntoView) {
      kotakPertama.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  /* ---------------- Muat pengaturan bazar (buka/tutup, jenis & denah stand, info biaya/rekening) ---------------- */
  async function muatPengaturanBazar() {
    const [{ data: settings }, { data: standData }, { data: elemenData }] = await Promise.all([
      supabaseClient.from("bazar_settings").select("pendaftaran_dibuka,jenis_stand_info,info_biaya,info_rekening,denah_background_url").eq("id", 1).single(),
      supabaseClient.from("bazar_stand").select("id,jenis,area,nomor,kode,tenant_id,milik_panitia,direservasi_oleh,direservasi_sampai,pos_x,pos_y,lebar,tinggi,rotasi").order("jenis").order("nomor"),
      supabaseClient.from("bazar_denah_elemen").select("*").order("urutan")
    ]);

    pendaftaranDibuka = !settings || settings.pendaftaran_dibuka !== false;
    ujiCobaAktifBazar = !!(window.ujiCobaAktif && window.ujiCobaAktif());
    jenisStandInfo = (settings && settings.jenis_stand_info) || {};
    denahBackgroundUrl = (settings && settings.denah_background_url) || null;
    standList = standData || [];
    elemenList = elemenData || [];
    // Stand "milik panitia" dihitung SAMA seperti terisi untuk deteksi
    // "sudah penuh semua" ini -- kalau sisanya cuma stand milik panitia,
    // halaman ini memang seharusnya menganggap pendaftaran sudah penuh.
    const semuaPenuh = standList.length > 0 && standList.every(function (s) { return !!s.tenant_id || !!s.milik_panitia; });

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

    // Kode uji coba (sama persis dengan Lomba) membuka form ini walau
    // `pendaftaran_dibuka` false -- TAPI tidak membuka stand yang memang
    // sudah penuh (itu bukan soal status buka/tutup, tidak ada gunanya
    // dilewati PIN).
    if ((!pendaftaranDibuka && !ujiCobaAktifBazar) || semuaPenuh) {
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
            (!pendaftaranDibuka ? (
              '<div style="margin-top:18px;">' +
                '<button type="button" class="btn btn--ghost" id="btn-bazar-ujicoba-reveal" style="font-size:12.5px;opacity:0.7;">Panitia? Masuk mode uji coba</button>' +
                '<div id="bazar-ujicoba-wrap" style="display:none;max-width:260px;margin:12px auto 0;">' +
                  '<input type="password" id="bazar-ujicoba-pin" placeholder="Kode uji coba" style="width:100%;text-align:center;letter-spacing:2px;" />' +
                  '<p class="form-error" id="bazar-ujicoba-error" style="display:none;margin-top:6px;">Kode salah.</p>' +
                  '<button type="button" class="btn btn--primary" id="bazar-ujicoba-submit" style="margin-top:8px;width:100%;">Masuk</button>' +
                '</div>' +
              '</div>'
            ) : "") +
          '</div>';

        if (!pendaftaranDibuka) {
          const btnReveal = document.getElementById("btn-bazar-ujicoba-reveal");
          const wrap = document.getElementById("bazar-ujicoba-wrap");
          const pinInput = document.getElementById("bazar-ujicoba-pin");
          const pinError = document.getElementById("bazar-ujicoba-error");
          btnReveal.addEventListener("click", function () {
            wrap.style.display = "block";
            pinInput.focus();
          });
          function cobaUjiCobaBazar() {
            const val = pinInput.value.trim();
            if (window.KODE_UJI_COBA_PANITIA && val === window.KODE_UJI_COBA_PANITIA) {
              pinError.style.display = "none";
              try { sessionStorage.setItem("alif_uji_coba_pin", val); } catch (e) { /* tetap lanjut walau gagal disimpan */ }
              router(); // render ulang halaman ini dari awal -- sekarang akan lolos gerbang karena sessionStorage sudah terisi
            } else {
              pinError.style.display = "block";
            }
          }
          document.getElementById("bazar-ujicoba-submit").addEventListener("click", cobaUjiCobaBazar);
          pinInput.addEventListener("keydown", function (e) {
            if (e.key === "Enter") cobaUjiCobaBazar();
          });
        }
      }
      return false;
    }
    return true;
  }

  /* ---------------- Upload berkas (pola sama dengan view-daftar.js, bucket & prefix "bazar/" supaya terpisah rapi) ---------------- */
  function ekstensi(file) {
    const bagian = file.name.split(".");
    return bagian.length > 1 ? bagian.pop() : "bin";
  }

  // Kecilkan otomatis berkas FOTO sebelum diunggah -- pola & alasan SAMA
  // PERSIS dengan `kecilkanGambarJikaPerlu()` di view-daftar.js (lihat
  // komentar di sana), diberi akhiran "Bazar" di sini supaya tidak bentrok
  // nama (satu scope global JS yang sama). Ini juga yang paling berperan
  // membuat pengunggahan Langkah 4 (sampai 5 berkas foto: logo, poster, 2
  // bukti follow IG, bukti bayar) jadi jauh lebih singkat di sinyal lemah --
  // foto HP yang tadinya 3-8MB biasanya jadi tinggal ratusan KB sebelum
  // dikirim, bukan cuma diunggah bergantian seperti perbaikan sebelumnya.
  // Ambang & ukuran diperketat (sebelumnya memicu di >=400KB, sisi maks
  // 1600px, kualitas 0.82) -- dilaporkan: unggahan logo (berkas PERTAMA di
  // antrean) masih sering "Failed to fetch" walau sinyal kelihatan penuh,
  // dan pendaftar menduga berkasnya masih terlalu besar/lama diunggah.
  // Sekarang memicu lebih dini (>=250KB) dan hasil akhirnya dibuat lebih
  // kecil lagi (sisi maks 1280px, kualitas 0.75) -- foto logo/produk tidak
  // butuh resolusi tinggi untuk ditampilkan di tabel/poster Panitia, jadi
  // ukuran file yang lebih kecil (biasanya tinggal puluhan-ratusan KB, bukan
  // ratusan KB-1MB seperti sebelumnya) mengurangi waktu unggah & peluang
  // koneksi lemah sempat putus di tengah proses unggahnya.
  function kecilkanGambarJikaPerluBazar(file) {
    if (!file || file.type.indexOf("image/") !== 0 || file.size < 250 * 1024) {
      return Promise.resolve(file);
    }
    return new Promise(function (resolve) {
      const img = new Image();
      const urlSementara = URL.createObjectURL(file);
      img.onload = function () {
        URL.revokeObjectURL(urlSementara);
        const MAKS_SISI = 1280;
        const skala = Math.min(1, MAKS_SISI / Math.max(img.naturalWidth, img.naturalHeight));
        const w = Math.round(img.naturalWidth * skala), h = Math.round(img.naturalHeight * skala);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        canvas.toBlob(function (blob) {
          if (!blob || blob.size >= file.size) { resolve(file); return; }
          resolve(new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" }));
        }, "image/jpeg", 0.75);
      };
      img.onerror = function () { URL.revokeObjectURL(urlSementara); resolve(file); };
      img.src = urlSementara;
    });
  }

  function tungguSebentar(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  // "Failed to fetch" (gagal di level jaringan, BUKAN error terstruktur dari
  // Supabase) sering muncul di HP dengan sinyal pas-pasan (4G naik-turun,
  // apalagi kalau beberapa berkas diunggah BERSAMAAN -- lihat perubahan di
  // bawah, sekarang diunggah BERGANTIAN satu-satu, bukan `Promise.all`
  // sekaligus, supaya tidak berebut koneksi di jaringan lemah). Begitu
  // ketemu error yang pola pesannya khas masalah jaringan sesaat (bukan
  // berkas ditolak server/format salah/dsb), coba ulang otomatis sebelum
  // benar-benar menyerah -- pengalaman nyata pendaftar: 1 dari 5 berkas
  // gagal di tengah sinyal lemot TIDAK harus langsung membatalkan seluruh
  // pendaftarannya.
  //
  // MAKS_PERCOBAAN dinaikkan dari 3 jadi 6 (sempat dilaporkan: di sinyal 4G
  // yang BENAR-BENAR lemah, 3x percobaan dengan jeda pendek masih sering
  // habis duluan sebelum koneksinya sempat pulih sebentar -- 6x percobaan
  // dengan jeda yang naik lebih jauh memberi waktu total lebih panjang
  // untuk jaringan yang naik-turun punya "jendela" sempat tersambung).
  // Jeda antar percobaan di-CAP di MAKS_JEDA_MS supaya tidak jadi berjam-jam
  // kalau percobaannya banyak -- totalnya tetap wajar untuk ukuran formulir
  // HP (lihat perhitungan di komentar `MAKS_JEDA_MS` di bawah).
  function kemungkinanErrorJaringan(pesan) {
    const p = String(pesan || "").toLowerCase();
    return p.indexOf("failed to fetch") !== -1 ||
      p.indexOf("network") !== -1 ||
      p.indexOf("load failed") !== -1 ||
      p.indexOf("networkerror") !== -1 ||
      p.indexOf("timeout") !== -1 ||
      p.indexOf("timed out") !== -1;
  }

  const MAKS_PERCOBAAN_UPLOAD_BAZAR = 6;
  const MAKS_JEDA_MS = 5000; // jeda antar percobaan di-cap 5 detik (naik 1.2s, 2.4s, 3.6s, 4.8s, lalu mentok 5s)
  const BATAS_WAKTU_UNGGAH_MS = 15000; // lihat komentar di bawah

  // supabase-js (storage.upload) TIDAK punya batas waktu bawaan -- di
  // koneksi yang sangat lemah, SATU percobaan upload bisa menggantung lama
  // sebelum browser akhirnya melempar "Failed to fetch" sendiri (kalau
  // sempat melempar sama sekali) -- dilaporkan pendaftar: terasa "lama" dan
  // mengganggu. Supaya TIAP percobaan dibatasi tegas 15 detik (bukan
  // menunggu browser), dibungkus Promise.race melawan timer -- begitu
  // timernya menang, dianggap error jaringan biasa (pesannya cocok dengan
  // kemungkinanErrorJaringan() di atas) supaya tetap ikut alur percobaan
  // ulang yang sama persis, bukan jalur terpisah.
  function unggahDenganBatasWaktu(path, file) {
    return Promise.race([
      supabaseClient.storage.from(STORAGE_BUCKET).upload(path, file, { contentType: file.type, upsert: true }),
      new Promise(function (resolve) {
        setTimeout(function () { resolve({ error: { message: "Waktu unggah habis (timeout jaringan)" } }); }, BATAS_WAKTU_UNGGAH_MS);
      })
    ]);
  }

  // `onPercobaan(percobaan, maksPercobaan)` opsional -- dipanggil SEBELUM
  // tiap percobaan ulang (bukan percobaan pertama) supaya pemanggil bisa
  // menampilkan progres "percobaan ke-X" ke pendaftar (lihat
  // unggahSemuaBergantian() di bawah) -- supaya kelihatan sedang berusaha
  // mencoba lagi, bukan diam/macet.
  async function uploadKeStorageBazar(file, label, onPercobaan) {
    file = await kecilkanGambarJikaPerluBazar(file);
    const path = "bazar/" + Date.now() + "-" + Math.random().toString(36).slice(2) + "-" + label + "." + ekstensi(file);
    let error;
    for (let percobaan = 1; percobaan <= MAKS_PERCOBAAN_UPLOAD_BAZAR; percobaan++) {
      if (percobaan > 1 && typeof onPercobaan === "function") onPercobaan(percobaan, MAKS_PERCOBAAN_UPLOAD_BAZAR);
      const hasil = await unggahDenganBatasWaktu(path, file);
      error = hasil.error;
      if (!error) {
        const { data } = supabaseClient.storage.from(STORAGE_BUCKET).getPublicUrl(path);
        return data.publicUrl;
      }
      console.error("Detail error upload (" + label + "), percobaan " + percobaan + ":", error);
      const bolehCobaLagi = percobaan < MAKS_PERCOBAAN_UPLOAD_BAZAR && kemungkinanErrorJaringan(error.message);
      if (!bolehCobaLagi) break;
      await tungguSebentar(Math.min(1200 * percobaan, MAKS_JEDA_MS)); // jeda makin lama tiap percobaan ulang, di-cap
    }
    throw new Error("Gagal mengunggah " + label + ": " + error.message);
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
      // Terima SEMUA jenis foto (cukup diawali "image/" -- otomatis
      // mencakup HEIC/HEIF/WEBP/dll, bukan cuma JPG/PNG seperti dulu) atau
      // PDF -- lihat catatan lengkap di config.js dekat ALLOWED_FILE_TYPES.
      const typeOk = file.type.indexOf("image/") === 0 || file.type === "application/pdf";
      if (!sizeOk || !typeOk) {
        filenameEl.textContent = !sizeOk
          ? ("Berkas melebihi " + MAX_FILE_SIZE_MB + "MB. Pilih ulang berkas.")
          : "Format tidak didukung. Gunakan foto (JPG/PNG/HEIC/dll) atau PDF.";
        box.classList.remove("has-file");
        input.value = "";
        return;
      }
      filenameEl.textContent = file.name;
      box.classList.add("has-file");
    });
  }

  setupUploadSingle("bazarFileLogo", "upload-bazar-logo", "filename-bazar-logo");
  setupUploadSingle("bazarFilePoster", "upload-bazar-poster", "filename-bazar-poster");
  setupUploadSingle("bazarFileIg1", "upload-bazar-ig1", "filename-bazar-ig1");
  setupUploadSingle("bazarFileIg2", "upload-bazar-ig2", "filename-bazar-ig2");
  setupUploadSingle("bazarFileBukti", "upload-bazar-bukti", "filename-bazar-bukti");

  /* ---------------- Validasi tiap langkah ---------------- */
  function setFieldError(fieldEl, hasError) {
    fieldEl.classList.toggle("has-error", hasError);
  }

  function validasiLangkah1() {
    let valid = true;
    ["bazarNamaUsaha", "bazarJenisProduk", "bazarPenanggungJawab", "bazarWhatsapp"].forEach(function (id) {
      const input = document.getElementById(id);
      const fieldEl = input.closest(".field");
      const ok = input.value.trim() !== "";
      setFieldError(fieldEl, !ok);
      if (!ok) valid = false;
    });
    [
      ["bazarFileLogo", "upload-bazar-logo"],
      ["bazarFilePoster", "upload-bazar-poster"],
      ["bazarFileIg1", "upload-bazar-ig1"],
      ["bazarFileIg2", "upload-bazar-ig2"]
    ].forEach(function (pair) {
      const input = document.getElementById(pair[0]);
      const ok = !!(input.files && input.files[0]) && document.getElementById(pair[1]).classList.contains("has-file");
      setFieldError(input.closest(".field"), !ok);
      if (!ok) valid = false;
    });
    return valid;
  }

  function validasiLangkah2() {
    const jenisChecked = jenisChoicesEl.querySelector('input[name="bazarJenis"]:checked');
    jenisErrorEl.style.display = jenisChecked ? "none" : "block";
    return !!jenisChecked;
  }

  function validasiLangkah3Lokal() {
    // Sekarang harus TEPAT sejumlah jumlahDipesan (bukan cuma "minimal satu"
    // seperti sebelumnya) -- jumlahnya sendiri sudah ditentukan di Langkah 2.
    const cukup = kodeTerpilihSet.size === jumlahDipesan;
    lokasiErrorEl.textContent = kodeTerpilihSet.size === 0
      ? ("Pilih " + jumlahDipesan + (jumlahDipesan === 1 ? " lokasi stand" : " lokasi stand") + " di denah sesuai yang dipesan.")
      : ("Jumlah lokasi yang dipilih (" + kodeTerpilihSet.size + ") belum sesuai jumlah yang dipesan (" + jumlahDipesan + "). Pilih/batalkan kotak di denah sampai jumlahnya pas.");
    lokasiErrorEl.style.display = cukup ? "none" : "block";
    return cukup;
  }

  function validasiLangkah4() {
    let valid = true;
    const buktiInput = document.getElementById("bazarFileBukti");
    const buktiOk = !!(buktiInput.files && buktiInput.files[0]);
    setFieldError(buktiInput.closest(".field"), !buktiOk);
    if (!buktiOk) valid = false;

    const konfirmasi = document.getElementById("bazarKonfirmasi");
    document.getElementById("bazar-konfirmasi-error").style.display = konfirmasi.checked ? "none" : "block";
    if (!konfirmasi.checked) valid = false;

    return valid;
  }

  /* ---------------- Navigasi wizard ---------------- */
  async function lanjutDariLangkah3() {
    if (!validasiLangkah3Lokal()) return false;
    reservasiErrorEl.style.display = "none";

    const kodeDipilih = Array.from(kodeTerpilihSet).sort();
    const kunciSeleksi = jenisTerpilih + "|" + kodeDipilih.join(",");
    if (reservasiTerakhirUntuk === kunciSeleksi) {
      // Seleksinya tidak berubah sejak reservasi terakhir yang berhasil --
      // tidak perlu panggil RPC lagi, reservasi lama masih berlaku (atau
      // akan diperpanjang otomatis begitu submit_bazar final dijalankan).
      return true;
    }

    const labelAsli = btnLanjut.textContent;
    btnLanjut.disabled = true;
    btnLanjut.textContent = "Mengunci lokasi...";
    try {
      const { data, error } = await supabaseClient.rpc("bazar_reservasi_stand", {
        p_jenis_stand: jenisTerpilih,
        p_kode_stand: kodeDipilih,
        p_sesi_token: sesiToken
      });
      if (error) throw new Error(error.message);
      if (!data.success) {
        reservasiErrorEl.textContent = data.message || "Gagal mengunci lokasi, coba lagi.";
        reservasiErrorEl.style.display = "block";
        // Kalau pendaftaran ternyata baru saja ditutup panitia DI TENGAH
        // pengisian (sangat jarang, tapi mungkin), muatPengaturanBazar()
        // sudah mengganti seluruh ".form-shell" dengan pesan tertutup --
        // elemen denah (#bazar-denah-outer dkk) jadi tidak ada lagi di DOM,
        // jadi JANGAN panggil renderLokasiPicker() kalau itu terjadi
        // (akan error null reference kalau dipaksa).
        const masihBuka = await muatPengaturanBazar();
        if (!masihBuka) return false;
        renderLokasiPicker();
        if (Array.isArray(data.kode_bentrok) && data.kode_bentrok.length > 0) {
          // Lokasi yang bentrok otomatis lepas dari pilihan, sisanya tetap
          // ada (BEDA dari penanganan bentrok saat submit final migrasi
          // 0040/0041 yang mereset total) -- di Langkah 3 ini pendaftar
          // masih bisa lihat & pilih lokasi PENGGANTI langsung di tempat
          // tanpa kehilangan pilihan lain yang sudah benar.
          data.kode_bentrok.forEach(function (k) { kodeTerpilihSet.delete(k); });
          perbaruiTotalLokasi();
          highlightKodeBentrok(data.kode_bentrok);
        }
        return false;
      }
      reservasiTerakhirUntuk = kunciSeleksi;
      return true;
    } catch (err) {
      reservasiErrorEl.textContent = "Gagal mengunci lokasi: " + err.message;
      reservasiErrorEl.style.display = "block";
      return false;
    } finally {
      btnLanjut.disabled = false;
      btnLanjut.textContent = labelAsli;
    }
  }

  function perbaruiRingkasanAkhir() {
    const harga = jenisTerpilih && jenisStandInfo[jenisTerpilih] ? (jenisStandInfo[jenisTerpilih].harga || 0) : 0;
    const jumlah = kodeTerpilihSet.size;
    const kodeList = Array.from(kodeTerpilihSet).sort().join(", ");
    ringkasanAkhirEl.innerHTML =
      '<strong>' + escapeHTMLDaftarBazar(document.getElementById("bazarNamaUsaha").value.trim() || "-") + '</strong>' +
      'Jenis ' + escapeHTMLDaftarBazar(jenisTerpilih || "-") + ' · ' + jumlah + ' stand (' + escapeHTMLDaftarBazar(kodeList) + ')<br/>' +
      'Total sewa: ' + formatRupiahDaftarBazar(jumlah * harga);
  }

  async function lepasReservasiSekarang() {
    if (!reservasiTerakhirUntuk) return;
    reservasiTerakhirUntuk = null;
    try {
      await supabaseClient.rpc("bazar_lepas_reservasi", { p_sesi_token: sesiToken });
    } catch (e) {
      console.error("Gagal melepas reservasi:", e);
    }
  }

  btnLanjut.addEventListener("click", async function () {
    if (currentStep === 1) {
      if (!validasiLangkah1()) {
        const err = form.querySelector(".field.has-error");
        if (err) err.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
      currentStep = 2;
      perbaruiTampilanLangkah();
      simpanDraftBazar();
    } else if (currentStep === 2) {
      if (!validasiLangkah2()) return;
      currentStep = 3;
      renderLokasiPicker();
      perbaruiTampilanLangkah();
      simpanDraftBazar();
    } else if (currentStep === 3) {
      const ok = await lanjutDariLangkah3();
      if (!ok) return;
      perbaruiRingkasanAkhir();
      currentStep = 4;
      perbaruiTampilanLangkah();
      simpanDraftBazar();
    }
  });

  btnKembali.addEventListener("click", async function () {
    if (currentStep === 2) {
      currentStep = 1;
    } else if (currentStep === 3) {
      currentStep = 2;
    } else if (currentStep === 4) {
      currentStep = 3;
      renderLokasiPicker();
    }
    perbaruiTampilanLangkah();
    simpanDraftBazar();
  });

  // Kalau pendaftar mundur dari Langkah 3 balik ke Langkah 2 (berarti
  // berpotensi ganti jenis stand), lepas reservasi yang sedang dipegang --
  // dipasang terpisah dari listener "Kembali" di atas karena harus async
  // dan tidak boleh menunda pindah langkahnya (lepas reservasi jalan di
  // belakang layar, tidak perlu ditunggu pendaftar).
  btnKembali.addEventListener("click", function () {
    if (currentStep === 2) lepasReservasiSekarang();
  });

  /* ---------------- Submit akhir (Langkah 4) ---------------- */
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (currentStep !== TOTAL_STEP) return;
    if (!validasiLangkah4()) {
      const err = form.querySelector(".field.has-error, #bazar-konfirmasi-error[style*='block']");
      if (err) err.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    const fileLogo = document.getElementById("bazarFileLogo").files[0];
    const filePoster = document.getElementById("bazarFilePoster").files[0];
    const fileIg1 = document.getElementById("bazarFileIg1").files[0];
    const fileIg2 = document.getElementById("bazarFileIg2").files[0];
    const fileBukti = document.getElementById("bazarFileBukti").files[0];
    const kodeDipilih = Array.from(kodeTerpilihSet);

    // Jaring pengaman TAMBAHAN khusus untuk berkas-berkas Langkah 1 (logo,
    // poster, bukti follow IG) -- validasiLangkah4() di atas HANYA
    // memeriksa bukti pembayaran (berkas Langkah 4 itu sendiri), BUKAN
    // keempat berkas Langkah 1. Dalam alur normal (klik "Lanjut" berurutan
    // dari Langkah 1) itu tidak masalah karena validasiLangkah1() sudah
    // menjaganya duluan. TAPI sejak fitur draf tersimpan (sessionStorage,
    // lihat pulihkanDraftLanjutanBazar()) bisa memulihkan pendaftar
    // LANGSUNG ke Langkah 2/3 setelah refresh -- sedangkan berkas TIDAK
    // PERNAH bisa ikut dipulihkan (keterbatasan browser) -- pendaftar bisa
    // saja langsung lanjut ke Langkah 4 lewat tombol "Lanjut" (yang cuma
    // memvalidasi Langkah 2/3, bukan berkas Langkah 1) lalu menekan "Kirim"
    // tanpa pernah mengisi ulang keempat berkas itu. Tanpa pengecekan ini,
    // `ekstensi(file)`/`ekstensi(undefined)` di uploadKeStorageBazar() akan
    // melempar "Cannot read properties of undefined (reading 'name')" --
    // pesan eror teknis yang membingungkan, bukan error jelas yang bisa
    // ditindaklanjuti pendaftar. Begitu ketemu berkas yang kosong, pendaftar
    // dibawa balik ke Langkah 1 dengan kotak yang kosong ditandai merah.
    if (!fileLogo || !filePoster || !fileIg1 || !fileIg2) {
      currentStep = 1;
      perbaruiTampilanLangkah();
      validasiLangkah1();
      alert("Beberapa berkas di Langkah 1 (Logo Usaha/Poster Promosi/Bukti Follow IG) belum dipilih -- kemungkinan karena draf pendaftaran baru saja dipulihkan setelah refresh (berkas memang tidak bisa ikut dipulihkan otomatis). Silakan pilih ulang berkas yang kotaknya ditandai merah di Langkah 1, lalu lanjutkan lagi sampai Langkah 4.");
      const err = form.querySelector(".field.has-error");
      if (err) err.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    btnSubmit.disabled = true;
    btnSubmit.textContent = "Mengirim...";
    btnKembali.disabled = true;

    // Diunggah BERGANTIAN satu-per-satu (bukan `Promise.all` lima sekaligus
    // seperti sebelumnya) -- 5 unggahan bersamaan gampang berebut koneksi di
    // HP dengan sinyal pas-pasan (dilaporkan nyata: "Gagal mengunggah
    // poster-promosi: Failed to fetch" di tengah 4G lemah), jadi diunggah
    // satu-satu supaya tiap unggahan dapat jatah koneksi penuh + tombol
    // "Mengirim..." sekalian menunjukkan progres (mis. "Mengunggah 2/5...")
    // supaya pendaftar tahu prosesnya masih jalan, bukan macet. Urutan
    // berkasnya SENGAJA bukti-bayar PALING AKHIR -- kalau salah satu berkas
    // identitas gagal total (habis 3x percobaan, lihat uploadKeStorageBazar),
    // pendaftar tahu lebih awal TANPA harus menunggu bukti bayar (biasanya
    // berkas paling besar) ikut terunggah dulu.
    const daftarUnggah = [
      { file: fileLogo, label: "logo-usaha" },
      { file: filePoster, label: "poster-promosi" },
      { file: fileIg1, label: "bukti-follow-ig-1" },
      { file: fileIg2, label: "bukti-follow-ig-2" },
      { file: fileBukti, label: "bukti-bayar" }
    ];

    async function unggahSemuaBergantian() {
      const hasil = [];
      for (let i = 0; i < daftarUnggah.length; i++) {
        btnSubmit.textContent = "Mengunggah " + (i + 1) + "/" + daftarUnggah.length + "...";
        hasil.push(await uploadKeStorageBazar(daftarUnggah[i].file, daftarUnggah[i].label, function (percobaan, maks) {
          // Ditampilkan hanya mulai percobaan ke-2 -- supaya pendaftar di
          // sinyal lemah melihat aplikasi sedang AKTIF mencoba lagi, bukan
          // macet/diam begitu percobaan pertama gagal karena koneksi sempat
          // putus sebentar. Teksnya SENGAJA menyebut "sinyal lemah" secara
          // eksplisit (bukan cuma nomor percobaan) -- begitu upload sudah
          // butuh percobaan ulang, itu sendiri sudah bukti kuat sinyalnya
          // sedang lemah SAAT INI, jadi banner peringatan juga ikut
          // dimunculkan di sini -- bukan cuma mengandalkan
          // navigator.connection (Network Information API) yang TIDAK
          // didukung semua browser (mis. Safari/iOS).
          btnSubmit.textContent = "Sinyal lemah, mencoba lagi... (berkas " + (i + 1) + "/" + daftarUnggah.length + ", percobaan " + percobaan + "/" + maks + ")";
          const hintEl = document.getElementById("bazar-sinyal-lemah-hint");
          if (hintEl) hintEl.style.display = "block";
        }));
      }
      return hasil;
    }

    unggahSemuaBergantian()
      .then(function (hasil) {
        return supabaseClient.rpc("submit_bazar", {
          p_nama_usaha: document.getElementById("bazarNamaUsaha").value.trim(),
          p_jenis_produk: document.getElementById("bazarJenisProduk").value.trim(),
          p_nama_penanggung_jawab: document.getElementById("bazarPenanggungJawab").value.trim(),
          p_whatsapp: document.getElementById("bazarWhatsapp").value.trim(),
          p_jenis_stand: jenisTerpilih || "",
          p_kode_stand: kodeDipilih,
          p_url_foto_produk: [hasil[0], hasil[1]],
          p_url_bukti_follow_ig: [hasil[2], hasil[3]],
          p_url_bukti_bayar: hasil[4],
          p_kode_uji_coba: (window.ujiCobaAktif && window.ujiCobaAktif()) ? window.KODE_UJI_COBA_PANITIA : null
        });
      })
      .then(async function (res) {
        if (res.error) throw new Error(res.error.message);
        const data = res.data;
        if (data.success) {
          reservasiTerakhirUntuk = null; // sudah final, tidak perlu dilepas lagi (submit_bazar sendiri yang membersihkan kolom reservasinya)
          hapusDraftBazar(); // pendaftaran sudah tersimpan di server -- draf lokal tidak diperlukan lagi
          form.style.display = "none";
          regNumberEl.textContent = data.nomor_pendaftaran || "-";
          resultPanel.classList.add("is-visible");
          resultPanel.scrollIntoView({ behavior: "smooth", block: "start" });

          // Pemberitahuan WA "pendaftar baru" ke grup/nomor panitia (migrasi
          // 0046) -- BEST-EFFORT, sengaja TIDAK di-await dan TIDAK pernah
          // menampilkan eror ke pendaftar: kalau Fonnte/secret panitia belum
          // disetel atau gagal terkirim, pendaftaran itu sendiri TETAP sukses
          // (sudah tersimpan di database lewat submit_bazar di atas) --
          // notifikasi ini murni pemberitahuan tambahan, bukan bagian dari
          // alur pendaftaran yang wajib berhasil. `data.id` (uuid baris
          // bazar_tenant yang baru) ditambahkan di submit_bazar() sejak
          // migrasi ini supaya Edge Function bisa mengambil data lengkapnya
          // sendiri dari database (bukan dari body request).
          if (data.id) {
            supabaseClient.functions.invoke("notifikasi-bazar-baru", { body: { id: data.id } })
              .catch(function (err) { console.error("Gagal mengirim notifikasi WA ke panitia:", err); });
          }
        } else {
          // Salah satu stand yang dipilih baru saja diambil pendaftar lain
          // meski sudah sempat direservasi (kedaluwarsa, atau race
          // condition) -- pesannya (migrasi 0040/0041) sudah menyebut KODE
          // STAND spesifik yang bentrok. Sesuai permintaan: pendaftar
          // diminta pilih ulang SEMUA lokasi dari awal (bukan dipertahankan
          // sebagian), jadi dibawa balik ke Langkah 3 dengan seleksi kosong.
          alert("Pendaftaran gagal: " + (data.message || "Terjadi kesalahan, coba lagi."));
          btnSubmit.disabled = false;
          btnSubmit.textContent = "Kirim Pendaftaran Bazar";
          btnKembali.disabled = false;
          kodeTerpilihSet = new Set();
          reservasiTerakhirUntuk = null;
          // Sama seperti di lanjutDariLangkah3() -- kalau pendaftaran ternyata
          // baru saja ditutup panitia, ".form-shell" sudah diganti total oleh
          // muatPengaturanBazar(), jadi jangan paksa render denah/langkah lagi.
          const masihBuka = await muatPengaturanBazar();
          if (!masihBuka) return;
          currentStep = 3;
          renderLokasiPicker();
          perbaruiTampilanLangkah();
          if (Array.isArray(data.kode_bentrok) && data.kode_bentrok.length > 0) {
            highlightKodeBentrok(data.kode_bentrok);
          }
        }
      })
      .catch(function (err) {
        console.error(err);
        // Pesan yang lebih ramah & jelas khusus untuk kegagalan jaringan
        // (sudah dicoba ulang otomatis sampai 6x oleh uploadKeStorageBazar,
        // tapi sinyalnya benar-benar putus lebih lama dari itu) -- supaya
        // pendaftar tahu ini bukan pendaftarannya ditolak/datanya salah,
        // dan tidak perlu mengisi ulang dari awal -- formulir yang sudah
        // diisi TETAP ada, cukup ketuk tombol Kirim lagi begitu sinyal
        // membaik.
        const pesanRamah = kemungkinanErrorJaringan(err.message)
          ? "Gagal mengirim data karena koneksi internet terputus-putus (sudah dicoba ulang beberapa kali). Data yang sudah Anda isi TIDAK hilang -- silakan cari sinyal/WiFi yang lebih stabil, lalu ketuk tombol \"Kirim Pendaftaran Bazar\" sekali lagi."
          : "Gagal mengirim data: " + err.message;
        alert(pesanRamah);
        btnSubmit.disabled = false;
        btnSubmit.textContent = "Kirim Pendaftaran Bazar";
        btnKembali.disabled = false;
      });
  });

  document.getElementById("btn-daftar-bazar-lagi").addEventListener("click", function () {
    lepasReservasiSekarang();
    hapusDraftBazar(); // mulai pendaftaran stand lain dari draf kosong, bukan membawa isian pendaftaran sebelumnya
    window.gotoRoute("#/daftar-bazar");
  });

  // Best-effort: kalau pendaftar menutup/meninggalkan tab di tengah jalan
  // (sudah sempat reservasi di Langkah 3->4 tapi belum submit), coba lepas
  // reservasinya supaya stand itu tidak nyangkut dipegang sia-sia sampai 15
  // menit kedaluwarsa sendiri. BUKAN jaminan mutlak (browser boleh saja
  // menutup koneksi sebelum request ini sempat terkirim) -- makanya
  // kedaluwarsa otomatis di server (migrasi 0042) tetap jadi jaring
  // pengaman utama, ini cuma percepatan kalau sempat.
  window.addEventListener("beforeunload", function () {
    // Simpan draf sekali lagi tepat sebelum halaman benar-benar
    // ditinggalkan/di-refresh -- jaring pengaman tambahan untuk perubahan
    // apa pun yang mungkin belum sempat tersimpan lewat listener lain.
    simpanDraftBazar();
    if (!reservasiTerakhirUntuk) return;
    try {
      supabaseClient.rpc("bazar_lepas_reservasi", { p_sesi_token: sesiToken });
    } catch (e) { /* abaikan -- murni best-effort */ }
  });

  // Dipanggil SATU KALI setelah muatPengaturanBazar() berhasil (standList &
  // jenisStandInfo sudah tersedia) -- memulihkan bagian draf yang butuh data
  // server ini: jenis & jumlah stand, lokasi yang sempat dipilih, dan posisi
  // langkah wizard. Lihat komentar lengkap di bagian "Draf pengisian" di
  // atas untuk alasan kenapa ini sengaja TIDAK langsung memulihkan sampai
  // Langkah 4.
  function pulihkanDraftLanjutanBazar() {
    if (!_draftBazarAwal) return;

    let langkahTujuan = 1;

    if (_draftBazarAwal.jenisTerpilih && jenisStandInfo[_draftBazarAwal.jenisTerpilih]) {
      jenisTerpilih = _draftBazarAwal.jenisTerpilih;
      jumlahDipesan = Math.max(1, parseInt(_draftBazarAwal.jumlahDipesan, 10) || 1);
      renderJenisChoices(); // render ulang -- radio jenis ikut tercentang, jumlahDipesan & stepper ikut terhitung ulang (lihat renderJumlahSelector())
      langkahTujuan = 2;

      const kodeDisimpan = Array.isArray(_draftBazarAwal.kodeTerpilih) ? _draftBazarAwal.kodeTerpilih : [];
      // Validasi ulang tiap kode tersimpan terhadap data TERBARU dari
      // server -- jangan percaya mentah-mentah draf lokal, lokasinya bisa
      // saja sudah diambil tenant lain atau stand itu sudah tidak ada sejak
      // sebelum refresh.
      const kodeValid = kodeDisimpan.filter(function (kode) {
        const s = standList.find(function (x) { return x.kode === kode; });
        return !!s && s.jenis === jenisTerpilih && !s.tenant_id && !s.milik_panitia;
      });
      if (kodeValid.length > 0 && kodeValid.length === jumlahDipesan && (Number(_draftBazarAwal.currentStep) || 1) >= 3) {
        kodeTerpilihSet = new Set(kodeValid);
        // Sengaja berhenti di Langkah 3 (BUKAN langsung ke 4) -- begitu
        // pendaftar klik "Lanjut" lagi dari sini, lanjutDariLangkah3() akan
        // memanggil ulang RPC bazar_reservasi_stand supaya reservasinya
        // tervalidasi/diperbarui FRESH ke server, bukan dipercaya mentah-
        // mentah dari draf lokal yang bisa saja sudah kedaluwarsa.
        langkahTujuan = 3;
      }
    }

    currentStep = langkahTujuan;
    if (currentStep >= 3) renderLokasiPicker();

    const hintEl = document.getElementById("bazar-draft-dipulihkan-hint");
    if (hintEl) hintEl.style.display = "block";
  }

  muatPengaturanBazar().then(function (berhasilDibuka) {
    if (!berhasilDibuka) return;
    pulihkanDraftLanjutanBazar();
    perbaruiTampilanLangkah();
  });
}

window.ViewDaftarBazar = { template: DAFTAR_BAZAR_TEMPLATE, init: initDaftarBazar };
