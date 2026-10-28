// Seluruh naskah situs berkumpul di berkas ini.
//
// Mesin 3D tidak tahu apa-apa soal isi: ia hanya membaca daftar bab di bawah,
// dan satu medan `fase` yang memberi tahu keadaan apa yang harus digambarkan
// oleh diagram cluster.

/** Keadaan cluster yang digambarkan dunia 3D pada sebuah bab. */
export type Fase =
  | "normal"
  | "gangguan"
  | "izin-habis"
  | "pemimpin-baru"
  | "kembali";

/** Tata letak naskah: rata tengah untuk pembuka dan penutup, kiri untuk narasi. */
export type Tata = "tengah" | "kiri";

export interface Metrik {
  nilai: string;
  label: string;
}

export interface Chapter {
  nomor: string;
  nama: string;
  tata: Tata;
  fase: Fase;
  kicker?: string;
  judul: string[];
  teks?: string;
  /** Baris kecil bermonospace di bawah paragraf, untuk catatan status. */
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
  status: "7/7 sehat",
  bahasa: ["ID", "EN"],
  cta: { label: "Akses awal", href: "https://panel.ai.id/" },
};

export const chapters: Chapter[] = [
  {
    nomor: "00",
    nama: "Panel",
    tata: "tengah",
    fase: "normal",
    kicker: "AKSES AWAL · Terbuka untuk penyedia hosting",
    judul: ["Satu panel untuk semua", "server hosting Anda."],
    teks:
      "Panel kontrol untuk penyedia hosting yang menjalankan lebih dari satu " +
      "server. Website, DNS, backup, dan database pelanggan dikelola dari satu " +
      "tempat. Pengendali dan database panel berjalan di tiga server: kalau satu " +
      "mati, yang lain mengambil alih dalam belasan detik.",
    catatan:
      "Masih dalam pengembangan dan belum untuk produksi. Konsol web dan " +
      "website pelanggan belum ikut pindah otomatis.",
    aksi: [
      { label: "Ajukan akses awal", href: "https://panel.ai.id/", utama: true },
      { label: "Lihat cara kerjanya", href: "#bab-1" },
    ],
  },
  {
    nomor: "01",
    nama: "Normal",
    tata: "kiri",
    fase: "normal",
    kicker: "T+0 · NORMAL",
    judul: ["Satu pengendali", "memimpin."],
    teks:
      "Panel dikendalikan oleh tiga pengendali. ctl-2 menjadi pemimpin: ia " +
      "memegang izin bernomor 41 di etcd dan terus memperbaruinya. Server " +
      "hosting hanya menjalankan perintah dari pemimpin ini.",
  },
  {
    nomor: "02",
    nama: "Gangguan",
    tata: "kiri",
    fase: "gangguan",
    kicker: "T+1 · GANGGUAN",
    judul: ["Pemimpin berhenti", "menjawab."],
    teks:
      "Prosesnya macet, servernya hang, atau jaringannya putus. Kalau hanya " +
      "pengendalinya yang bermasalah, website pelanggan tetap berjalan dan yang " +
      "tertunda hanya perubahan baru dari panel.",
  },
  {
    nomor: "03",
    nama: "Izin habis",
    tata: "kiri",
    fase: "izin-habis",
    kicker: "T+2 · IZIN HABIS",
    judul: ["Izin punya", "batas waktu."],
    teks:
      "Begitu batas waktunya lewat, izin nomor 41 tidak bisa diperpanjang lagi " +
      "— juga oleh pemiliknya sendiri. Dua pengendali yang tersisa memilih " +
      "pemimpin baru.",
  },
  {
    nomor: "04",
    nama: "Pemimpin baru",
    tata: "kiri",
    fase: "pemimpin-baru",
    kicker: "T+3 · PEMIMPIN BARU",
    judul: ["Pemimpin baru", "dengan nomor baru."],
    teks:
      "Pemenangnya mendapat izin nomor 42, lebih tinggi dari semua nomor " +
      "sebelumnya. Server hosting langsung mengikuti pemimpin baru tanpa diatur " +
      "manual.",
    metrik: [
      { nilai: "1,5–2,2 dtk", label: "dihentikan normal" },
      { nilai: "13,8 dtk", label: "dibekukan" },
      { nilai: "17,5 dtk", label: "crash" },
    ],
    catatan: "Hasil uji di cluster pengembangan kami.",
  },
  {
    nomor: "05",
    nama: "Kembali",
    tata: "kiri",
    fase: "kembali",
    kicker: "T+4 · KEMBALI",
    judul: ["Pengendali lama hidup lagi,", "perintahnya ditolak."],
    teks:
      "Saat ctl-2 hidup lagi, perintahnya masih membawa nomor 41 dan langsung " +
      "ditolak. Siapa pemimpinnya ditentukan oleh nomor izin; jam server tidak " +
      "dipakai untuk itu.",
  },
  {
    nomor: "06",
    nama: "Akses awal",
    tata: "tengah",
    fase: "normal",
    kicker: "AKSES AWAL",
    judul: ["Coba lebih awal,", "bantu menentukan urutannya."],
    teks:
      "Terbuka untuk penyedia hosting yang menjalankan lebih dari satu server. " +
      "Setiap fitur diberi label statusnya: sudah diuji di cluster pengembangan " +
      "kami, atau segera hadir.",
    aksi: [{ label: "Ajukan akses awal", href: "https://panel.ai.id/", utama: true }],
  },
];

/** Nama simpul yang digambar di dunia 3D, searah dengan diagram di panel.ai.id. */
export const pengendali = ["ctl-1", "ctl-2", "ctl-3"] as const;
