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

// Batas ukuran tiap file upload (MB).
const MAX_FILE_SIZE_MB = 4;

// Tipe file yang diterima untuk upload berkas.
const ALLOWED_FILE_TYPES = ["image/jpeg", "image/png", "application/pdf"];

// Nama bucket Storage tempat berkas upload disimpan (dibuat otomatis oleh
// supabase/migrations/0001_init.sql).
const STORAGE_BUCKET = "berkas-pendaftaran";
