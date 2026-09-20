// supabase/functions/sync-ke-sheets/index.ts
//
// Dipanggil otomatis oleh Supabase Database Webhook setiap kali ada baris
// baru masuk ke tabel "pendaftaran" atau "anggota_tim". Fungsi ini menulis
// baris yang sama ke Google Sheet lewat Google Sheets API, memakai Service
// Account (bukan OAuth) karena kita hanya menulis nilai ke sheet yang sudah
// ada — bukan membuat file baru di Drive, jadi tidak kena batas kuota
// storage akun Service Account.
//
// Env var yang wajib diisi (Project Settings -> Edge Functions -> Secrets):
//   GOOGLE_SERVICE_ACCOUNT_KEY  -> isi lengkap file JSON service account
//   SPREADSHEET_ID              -> ID Google Sheet tujuan (dari URL sheet)
//
// Sheet tujuan WAJIB di-share ke email service account (field "client_email"
// di JSON key) sebagai Editor. Lihat README.md bagian "Setup Sinkron ke
// Google Sheets".

import { serve } from "https://deno.land/std@0.203.0/http/server.ts";

const SERVICE_ACCOUNT_KEY = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_KEY") ?? "";
const SPREADSHEET_ID = Deno.env.get("SPREADSHEET_ID") ?? "";

const HEADER_PENDAFTARAN = [
  "Nomor Pendaftaran", "Waktu Daftar", "Lomba", "Nama Lengkap", "Jenjang", "Kelas",
  "Tanggal Lahir", "Usia", "Asal Sekolah", "No. WhatsApp", "Email",
  "Nama Tim", "Guru Pendamping", "Link Surat Aktif Sekolah", "Link Kartu Pelajar", "Status"
];
const HEADER_ANGGOTA = ["Nomor Pendaftaran", "Nama Tim", "Nama Anggota", "Kelas"];

function base64UrlEncode(bytes: Uint8Array | string): string {
  const bin = typeof bytes === "string" ? bytes : String.fromCharCode(...bytes);
  return btoa(bin).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function getAccessToken(): Promise<string> {
  const sa = JSON.parse(SERVICE_ACCOUNT_KEY);
  const now = Math.floor(Date.now() / 1000);

  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600
  };

  const unsigned = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(JSON.stringify(claim))}`;

  const pem = sa.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s/g, "");
  const keyBytes = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    keyBytes,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(unsigned)
  );

  const jwt = `${unsigned}.${base64UrlEncode(new Uint8Array(signature))}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt
    })
  });
  const data = await res.json();
  if (!data.access_token) {
    throw new Error("Gagal ambil access token Google: " + JSON.stringify(data));
  }
  return data.access_token;
}

async function ensureHeader(sheetName: string, header: string[], accessToken: string) {
  const range = encodeURIComponent(`${sheetName}!A1:${String.fromCharCode(64 + header.length)}1`);
  const getUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${range}`;
  const getRes = await fetch(getUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
  const getData = await getRes.json();
  if (!getData.values || getData.values.length === 0) {
    await fetch(`${getUrl}?valueInputOption=USER_ENTERED`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ values: [header] })
    });
  }
}

async function appendRow(sheetName: string, values: unknown[], accessToken: string) {
  const range = encodeURIComponent(`${sheetName}!A1`);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${range}:append?valueInputOption=USER_ENTERED`;
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ values: [values] })
  });
  if (!res.ok) {
    throw new Error("Gagal menulis ke sheet " + sheetName + ": " + (await res.text()));
  }
}

serve(async (req) => {
  try {
    const payload = await req.json();
    const table = payload.table;
    const record = payload.record;

    const accessToken = await getAccessToken();

    if (table === "pendaftaran") {
      await ensureHeader("Pendaftaran", HEADER_PENDAFTARAN, accessToken);
      await appendRow("Pendaftaran", [
        record.nomor_pendaftaran,
        record.created_at,
        record.lomba_nama,
        record.nama_lengkap,
        record.jenjang,
        record.kelas,
        record.tanggal_lahir,
        record.usia,
        record.asal_sekolah,
        record.whatsapp,
        record.email ?? "",
        record.nama_tim ?? "",
        record.pembina ?? "",
        record.url_surat_aktif,
        record.url_kartu_pelajar,
        record.status
      ], accessToken);
    } else if (table === "anggota_tim") {
      await ensureHeader("Anggota Tim", HEADER_ANGGOTA, accessToken);
      await appendRow("Anggota Tim", [
        record.nomor_pendaftaran,
        record.nama_tim,
        record.nama,
        record.kelas
      ], accessToken);
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
});
