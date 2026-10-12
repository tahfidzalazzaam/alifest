/* ==========================================================================
   KONFIGURASI ALIF 5.0
   ==========================================================================
   Syarat lomba (jenjang, usia, kuota, dll) TIDAK lagi diatur di file ini —
   sekarang datanya ada di tabel `lomba_rules` pada Supabase, dan bisa Anda
   ubah kapan saja lewat Table Editor di dashboard Supabase, tanpa sentuh
   kode maupun deploy ulang. Lihat README.md bagian "Mengatur Syarat Lomba".

   File ini hanya berisi pengaturan koneksi & batas teknis.
   ========================================================================== */

// Didapat dari Project Settings -> API di dashboard Supabase Anda.
const SUPABASE_URL = "https://ybbwunppvubnfcqcqpeq.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InliYnd1bnBwdnVibmZjcWNxcGVxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk5MTMxNTksImV4cCI6MjEwNTQ4OTE1OX0.4yoOO4e7pSjvpQ9tJHXdqZ61zSGx1ady2FBQyAwwebw";

const EVENT_NAME = "ALIF 5.0";
const EVENT_FULL_NAME = "Al Azzaam Islamic Fair 5.0";

// Jenjang yang dikenal sistem, untuk isi dropdown pada form.
const JENJANG_LIST = ["SD", "SMP"];

// Batas ukuran tiap file upload (MB) -- dinaikkan dari 4 ke 12. Alasannya:
// foto langsung dari kamera HP modern sering sudah di atas 4MB (apalagi mode
// resolusi tinggi/"HDR"/Live Photo di iPhone), jadi banyak pendaftar sempat
// tertolak di sini SEBELUM berkasnya sempat sampai ke tahap pengecilan
// otomatis (lihat kecilkanGambarJikaPerlu()/kecilkanGambarJikaPerluBazar()
// di view-daftar.js/view-daftarbazar.js, yang memadatkan ulang foto jadi
// jauh lebih kecil sebelum benar-benar diunggah) -- jadi batas di sini
// murni jaring pengaman SANGAT longgar, bukan batas ukuran unggahan
// sesungguhnya.
const MAX_FILE_SIZE_MB = 12;

// Tipe file yang diterima untuk upload berkas PDF -- untuk FOTO, validasinya
// SENGAJA TIDAK lagi membandingkan `file.type` dengan daftar MIME type yang
// kaku kayak dulu (cuma "image/jpeg"/"image/png"), tapi cukup cek apakah
// diawali "image/" (lihat typeOk di view-daftar.js/view-daftarbazar.js) --
// supaya otomatis menerima SEMUA jenis foto, termasuk format yang sering
// bikin pendaftar tertolak sebelumnya seperti HEIC/HEIF (default kamera
// iPhone), WEBP, GIF, dsb, tanpa perlu menambah daftar MIME type satu-satu
// tiap ada format baru. Konstanta ini sekarang HANYA dipakai untuk
// mencocokkan berkas PDF.
const ALLOWED_FILE_TYPES = ["image/jpeg", "image/png", "application/pdf"];

// Nama bucket Storage tempat berkas upload disimpan (dibuat otomatis oleh
// supabase/migrations/0001_init.sql).
const STORAGE_BUCKET = "berkas-pendaftaran";
