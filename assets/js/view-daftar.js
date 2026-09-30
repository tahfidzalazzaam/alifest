// View: Form Pendaftaran ("#/daftar")
//
// Urutan sengaja: pilih lomba DULU (Langkah 1), baru data selanjutnya.
// Untuk lomba INDIVIDU (Adzan, Panahan, MHQ, Kaligrafi): Langkah 2 = Data
// Diri Peserta (termasuk tanggal lahir), lalu sistem mengecek usia terhadap
// tanggal pelaksanaan lomba (diatur panitia).
//
// Sejak migrasi 0024, batas usia jenjang memakai aturan TIDAK SIMETRIS
// (lihat cekBatasUsia() di bawah untuk detail & contoh perhitungannya):
//   - Batas ATAS (maksimal) KETAT sampai ke hari: begitu peserta sudah
//     lewat dari tanggal ulang tahun ke-(usia maksimal) walau cuma 1 hari,
//     langsung dianggap TERLALU TUA dan ditolak. Tepat DI hari ulang
//     tahun itu sendiri masih dianggap pas/boleh.
//   - Batas BAWAH (minimal) LONGGAR: begitu peserta sudah lewat dari
//     tanggal ulang tahun ke-(usia minimal - 1) -- artinya sudah masuk
//     "tahun usia ke-(minimal)"-nya walau belum genap -- sudah dianggap
//     CUKUP UMUR, tidak perlu menunggu sampai persis genap usia minimal.
// Pengecekan ini diulang lagi secara otentik di database (fungsi
// submit_pendaftaran, migrasi 0024) supaya tidak bisa dilewati dari browser.
//
// Untuk lomba TIM (Futsal): alurnya beda, TIDAK ada "Data Diri Peserta"
// perorangan, tapi usia TIAP ANGGOTA tim JUGA dicek dengan aturan yang
// SAMA PERSIS (lihat cekBatasUsia()) terhadap syarat usia jenjang yang
// dipilih -- kalau ada satu saja anggota yang meleset, pengiriman form
// diblokir sampai diperbaiki (lihat evaluasiKelayakanTim() &
// perbaruiUsiaAnggota() di bawah). Alurnya:
//   Langkah 2: Nama Tim (Nama Sekolah), Nama Pendamping, No. WA Pendamping
//   Langkah 3: Nama, Tempat Tanggal Lahir, Kelas -- untuk tiap anggota tim
//   Langkah 4: Upload Berkas (kartu pelajar/surat aktif BOLEH BANYAK FILE
//   sekaligus, surat delegasi, bukti follow IG) -- semua file diberi nama
//   berdasarkan Nama Tim saat diunggah ke Storage.

const DAFTAR_TEMPLATE = `
<main class="form-page container">
  <div class="form-header">
    <h1>Formulir Pendaftaran</h1>
    <p>Pilih cabang lomba dulu, baru isi data selanjutnya sesuai jenis lomba.</p>
    <div id="juknis-link-wrap"></div>
    <div class="countdown-tutup" id="countdown-tutup-daftar" style="display:none;"></div>
  </div>

  <div class="form-shell">

    <form id="form-daftar" novalidate>

      <fieldset>
        <span class="form-step">Langkah 1</span>
        <legend>Pilih Cabang Lomba</legend>
        <div class="lomba-choices" id="lomba-choices"></div>
        <div class="form-error" id="lomba-error" style="margin-top:10px;">Pilih salah satu cabang lomba.</div>
      </fieldset>

      <!-- ============ LOMBA INDIVIDU (Adzan, Panahan, MHQ, Kaligrafi) ============ -->
      <fieldset id="fieldset-individu" style="display:none;">
        <span class="form-step">Langkah 2</span>
        <legend>Data Diri Peserta</legend>

        <div class="field-row">
          <div class="field">
            <label for="namaLengkap">Nama Lengkap Peserta (sesuai akte)</label>
            <p class="hint" style="margin-top:-4px;">Isi nama peserta LOMBA itu sendiri, bukan nama orang tua/wali/pendamping. Tulis sesuai akte kelahiran (ejaan & urutan nama harus persis sama, karena dipakai untuk sertifikat).</p>
            <input type="text" id="namaLengkap" name="namaLengkap" />
            <div class="form-error">Nama lengkap peserta wajib diisi.</div>
          </div>
          <div class="field">
            <label for="namaPendamping">Nama Pendamping <span style="font-weight:400;">(opsional)</span></label>
            <p class="hint" style="margin-top:-4px;">Nama orang tua/wali/guru yang mendampingi peserta ini (jika ada). Tidak ditampilkan di tabel Data Pendaftar, hanya terlihat lewat detail pendaftar.</p>
            <input type="text" id="namaPendamping" name="namaPendamping" placeholder="Boleh dikosongkan" />
          </div>
        </div>

        <div class="field-row">
          <div class="field">
            <label for="jenjang">Jenjang</label>
            <select id="jenjang" name="jenjang">
              <option value="">Pilih jenjang</option>
            </select>
            <div class="form-error">Pilih jenjang peserta.</div>
          </div>
          <div class="field">
            <label for="kelas">Kelas</label>
            <input type="text" id="kelas" name="kelas" placeholder="mis. VIII / 5 SD" />
            <div class="form-error">Kelas wajib diisi.</div>
          </div>
        </div>

        <div class="field" id="field-jenis-kelamin">
          <label>Jenis Kelamin</label>
          <div>
            <label style="font-weight:400;display:inline-flex;align-items:center;gap:6px;margin-right:18px;">
              <input type="radio" name="jenisKelamin" value="laki-laki" /> Laki-laki
            </label>
            <label style="font-weight:400;display:inline-flex;align-items:center;gap:6px;">
              <input type="radio" name="jenisKelamin" value="perempuan" /> Perempuan
            </label>
          </div>
          <div class="form-error" id="jenis-kelamin-error">Pilih jenis kelamin peserta.</div>
        </div>

        <div class="field-row">
          <div class="field">
            <label for="tanggalLahir">Tanggal Lahir</label>
            <input type="date" id="tanggalLahir" name="tanggalLahir" />
            <div class="form-error">Tanggal lahir wajib diisi.</div>
          </div>
          <div class="field">
            <label for="whatsapp">No. WhatsApp Aktif</label>
            <input type="tel" id="whatsapp" name="whatsapp" placeholder="08xxxxxxxxxx" />
            <div class="form-error">Nomor WhatsApp wajib diisi.</div>
          </div>
        </div>

        <div class="field">
          <label for="asalSekolah">Asal Sekolah</label>
          <input type="text" id="asalSekolah" name="asalSekolah" />
          <div class="form-error">Asal sekolah wajib diisi.</div>
        </div>

        <div class="notice" id="usia-notice" style="display:none;"></div>
      </fieldset>

      <!-- ============ LOMBA TIM (Futsal) — Langkah 2: Data Tim ============ -->
      <fieldset id="fieldset-tim-info" style="display:none;">
        <span class="form-step">Langkah 2</span>
        <legend>Data Tim</legend>

        <div class="field">
          <label for="namaTim">Nama Tim (Nama Sekolah)</label>
          <input type="text" id="namaTim" name="namaTim" placeholder="mis. SMP Al Azzaam" />
          <div class="form-error">Nama tim/sekolah wajib diisi.</div>
        </div>

        <div class="field-row">
          <div class="field">
            <label for="pembina">Nama Pendamping (guru/pembina, BUKAN peserta)</label>
            <p class="hint" style="margin-top:-4px;">Nama guru/pendamping yang bertanggung jawab atas tim ini, BUKAN nama siswa/peserta yang bertanding — nama tiap peserta diisi terpisah di Langkah 3 (Data Anggota Tim).</p>
            <input type="text" id="pembina" name="pembina" placeholder="mis. Ust. Ahmad (guru pendamping)" />
            <div class="form-error">Nama pendamping wajib diisi.</div>
          </div>
          <div class="field">
            <label for="whatsappTim">No. WA Pendamping</label>
            <input type="tel" id="whatsappTim" name="whatsappTim" placeholder="08xxxxxxxxxx" />
            <div class="form-error">Nomor WhatsApp pendamping wajib diisi.</div>
          </div>
        </div>

        <div class="field-row">
          <div class="field" id="field-jenjang-tim">
            <label for="jenjangTim">Jenjang Tim</label>
            <select id="jenjangTim" name="jenjangTim"></select>
          </div>
          <div class="field" id="field-gender-tim">
            <label>Jenis Kelamin Tim</label>
            <div>
              <label style="font-weight:400;display:inline-flex;align-items:center;gap:6px;margin-right:18px;">
                <input type="radio" name="jenisKelaminTim" value="laki-laki" /> Putra
              </label>
              <label style="font-weight:400;display:inline-flex;align-items:center;gap:6px;">
                <input type="radio" name="jenisKelaminTim" value="perempuan" /> Putri
              </label>
            </div>
          </div>
        </div>

        <div class="notice" id="tim-notice" style="display:none;"></div>
      </fieldset>

      <!-- Info tambahan yang berlaku untuk kedua jenis lomba -->
      <div id="kontak-tambahan" style="display:none;">
        <div class="field">
          <label for="email">Email (opsional)</label>
          <input type="email" id="email" name="email" />
        </div>
      </div>

      <div id="bagian-lanjutan" style="display:none;">

        <!-- ============ LOMBA TIM — Langkah 3: Data Anggota Tim ============ -->
        <fieldset id="fieldset-tim-anggota" style="display:none;">
          <span class="form-step">Langkah 3</span>
          <legend>Data Anggota Tim (Peserta)</legend>
          <p class="hint" style="margin-top:-6px;">Isi data peserta yang bertanding (bukan pendamping). Nama tiap anggota ditulis sesuai akte kelahiran (dipakai untuk sertifikat).</p>

          <div class="field">
            <div class="anggota-list" id="anggota-list"></div>
            <button type="button" class="btn-add" id="btn-tambah-anggota">+ Tambah anggota</button>
            <div class="hint" id="anggota-hint"></div>
          </div>
        </fieldset>

        <fieldset>
          <span class="form-step" id="upload-step-badge">Langkah 3</span>
          <legend>Unggah Berkas</legend>

          <div class="field">
            <label>Kartu Pelajar / Surat Keterangan Aktif Sekolah</label>
            <p class="hint" id="kartu-hint" style="margin-top:-4px;">Unggah salah satu: kartu pelajar, atau surat keterangan aktif sekolah kalau kartu pelajar belum ada.</p>
            <div class="upload-field" id="upload-kartu">
              <label class="upload-trigger" for="fileKartu">Pilih berkas (JPG/PNG/PDF, maks 4MB)</label>
              <input type="file" id="fileKartu" name="fileKartu" accept=".jpg,.jpeg,.png,.pdf" />
              <div class="filename" id="filename-kartu">Belum ada berkas dipilih.</div>
            </div>
            <div class="form-error">Kartu Pelajar / Surat Keterangan Aktif Sekolah wajib diunggah.</div>
          </div>

          <div class="field" id="upload-delegasi-wrap" style="display:none;">
            <label>Surat Delegasi dari Sekolah</label>
            <p class="hint" style="margin-top:-4px;">Surat resmi dari sekolah yang menugaskan/mendelegasikan tim ini mengikuti lomba.</p>
            <div class="upload-field" id="upload-delegasi">
              <label class="upload-trigger" for="fileDelegasi">Pilih berkas (JPG/PNG/PDF, maks 4MB)</label>
              <input type="file" id="fileDelegasi" name="fileDelegasi" accept=".jpg,.jpeg,.png,.pdf" />
              <div class="filename" id="filename-delegasi">Belum ada berkas dipilih.</div>
            </div>
            <div class="form-error">Surat Delegasi dari Sekolah wajib diunggah untuk lomba tim.</div>
          </div>

          <div class="field">
            <label>Screenshot Bukti Follow Instagram</label>
            <p class="hint" style="margin-top:-4px;">Follow dulu 2 akun Instagram resmi: <a href="https://instagram.com/al.azzaam.id" target="_blank" rel="noopener">@al.azzaam.id</a> dan <a href="https://instagram.com/alifest.26" target="_blank" rel="noopener">@alifest.26</a>, lalu screenshot halaman profil kedua akun (terlihat tombol "Following"). Minimal 2 berkas (satu per akun), boleh lebih.</p>
            <div class="upload-field" id="upload-ig">
              <label class="upload-trigger" for="fileIg">Pilih berkas (minimal 2, JPG/PNG/PDF, maks 4MB/file)</label>
              <input type="file" id="fileIg" name="fileIg" accept=".jpg,.jpeg,.png,.pdf" multiple />
              <div class="filename" id="filename-ig">Belum ada berkas dipilih.</div>
            </div>
            <div class="form-error">Screenshot bukti follow Instagram wajib diunggah, minimal 2 berkas.</div>
          </div>
        </fieldset>

        <fieldset>
          <label class="checkbox-field">
            <input type="checkbox" id="konfirmasi" name="konfirmasi" required />
            <span>Saya menyatakan data yang diisi sudah benar dan berkas yang diunggah sesuai identitas peserta.</span>
          </label>
          <div class="form-error" id="konfirmasi-error">Centang pernyataan ini sebelum mengirim.</div>
        </fieldset>

        <div class="submit-row">
          <button type="submit" class="btn btn--primary" id="btn-submit">Kirim Pendaftaran</button>
        </div>
      </div>
    </form>

    <div class="result-panel" id="result-panel">
      <div class="result-panel__icon">✅</div>
      <h2>Pendaftaran berhasil dikirim</h2>
      <p>Simpan nomor pendaftaran berikut sebagai bukti:</p>
      <div class="reg-number" id="reg-number">—</div>
      <p id="hasil-catatan">Panitia akan menghubungi melalui WhatsApp untuk info teknis lomba.</p>
      <button type="button" class="btn btn--ghost" id="btn-daftar-lagi">Daftar Peserta Lain</button>
    </div>

  </div>
</main>
`;

function initDaftar() {
  const form = document.getElementById("form-daftar");
  const jenjangSelect = document.getElementById("jenjang");
  const tanggalLahirInput = document.getElementById("tanggalLahir");
  const lomboaChoicesEl = document.getElementById("lomba-choices");
  const lombaErrorEl = document.getElementById("lomba-error");
  const fieldsetIndividu = document.getElementById("fieldset-individu");
  const fieldJenisKelamin = document.getElementById("field-jenis-kelamin");
  const usiaNotice = document.getElementById("usia-notice");
  const bagianLanjutan = document.getElementById("bagian-lanjutan");
  const kontakTambahan = document.getElementById("kontak-tambahan");

  const fieldsetTimInfo = document.getElementById("fieldset-tim-info");
  const fieldsetTimAnggota = document.getElementById("fieldset-tim-anggota");
  const jenjangTimSelect = document.getElementById("jenjangTim");
  const fieldJenjangTim = document.getElementById("field-jenjang-tim");
  const fieldGenderTim = document.getElementById("field-gender-tim");
  const timNotice = document.getElementById("tim-notice");
  const anggotaListEl = document.getElementById("anggota-list");
  const anggotaHintEl = document.getElementById("anggota-hint");
  const btnTambahAnggota = document.getElementById("btn-tambah-anggota");

  const resultPanel = document.getElementById("result-panel");
  const regNumberEl = document.getElementById("reg-number");
  const hasilCatatan = document.getElementById("hasil-catatan");
  const btnSubmit = document.getElementById("btn-submit");
  const btnDaftarLagi = document.getElementById("btn-daftar-lagi");

  let LOMBA_LIST = [];       // diisi dari Supabase saat view dibuka
  let genderCountMap = {};   // { lombaId: { jenjang: { "laki-laki": n, "perempuan": n } } } dari rekap_gender_lomba()
  let selectedLomba = null;
  let anggotaCount = 0;
  let bolehLanjut = false;   // hasil terakhir evaluasiKelayakan()/evaluasiKelayakanTim()
  // Sejak pembaruan ini, toggle "Peserta Individu / Perwakilan Lembaga" sudah
  // dihapus -- form langsung tampil tanpa perlu memilih mode dulu. Server
  // (submit_pendaftaran) tetap menerima parameter p_tipe_pendaftar untuk
  // kompatibilitas ke belakang (data lama), jadi di sini selalu dikirim
  // sebagai "individu" dan p_penanggung_jawab selalu null.
  const tipePendaftar = "individu";

  btnDaftarLagi.addEventListener("click", function () {
    form.reset();
    form.style.display = "block";
    resultPanel.classList.remove("is-visible");
    form.querySelectorAll(".has-error").forEach(function (el) { el.classList.remove("has-error"); });

    ["kartu", "ig", "delegasi"].forEach(function (key) {
      document.getElementById("upload-" + key).classList.remove("has-file");
      document.getElementById("filename-" + key).textContent = "Belum ada berkas dipilih.";
    });
    document.getElementById("fileKartu").removeAttribute("multiple");

    fieldsetIndividu.style.display = "none";
    fieldsetTimInfo.style.display = "none";
    fieldsetTimAnggota.style.display = "none";
    kontakTambahan.style.display = "none";
    usiaNotice.style.display = "none";
    timNotice.style.display = "none";
    selectedLomba = null;
    anggotaListEl.innerHTML = "";
    anggotaCount = 0;
    terapkanLanjutan(false);
    renderLombaChoices(); // segarkan status kuota tiap lomba

    btnSubmit.disabled = false;
    btnSubmit.textContent = "Kirim Pendaftaran";
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  /* ---------------- Link unduh Petunjuk Teknis (kalau sudah diupload admin) ---------------- */
  async function muatLinkJuknis() {
    const wrap = document.getElementById("juknis-link-wrap");
    const { data } = await supabaseClient.from("site_settings").select("juknis_url,juknis_nama").eq("id", 1).single();
    if (data && data.juknis_url) {
      wrap.innerHTML = '<a class="btn btn--ghost" href="' + data.juknis_url + '" target="_blank" rel="noopener" style="margin-top:14px;display:inline-flex;">📄 Unduh Petunjuk Teknis</a>';
    }
  }
  muatLinkJuknis();

  /* ---------------- Kunci form kalau pendaftaran sedang ditutup panitia ---------------- */
  async function cekStatusPendaftaran() {
    const { data } = await supabaseClient.from("site_settings").select("pendaftaran_dibuka,tanggal_tutup_pendaftaran").eq("id", 1).single();
    const status = window.hitungStatusPendaftaranAsli(data);
    const dibukaAsli = status.dibuka;
    // Status navbar/hero selalu mengikuti status ASLI (bukan status uji
    // coba), supaya panitia yang sedang uji coba tetap melihat gembok yang
    // sama seperti yang dilihat pengunjung publik -- pengingat bahwa
    // pendaftaran memang belum benar-benar dibuka.
    if (typeof window.terapkanStatusPendaftaran === "function") window.terapkanStatusPendaftaran(dibukaAsli);

    // Countdown cuma tampil selama pendaftaran ASLI-nya masih dibuka (bukan
    // status uji coba) dan panitia sudah mengisi tanggal tutup otomatisnya.
    if (typeof window.pasangCountdownTutup === "function") {
      window.pasangCountdownTutup(document.getElementById("countdown-tutup-daftar"), dibukaAsli ? status.tanggalTutup : null);
    }

    const ujiCoba = typeof window.ujiCobaAktif === "function" && window.ujiCobaAktif();

    if (!dibukaAsli && !ujiCoba) {
      const shell = document.querySelector(".form-shell");
      if (shell) {
        shell.innerHTML =
          '<div style="text-align:center;padding:20px 0;">' +
            '<div style="font-size:2.4rem;margin-bottom:12px;">🔒</div>' +
            '<h2>Pendaftaran Sedang Ditutup</h2>' +
            '<p>Mohon maaf, pendaftaran ALIF 5.0 sedang tidak dibuka sementara oleh panitia. Silakan cek kembali nanti atau hubungi panitia untuk informasi lebih lanjut.</p>' +
          '</div>';
      }
      return;
    }

    // Lolos gerbang PIN (lihat router.js) tapi pendaftaran ASLI-nya masih
    // ditutup ke publik -- form tetap ditampilkan seperti biasa untuk uji
    // coba, tapi diberi pengingat jelas supaya panitia tidak lupa ini
    // BENAR-BENAR masuk ke database (lihat migrasi 0020).
    if (!dibukaAsli && ujiCoba) {
      const shell = document.querySelector(".form-shell");
      if (shell && !document.getElementById("banner-uji-coba")) {
        const banner = document.createElement("div");
        banner.id = "banner-uji-coba";
        banner.className = "notice notice--warning";
        banner.style.marginBottom = "16px";
        banner.textContent = "🔑 Mode uji coba panitia aktif. Pendaftaran lewat sini SUNGGUHAN masuk ke database (bukan cuma pratinjau) — jangan lupa hapus lagi data uji cobanya di halaman Panitia setelah selesai. Pendaftaran publik tetap TERTUTUP sampai panitia membukanya lewat tombol \"Pendaftaran Dibuka\".";
        shell.prepend(banner);
      }
    }
  }
  cekStatusPendaftaran();

  /* ---------------- Muat data lomba dari Supabase ---------------- */
  async function muatDataLomba() {
    const [{ data: rules, error: errRules }, { data: rekapGender }] = await Promise.all([
      supabaseClient.from("lomba_rules").select("*").eq("aktif", true).order("urutan"),
      supabaseClient.rpc("rekap_gender_lomba")
    ]);

    if (errRules || !rules) {
      lomboaChoicesEl.innerHTML = "<p>Gagal memuat data lomba. Muat ulang halaman ini.</p>";
      console.error(errRules);
      return;
    }

    LOMBA_LIST = rules.map(function (r) {
      return {
        id: r.id,
        nama: r.nama,
        ikon: r.ikon,
        jenjang: r.jenjang,
        usiaPerJenjang: r.usia_per_jenjang || {},
        tipe: r.tipe,
        minAnggota: r.min_anggota,
        maxAnggota: r.max_anggota,
        kuota: r.kuota,
        tanggalPelaksanaan: r.tanggal_pelaksanaan,
        genderDiizinkan: r.gender_diizinkan || "semua"
      };
    });

    genderCountMap = {};
    (rekapGender || []).forEach(function (row) {
      if (!genderCountMap[row.lomba_id]) genderCountMap[row.lomba_id] = {};
      if (!genderCountMap[row.lomba_id][row.jenjang]) genderCountMap[row.lomba_id][row.jenjang] = {};
      genderCountMap[row.lomba_id][row.jenjang][row.jenis_kelamin] = row.jumlah;
    });

    renderLombaChoices();
  }

  /* ---------------- Jenjang dropdown (individu) ---------------- */
  JENJANG_LIST.forEach(function (j) {
    const opt = document.createElement("option");
    opt.value = j;
    opt.textContent = j;
    jenjangSelect.appendChild(opt);
  });

  /* ---------------- Hitung usia pada tanggal acuan tertentu ----------------
     Usia GENAP (dibulatkan ke bawah) -- dipakai murni untuk DITAMPILKAN ke
     pendaftar (mis. "usia peserta 12 tahun"), BUKAN untuk keputusan
     lolos/tidaknya syarat jenjang -- itu tugas cekBatasUsia() di bawah. */
  function hitungUsiaPada(tanggalLahirStr, tanggalAcuanStr) {
    if (!tanggalLahirStr) return null;
    const lahir = new Date(tanggalLahirStr);
    if (isNaN(lahir.getTime())) return null;
    const acuan = tanggalAcuanStr ? new Date(tanggalAcuanStr) : new Date();
    if (isNaN(acuan.getTime())) return null;
    let usia = acuan.getFullYear() - lahir.getFullYear();
    const belumUlangTahun =
      acuan.getMonth() < lahir.getMonth() ||
      (acuan.getMonth() === lahir.getMonth() && acuan.getDate() < lahir.getDate());
    if (belumUlangTahun) usia--;
    return usia;
  }

  /* ---------------- Cek syarat usia jenjang (TIDAK simetris, sampai presisi hari) ----------------
     Dipakai untuk keputusan lolos/tidaknya syarat usia jenjang (individu
     maupun tiap anggota tim). Aturannya SENGAJA tidak simetris antara
     batas bawah & batas atas (hasil klarifikasi langsung dengan panitia):
       - Batas ATAS (usiaMax) KETAT: dihitung dari tanggal ulang tahun
         ke-(usiaMax) peserta (lahir + usiaMax tahun). Begitu tanggal acuan
         (tanggal pelaksanaan lomba) SUDAH LEWAT dari tanggal itu -- walau
         cuma 1 hari -- peserta dianggap TERLALU TUA. Tepat DI hari ulang
         tahun itu sendiri (0 hari lebih) masih dianggap pas & boleh.
         Contoh: lahir 30 Okt 2013, pelaksanaan 31 Okt 2026, usiaMax 13 ->
         ulang tahun ke-13 jatuh 30 Okt 2026, pelaksanaan sehari setelahnya
         -> TERLALU TUA (ditolak). Kalau pelaksanaan-nya PAS 30 Okt 2026,
         masih dianggap pas 13 tahun -> boleh.
       - Batas BAWAH (usiaMin) LONGGAR: dihitung dari tanggal ulang tahun
         ke-(usiaMin - 1) peserta (lahir + (usiaMin-1) tahun). Begitu
         tanggal acuan SUDAH LEWAT dari tanggal itu -- artinya peserta
         sudah masuk "tahun usia ke-usiaMin"-nya walau belum genap --
         sudah dianggap CUKUP UMUR, tidak perlu menunggu sampai persis
         genap usiaMin. Tepat DI hari ulang tahun ke-(usiaMin-1) itu
         sendiri (baru genap usiaMin-1, belum lewat) masih dianggap
         BELUM cukup umur.
         Contoh: lahir 1 Nov 2016, pelaksanaan 31 Okt 2026, usiaMin 10 ->
         umurnya baru 9 tahun 364 hari (sehari lagi genap 10), tapi karena
         sudah lewat dari ulang tahun ke-9 (1 Nov 2025) -> dianggap CUKUP
         UMUR -> boleh.
     Mengembalikan null kalau tanggal lahir/acuan tidak valid, atau objek
     { lolos, terlaluMuda, terlaluTua }. */
  function cekBatasUsia(tanggalLahirStr, tanggalAcuanStr, usiaMin, usiaMax) {
    if (!tanggalLahirStr) return null;
    const lahir = new Date(tanggalLahirStr);
    if (isNaN(lahir.getTime())) return null;
    const acuan = tanggalAcuanStr ? new Date(tanggalAcuanStr) : new Date();
    if (isNaN(acuan.getTime())) return null;

    // PENTING: dikerjakan semua dalam UTC (getUTCFullYear/Date.UTC), BUKAN
    // getFullYear()/new Date(y,m,d) versi lokal -- soalnya tanggal dari
    // <input type="date"> ("YYYY-MM-DD") di-parse JS sebagai tengah malam
    // UTC, sementara new Date(y,m,d) versi lokal membuat tengah malam di
    // zona waktu PERAMBAN (mis. Asia/Jakarta, UTC+7). Mencampur keduanya
    // menggeser ultahMax/ultahMinMinus1 mundur beberapa jam ke HARI
    // SEBELUMNYA setelah dikonversi ke UTC, yang berakibat fatal untuk fitur
    // ini: batas maksimal yang seharusnya PAS (0 hari lebih) malah dianggap
    // sudah lewat 1 hari. Dengan UTC konsisten di kedua sisi, masalah itu
    // tidak muncul, siapa pun zona waktu perangkat pendaftar/panitia.
    const ultahMax = Date.UTC(lahir.getUTCFullYear() + usiaMax, lahir.getUTCMonth(), lahir.getUTCDate());
    const terlaluTua = acuan.getTime() > ultahMax;

    const ultahMinMinus1 = Date.UTC(lahir.getUTCFullYear() + (usiaMin - 1), lahir.getUTCMonth(), lahir.getUTCDate());
    const terlaluMuda = acuan.getTime() <= ultahMinMinus1;

    return { lolos: !terlaluTua && !terlaluMuda, terlaluMuda: terlaluMuda, terlaluTua: terlaluTua };
  }

  // Kuota diisi admin dibagi rata per jenjang lomba itu (2 jenjang -> setengah,
  // 3 jenjang -> sepertiga, dst). Ini angka maksimal untuk SATU sel
  // (jenjang tertentu x gender tertentu). Berlaku sama untuk lomba individu
  // maupun tim (satu tim terhitung 1 slot).
  function kuotaEfektifPerSel(lomba) {
    if (!lomba.kuota) return null;
    const jumlahJenjang = (lomba.jenjang && lomba.jenjang.length) || 1;
    return Math.floor(lomba.kuota / jumlahJenjang);
  }

  // Dipakai di Langkah 1 (jenjang & jenis kelamin belum diketahui) — lomba
  // dianggap penuh hanya kalau SEMUA kombinasi jenjang x gender sudah penuh.
  function kuotaPenuh(lomba) {
    const efektif = kuotaEfektifPerSel(lomba);
    if (efektif === null) return false;
    const jenjangMap = genderCountMap[lomba.id] || {};
    return lomba.jenjang.every(function (j) {
      const g = jenjangMap[j] || {};
      const lakiPenuh = (g["laki-laki"] || 0) >= efektif;
      const perempuanPenuh = (g["perempuan"] || 0) >= efektif;
      return lakiPenuh && perempuanPenuh;
    });
  }

  // Dipakai setelah jenjang & jenis kelamin diketahui (individu maupun tim).
  function kuotaSelPenuh(lomba, jenjang, gender) {
    const efektif = kuotaEfektifPerSel(lomba);
    if (efektif === null) return false;
    const jenjangMap = genderCountMap[lomba.id] || {};
    const g = jenjangMap[jenjang] || {};
    return (g[gender] || 0) >= efektif;
  }

  // Ringkasan kuota untuk kartu pilihan lomba (Langkah 1) — dibuat gamblang:
  // per jenjang, jelas maksimalnya berapa DAN untuk gender apa saja.
  function ringkasanKuota(lomba) {
    const efektif = kuotaEfektifPerSel(lomba);
    if (efektif === null) return "Kuota tidak dibatasi";
    if (lomba.genderDiizinkan !== "semua") {
      return lomba.jenjang.map(function (j) { return j + ": maks " + efektif; }).join(" · ");
    }
    return lomba.jenjang.map(function (j) { return j + ": maks " + efektif + "/putra, " + efektif + "/putri"; }).join(" · ");
  }

  /* ---------------- Render pilihan lomba (Langkah 1) ---------------- */
  function renderLombaChoices() {
    lomboaChoicesEl.innerHTML = LOMBA_LIST.map(function (lomba) {
      const genderLabel = lomba.genderDiizinkan !== "semua" ? (" · Khusus " + lomba.genderDiizinkan) : "";
      const usiaLabel = lomba.jenjang.map(function (j) {
        const r = lomba.usiaPerJenjang[j];
        return r ? (j + " " + r.min + "-" + r.max + "th") : (j + " -");
      }).join(", ");
      return (
        '<div class="lomba-choice" data-id="' + lomba.id + '">' +
          '<label>' +
            '<input type="radio" name="lombaId" value="' + lomba.id + '" />' +
            '<span class="lomba-choice__icon">' + lomba.ikon + '</span>' +
            '<span class="lomba-choice__text">' +
              '<strong>' + lomba.nama + '</strong>' +
              '<span>' + (lomba.tipe === "tim" ? usiaLabel + genderLabel : usiaLabel + genderLabel) + '</span>' +
              '<span class="kuota-chip">' + ringkasanKuota(lomba) + '</span>' +
            '</span>' +
            '<span class="lomba-choice__note"></span>' +
          '</label>' +
        '</div>'
      );
    }).join("");

    LOMBA_LIST.forEach(function (lomba) {
      const wrap = lomboaChoicesEl.querySelector('.lomba-choice[data-id="' + lomba.id + '"]');
      const input = wrap.querySelector('input[type="radio"]');
      const note = wrap.querySelector(".lomba-choice__note");
      if (kuotaPenuh(lomba)) {
        wrap.classList.add("is-disabled", "is-penuh");
        input.disabled = true;
        note.innerHTML = '<span class="badge-penuh">🚫 Kuota Penuh</span>';
      }
    });

    lomboaChoicesEl.querySelectorAll('input[name="lombaId"]').forEach(function (input) {
      input.addEventListener("change", onLombaChange);
    });
  }

  /* ---------------- Siapkan Jenjang/Gender Tim begitu lomba tim dipilih ---------------- */
  function setupJenjangGenderTim() {
    jenjangTimSelect.innerHTML = selectedLomba.jenjang.map(function (j) {
      return '<option value="' + j + '">' + j + '</option>';
    }).join("");

    const perluPilihJenjang = selectedLomba.jenjang.length > 1;
    fieldJenjangTim.style.display = perluPilihJenjang ? "block" : "none";
    jenjangTimSelect.value = selectedLomba.jenjang[0];

    const perluPilihGender = selectedLomba.genderDiizinkan === "semua";
    fieldGenderTim.style.display = perluPilihGender ? "block" : "none";
    if (!perluPilihGender) {
      const radio = document.querySelector('input[name="jenisKelaminTim"][value="' + selectedLomba.genderDiizinkan + '"]');
      if (radio) radio.checked = true;
    } else {
      document.querySelectorAll('input[name="jenisKelaminTim"]').forEach(function (r) { r.checked = false; });
    }
  }

  // Kalau lomba individu ini sudah dikunci ke satu jenis kelamin (bukan
  // "semua"), pilihan Jenis Kelamin tidak perlu ditampilkan -- otomatis
  // dipilihkan sistem, sama seperti perlakuan Jenjang/Jenis Kelamin Tim di
  // formulir tim (lihat setupJenjangGenderTim).
  function setupGenderIndividu() {
    const perluPilihGender = selectedLomba.genderDiizinkan === "semua";
    fieldJenisKelamin.style.display = perluPilihGender ? "block" : "none";
    if (!perluPilihGender) {
      const radio = document.querySelector('input[name="jenisKelamin"][value="' + selectedLomba.genderDiizinkan + '"]');
      if (radio) radio.checked = true;
    } else {
      document.querySelectorAll('input[name="jenisKelamin"]').forEach(function (r) { r.checked = false; });
    }
  }

  /* ---------------- Siapkan input upload Kartu: satu file (individu) vs banyak file (tim) ---------------- */
  function setupUploadKartuLabel() {
    const input = document.getElementById("fileKartu");
    const label = document.querySelector('label[for="fileKartu"]');
    const hint = document.getElementById("kartu-hint");
    const box = document.getElementById("upload-kartu");
    const filenameEl = document.getElementById("filename-kartu");

    input.value = "";
    box.classList.remove("has-file");
    filenameEl.textContent = "Belum ada berkas dipilih.";

    if (selectedLomba && selectedLomba.tipe === "tim") {
      input.setAttribute("multiple", "multiple");
      label.textContent = "Pilih berkas (boleh lebih dari satu, JPG/PNG/PDF, maks 4MB/file)";
      hint.textContent = "Unggah kartu pelajar/surat aktif sekolah SELURUH anggota tim sekaligus dalam satu kali pilih berkas (bisa pilih banyak file).";
    } else {
      input.removeAttribute("multiple");
      label.textContent = "Pilih berkas (JPG/PNG/PDF, maks 4MB)";
      hint.textContent = "Unggah salah satu: kartu pelajar, atau surat keterangan aktif sekolah kalau kartu pelajar belum ada.";
    }
  }

  /* ---------------- Pilih lomba -> tampilkan langkah selanjutnya sesuai tipe ---------------- */
  function onLombaChange() {
    const checked = lomboaChoicesEl.querySelector('input[name="lombaId"]:checked');
    selectedLomba = checked ? LOMBA_LIST.find(function (l) { return l.id === checked.value; }) : null;

    fieldsetIndividu.style.display = "none";
    fieldsetTimInfo.style.display = "none";
    kontakTambahan.style.display = "none";
    terapkanLanjutan(false);

    if (!selectedLomba) return;

    kontakTambahan.style.display = "block";
    setupUploadKartuLabel();

    if (selectedLomba.tipe === "tim") {
      fieldsetTimInfo.style.display = "block";
      setupJenjangGenderTim();
      resetAnggota(selectedLomba.minAnggota);
      evaluasiKelayakanTim();
    } else {
      fieldsetIndividu.style.display = "block";
      setupGenderIndividu();
      evaluasiKelayakan();
    }
  }

  /* ---------------- Tampilkan/sembunyikan bagian lanjutan (upload + submit) ---------------- */
  function terapkanLanjutan(visible) {
    bolehLanjut = visible;
    bagianLanjutan.style.display = visible ? "block" : "none";
    const isTim = !!(selectedLomba && selectedLomba.tipe === "tim");
    fieldsetTimAnggota.style.display = (visible && isTim) ? "block" : "none";
    document.getElementById("upload-step-badge").textContent = isTim ? "Langkah 4" : "Langkah 3";
    document.getElementById("upload-delegasi-wrap").style.display = isTim ? "block" : "none";
  }

  function tampilkanNotice(jenis, teks) {
    usiaNotice.className = "notice notice--" + jenis;
    usiaNotice.textContent = teks;
    usiaNotice.style.display = "block";
  }

  function tampilkanNoticeTim(jenis, teks) {
    timNotice.className = "notice notice--" + jenis;
    timNotice.textContent = teks;
    timNotice.style.display = "block";
  }

  /* ---------------- Kelayakan: lomba INDIVIDU (cek jenjang, gender, kuota, usia) ---------------- */
  function evaluasiKelayakan() {
    if (!selectedLomba) {
      usiaNotice.style.display = "none";
      terapkanLanjutan(false);
      return;
    }

    const jenjang = jenjangSelect.value;
    const tgl = tanggalLahirInput.value;
    const genderChecked = document.querySelector('input[name="jenisKelamin"]:checked');
    const gender = genderChecked ? genderChecked.value : "";

    if (!jenjang || !tgl || !gender) {
      usiaNotice.style.display = "none";
      terapkanLanjutan(false);
      return;
    }

    if (selectedLomba.jenjang.indexOf(jenjang) === -1) {
      tampilkanNotice("error", "Jenjang " + jenjang + " tidak termasuk syarat lomba ini (" + selectedLomba.jenjang.join("/") + "). Silakan pilih cabang lomba lain.");
      terapkanLanjutan(false);
      return;
    }

    if (selectedLomba.genderDiizinkan !== "semua" && gender !== selectedLomba.genderDiizinkan) {
      tampilkanNotice("error", "Lomba ini khusus peserta " + selectedLomba.genderDiizinkan + ". Silakan pilih cabang lomba lain.");
      terapkanLanjutan(false);
      return;
    }

    if (kuotaSelPenuh(selectedLomba, jenjang, gender)) {
      tampilkanNotice("error", "Mohon maaf, kuota peserta " + gender + " jenjang " + jenjang + " untuk lomba ini sudah penuh. Silakan pilih cabang lomba lain.");
      terapkanLanjutan(false);
      return;
    }

    const syaratUsia = selectedLomba.usiaPerJenjang[jenjang];
    if (!syaratUsia) {
      tampilkanNotice("error", "Syarat usia untuk jenjang " + jenjang + " belum diatur panitia untuk lomba ini. Silakan hubungi panitia.");
      terapkanLanjutan(false);
      return;
    }

    // TIDAK ADA toleransi sama sekali -- lihat cekBatasUsia() untuk aturan
    // lengkapnya (batas atas ketat sampai ke hari, batas bawah longgar
    // begitu sudah lewat ulang tahun ke usiaMin-1). Server (submit_pendaftaran,
    // migrasi 0024) mengulang pengecekan yang sama persis, jadi ini bukan
    // cuma validasi tampilan.
    const usiaMin = syaratUsia.min;
    const usiaMax = syaratUsia.max;
    const usiaGenap = hitungUsiaPada(tgl, selectedLomba.tanggalPelaksanaan);
    const cek = cekBatasUsia(tgl, selectedLomba.tanggalPelaksanaan, usiaMin, usiaMax);
    const keteranganAcuan = selectedLomba.tanggalPelaksanaan ? " pada tanggal pelaksanaan lomba" : "";

    if (cek && cek.lolos) {
      usiaNotice.style.display = "none";
      terapkanLanjutan(true);
    } else if (cek && cek.terlaluTua) {
      tampilkanNotice("error",
        "Mohon maaf, usia peserta (" + usiaGenap + " tahun" + keteranganAcuan + ") sudah melebihi batas maksimal jenjang " + jenjang + " (" +
        usiaMin + "–" + usiaMax + " tahun) untuk lomba ini, walau cuma selisih beberapa hari dari batas usia maksimal. Silakan pilih cabang lomba lain yang sesuai.");
      terapkanLanjutan(false);
    } else if (cek && cek.terlaluMuda) {
      tampilkanNotice("error",
        "Mohon maaf, usia peserta (" + usiaGenap + " tahun" + keteranganAcuan + ") belum memenuhi batas minimal jenjang " + jenjang + " (" +
        usiaMin + "–" + usiaMax + " tahun) untuk lomba ini. Silakan pilih cabang lomba lain yang sesuai.");
      terapkanLanjutan(false);
    } else {
      tampilkanNotice("error", "Tanggal lahir tidak valid. Mohon periksa kembali.");
      terapkanLanjutan(false);
    }
  }

  /* ---------------- Kelayakan: lomba TIM (cek jenjang, gender, kuota, DAN usia semua anggota) ----------------
     Usia SETIAP anggota tim dicek dengan aturan yang SAMA PERSIS dengan
     lomba individu -- lihat cekBatasUsia() (batas atas ketat sampai ke
     hari, batas bawah longgar begitu sudah lewat ulang tahun ke usiaMin-1).
     Bedanya dengan individu: field Data Anggota & Upload Berkas TETAP
     ditampilkan kalau ada anggota yang usianya bermasalah (supaya bisa
     diperbaiki langsung), yang diblokir cuma pengiriman formnya
     (bolehLanjut) -- lihat perbaruiUsiaAnggota() di bawah. */
  function evaluasiKelayakanTim() {
    if (!selectedLomba) {
      timNotice.style.display = "none";
      terapkanLanjutan(false);
      return;
    }

    const jenjang = jenjangTimSelect.value;
    const genderChecked = document.querySelector('input[name="jenisKelaminTim"]:checked');
    const gender = genderChecked ? genderChecked.value : "";

    if (!jenjang || !gender) {
      timNotice.style.display = "none";
      terapkanLanjutan(false);
      return;
    }

    if (kuotaSelPenuh(selectedLomba, jenjang, gender)) {
      tampilkanNoticeTim("error", "Mohon maaf, kuota tim " + gender + " jenjang " + jenjang + " untuk lomba ini sudah penuh. Silakan hubungi panitia.");
      terapkanLanjutan(false);
      return;
    }

    // Tampilkan dulu bagian anggota & upload -- SEBELUM cek usia -- supaya
    // kalaupun ada anggota yang usianya bermasalah, field-nya tetap terlihat
    // (tidak ikut disembunyikan) dan bisa langsung diperbaiki oleh pendaftar.
    terapkanLanjutan(true);

    const syaratUsia = selectedLomba.usiaPerJenjang[jenjang];
    const anggotaBermasalah = perbaruiUsiaAnggota(syaratUsia);

    if (syaratUsia && anggotaBermasalah.length > 0) {
      tampilkanNoticeTim("error",
        "Usia anggota berikut di luar syarat jenjang " + jenjang + " (" + syaratUsia.min + "–" + syaratUsia.max + " tahun" +
        (selectedLomba.tanggalPelaksanaan ? ", dihitung pada tanggal pelaksanaan lomba" : "") + "): " +
        anggotaBermasalah.join(", ") + ". Mohon perbaiki tanggal lahirnya sebelum mengirim, atau pilih jenjang lain.");
      bolehLanjut = false; // field tetap tampil (lihat komentar di atas), cuma pengiriman yang diblokir
    } else {
      timNotice.style.display = "none";
    }
  }

  // Menghitung & menandai usia tiap baris anggota terhadap syaratUsia
  // (jenjang tim yang sedang dipilih), mengembalikan daftar nama anggota
  // yang usianya di luar syarat. Baris yang tanggal lahirnya belum diisi
  // dilewati (belum bisa dinilai). Dipanggil dari evaluasiKelayakanTim()
  // setiap kali jenjang/tanggal lahir anggota berubah, atau baris
  // ditambah/dihapus.
  function perbaruiUsiaAnggota(syaratUsia) {
    const bermasalah = [];
    Array.from(anggotaListEl.children).forEach(function (row, idx) {
      const tglVal = row.querySelector(".anggota-tgl").value;
      const usiaEl = row.querySelector(".anggota-usia");
      if (!tglVal) {
        usiaEl.textContent = "";
        usiaEl.classList.remove("anggota-usia--error");
        return;
      }
      const usia = hitungUsiaPada(tglVal, selectedLomba.tanggalPelaksanaan);
      if (usia === null || isNaN(usia)) {
        usiaEl.textContent = "";
        usiaEl.classList.remove("anggota-usia--error");
        return;
      }
      const cek = syaratUsia ? cekBatasUsia(tglVal, selectedLomba.tanggalPelaksanaan, syaratUsia.min, syaratUsia.max) : null;
      const diLuarSyarat = !!(cek && !cek.lolos);
      usiaEl.textContent = usia + " th" + (diLuarSyarat ? " ⚠️" : "");
      usiaEl.classList.toggle("anggota-usia--error", diLuarSyarat);
      if (diLuarSyarat) {
        const namaVal = row.querySelector(".anggota-nama").value.trim() || ("Anggota " + (idx + 1));
        bermasalah.push(namaVal);
      }
    });
    return bermasalah;
  }

  jenjangSelect.addEventListener("change", evaluasiKelayakan);
  tanggalLahirInput.addEventListener("change", evaluasiKelayakan);
  document.querySelectorAll('input[name="jenisKelamin"]').forEach(function (radio) {
    radio.addEventListener("change", evaluasiKelayakan);
  });
  jenjangTimSelect.addEventListener("change", evaluasiKelayakanTim);
  document.querySelectorAll('input[name="jenisKelaminTim"]').forEach(function (radio) {
    radio.addEventListener("change", evaluasiKelayakanTim);
  });

  /* ---------------- Anggota tim (dinamis): Nama, Tempat Lahir, Tanggal Lahir, Kelas ----------------
     Tanggal lahir dipakai input tanggal ASLI, dan sejak pembaruan ini usia
     yang dihitung dari situ SUNGGUHAN dicek terhadap syarat jenjang yang
     dipilih (bukan cuma informasi buat panitia lagi seperti sebelumnya) --
     lihat evaluasiKelayakanTim() & perbaruiUsiaAnggota() di atas. */
  function buatBarisAnggota(index) {
    const row = document.createElement("div");
    row.className = "anggota-row";
    row.innerHTML =
      '<input type="text" placeholder="Nama lengkap peserta ' + index + ' (sesuai akte)" class="anggota-nama" required />' +
      '<input type="text" placeholder="Tempat lahir" class="anggota-tempat" required />' +
      '<span class="anggota-tgl-wrap">' +
        '<input type="date" class="anggota-tgl" required />' +
        '<small class="anggota-usia"></small>' +
      '</span>' +
      '<input type="text" placeholder="Kelas" class="anggota-kelas" required />' +
      '<button type="button" class="btn-remove">Hapus</button>';

    const inputTgl = row.querySelector(".anggota-tgl");
    inputTgl.addEventListener("change", evaluasiKelayakanTim);

    row.querySelector(".btn-remove").addEventListener("click", function () {
      if (!selectedLomba) return;
      if (anggotaListEl.children.length <= selectedLomba.minAnggota) return;
      row.remove();
      anggotaCount--;
      updateAnggotaHint();
      evaluasiKelayakanTim();
    });
    return row;
  }

  function resetAnggota(jumlahAwal) {
    anggotaListEl.innerHTML = "";
    anggotaCount = 0;
    for (let i = 0; i < jumlahAwal; i++) {
      anggotaListEl.appendChild(buatBarisAnggota(anggotaCount + 1));
      anggotaCount++;
    }
    updateAnggotaHint();
  }

  btnTambahAnggota.addEventListener("click", function () {
    if (!selectedLomba) return;
    if (anggotaCount >= selectedLomba.maxAnggota) return;
    anggotaListEl.appendChild(buatBarisAnggota(anggotaCount + 1));
    anggotaCount++;
    updateAnggotaHint();
    evaluasiKelayakanTim();
  });

  function updateAnggotaHint() {
    if (!selectedLomba) return;
    anggotaHintEl.textContent =
      "Anggota saat ini: " + anggotaCount + " (minimal " + selectedLomba.minAnggota +
      ", maksimal " + selectedLomba.maxAnggota + ")";
    btnTambahAnggota.disabled = anggotaCount >= selectedLomba.maxAnggota;
  }

  /* ---------------- Upload berkas (validasi lokal) ---------------- */
  function setupUpload(inputId, boxId, filenameId) {
    const input = document.getElementById(inputId);
    const box = document.getElementById(boxId);
    const filenameEl = document.getElementById(filenameId);

    input.addEventListener("change", function () {
      const file = input.files[0];
      if (!file) {
        box.classList.remove("has-file");
        filenameEl.textContent = "Belum ada berkas dipilih.";
        return;
      }
      const sizeOk = file.size <= MAX_FILE_SIZE_MB * 1024 * 1024;
      const typeOk = ALLOWED_FILE_TYPES.indexOf(file.type) !== -1;

      if (!sizeOk) {
        filenameEl.textContent = "Ukuran berkas melebihi " + MAX_FILE_SIZE_MB + "MB. Pilih berkas lain.";
        box.classList.remove("has-file");
        input.value = "";
        return;
      }
      if (!typeOk) {
        filenameEl.textContent = "Format tidak didukung. Gunakan JPG, PNG, atau PDF.";
        box.classList.remove("has-file");
        input.value = "";
        return;
      }
      filenameEl.textContent = file.name;
      box.classList.add("has-file");
    });
  }

  // Kartu pelajar/surat aktif: butuh penanganan khusus karena bisa banyak
  // file sekaligus (lomba tim) ATAU satu file saja (lomba individu),
  // tergantung atribut "multiple" yang diatur oleh setupUploadKartuLabel().
  function setupUploadKartu() {
    const input = document.getElementById("fileKartu");
    const box = document.getElementById("upload-kartu");
    const filenameEl = document.getElementById("filename-kartu");

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
            : ('Format "' + file.name + '" tidak didukung. Gunakan JPG, PNG, atau PDF.');
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

  // Bukti follow IG: sama seperti Kartu Pelajar tim -- selalu bisa pilih
  // banyak file sekaligus, tapi di sini WAJIB minimal 2 file (lihat migrasi
  // 0021: submit_pendaftaran menolak kalau array-nya kurang dari 2 elemen).
  function setupUploadIg() {
    const input = document.getElementById("fileIg");
    const box = document.getElementById("upload-ig");
    const filenameEl = document.getElementById("filename-ig");

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
            : ('Format "' + file.name + '" tidak didukung. Gunakan JPG, PNG, atau PDF.');
          box.classList.remove("has-file");
          input.value = "";
          return;
        }
      }
      const daftarNama = files.length + " berkas dipilih: " + files.map(function (f) { return f.name; }).join(", ");
      if (files.length < 2) {
        filenameEl.textContent = daftarNama + " — minimal 2 berkas, pilih tambahan lagi.";
        box.classList.remove("has-file");
        return;
      }
      filenameEl.textContent = daftarNama;
      box.classList.add("has-file");
    });
  }

  setupUploadKartu();
  setupUploadIg();
  setupUpload("fileDelegasi", "upload-delegasi", "filename-delegasi");

  /* ---------------- Upload ke Supabase Storage ---------------- */
  function ekstensi(file) {
    const bagian = file.name.split(".");
    return bagian.length > 1 ? bagian.pop() : "bin";
  }

  // Nama tim dijadikan bagian dari nama file yang tersimpan di Storage,
  // supaya berkas milik tim tertentu langsung terlihat namanya dari daftar
  // file (bukan nama acak) — dibersihkan dulu dari karakter yang tidak aman
  // untuk nama file.
  function namaFileAman(teks) {
    const bersih = String(teks || "").toLowerCase().trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    return bersih || "tim";
  }

  async function uploadKeStorage(file, label) {
    const path = "sementara/" + Date.now() + "-" + Math.random().toString(36).slice(2) + "-" + label + "." + ekstensi(file);
    const { error } = await supabaseClient.storage.from(STORAGE_BUCKET).upload(path, file, {
      contentType: file.type,
      upsert: false
    });
    if (error) {
      console.error("Detail error upload (" + label + "):", error);
      let detail = "";
      try { detail = " | detail: " + JSON.stringify(error); } catch (e) { detail = ""; }
      throw new Error("Gagal mengunggah " + label + ": " + error.message + detail);
    }
    const { data } = supabaseClient.storage.from(STORAGE_BUCKET).getPublicUrl(path);
    return data.publicUrl;
  }

  /* ---------------- Validasi & kirim ---------------- */
  function setFieldError(fieldEl, hasError) {
    fieldEl.classList.toggle("has-error", hasError);
  }

  function validateForm() {
    let valid = true;
    const isTim = !!(selectedLomba && selectedLomba.tipe === "tim");

    const lombaChecked = lomboaChoicesEl.querySelector('input[name="lombaId"]:checked');
    lombaErrorEl.style.display = lombaChecked ? "none" : "block";
    if (!lombaChecked) valid = false;

    if (isTim) {
      ["namaTim", "pembina", "whatsappTim"].forEach(function (id) {
        const input = document.getElementById(id);
        const fieldEl = input.closest(".field");
        const ok = input.value.trim() !== "";
        setFieldError(fieldEl, !ok);
        if (!ok) valid = false;
      });
      if (!jenjangTimSelect.value) valid = false;
      if (!document.querySelector('input[name="jenisKelaminTim"]:checked')) valid = false;
    } else {
      ["namaLengkap", "jenjang", "kelas", "tanggalLahir", "whatsapp", "asalSekolah"].forEach(function (id) {
        const input = document.getElementById(id);
        const fieldEl = input.closest(".field");
        const ok = input.value.trim() !== "";
        setFieldError(fieldEl, !ok);
        if (!ok) valid = false;
      });

      const genderOk = !!document.querySelector('input[name="jenisKelamin"]:checked');
      document.getElementById("jenis-kelamin-error").style.display = genderOk ? "none" : "block";
      if (!genderOk) valid = false;
    }

    if (!bolehLanjut) valid = false;

    if (isTim) {
      const rows = anggotaListEl.querySelectorAll(".anggota-row");
      rows.forEach(function (row) {
        const nama = row.querySelector(".anggota-nama");
        const tempat = row.querySelector(".anggota-tempat");
        const tgl = row.querySelector(".anggota-tgl");
        const kelas = row.querySelector(".anggota-kelas");
        const ok = nama.value.trim() !== "" && tempat.value.trim() !== "" && tgl.value !== "" && kelas.value.trim() !== "";
        [nama, tempat, tgl, kelas].forEach(function (el) { el.style.borderColor = ok ? "" : "var(--danger)"; });
        if (!ok) valid = false;
      });
    }

    const fileKartu = document.getElementById("fileKartu");
    const fileKartuField = fileKartu.closest(".field");
    const kartuOk = fileKartu.files.length > 0 && fileKartu.closest(".upload-field").classList.contains("has-file");
    setFieldError(fileKartuField, !kartuOk);
    if (!kartuOk) valid = false;

    const fileIg = document.getElementById("fileIg");
    const fileIgField = fileIg.closest(".field");
    const igOk = fileIg.files.length >= 2 && fileIg.closest(".upload-field").classList.contains("has-file");
    setFieldError(fileIgField, !igOk);
    if (!igOk) valid = false;

    if (isTim) {
      const fileDelegasi = document.getElementById("fileDelegasi");
      const fileDelegasiField = fileDelegasi.closest(".field");
      const delegasiOk = fileDelegasi.files.length > 0 && fileDelegasi.closest(".upload-field").classList.contains("has-file");
      setFieldError(fileDelegasiField, !delegasiOk);
      if (!delegasiOk) valid = false;
    }

    const konfirmasi = document.getElementById("konfirmasi");
    document.getElementById("konfirmasi-error").style.display = konfirmasi.checked ? "none" : "block";
    if (!konfirmasi.checked) valid = false;

    return valid;
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (!validateForm()) {
      const firstError = form.querySelector(".has-error, #lomba-error[style*='block']");
      if (firstError) firstError.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    if (SUPABASE_URL.indexOf("GANTI_DENGAN") !== -1) {
      alert("SUPABASE_URL / SUPABASE_ANON_KEY di assets/js/config.js belum diisi. Lihat README.md.");
      return;
    }

    btnSubmit.disabled = true;
    btnSubmit.textContent = "Mengirim...";

    const isTim = selectedLomba.tipe === "tim";
    const namaTimVal = isTim ? document.getElementById("namaTim").value.trim() : "";
    const labelDasar = isTim ? namaFileAman(namaTimVal) : "";
    const fileIgList = Array.from(document.getElementById("fileIg").files || []);

    let uploadTugas;
    if (isTim) {
      const fileDelegasi = document.getElementById("fileDelegasi").files[0];
      const fileKartuList = Array.from(document.getElementById("fileKartu").files || []);
      uploadTugas = Promise.all(
        fileKartuList.map(function (f, i) { return uploadKeStorage(f, labelDasar + "-kartu-" + (i + 1)); })
      ).then(function (urlsKartu) {
        return Promise.all([
          Promise.all(fileIgList.map(function (f, i) { return uploadKeStorage(f, labelDasar + "-bukti-ig-" + (i + 1)); })),
          uploadKeStorage(fileDelegasi, labelDasar + "-delegasi")
        ]).then(function (hasilLain) {
          return { urlKartuTunggal: null, urlBerkasTim: urlsKartu, urlIgArray: hasilLain[0], urlDelegasi: hasilLain[1] };
        });
      });
    } else {
      const fileKartuTunggal = document.getElementById("fileKartu").files[0];
      uploadTugas = Promise.all([
        uploadKeStorage(fileKartuTunggal, "kartu-pelajar"),
        Promise.all(fileIgList.map(function (f, i) { return uploadKeStorage(f, "bukti-follow-ig-" + (i + 1)); }))
      ]).then(function (hasil) {
        return { urlKartuTunggal: hasil[0], urlBerkasTim: [], urlIgArray: hasil[1], urlDelegasi: null };
      });
    }

    uploadTugas
      .then(function (u) {
        const anggotaTim = isTim
          ? Array.from(anggotaListEl.querySelectorAll(".anggota-row")).map(function (row) {
              return {
                nama: row.querySelector(".anggota-nama").value.trim(),
                tempat_lahir: row.querySelector(".anggota-tempat").value.trim(),
                tanggal_lahir: row.querySelector(".anggota-tgl").value,
                kelas: row.querySelector(".anggota-kelas").value.trim()
              };
            })
          : [];

        const jenjangVal = isTim ? jenjangTimSelect.value : jenjangSelect.value;
        const genderChecked = document.querySelector('input[name="' + (isTim ? "jenisKelaminTim" : "jenisKelamin") + '"]:checked');

        return supabaseClient.rpc("submit_pendaftaran", {
          p_lomba_id: selectedLomba.id,
          p_tipe_pendaftar: tipePendaftar,
          p_penanggung_jawab: null,
          p_nama_lengkap: isTim ? namaTimVal : document.getElementById("namaLengkap").value.trim(),
          p_jenjang: jenjangVal,
          p_kelas: isTim ? null : document.getElementById("kelas").value.trim(),
          p_jenis_kelamin: genderChecked ? genderChecked.value : null,
          p_tanggal_lahir: isTim ? null : document.getElementById("tanggalLahir").value,
          p_asal_sekolah: isTim ? namaTimVal : document.getElementById("asalSekolah").value.trim(),
          p_whatsapp: isTim ? document.getElementById("whatsappTim").value.trim() : document.getElementById("whatsapp").value.trim(),
          p_email: document.getElementById("email").value.trim(),
          p_nama_tim: isTim ? namaTimVal : null,
          p_pembina: isTim ? document.getElementById("pembina").value.trim() : null,
          p_url_kartu_pelajar: u.urlKartuTunggal,
          p_url_bukti_follow_ig: u.urlIgArray,
          p_url_surat_delegasi: u.urlDelegasi,
          p_anggota_tim: anggotaTim,
          p_url_berkas_tim: u.urlBerkasTim,
          // Kosong/null kalau bukan mode uji coba -- server tetap aman kalau
          // pendaftaran memang sedang dibuka (parameter ini diabaikan),
          // lihat migrasi 0020.
          p_kode_uji_coba: (typeof window.ujiCobaAktif === "function" && window.ujiCobaAktif()) ? window.KODE_UJI_COBA_PANITIA : null,
          // Field baru (migrasi 0027): nama pendamping, HANYA untuk lomba
          // INDIVIDU (terpisah dari p_pembina yang khusus lomba tim). Opsional,
          // dikirim null kalau kosong atau kalau ini pendaftaran tim.
          p_nama_pendamping: isTim ? null : document.getElementById("namaPendamping").value.trim()
        });
      })
      .then(function (res) {
        if (res.error) throw new Error(res.error.message);
        const data = res.data;
        if (data.success) {
          form.style.display = "none";
          regNumberEl.textContent = data.nomor_pendaftaran || "-";
          if (data.status === "Perlu Verifikasi Usia") {
            hasilCatatan.textContent = "Usia peserta sedikit di luar ketentuan, jadi pendaftaran ini akan diverifikasi manual oleh panitia sebelum dipastikan diterima. Panitia akan menghubungi lewat WhatsApp.";
          } else {
            hasilCatatan.textContent = "Panitia akan menghubungi melalui WhatsApp untuk info teknis lomba.";
          }
          resultPanel.classList.add("is-visible");
          resultPanel.scrollIntoView({ behavior: "smooth", block: "start" });
        } else {
          alert("Pendaftaran gagal: " + (data.message || "Terjadi kesalahan, coba lagi."));
          btnSubmit.disabled = false;
          btnSubmit.textContent = "Kirim Pendaftaran";
        }
      })
      .catch(function (err) {
        console.error(err);
        alert("Gagal mengirim data: " + err.message);
        btnSubmit.disabled = false;
        btnSubmit.textContent = "Kirim Pendaftaran";
      });
  });

  muatDataLomba();
}

window.ViewDaftar = { template: DAFTAR_TEMPLATE, init: initDaftar };
