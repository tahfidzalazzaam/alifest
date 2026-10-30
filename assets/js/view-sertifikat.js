// View: Unduh Sertifikat PESERTA ("#/sertifikat?k=KUNCI" ATAU
// "/sertifikat?k=KUNCI") -- halaman PUBLIK, tidak butuh login. SATU link untuk semua
// kelompok (migrasi 0057/0058); kelompok yang tampil diatur panitia lewat
// saklar di tab Kartu Peserta > "Link Sertifikat Peserta". Peserta memfilter
// Cabang -> Jenjang -> Jenis Kelamin, mencentang nama, dan mengunduh PDF-nya
// (digambar di browser memakai gambarKartu()/FIELD_SERTIFIKAT dari view-admin.js).
//
// Sertifikat hanya untuk PESERTA (individu & anggota tim), BUKAN pendamping:
// fitur link sertifikat pendamping ("?token=...") sudah dihapus -- link lama
// dengan token hanya menampilkan pemberitahuan.
//
// Linknya memakai bentuk HASH ("#/sertifikat?k=...") supaya selalu
// berfungsi tanpa konfigurasi rewrite di hosting.

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

// Kunci link tunggal ("#/sertifikat?k=...", migrasi 0058).
function ambilKunciDariUrlSertifikat() {
  const dariQuery = new URLSearchParams(window.location.search).get("k");
  if (dariQuery) return dariQuery.trim();
  const hash = window.location.hash || "";
  const tandaTanya = hash.indexOf("?");
  if (tandaTanya === -1) return "";
  return (new URLSearchParams(hash.slice(tandaTanya + 1)).get("k") || "").trim();
}

function labelJenisKelaminSertifikat(jk) {
  return jk === "laki-laki" ? "Putra" : jk === "perempuan" ? "Putri" : "Umum";
}

// Halaman pilih sertifikat: filter Cabang -> Jenjang -> Jenis Kelamin, daftar
// nama bercentang (pilihan TETAP tersimpan saat filter diganti, jadi boleh
// lintas kelompok), pratinjau, lalu unduh satu PDF berisi semua yang dicentang.
async function initSertifikatPilihPublik(root, kunci) {
  root.innerHTML = '<div class="form-shell"><p class="hint">Memuat...</p></div>';
  const { data, error } = await supabaseClient.rpc("pilihan_sertifikat", { p_token: kunci });
  if (error || !data || !data.success) {
    root.innerHTML =
      '<div class="form-shell"><h1>Link Tidak Berlaku</h1><p>' +
      escapeHTMLSertifikatPublik((data && data.message) || (error && error.message) || "Link ini tidak valid.") +
      '</p></div>';
    return;
  }
  const grup = data.grup || [];
  if (grup.length === 0) {
    root.innerHTML = '<div class="form-shell"><h1>🎓 Sertifikat Peserta</h1><p>Sertifikat belum dibuka panitia. Silakan coba lagi nanti.</p></div>';
    return;
  }

  const dipilih = new Map(); // kunci unik -> { nama, lomba, jenjang, jk }
  let namaTampil = [];       // hasil kelompok yang sedang difilter
  let kelompokAktif = null;

  root.innerHTML =
    '<div class="form-shell">' +
      '<h1>🎓 Sertifikat Peserta</h1>' +
      '<p class="hint">Pilih Cabang Lomba, Jenjang, dan Jenis Kelamin, lalu centang namamu. Kamu bisa ganti filter dan menambah nama lain -- centangan sebelumnya tetap tersimpan.</p>' +
      '<div class="field"><label for="sf-lomba">Cabang Lomba</label><select id="sf-lomba"></select></div>' +
      '<div class="field"><label for="sf-jenjang">Jenjang</label><select id="sf-jenjang"></select></div>' +
      '<div class="field"><label for="sf-jk">Jenis Kelamin</label><select id="sf-jk"></select></div>' +
      '<div id="sf-daftar" style="margin-top:10px;"></div>' +
      '<div id="sf-pratinjau" style="margin-top:14px;"></div>' +
      '<div id="sf-keranjang" style="margin-top:14px;"></div>' +
    '</div>';

  const selLomba = document.getElementById("sf-lomba");
  const selJenjang = document.getElementById("sf-jenjang");
  const selJk = document.getElementById("sf-jk");
  const boxDaftar = document.getElementById("sf-daftar");
  const boxPratinjau = document.getElementById("sf-pratinjau");
  const boxKeranjang = document.getElementById("sf-keranjang");

  function unik(arr) { return Array.from(new Set(arr)); }
  function opsi(el, daftar, placeholder) {
    el.innerHTML = '<option value="">' + placeholder + '</option>' +
      daftar.map(function (d) { return '<option value="' + escapeHTMLSertifikatPublik(d.v) + '">' + escapeHTMLSertifikatPublik(d.t) + '</option>'; }).join("");
  }

  const lombaUnik = unik(grup.map(function (g) { return g.lomba_id; }));
  opsi(selLomba, lombaUnik.map(function (id) { return { v: id, t: grup.find(function (g) { return g.lomba_id === id; }).lomba }; }), "-- Pilih Cabang Lomba --");
  opsi(selJenjang, [], "-- Pilih Jenjang --");
  opsi(selJk, [], "-- Pilih Jenis Kelamin --");

  selLomba.addEventListener("change", function () {
    const js = unik(grup.filter(function (g) { return g.lomba_id === selLomba.value; }).map(function (g) { return g.jenjang; }));
    opsi(selJenjang, js.map(function (j) { return { v: j, t: j || "Umum" }; }), "-- Pilih Jenjang --");
    opsi(selJk, [], "-- Pilih Jenis Kelamin --");
    kosongkanDaftar();
    if (js.length === 1) { selJenjang.selectedIndex = 1; selJenjang.dispatchEvent(new Event("change")); }
  });
  selJenjang.addEventListener("change", function () {
    if (selLomba.selectedIndex === 0 || selJenjang.selectedIndex === 0) { opsi(selJk, [], "-- Pilih Jenis Kelamin --"); kosongkanDaftar(); return; }
    const jks = unik(grup.filter(function (g) { return g.lomba_id === selLomba.value && g.jenjang === selJenjang.value; }).map(function (g) { return g.jenis_kelamin; }));
    opsi(selJk, jks.map(function (j) { return { v: j, t: labelJenisKelaminSertifikat(j) }; }), "-- Pilih Jenis Kelamin --");
    kosongkanDaftar();
    if (jks.length === 1) { selJk.selectedIndex = 1; selJk.dispatchEvent(new Event("change")); }
  });
  selJk.addEventListener("change", muatDaftar);

  function kosongkanDaftar() { namaTampil = []; kelompokAktif = null; boxDaftar.innerHTML = ""; }

  function kunciPilihan(g, nama) { return [g.lomba_id, g.jenjang, g.jenis_kelamin, nama].join("||"); }

  async function muatDaftar() {
    if (selLomba.selectedIndex === 0 || selJenjang.selectedIndex === 0 || selJk.selectedIndex === 0) { kosongkanDaftar(); return; }
    const g = grup.find(function (x) { return x.lomba_id === selLomba.value && x.jenjang === selJenjang.value && x.jenis_kelamin === selJk.value; });
    if (!g) { kosongkanDaftar(); return; }
    kelompokAktif = g;
    boxDaftar.innerHTML = '<p class="hint">Memuat nama...</p>';
    const { data: res, error: err } = await supabaseClient.rpc("daftar_peserta_sertifikat", {
      p_token: kunci, p_lomba_id: g.lomba_id, p_jenjang: g.jenjang, p_jenis_kelamin: g.jenis_kelamin
    });
    if (err || !res || !res.success) {
      boxDaftar.innerHTML = '<p class="hint">' + escapeHTMLSertifikatPublik((res && res.message) || (err && err.message) || "Gagal memuat nama.") + '</p>';
      return;
    }
    namaTampil = res.nama || [];
    renderDaftar();
  }

  function renderDaftar() {
    if (namaTampil.length === 0) { boxDaftar.innerHTML = '<p class="hint">Belum ada nama di kelompok ini.</p>'; return; }
    const g = kelompokAktif;
    boxDaftar.innerHTML =
      '<div class="field"><label for="sf-cari">Cari nama (opsional)</label><input type="text" id="sf-cari" placeholder="Ketik untuk menyaring..." autocomplete="off" /></div>' +
      '<div style="display:flex;gap:10px;flex-wrap:wrap;margin:6px 0;">' +
        '<button type="button" class="btn btn--ghost" id="sf-pilih-semua">Centang semua yang tampil</button>' +
        '<button type="button" class="btn btn--ghost" id="sf-batal-semua">Batalkan centang yang tampil</button>' +
      '</div>' +
      '<div id="sf-baris" style="max-height:340px;overflow-y:auto;border:1px solid #e4e4e4;border-radius:8px;padding:8px;background:#fafafa;"></div>';

    function gambarBaris() {
      const kata = (document.getElementById("sf-cari").value || "").trim().toLowerCase();
      const tampil = namaTampil.filter(function (n) { return !kata || n.toLowerCase().indexOf(kata) !== -1; });
      const wadah = document.getElementById("sf-baris");
      if (tampil.length === 0) { wadah.innerHTML = '<p class="hint" style="margin:0;">Tidak ada nama yang cocok.</p>'; return tampil; }
      wadah.innerHTML = tampil.map(function (n, i) {
        return '<div style="display:flex;align-items:center;gap:8px;padding:4px 2px;">' +
          '<label style="flex:1;display:flex;align-items:center;gap:8px;cursor:pointer;"><input type="checkbox" class="sf-cek" data-i="' + i + '"' + (dipilih.has(kunciPilihan(g, n)) ? " checked" : "") + ' /> <span>' + escapeHTMLSertifikatPublik(n) + '</span></label>' +
          '<button type="button" class="btn btn--ghost sf-lihat" data-i="' + i + '">Lihat</button>' +
        '</div>';
      }).join("");
      wadah.querySelectorAll(".sf-cek").forEach(function (c) {
        c.addEventListener("change", function () {
          const n = tampil[Number(c.dataset.i)];
          if (c.checked) dipilih.set(kunciPilihan(g, n), { nama: n, lomba: g.lomba, jenjang: g.jenjang, jk: g.jenis_kelamin });
          else dipilih.delete(kunciPilihan(g, n));
          renderKeranjang();
        });
      });
      wadah.querySelectorAll(".sf-lihat").forEach(function (b) {
        b.addEventListener("click", function () {
          const n = tampil[Number(b.dataset.i)];
          tampilkanPratinjau({ nama: n, lomba: g.lomba, jenjang: g.jenjang, jk: g.jenis_kelamin });
        });
      });
      return tampil;
    }
    let tampilSekarang = gambarBaris();
    document.getElementById("sf-cari").addEventListener("input", function () { tampilSekarang = gambarBaris(); });
    document.getElementById("sf-pilih-semua").addEventListener("click", function () {
      tampilSekarang.forEach(function (n) { dipilih.set(kunciPilihan(g, n), { nama: n, lomba: g.lomba, jenjang: g.jenjang, jk: g.jenis_kelamin }); });
      tampilSekarang = gambarBaris(); renderKeranjang();
    });
    document.getElementById("sf-batal-semua").addEventListener("click", function () {
      tampilSekarang.forEach(function (n) { dipilih.delete(kunciPilihan(g, n)); });
      tampilSekarang = gambarBaris(); renderKeranjang();
    });
  }

  async function siapkanKanvas(item) {
    await pastikanLibKartu();
    const templatesSemua = await ambilKartuTemplates();
    if (!templatesSemua.sertifikat || !templatesSemua.sertifikat.url) throw new Error("Templat sertifikat belum disiapkan panitia.");
    const templateImg = await muatGambar(templatesSemua.sertifikat.url);
    const layout = templatesSemua.sertifikat.layout || DEFAULT_LAYOUT_KARTU.sertifikat;
    return { templateImg: templateImg, layout: layout };
  }

  function gambarSertifikat(canvas, tpl, item) {
    gambarKartu(
      canvas, tpl.templateImg, tpl.layout,
      { nama: item.nama, peserta: "Peserta", lomba_sertifikat: labelLombaSertifikat(item.lomba, item.jenjang, item.jk) },
      FIELD_SERTIFIKAT, SERTIFIKAT_LEBAR_PX, SERTIFIKAT_TINGGI_PX
    );
  }

  async function tampilkanPratinjau(item) {
    boxPratinjau.innerHTML = '<p class="hint">Menyiapkan pratinjau...</p>';
    try {
      const tpl = await siapkanKanvas();
      const canvas = document.createElement("canvas");
      gambarSertifikat(canvas, tpl, item);
      canvas.style.cssText = "width:100%;height:auto;border:1px solid #ccc;border-radius:6px;";
      boxPratinjau.innerHTML = '<p><strong>Pratinjau:</strong> ' + escapeHTMLSertifikatPublik(item.nama) + '</p>';
      boxPratinjau.appendChild(canvas);
    } catch (e) {
      boxPratinjau.innerHTML = '<p class="hint">Gagal menyiapkan pratinjau: ' + escapeHTMLSertifikatPublik(e.message) + '</p>';
    }
  }

  function renderKeranjang() {
    const n = dipilih.size;
    if (n === 0) { boxKeranjang.innerHTML = '<p class="hint">Belum ada nama yang dicentang.</p>'; return; }
    boxKeranjang.innerHTML =
      '<p><strong>' + n + ' sertifikat dipilih</strong></p>' +
      '<div class="submit-row"><button type="button" class="btn btn--primary" id="sf-unduh">Unduh Sertifikat (PDF)</button> ' +
      '<button type="button" class="btn btn--ghost" id="sf-kosongkan">Kosongkan Pilihan</button></div>' +
      '<p class="hint" id="sf-status" style="margin-top:8px;"></p>';
    document.getElementById("sf-kosongkan").addEventListener("click", function () {
      dipilih.clear(); renderKeranjang(); if (kelompokAktif) renderDaftar();
    });
    document.getElementById("sf-unduh").addEventListener("click", unduh);
  }

  async function unduh() {
    const btn = document.getElementById("sf-unduh");
    const statusEl = document.getElementById("sf-status");
    const daftar = Array.from(dipilih.values());
    btn.disabled = true;
    try {
      statusEl.textContent = "Menyiapkan...";
      const tpl = await siapkanKanvas();
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ unit: "cm", format: "a4", orientation: "landscape" });
      const canvas = document.createElement("canvas");
      for (let i = 0; i < daftar.length; i++) {
        if (i > 0) doc.addPage("a4", "landscape");
        gambarSertifikat(canvas, tpl, daftar[i]);
        doc.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, SERTIFIKAT_LEBAR_CM, SERTIFIKAT_TINGGI_CM);
        statusEl.textContent = "Membuat sertifikat " + (i + 1) + " dari " + daftar.length + "...";
        await new Promise(function (r) { setTimeout(r, 0); }); // beri napas ke UI
      }
      const namaFile = daftar.length === 1
        ? "sertifikat-" + daftar[0].nama.trim().replace(/[^a-z0-9]+/gi, "-") + "-alif5.pdf"
        : "sertifikat-alif5-" + daftar.length + "-peserta.pdf";
      doc.save(namaFile);
      statusEl.textContent = "✓ Selesai -- " + daftar.length + " sertifikat terunduh.";
    } catch (e) {
      statusEl.textContent = "Gagal membuat sertifikat: " + e.message;
    } finally {
      btn.disabled = false;
    }
  }

  renderKeranjang();
  if (lombaUnik.length === 1) { selLomba.selectedIndex = 1; selLomba.dispatchEvent(new Event("change")); }
}

async function initSertifikatPublik() {
  const root = document.getElementById("sertifikat-publik-root");
  const kunci = ambilKunciDariUrlSertifikat();
  if (kunci) { initSertifikatPilihPublik(root, kunci); return; }
  root.innerHTML =
    '<div class="form-shell">' +
      '<h1>Link Tidak Berlaku</h1>' +
      '<p>Link sertifikat ini tidak lengkap atau sudah tidak digunakan. Sertifikat hanya diberikan kepada peserta lomba -- mohon buka link yang dikirim panitia ke grup peserta, atau hubungi panitia.</p>' +
    '</div>';
}

window.ViewSertifikat = { template: SERTIFIKAT_PUBLIK_TEMPLATE, init: initSertifikatPublik };
