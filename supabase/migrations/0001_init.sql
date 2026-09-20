-- =============================================================================
-- ALIF 5.0 — Skema Supabase
-- =============================================================================
-- Cara pakai: Supabase Dashboard -> SQL Editor -> tempel seluruh isi file ini
-- -> Run. Aman dijalankan ulang (pakai IF NOT EXISTS / ON CONFLICT di
-- sebagian besar bagian), tapi sebaiknya cukup dijalankan sekali di awal.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. TABEL: lomba_rules
-- -----------------------------------------------------------------------------
-- Satu-satunya tempat mengatur syarat lomba (jenjang, usia, kuota, dst).
-- Edit langsung lewat Table Editor di dashboard Supabase — tidak perlu ubah
-- kode apa pun. Frontend membaca tabel ini secara realtime.
-- -----------------------------------------------------------------------------
create table if not exists public.lomba_rules (
  id            text primary key,
  nama          text not null,
  ikon          text not null default '🏆',
  jenjang       text[] not null,
  usia_min      int not null,
  usia_max      int not null,
  tipe          text not null check (tipe in ('individu', 'tim')),
  min_anggota   int,
  max_anggota   int,
  kuota         int,              -- null = tidak dibatasi
  deskripsi     text not null default '',
  aktif         boolean not null default true,
  urutan        int not null default 0
);

-- -----------------------------------------------------------------------------
-- 2. TABEL: lomba_counter
-- -----------------------------------------------------------------------------
-- Penghitung berjalan per lomba, dipakai untuk membuat nomor pendaftaran
-- (KODE-001, KODE-002, ...) dan menegakkan kuota secara atomik (aman dari
-- race condition saat banyak orang submit bersamaan).
-- -----------------------------------------------------------------------------
create table if not exists public.lomba_counter (
  lomba_id  text primary key references public.lomba_rules(id),
  jumlah    int not null default 0
);

-- -----------------------------------------------------------------------------
-- 3. TABEL: pendaftaran
-- -----------------------------------------------------------------------------
create table if not exists public.pendaftaran (
  id                  uuid primary key default gen_random_uuid(),
  nomor_pendaftaran   text not null unique,
  lomba_id            text not null references public.lomba_rules(id),
  lomba_nama          text not null,
  tipe                text not null,
  nama_lengkap        text not null,
  jenjang             text not null,
  kelas               text not null,
  tanggal_lahir       date not null,
  usia                int not null,
  asal_sekolah        text not null,
  whatsapp            text not null,
  email               text,
  nama_tim            text,
  pembina             text,
  url_surat_aktif     text not null,
  url_kartu_pelajar   text not null,
  status              text not null default 'Menunggu Verifikasi',
  created_at          timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- 4. TABEL: anggota_tim
-- -----------------------------------------------------------------------------
create table if not exists public.anggota_tim (
  id                  uuid primary key default gen_random_uuid(),
  pendaftaran_id      uuid not null references public.pendaftaran(id) on delete cascade,
  nomor_pendaftaran   text not null,   -- disalin dari pendaftaran, biar gampang dibaca di Sheet
  nama_tim            text not null,
  nama                text not null,
  kelas               text not null,
  created_at          timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- 5. Row Level Security + GRANT eksplisit
-- -----------------------------------------------------------------------------
-- Catatan penting: di Supabase, RLS policy SAJA tidak cukup — role (anon/
-- authenticated) juga butuh GRANT eksplisit di level tabel, kalau tidak,
-- request akan ditolak walau policy-nya benar. Karena itu semua GRANT di
-- bawah ini ditulis eksplisit, jangan dihapus.
-- -----------------------------------------------------------------------------

alter table public.lomba_rules   enable row level security;
alter table public.lomba_counter enable row level security;
alter table public.pendaftaran   enable row level security;
alter table public.anggota_tim   enable row level security;

-- lomba_rules: publik boleh membaca (dipakai frontend untuk render & validasi)
drop policy if exists "publik boleh baca lomba_rules" on public.lomba_rules;
create policy "publik boleh baca lomba_rules"
  on public.lomba_rules for select
  to anon
  using (true);
grant select on public.lomba_rules to anon;

-- lomba_counter: publik boleh membaca (dipakai frontend untuk cek sisa kuota)
drop policy if exists "publik boleh baca lomba_counter" on public.lomba_counter;
create policy "publik boleh baca lomba_counter"
  on public.lomba_counter for select
  to anon
  using (true);
grant select on public.lomba_counter to anon;

-- pendaftaran & anggota_tim: TIDAK ada policy SELECT/INSERT langsung untuk
-- anon. Semua insert wajib lewat fungsi submit_pendaftaran() di bawah, yang
-- berjalan sebagai SECURITY DEFINER (hak akses pemilik fungsi), supaya data
-- pribadi peserta (nama, WhatsApp, link berkas) tidak bisa dibaca publik
-- lewat API langsung.

-- -----------------------------------------------------------------------------
-- 6. Storage bucket untuk berkas upload
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('berkas-pendaftaran', 'berkas-pendaftaran', true)
on conflict (id) do nothing;

drop policy if exists "anon boleh upload ke berkas-pendaftaran" on storage.objects;
create policy "anon boleh upload ke berkas-pendaftaran"
  on storage.objects for insert
  to anon
  with check (bucket_id = 'berkas-pendaftaran');
grant insert on storage.objects to anon;

-- -----------------------------------------------------------------------------
-- 7. Fungsi: submit_pendaftaran
-- -----------------------------------------------------------------------------
-- Satu pintu untuk semua pendaftaran: validasi syarat lomba, cek & tegakkan
-- kuota, buat nomor pendaftaran, simpan ke pendaftaran + anggota_tim — semua
-- dalam satu transaksi atomik (aman dari race condition saat lonjakan
-- submit bersamaan).
-- -----------------------------------------------------------------------------
create or replace function public.submit_pendaftaran(
  p_lomba_id          text,
  p_nama_lengkap      text,
  p_jenjang           text,
  p_kelas             text,
  p_tanggal_lahir     date,
  p_usia              int,
  p_asal_sekolah      text,
  p_whatsapp          text,
  p_email             text,
  p_nama_tim          text,
  p_pembina           text,
  p_url_surat_aktif   text,
  p_url_kartu_pelajar text,
  p_anggota_tim       jsonb   -- array [{"nama":"...","kelas":"..."}, ...] atau '[]'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rule      public.lomba_rules%rowtype;
  v_jumlah    int;
  v_kode      text;
  v_nomor     text;
  v_id        uuid;
  v_jml_anggota int;
  v_anggota   jsonb;
begin
  select * into v_rule from public.lomba_rules where id = p_lomba_id and aktif = true;
  if not found then
    return jsonb_build_object('success', false, 'message', 'Cabang lomba tidak dikenali atau sedang ditutup.');
  end if;

  if not (p_jenjang = any(v_rule.jenjang)) then
    return jsonb_build_object('success', false, 'message', 'Jenjang tidak sesuai syarat lomba ini.');
  end if;

  if p_usia < v_rule.usia_min or p_usia > v_rule.usia_max then
    return jsonb_build_object('success', false, 'message',
      format('Usia peserta di luar syarat lomba ini (%s-%s tahun).', v_rule.usia_min, v_rule.usia_max));
  end if;

  if v_rule.tipe = 'tim' then
    if p_nama_tim is null or trim(p_nama_tim) = '' or p_pembina is null or trim(p_pembina) = '' then
      return jsonb_build_object('success', false, 'message', 'Nama tim dan guru pendamping wajib diisi.');
    end if;
    v_jml_anggota := jsonb_array_length(coalesce(p_anggota_tim, '[]'::jsonb));
    if v_jml_anggota < v_rule.min_anggota or v_jml_anggota > v_rule.max_anggota then
      return jsonb_build_object('success', false, 'message',
        format('Jumlah anggota tim harus %s-%s orang.', v_rule.min_anggota, v_rule.max_anggota));
    end if;
  end if;

  if p_url_surat_aktif is null or p_url_kartu_pelajar is null then
    return jsonb_build_object('success', false, 'message', 'Berkas Surat Aktif Sekolah dan Kartu Pelajar wajib diunggah.');
  end if;

  -- Naikkan counter secara atomik (aman dari race condition) sekaligus dapat nomor urut.
  insert into public.lomba_counter (lomba_id, jumlah)
  values (p_lomba_id, 1)
  on conflict (lomba_id) do update set jumlah = public.lomba_counter.jumlah + 1
  returning jumlah into v_jumlah;

  if v_rule.kuota is not null and v_jumlah > v_rule.kuota then
    return jsonb_build_object('success', false, 'message', 'Mohon maaf, kuota lomba ini sudah penuh.');
  end if;

  v_kode  := upper(left(p_lomba_id, 3));
  v_nomor := v_kode || '-' || lpad(v_jumlah::text, 3, '0');

  insert into public.pendaftaran (
    nomor_pendaftaran, lomba_id, lomba_nama, tipe, nama_lengkap, jenjang, kelas,
    tanggal_lahir, usia, asal_sekolah, whatsapp, email, nama_tim, pembina,
    url_surat_aktif, url_kartu_pelajar
  ) values (
    v_nomor, p_lomba_id, v_rule.nama, v_rule.tipe, p_nama_lengkap, p_jenjang, p_kelas,
    p_tanggal_lahir, p_usia, p_asal_sekolah, p_whatsapp, nullif(p_email, ''), p_nama_tim, p_pembina,
    p_url_surat_aktif, p_url_kartu_pelajar
  ) returning id into v_id;

  if v_rule.tipe = 'tim' then
    for v_anggota in select * from jsonb_array_elements(p_anggota_tim)
    loop
      insert into public.anggota_tim (pendaftaran_id, nomor_pendaftaran, nama_tim, nama, kelas)
      values (v_id, v_nomor, p_nama_tim, v_anggota->>'nama', v_anggota->>'kelas');
    end loop;
  end if;

  return jsonb_build_object('success', true, 'nomor_pendaftaran', v_nomor);
exception when others then
  return jsonb_build_object('success', false, 'message', 'Kesalahan server: ' || sqlerrm);
end;
$$;

grant execute on function public.submit_pendaftaran(
  text, text, text, text, date, int, text, text, text, text, text, text, text, jsonb
) to anon;

-- -----------------------------------------------------------------------------
-- 8. Seed data lomba (silakan ubah nilainya lewat Table Editor kapan pun)
-- -----------------------------------------------------------------------------
insert into public.lomba_rules (id, nama, ikon, jenjang, usia_min, usia_max, tipe, min_anggota, max_anggota, kuota, deskripsi, urutan)
values
  ('adzan', 'Lomba Adzan', '🕌', array['SD','SMP','SMA'], 8, 17, 'individu', null, null, 40,
   'Lantunan adzan terbaik, dinilai dari kefasihan, lagu, dan adab.', 1),
  ('panahan', 'Lomba Panahan', '🎯', array['SMP','SMA'], 12, 18, 'individu', null, null, 32,
   'Ketepatan bidikan jarak standar, sesuai sunnah Rasulullah ﷺ.', 2),
  ('mhq', E'Lomba MHQ (Musabaqah Hifzhil Qur\'an)', '📖', array['SD','SMP','SMA'], 7, 18, 'individu', null, null, 60,
   'Hafalan Al-Qur''an sesuai juz yang dilombakan per jenjang.', 3),
  ('kaligrafi', 'Lomba Kaligrafi', '✍️', array['SD','SMP','SMA'], 7, 18, 'individu', null, null, 40,
   'Keindahan tulisan Arab, kreativitas hiasan, dan kerapian karya.', 4),
  ('futsal', 'Lomba Futsal (Mewakili Sekolah)', '⚽', array['SMP','SMA'], 12, 18, 'tim', 5, 10, 16,
   'Tim resmi mewakili sekolah, minimal 5 dan maksimal 10 pemain.', 5)
on conflict (id) do nothing;
