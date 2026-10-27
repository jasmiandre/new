// Seluruh naskah situs berkumpul di berkas ini.
//
// Mesin 3D tidak tahu apa-apa soal isi: ia hanya membaca daftar chapter di
// bawah. Mengganti naskah, jumlah bab, atau urutannya cukup dilakukan di sini.

/** Nama glif yang boleh dipakai sebuah tile. Lihat src/world/glyphs.ts. */
export type NamaGlif =
  | "kode"
  | "gelombang"
  | "kursor"
  | "kilau"
  | "kubus"
  | "lapisan"
  | "obrolan"
  | "diagram"
  | "panah"
  | "kisi"
  | "mata"
  | "simpul";

export type Tema = "gelap" | "terang";

export interface Chapter {
  /** Nomor dua digit yang tampil di HUD, misal "01". */
  nomor: string;
  /** Nama bab di HUD, selalu tampil dalam huruf besar. */
  nama: string;
  /** Tema dunia 3D selama bab ini berlangsung. */
  tema: Tema;
  /** Baris kecil di atas judul. */
  kicker?: string;
  /** Judul besar. Baris dipisah agar pemenggalannya terkendali. */
  judul?: string[];
  /** Paragraf pendukung. */
  teks?: string;
  /** Daftar butir, dipakai bab PROCESS. */
  butir?: { label: string; teks: string }[];
  /** Tautan aksi. */
  aksi?: { label: string; href: string; utama?: boolean }[];
}

export const situs = {
  nama: "STUDIO",
  tagline: "Pengalaman web yang digerakkan gerak",
  nav: ["Tentang", "Karya", "Proses", "Studio"],
  bahasa: ["ID", "EN"],
  cta: { label: "Mulai proyek", href: "#studio" },
};

export const chapters: Chapter[] = [
  {
    nomor: "00",
    nama: "Selamat datang",
    tema: "gelap",
    kicker: "Kami membangun pengalaman web yang bergerak",
    judul: ["Gerak,", "yang dirancang."],
    teks:
      "Situs interaktif untuk merek, kampanye, dan peluncuran produk. " +
      "Kami merencanakannya, mendesainnya, lalu membangunnya.",
    aksi: [
      { label: "Lihat karya", href: "#karya", utama: true },
      { label: "Mulai proyek", href: "#studio" },
    ],
  },
  {
    nomor: "01",
    nama: "Tentang",
    tema: "gelap",
    kicker: "Apa yang kami kerjakan",
    judul: ["Dirancang cermat.", "Terasa hidup."],
    teks:
      "Setiap bidang, bayang, dan jeda dihitung. Gerak bukan hiasan yang " +
      "ditempel belakangan — ia bagian dari rancangan sejak halaman pertama.",
  },
  {
    nomor: "02",
    nama: "Karya",
    tema: "terang",
    kicker: "Pilihan proyek",
    judul: ["Dari gagasan", "menjadi sesuatu", "yang bekerja."],
    teks:
      "Peluncuran produk, instalasi pameran, dan kampanye yang perlu " +
      "terasa berbeda sejak detik pertama halaman terbuka.",
  },
  {
    nomor: "03",
    nama: "Proses",
    tema: "gelap",
    kicker: "Cara kami bekerja",
    judul: ["Satu tim.", "Setiap tahap."],
    butir: [
      { label: "Petakan", teks: "Menentukan satu gagasan yang dibawa seluruh halaman." },
      { label: "Rancang", teks: "Tata letak, tipografi, dan gerak dirancang bersamaan." },
      { label: "Bangun", teks: "Diimplementasikan langsung di peramban, bukan di prototipe." },
      { label: "Rawat", teks: "Diukur, dirapikan, dan dijaga setelah diluncurkan." },
    ],
  },
  {
    nomor: "04",
    nama: "Studio",
    tema: "gelap",
    kicker: "Mari mulai",
    judul: ["Pengalaman berikutmu,", "bersama kami."],
    teks: "Ceritakan yang sedang kamu bangun. Kami balas dalam dua hari kerja.",
    aksi: [{ label: "Kirim surel", href: "mailto:halo@contoh.id", utama: true }],
  },
];

/**
 * Glif yang melayang di atas grid, satu set per bab.
 * Bab "Karya" sengaja memakai lebih sedikit tile tapi berukuran besar.
 */
export const glifPerChapter: NamaGlif[][] = [
  ["kode", "gelombang", "kursor", "kilau", "kubus", "simpul", "lapisan", "diagram"],
  ["simpul", "lapisan", "kubus", "kursor", "kode", "obrolan", "diagram", "kilau", "mata", "kisi"],
  ["kisi", "mata", "panah", "kubus", "kilau", "lapisan"],
  ["kisi", "diagram", "lapisan", "simpul", "panah", "kode", "obrolan", "gelombang"],
  ["kilau", "obrolan", "panah", "kursor", "kode", "kubus"],
];
