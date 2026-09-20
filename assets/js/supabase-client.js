// Klien Supabase bersama, dipakai oleh main.js dan form.js.
// Membutuhkan config.js (SUPABASE_URL, SUPABASE_ANON_KEY) dan CDN
// @supabase/supabase-js sudah dimuat sebelum file ini.
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
