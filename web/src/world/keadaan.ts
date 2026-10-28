// Keadaan cluster sebagai fungsi menerus dari posisi gulir.
//
// Inilah bedanya dengan versi sebelumnya: dunia tidak lagi memuat beberapa
// salinan beku yang dilewati kamera, melainkan SATU sistem yang benar-benar
// berubah di tempat. Region meredup sedikit demi sedikit, izinnya kedaluwarsa,
// kepemimpinan berpindah — semuanya sebagai nilai 0..1 yang dihitung ulang
// tiap kerangka.
//
// Karena seluruhnya fungsi murni dari kemajuan gulir, menggulir naik benar-
// benar memutar balik cerita: region yang padam menyala kembali persis seperti
// ia meredup.

import { chapters, PEMIMPIN_AWAL, PEMIMPIN_BARU } from "../content";

export interface Keadaan {
  /** Seberapa hidup tiap region, 0 padam sampai 1 sehat. */
  hidup: number[];
  /** Bobot kepemimpinan tiap region, 0..1. Nol semua berarti tanpa pemimpin. */
  pimpin: number[];
  /** Kesehatan izin kepemimpinan, 0 berarti sudah kedaluwarsa. */
  izin: number;
  /** Nomor izin yang sedang berlaku. */
  epoch: number;
  /** Seberapa kuat penolakan perintah berepoch lama sedang ditampilkan. */
  ditolak: number;
}

const jepit = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const halus = (t: number) => t * t * (3 - 2 * t);

/** Landai mulus dari 0 ke 1 ketika x bergerak dari a ke b. */
const landai = (x: number, a: number, b: number) => halus(jepit((x - a) / (b - a), 0, 1));

/**
 * Jadwal cerita, dalam satuan "bab": 0 di awal halaman, chapters.length di
 * akhir. Angkanya sengaja ditulis sebagai pecahan bab agar peristiwa jatuh di
 * dalam bab yang menceritakannya, bukan di perbatasan.
 */
const MATI_MULAI = 3.05;
const MATI_SELESAI = 3.75;
const IZIN_HABIS_MULAI = 3.5;
const IZIN_HABIS_SELESAI = 3.9;
const ALIH_MULAI = 3.95;
const ALIH_SELESAI = 4.35;
const IZIN_BARU_MULAI = 4.0;
const IZIN_BARU_SELESAI = 4.3;
const PULIH_MULAI = 5.0;
const PULIH_SELESAI = 5.65;
const TOLAK_MASUK = 5.15;
const TOLAK_KELUAR = 5.75;

export function keadaanPada(kemajuan: number): Keadaan {
  const n = chapters.length;
  const bab = jepit(kemajuan, 0, 1) * n;

  const mati = landai(bab, MATI_MULAI, MATI_SELESAI);
  const pulih = landai(bab, PULIH_MULAI, PULIH_SELESAI);
  // Region yang padam baru benar-benar hidup lagi setelah tahap pemulihan.
  const hidupPadam = 1 - mati * (1 - pulih);

  const hidup = chapters.map(() => 1);
  hidup[PEMIMPIN_AWAL] = hidupPadam;

  // Hanya tiga region yang digambar; sisanya tidak dipakai.
  const tiga = [hidup[0]!, hidup[1]!, hidup[2]!];

  const alih = landai(bab, ALIH_MULAI, ALIH_SELESAI);
  const pimpin = [0, 0, 0];
  // Region yang sedang padam tidak bisa memimpin, jadi bobotnya ikut meredup.
  pimpin[PEMIMPIN_AWAL] = (1 - alih) * tiga[PEMIMPIN_AWAL]!;
  pimpin[PEMIMPIN_BARU] = alih;

  const habis = landai(bab, IZIN_HABIS_MULAI, IZIN_HABIS_SELESAI);
  const baru = landai(bab, IZIN_BARU_MULAI, IZIN_BARU_SELESAI);
  const izin = 1 - habis * (1 - baru);

  const ditolak =
    landai(bab, TOLAK_MASUK, TOLAK_MASUK + 0.25) *
    (1 - landai(bab, TOLAK_KELUAR, TOLAK_KELUAR + 0.3));

  return {
    hidup: tiga,
    pimpin,
    izin,
    epoch: alih < 0.5 ? 41 : 42,
    ditolak,
  };
}
