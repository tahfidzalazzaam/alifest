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

const DAFTAR_BAZAR_TEMPLATE = `
<main class="form-page container">
  <div class="form-header">
    <h1>Pendaftaran Stand/Tenant Bazar</h1>
    <p>${EVENT_FULL_NAME} — isi data usaha/stand Anda untuk ikut meramaikan bazar ALIF 5.0. Belum lihat info lengkap Bazar? <a href="#/bazar">Kembali ke halaman Bazar</a>.</p>
  </div>

  <div class="form-shell">
    <div class="notice" id="bazar-info-biaya" style="display:none;"></div>
    <div class="notice" id="bazar-info-rekening" style="display:none;"></div>
    <div class="notice" id="bazar-info-kuota" style="display:none;"></div>

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

        <div class="field" id="bazar-kategori-field">
          <label>Kategori/Ukuran Stand</label>
          <div class="lomba-choices" id="bazar-kategori-choices"></div>
          <div class="form-error" id="bazar-kategori-error" style="margin-top:10px;">Pilih salah satu kategori stand.</div>
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
          <p class="hint" style="margin-top:-4px;" id="bazar-bukti-bayar-hint">Transfer biaya sewa stand sesuai kategori yang dipilih, lalu unggah screenshot/foto bukti transfernya di sini.</p>
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

function initDaftarBazar() {
  const form = document.getElementById("form-bazar");
  const kategoriChoicesEl = document.getElementById("bazar-kategori-choices");
  const kategoriErrorEl = document.getElementById("bazar-kategori-error");
  const btnSubmit = document.getElementById("btn-submit-bazar");
  const resultPanel = document.getElementById("result-panel-bazar");
  const regNumberEl = document.getElementById("reg-number-bazar");

  let kategoriList = [];
  let pendaftaranDibuka = true;
  let kuotaTotal = null;

  /* ---------------- Pilihan kategori stand (dari bazar_settings.kategori_list) ---------------- */
  function renderKategoriChoices() {
    kategoriChoicesEl.innerHTML = kategoriList.map(function (k, i) {
      return (
        '<div class="lomba-choice">' +
          '<label>' +
            '<input type="radio" name="bazarKategori" value="' + escapeHTMLDaftarBazar(k) + '" ' + (i === 0 ? "" : "") + ' />' +
            '<span class="lomba-choice__icon">🏪</span>' +
            '<span class="lomba-choice__text"><strong>' + escapeHTMLDaftarBazar(k) + '</strong></span>' +
          '</label>' +
        '</div>'
      );
    }).join("");
  }

  function escapeHTMLDaftarBazar(teks) {
    const div = document.createElement("div");
    div.textContent = String(teks == null ? "" : teks);
    return div.innerHTML;
  }

  /* ---------------- Muat pengaturan bazar (buka/tutup, kategori, kuota, info biaya/rekening) ---------------- */
  async function muatPengaturanBazar() {
    const [{ data: settings }, { data: jumlahTerisi }] = await Promise.all([
      supabaseClient.from("bazar_settings").select("pendaftaran_dibuka,kategori_list,kuota_total,info_biaya,info_rekening").eq("id", 1).single(),
      supabaseClient.rpc("bazar_jumlah_terisi")
    ]);

    pendaftaranDibuka = !settings || settings.pendaftaran_dibuka !== false;
    kategoriList = (settings && Array.isArray(settings.kategori_list) && settings.kategori_list.length)
      ? settings.kategori_list
      : ["Kecil", "Sedang", "Besar"];
    kuotaTotal = settings ? settings.kuota_total : null;
    const terisi = typeof jumlahTerisi === "number" ? jumlahTerisi : 0;
    const kuotaPenuh = kuotaTotal !== null && kuotaTotal !== undefined && terisi >= kuotaTotal;

    renderKategoriChoices();

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

    const infoKuotaEl = document.getElementById("bazar-info-kuota");
    if (kuotaTotal !== null && kuotaTotal !== undefined) {
      infoKuotaEl.textContent = kuotaPenuh
        ? "🚫 Kuota stand bazar sudah penuh (" + terisi + "/" + kuotaTotal + ")."
        : "📊 Sisa kuota stand: " + Math.max(kuotaTotal - terisi, 0) + " dari " + kuotaTotal + ".";
      infoKuotaEl.className = "notice" + (kuotaPenuh ? " notice--error" : "");
      infoKuotaEl.style.display = "block";
    }

    if (!pendaftaranDibuka || kuotaPenuh) {
      const shell = document.querySelector(".form-shell");
      const pesan = !pendaftaranDibuka
        ? "Mohon maaf, pendaftaran stand/tenant bazar ALIF 5.0 sedang tidak dibuka sementara oleh panitia. Silakan cek kembali nanti atau hubungi panitia untuk informasi lebih lanjut."
        : "Mohon maaf, kuota stand bazar ALIF 5.0 sudah penuh. Silakan hubungi panitia untuk informasi lebih lanjut.";
      if (shell) {
        shell.innerHTML =
          '<div style="text-align:center;padding:20px 0;">' +
            '<div style="font-size:2.4rem;margin-bottom:12px;">' + (!pendaftaranDibuka ? "🔒" : "🚫") + '</div>' +
            '<h2>' + (!pendaftaranDibuka ? "Pendaftaran Bazar Sedang Ditutup" : "Kuota Stand Penuh") + '</h2>' +
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

    const kategoriChecked = kategoriChoicesEl.querySelector('input[name="bazarKategori"]:checked');
    kategoriErrorEl.style.display = kategoriChecked ? "none" : "block";
    if (!kategoriChecked) valid = false;

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
      const firstError = form.querySelector(".has-error, #bazar-kategori-error[style*='block']");
      if (firstError) firstError.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    btnSubmit.disabled = true;
    btnSubmit.textContent = "Mengirim...";

    const fotoList = Array.from(document.getElementById("bazarFileFoto").files || []);
    const fileBukti = document.getElementById("bazarFileBukti").files[0];
    const kategoriChecked = kategoriChoicesEl.querySelector('input[name="bazarKategori"]:checked');

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
          p_kategori_stand: kategoriChecked ? kategoriChecked.value : "",
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
          alert("Pendaftaran gagal: " + (data.message || "Terjadi kesalahan, coba lagi."));
          btnSubmit.disabled = false;
          btnSubmit.textContent = "Kirim Pendaftaran Bazar";
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
