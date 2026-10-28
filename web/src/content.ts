// Seluruh naskah situs berkumpul di berkas ini.
//
// Berbeda dari versi sebelumnya, dunia 3D kini menggambarkan SATU sistem yang
// sama sepanjang halaman. Bab tidak lagi membawa keadaannya sendiri-sendiri;
// keadaan cluster dihitung sebagai fungsi menerus dari posisi gulir di
// world/keadaan.ts. Bab di sini hanya menentukan naskah dan sikap kamera.

export type Tata = "tengah" | "kiri";

/**
 * Label status, mengikuti konvensi panel.ai.id: tiap klaim menyebut apakah ia
 * sudah diuji atau masih dikerjakan.
 */
export type Status = "diuji" | "segera";

export interface Metrik {
  nilai: string;
  label: string;
}

export interface Chapter {
  nomor: string;
  nama: string;
  tata: Tata;
  status?: Status;
  kicker?: string;
  judul: string[];
  teks?: string;
  catatan?: string;
  metrik?: Metrik[];
  aksi?: { label: string; href: string; utama?: boolean }[];
}

export const situs = {
  nama: "panel.ai.id",
  nav: [
    { label: "Cara kerja", href: "#bab-1" },
    { label: "Failover", href: "#bab-3" },
    { label: "Akses awal", href: "#bab-6" },
  ],
  status: "3/3 region",
  bahasa: ["ID", "EN"],
  cta: { label: "Akses awal", href: "https://panel.ai.id/" },
};

export const LABEL_STATUS: Record<Status, string> = {
  diuji: "SUDAH DIUJI DI CLUSTER KAMI",
  segera: "SEDANG DIKERJAKAN",
};

export const chapters: Chapter[] = [
  {
    nomor: "00",
    nama: "Panel",
    tata: "tengah",
    kicker: "AKSES AWAL · Terbuka untuk penyedia hosting",
    judul: ["Satu panel.", "Tiga region."],
    teks:
      "Panel kontrol untuk penyedia hosting yang menjalankan lebih dari satu " +
      "server. Pengendali dan database panel berjalan di tiga region — kalau " +
      "satu region berhenti menjawab, dua sisanya mengambil alih tanpa diatur " +
      "manual.",
    catatan:
      "Masih dalam pengembangan dan belum untuk produksi. Failover pengendali " +
      "sudah diuji di cluster kami; perpindahan konsol web dan website " +
      "pelanggan sedang dikerjakan.",
    aksi: [
      { label: "Ajukan akses awal", href: "https://panel.ai.id/", utama: true },
      { label: "Lihat cara kerjanya", href: "#bab-1" },
    ],
  },
  {
    nomor: "01",
    nama: "Region",
    tata: "kiri",
    status: "diuji",
    kicker: "01 · SATU REGION",
    judul: ["Tiap region", "berdiri sendiri."],
    teks:
      "Satu region membawa pengendali panel, salinan databasenya, dan server " +
      "hosting yang melayani website pelanggan. Tidak ada satu pun bagian yang " +
      "hanya hidup di satu tempat.",
  },
  {
    nomor: "02",
    nama: "Replikasi",
    tata: "kiri",
    status: "diuji",
    kicker: "02 · REPLIKASI",
    judul: ["Ketiganya", "saling menyalin."],
    teks:
      "Satu region memegang izin kepemimpinan bernomor 41 dan terus " +
      "memperbaruinya. Perubahan apa pun dari panel mengalir ke dua region " +
      "lain sebelum dianggap selesai.",
  },
  {
    nomor: "03",
    nama: "Padam",
    tata: "kiri",
    status: "diuji",
    kicker: "03 · PADAM",
    judul: ["Satu region", "berhenti menjawab."],
    teks:
      "Prosesnya macet, servernya hang, atau jaringannya putus. Izin nomor 41 " +
      "tidak bisa diperpanjang lagi begitu batas waktunya lewat — juga oleh " +
      "pemiliknya sendiri.",
  },
  {
    nomor: "04",
    nama: "Berbelok",
    tata: "kiri",
    status: "diuji",
    kicker: "04 · AMBIL ALIH",
    judul: ["Dua sisanya", "mengambil alih."],
    teks:
      "Pemenangnya mendapat izin nomor 42, lebih tinggi dari semua nomor " +
      "sebelumnya. Server hosting langsung mengikuti pemimpin baru tanpa " +
      "diatur manual.",
    metrik: [
      { nilai: "1,5–2,2 dtk", label: "dihentikan normal" },
      { nilai: "13,8 dtk", label: "dibekukan" },
      { nilai: "17,5 dtk", label: "crash" },
    ],
    catatan:
      "Angka failover pengendali dari uji di cluster pengembangan kami. " +
      "Perpindahan website pelanggan antar region sedang dikerjakan.",
  },
  {
    nomor: "05",
    nama: "Pulih",
    tata: "kiri",
    status: "diuji",
    kicker: "05 · KEMBALI",
    judul: ["Region lama kembali,", "nomor lamanya ditolak."],
    teks:
      "Saat region itu hidup lagi, perintahnya masih membawa nomor 41 dan " +
      "langsung ditolak. Siapa pemimpinnya ditentukan oleh nomor izin; jam " +
      "server tidak dipakai untuk itu.",
  },
  {
    nomor: "06",
    nama: "Akses awal",
    tata: "tengah",
    kicker: "AKSES AWAL",
    judul: ["Coba lebih awal,", "bantu menentukan urutannya."],
    teks:
      "Terbuka untuk penyedia hosting yang menjalankan lebih dari satu server. " +
      "Setiap fitur diberi label statusnya: sudah diuji di cluster kami, atau " +
      "sedang dikerjakan.",
    aksi: [{ label: "Ajukan akses awal", href: "https://panel.ai.id/", utama: true }],
  },
];

/** Nama region yang digambar di dunia 3D. */
export const REGION = ["region-1", "region-2", "region-3"] as const;

/** Region yang memimpin di awal cerita, dan yang mengambil alih setelah padam. */
export const PEMIMPIN_AWAL = 1;
export const PEMIMPIN_BARU = 2;
