// View: Form Pendaftaran ("#/daftar")
//
// Urutan sengaja: pilih lomba DULU (Langkah 1), baru Data Diri termasuk
// tanggal lahir (Langkah 2). Begitu jenjang & tanggal lahir terisi, sistem
// mengecek usia terhadap tanggal pelaksanaan lomba (diatur panitia):
//   - sesuai syarat           -> lanjut normal
//   - meleset tapi masih dalam toleransi -> tetap boleh lanjut, dengan
//     peringatan bahwa pendaftaran akan diverifikasi manual
//   - meleset lebih dari toleransi -> langsung ditolak di sini, bagian
//     selanjutnya (upload berkas, kirim) tetap disembunyikan
// Pengecekan ini diulang lagi secara otentik di database (fungsi
// submit_pendaftaran) supaya tidak bisa dilewati dari browser.

const DAFTAR_TEMPLATE = `
<main class="form-page container">
  <div class="form-header">
    <h1>Formulir Pendaftaran</h1>
    <p>Pilih cabang lomba dulu, baru isi data diri. Kecocokan usia dicek otomatis begitu tanggal lahir diisi.</p>
    <div id="juknis-link-wrap"></div>
  </div>

  <div class="form-shell">

    <form id="form-daftar" novalidate>

      <div class="admin-tabs" id="mode-toggle" style="margin-bottom:24px;">
        <button type="button" class="admin-tab is-active" data-mode="individu">Peserta Individu</button>
        <button type="button" class="admin-tab" data-mode="lembaga">Perwakilan Lembaga/Sekolah</button>
      </div>

      <fieldset>
        <span class="form-step">Langkah 1</span>
        <legend>Pilih Cabang Lomba</legend>
        <div class="lomba-choices" id="lomba-choices"></div>
        <div class="form-error" id="lomba-error" style="margin-top:10px;">Pilih salah satu cabang lomba.</div>
      </fieldset>

      <fieldset id="fieldset-data-diri" style="display:none;">
        <span class="form-step">Langkah 2</span>
        <legend>Data Diri Peserta</legend>

        <div class="field">
          <label for="namaLengkap">Nama Lengkap</label>
          <input type="text" id="namaLengkap" name="namaLengkap" required />
          <div class="form-error">Nama lengkap wajib diisi.</div>
        </div>

        <div class="field-row">
          <div class="field">
            <label for="jenjang">Jenjang</label>
            <select id="jenjang" name="jenjang" required>
              <option value="">Pilih jenjang</option>
            </select>
            <div class="form-error">Pilih jenjang peserta.</div>
          </div>
          <div class="field">
            <label for="kelas">Kelas</label>
            <input type="text" id="kelas" name="kelas" placeholder="mis. VIII / 5 SD" required />
            <div class="form-error">Kelas wajib diisi.</div>
          </div>
        </div>

        <div class="field">
          <label>Jenis Kelamin</label>
          <div>
            <label style="font-weight:400;display:inline-flex;align-items:center;gap:6px;margin-right:18px;">
              <input type="radio" name="jenisKelamin" value="laki-laki" required /> Laki-laki
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
            <input type="date" id="tanggalLahir" name="tanggalLahir" required />
            <div class="form-error">Tanggal lahir wajib diisi.</div>
          </div>
          <div class="field">
            <label for="whatsapp">No. WhatsApp Aktif</label>
            <input type="tel" id="whatsapp" name="whatsapp" placeholder="08xxxxxxxxxx" required />
            <div class="form-error">Nomor WhatsApp wajib diisi.</div>
          </div>
        </div>

        <div class="field">
          <label for="asalSekolah">Asal Sekolah</label>
          <input type="text" id="asalSekolah" name="asalSekolah" required />
          <div class="form-error">Asal sekolah wajib diisi.</div>
        </div>

        <div class="field" id="field-penanggung-jawab" style="display:none;">
          <label for="penanggungJawab">Nama Penanggung Jawab / Koordinator</label>
          <input type="text" id="penanggungJawab" name="penanggungJawab" placeholder="Nama guru/koordinator yang mendaftarkan" />
          <div class="form-error">Nama penanggung jawab wajib diisi untuk pendaftaran perwakilan lembaga.</div>
        </div>

        <div class="field">
          <label for="email">Email (opsional)</label>
          <input type="email" id="email" name="email" />
        </div>

        <div class="notice" id="usia-notice" style="display:none;"></div>
      </fieldset>

      <div id="bagian-lanjutan" style="display:none;">

        <fieldset id="fieldset-tim" style="display:none;">
          <span class="form-step">Khusus Lomba Tim</span>
          <legend>Data Tim</legend>

          <div class="field-row">
            <div class="field">
              <label for="namaTim">Nama Tim</label>
              <input type="text" id="namaTim" name="namaTim" />
              <div class="form-error">Nama tim wajib diisi.</div>
            </div>
            <div class="field">
              <label for="pembina">Guru Pendamping</label>
              <input type="text" id="pembina" name="pembina" />
              <div class="form-error">Nama guru pendamping wajib diisi.</div>
            </div>
          </div>

          <div class="field">
            <label>Anggota Tim</label>
            <div class="anggota-list" id="anggota-list"></div>
            <button type="button" class="btn-add" id="btn-tambah-anggota">+ Tambah anggota</button>
            <div class="hint" id="anggota-hint"></div>
          </div>
        </fieldset>

        <fieldset>
          <span class="form-step">Langkah 3</span>
          <legend>Unggah Berkas</legend>

          <div class="field">
            <label>Surat Keterangan Aktif Sekolah</label>
            <div class="upload-field" id="upload-surat">
              <label class="upload-trigger" for="fileSurat">Pilih berkas (JPG/PNG/PDF, maks 4MB)</label>
              <input type="file" id="fileSurat" name="fileSurat" accept=".jpg,.jpeg,.png,.pdf" />
              <div class="filename" id="filename-surat">Belum ada berkas dipilih.</div>
            </div>
            <div class="form-error">Surat Keterangan Aktif Sekolah wajib diunggah.</div>
          </div>

          <div class="field">
            <label>Kartu Pelajar</label>
            <div class="upload-field" id="upload-kartu">
              <label class="upload-trigger" for="fileKartu">Pilih berkas (JPG/PNG/PDF, maks 4MB)</label>
              <input type="file" id="fileKartu" name="fileKartu" accept=".jpg,.jpeg,.png,.pdf" />
              <div class="filename" id="filename-kartu">Belum ada berkas dipilih.</div>
            </div>
            <div class="form-error">Kartu Pelajar wajib diunggah.</div>
          </div>

          <div class="field">
            <label>Screenshot Bukti Follow Instagram</label>
            <p class="hint" style="margin-top:-4px;">Follow dulu 2 akun Instagram resmi: <a href="https://instagram.com/al.azzaam.id" target="_blank" rel="noopener">@al.azzaam.id</a> dan <a href="https://instagram.com/alifest.26" target="_blank" rel="noopener">@alifest.26</a>, lalu screenshot halaman profil kedua akun (terlihat tombol "Following").</p>
            <div class="upload-field" id="upload-ig">
              <label class="upload-trigger" for="fileIg">Pilih berkas (JPG/PNG, maks 4MB)</label>
              <input type="file" id="fileIg" name="fileIg" accept=".jpg,.jpeg,.png,.pdf" />
              <div class="filename" id="filename-ig">Belum ada berkas dipilih.</div>
            </div>
            <div class="form-error">Screenshot bukti follow Instagram wajib diunggah.</div>
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
  const fieldsetDataDiri = document.getElementById("fieldset-data-diri");
  const usiaNotice = document.getElementById("usia-notice");
  const bagianLanjutan = document.getElementById("bagian-lanjutan");
  const modeToggle = document.getElementById("mode-toggle");
  const fieldPenanggungJawab = document.getElementById("field-penanggung-jawab");

  const fieldsetTim = document.getElementById("fieldset-tim");
  const anggotaListEl = document.getElementById("anggota-list");
  const anggotaHintEl = document.getElementById("anggota-hint");
  const btnTambahAnggota = document.getElementById("btn-tambah-anggota");

  const resultPanel = document.getElementById("result-panel");
  const regNumberEl = document.getElementById("reg-number");
  const hasilCatatan = document.getElementById("hasil-catatan");
  const btnSubmit = document.getElementById("btn-submit");
  const btnDaftarLagi = document.getElementById("btn-daftar-lagi");

  let LOMBA_LIST = [];       // diisi dari Supabase saat view dibuka
  let genderCountMap = {};   // { lombaId: { "laki-laki": n, "perempuan": n } } dari rekap_gender_lomba()
  let selectedLomba = null;
  let anggotaCount = 0;
  let bolehLanjut = false;   // hasil terakhir evaluasiKelayakan()
  let tipePendaftar = "individu"; // "individu" | "lembaga"

  /* ---------------- Mode: Individu / Perwakilan Lembaga ---------------- */
  modeToggle.querySelectorAll(".admin-tab").forEach(function (tab) {
    tab.addEventListener("click", function () {
      modeToggle.querySelectorAll(".admin-tab").forEach(function (t) { t.classList.remove("is-active"); });
      tab.classList.add("is-active");
      tipePendaftar = tab.getAttribute("data-mode");
      fieldPenanggungJawab.style.display = tipePendaftar === "lembaga" ? "block" : "none";
    });
  });

  btnDaftarLagi.addEventListener("click", function () {
    const preserveLembaga = tipePendaftar === "lembaga";
    const asalSekolahVal = document.getElementById("asalSekolah").value;
    const penanggungJawabVal = document.getElementById("penanggungJawab").value;
    const whatsappVal = document.getElementById("whatsapp").value;

    form.reset();
    form.style.display = "block";
    resultPanel.classList.remove("is-visible");
    form.querySelectorAll(".has-error").forEach(function (el) { el.classList.remove("has-error"); });

    ["surat", "kartu", "ig"].forEach(function (key) {
      document.getElementById("upload-" + key).classList.remove("has-file");
      document.getElementById("filename-" + key).textContent = "Belum ada berkas dipilih.";
    });

    fieldsetDataDiri.style.display = "none";
    usiaNotice.style.display = "none";
    selectedLomba = null;
    anggotaListEl.innerHTML = "";
    anggotaCount = 0;
    terapkanLanjutan(false);
    renderLombaChoices(); // segarkan status kuota tiap lomba

    if (preserveLembaga) {
      document.getElementById("asalSekolah").value = asalSekolahVal;
      document.getElementById("penanggungJawab").value = penanggungJawabVal;
      document.getElementById("whatsapp").value = whatsappVal;
      fieldPenanggungJawab.style.display = "block";
    }

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
        usiaMin: r.usia_min,
        usiaMax: r.usia_max,
        tipe: r.tipe,
        minAnggota: r.min_anggota,
        maxAnggota: r.max_anggota,
        kuota: r.kuota,
        tanggalPelaksanaan: r.tanggal_pelaksanaan,
        toleransiTahun: r.toleransi_tahun || 0,
        genderDiizinkan: r.gender_diizinkan || "semua",
        maksUtusanPerLembaga: r.maks_utusan_per_lembaga || 2
      };
    });

    genderCountMap = {};
    (rekapGender || []).forEach(function (row) {
      if (!genderCountMap[row.lomba_id]) genderCountMap[row.lomba_id] = {};
      genderCountMap[row.lomba_id][row.jenis_kelamin] = row.jumlah;
    });

    renderLombaChoices();
  }

  /* ---------------- Jenjang dropdown ---------------- */
  JENJANG_LIST.forEach(function (j) {
    const opt = document.createElement("option");
    opt.value = j;
    opt.textContent = j;
    jenjangSelect.appendChild(opt);
  });

  /* ---------------- Hitung usia pada tanggal acuan tertentu ---------------- */
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

  // Dipakai di Langkah 1 (jenis kelamin belum diketahui) — lomba dianggap
  // penuh hanya kalau kuota LAKI-LAKI dan PEREMPUAN dua-duanya sudah penuh.
  function kuotaPenuh(lomba) {
    if (!lomba.kuota) return false;
    const g = genderCountMap[lomba.id] || {};
    const lakiPenuh = (g["laki-laki"] || 0) >= lomba.kuota;
    const perempuanPenuh = (g["perempuan"] || 0) >= lomba.kuota;
    return lakiPenuh && perempuanPenuh;
  }

  // Dipakai di Langkah 2, setelah jenis kelamin peserta diketahui.
  function kuotaGenderPenuh(lomba, gender) {
    if (!lomba.kuota) return false;
    const g = genderCountMap[lomba.id] || {};
    return (g[gender] || 0) >= lomba.kuota;
  }

  /* ---------------- Render pilihan lomba (Langkah 1) ---------------- */
  function renderLombaChoices() {
    lomboaChoicesEl.innerHTML = LOMBA_LIST.map(function (lomba) {
      const genderLabel = lomba.genderDiizinkan !== "semua" ? (" · Khusus " + lomba.genderDiizinkan) : "";
      const kuotaLabel = lomba.kuota ? (" · Kuota " + lomba.kuota + "/gender") : "";
      return (
        '<div class="lomba-choice" data-id="' + lomba.id + '">' +
          '<label>' +
            '<input type="radio" name="lombaId" value="' + lomba.id + '" />' +
            '<span class="lomba-choice__icon">' + lomba.ikon + '</span>' +
            '<span class="lomba-choice__text">' +
              '<strong>' + lomba.nama + '</strong>' +
              '<span>' + lomba.jenjang.join("/") + ' · ' + lomba.usiaMin + '-' + lomba.usiaMax + ' th' + genderLabel + kuotaLabel +
                ' · Maks ' + lomba.maksUtusanPerLembaga + ' peserta/sekolah</span>' +
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
        wrap.classList.add("is-disabled");
        input.disabled = true;
        note.textContent = "Kuota penuh";
      }
    });

    lomboaChoicesEl.querySelectorAll('input[name="lombaId"]').forEach(function (input) {
      input.addEventListener("change", onLombaChange);
    });
  }

  /* ---------------- Pilih lomba -> tampilkan Data Diri (Langkah 2) ---------------- */
  function onLombaChange() {
    const checked = lomboaChoicesEl.querySelector('input[name="lombaId"]:checked');
    selectedLomba = checked ? LOMBA_LIST.find(function (l) { return l.id === checked.value; }) : null;

    if (!selectedLomba) {
      fieldsetDataDiri.style.display = "none";
      evaluasiKelayakan();
      return;
    }

    fieldsetDataDiri.style.display = "block";

    if (selectedLomba.tipe === "tim") {
      resetAnggota(selectedLomba.minAnggota);
    } else {
      anggotaListEl.innerHTML = "";
      anggotaCount = 0;
    }

    evaluasiKelayakan();
  }

  /* ---------------- Cek kecocokan jenjang & usia ---------------- */
  function terapkanLanjutan(visible) {
    bolehLanjut = visible;
    bagianLanjutan.style.display = visible ? "block" : "none";
    fieldsetTim.style.display = (visible && selectedLomba && selectedLomba.tipe === "tim") ? "block" : "none";
  }

  function tampilkanNotice(jenis, teks) {
    usiaNotice.className = "notice notice--" + jenis;
    usiaNotice.textContent = teks;
    usiaNotice.style.display = "block";
  }

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

    if (kuotaGenderPenuh(selectedLomba, gender)) {
      tampilkanNotice("error", "Mohon maaf, kuota peserta " + gender + " untuk lomba ini sudah penuh (maksimal " + selectedLomba.kuota + " " + gender + "). Silakan pilih cabang lomba lain.");
      terapkanLanjutan(false);
      return;
    }

    const usia = hitungUsiaPada(tgl, selectedLomba.tanggalPelaksanaan);
    const toleransi = selectedLomba.toleransiTahun || 0;
    const batasBawah = selectedLomba.usiaMin - toleransi;
    const batasAtas = selectedLomba.usiaMax + toleransi;
    const keteranganAcuan = selectedLomba.tanggalPelaksanaan ? " pada tanggal pelaksanaan lomba" : "";

    if (usia >= selectedLomba.usiaMin && usia <= selectedLomba.usiaMax) {
      usiaNotice.style.display = "none";
      terapkanLanjutan(true);
    } else if (usia >= batasBawah && usia <= batasAtas) {
      tampilkanNotice("warning",
        "Usia peserta (" + usia + " tahun" + keteranganAcuan + ") sedikit di luar ketentuan (" +
        selectedLomba.usiaMin + "–" + selectedLomba.usiaMax + " tahun). Pendaftaran tetap bisa dilanjutkan, " +
        "tapi akan diverifikasi manual oleh panitia sebelum diterima.");
      terapkanLanjutan(true);
    } else {
      tampilkanNotice("error",
        "Mohon maaf, usia peserta (" + usia + " tahun" + keteranganAcuan + ") di luar syarat lomba ini (" +
        selectedLomba.usiaMin + "–" + selectedLomba.usiaMax + " tahun). Silakan pilih cabang lomba lain yang sesuai.");
      terapkanLanjutan(false);
    }
  }

  jenjangSelect.addEventListener("change", evaluasiKelayakan);
  tanggalLahirInput.addEventListener("change", evaluasiKelayakan);
  document.querySelectorAll('input[name="jenisKelamin"]').forEach(function (radio) {
    radio.addEventListener("change", evaluasiKelayakan);
  });

  /* ---------------- Anggota tim (dinamis) ---------------- */
  function buatBarisAnggota(index) {
    const row = document.createElement("div");
    row.className = "anggota-row";
    row.innerHTML =
      '<input type="text" placeholder="Nama anggota ' + index + '" class="anggota-nama" required />' +
      '<input type="text" placeholder="Kelas" class="anggota-kelas" required />' +
      '<button type="button" class="btn-remove">Hapus</button>';
    row.querySelector(".btn-remove").addEventListener("click", function () {
      if (!selectedLomba) return;
      if (anggotaListEl.children.length <= selectedLomba.minAnggota) return;
      row.remove();
      anggotaCount--;
      updateAnggotaHint();
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
  setupUpload("fileSurat", "upload-surat", "filename-surat");
  setupUpload("fileKartu", "upload-kartu", "filename-kartu");
  setupUpload("fileIg", "upload-ig", "filename-ig");

  /* ---------------- Upload ke Supabase Storage ---------------- */
  function ekstensi(file) {
    const bagian = file.name.split(".");
    return bagian.length > 1 ? bagian.pop() : "bin";
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

    const lombaChecked = lomboaChoicesEl.querySelector('input[name="lombaId"]:checked');
    lombaErrorEl.style.display = lombaChecked ? "none" : "block";
    if (!lombaChecked) valid = false;

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

    if (tipePendaftar === "lembaga") {
      const penanggungJawabInput = document.getElementById("penanggungJawab");
      const pjOk = penanggungJawabInput.value.trim() !== "";
      setFieldError(penanggungJawabInput.closest(".field"), !pjOk);
      if (!pjOk) valid = false;
    }

    if (!bolehLanjut) valid = false;

    if (selectedLomba && selectedLomba.tipe === "tim") {
      ["namaTim", "pembina"].forEach(function (id) {
        const input = document.getElementById(id);
        const fieldEl = input.closest(".field");
        const ok = input.value.trim() !== "";
        setFieldError(fieldEl, !ok);
        if (!ok) valid = false;
      });
      const rows = anggotaListEl.querySelectorAll(".anggota-row");
      rows.forEach(function (row) {
        const nama = row.querySelector(".anggota-nama");
        const kelas = row.querySelector(".anggota-kelas");
        if (nama.value.trim() === "" || kelas.value.trim() === "") {
          nama.style.borderColor = "var(--danger)";
          kelas.style.borderColor = "var(--danger)";
          valid = false;
        } else {
          nama.style.borderColor = "";
          kelas.style.borderColor = "";
        }
      });
    }

    const fileSurat = document.getElementById("fileSurat");
    const fileSuratField = fileSurat.closest(".field");
    const suratOk = fileSurat.files.length > 0 && fileSurat.closest(".upload-field").classList.contains("has-file");
    setFieldError(fileSuratField, !suratOk);
    if (!suratOk) valid = false;

    const fileKartu = document.getElementById("fileKartu");
    const fileKartuField = fileKartu.closest(".field");
    const kartuOk = fileKartu.files.length > 0 && fileKartu.closest(".upload-field").classList.contains("has-file");
    setFieldError(fileKartuField, !kartuOk);
    if (!kartuOk) valid = false;

    const fileIg = document.getElementById("fileIg");
    const fileIgField = fileIg.closest(".field");
    const igOk = fileIg.files.length > 0 && fileIg.closest(".upload-field").classList.contains("has-file");
    setFieldError(fileIgField, !igOk);
    if (!igOk) valid = false;

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

    const fileSurat = document.getElementById("fileSurat").files[0];
    const fileKartu = document.getElementById("fileKartu").files[0];
    const fileIg = document.getElementById("fileIg").files[0];

    Promise.all([
      uploadKeStorage(fileSurat, "surat-aktif"),
      uploadKeStorage(fileKartu, "kartu-pelajar"),
      uploadKeStorage(fileIg, "bukti-follow-ig")
    ])
      .then(function (urls) {
        const anggotaTim = selectedLomba.tipe === "tim"
          ? Array.from(anggotaListEl.querySelectorAll(".anggota-row")).map(function (row) {
              return {
                nama: row.querySelector(".anggota-nama").value.trim(),
                kelas: row.querySelector(".anggota-kelas").value.trim()
              };
            })
          : [];

        const genderChecked = document.querySelector('input[name="jenisKelamin"]:checked');

        return supabaseClient.rpc("submit_pendaftaran", {
          p_lomba_id: selectedLomba.id,
          p_tipe_pendaftar: tipePendaftar,
          p_penanggung_jawab: tipePendaftar === "lembaga" ? document.getElementById("penanggungJawab").value.trim() : null,
          p_nama_lengkap: document.getElementById("namaLengkap").value.trim(),
          p_jenjang: document.getElementById("jenjang").value,
          p_kelas: document.getElementById("kelas").value.trim(),
          p_jenis_kelamin: genderChecked ? genderChecked.value : null,
          p_tanggal_lahir: document.getElementById("tanggalLahir").value,
          p_asal_sekolah: document.getElementById("asalSekolah").value.trim(),
          p_whatsapp: document.getElementById("whatsapp").value.trim(),
          p_email: document.getElementById("email").value.trim(),
          p_nama_tim: selectedLomba.tipe === "tim" ? document.getElementById("namaTim").value.trim() : null,
          p_pembina: selectedLomba.tipe === "tim" ? document.getElementById("pembina").value.trim() : null,
          p_url_surat_aktif: urls[0],
          p_url_kartu_pelajar: urls[1],
          p_url_bukti_follow_ig: urls[2],
          p_anggota_tim: anggotaTim
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
