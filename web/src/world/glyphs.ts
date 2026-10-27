// Glif untuk tile yang melayang di atas grid.
//
// Semua ikon digambar ke <canvas> saat runtime alih-alih dimuat sebagai berkas
// gambar. Hasilnya: tidak ada aset terpisah yang perlu ikut dipaket, dan ikon
// tetap tajam pada rasio piksel berapa pun.

import { CanvasTexture, LinearFilter, SRGBColorSpace, type Texture } from "three";
import type { NamaGlif } from "../content";

/** Ukuran sisi kanvas glif dalam piksel. */
const UKURAN = 256;

/** Semua ikon digambar di dalam kotak satuan 0..1 lalu diskalakan. */
type Pelukis = (c: CanvasRenderingContext2D) => void;

function garis(c: CanvasRenderingContext2D, titik: [number, number][], tutup = false) {
  c.beginPath();
  titik.forEach(([x, y], i) => (i === 0 ? c.moveTo(x, y) : c.lineTo(x, y)));
  if (tutup) c.closePath();
  c.stroke();
}

function lingkaran(c: CanvasRenderingContext2D, x: number, y: number, r: number, isi = false) {
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  isi ? c.fill() : c.stroke();
}

const pelukis: Record<NamaGlif, Pelukis> = {
  // Sepasang kurung sudut: </>
  kode: (c) => {
    garis(c, [[0.38, 0.3], [0.18, 0.5], [0.38, 0.7]]);
    garis(c, [[0.62, 0.3], [0.82, 0.5], [0.62, 0.7]]);
  },

  // Batang gelombang suara dengan tinggi berbeda.
  gelombang: (c) => {
    const tinggi = [0.18, 0.34, 0.5, 0.34, 0.22];
    tinggi.forEach((t, i) => {
      const x = 0.24 + i * 0.13;
      garis(c, [[x, 0.5 - t / 2], [x, 0.5 + t / 2]]);
    });
  },

  // Penunjuk tetikus.
  kursor: (c) => {
    garis(c, [[0.33, 0.22], [0.33, 0.73], [0.46, 0.61], [0.56, 0.8], [0.65, 0.75], [0.55, 0.57], [0.72, 0.54]], true);
  },

  // Kilau empat sudut.
  kilau: (c) => {
    c.beginPath();
    c.moveTo(0.5, 0.16);
    c.quadraticCurveTo(0.54, 0.46, 0.84, 0.5);
    c.quadraticCurveTo(0.54, 0.54, 0.5, 0.84);
    c.quadraticCurveTo(0.46, 0.54, 0.16, 0.5);
    c.quadraticCurveTo(0.46, 0.46, 0.5, 0.16);
    c.closePath();
    c.stroke();
  },

  // Kubus isometrik.
  kubus: (c) => {
    garis(c, [[0.5, 0.18], [0.81, 0.34], [0.81, 0.66], [0.5, 0.82], [0.19, 0.66], [0.19, 0.34]], true);
    garis(c, [[0.5, 0.18], [0.5, 0.5]]);
    garis(c, [[0.5, 0.5], [0.81, 0.34]]);
    garis(c, [[0.5, 0.5], [0.19, 0.34]]);
  },

  // Tiga lapis bidang bertumpuk.
  lapisan: (c) => {
    garis(c, [[0.5, 0.2], [0.8, 0.36], [0.5, 0.52], [0.2, 0.36]], true);
    garis(c, [[0.2, 0.5], [0.5, 0.66], [0.8, 0.5]]);
    garis(c, [[0.2, 0.64], [0.5, 0.8], [0.8, 0.64]]);
  },

  // Balon percakapan.
  obrolan: (c) => {
    c.beginPath();
    const r = 0.1;
    const [x0, y0, x1, y1] = [0.18, 0.24, 0.82, 0.64];
    c.moveTo(x0 + r, y0);
    c.arcTo(x1, y0, x1, y1, r);
    c.arcTo(x1, y1, x0, y1, r);
    c.lineTo(0.42, y1);
    c.lineTo(0.3, 0.78);
    c.lineTo(0.3, y1);
    c.arcTo(x0, y1, x0, y0, r);
    c.arcTo(x0, y0, x1, y0, r);
    c.closePath();
    c.stroke();
  },

  // Diagram batang.
  diagram: (c) => {
    garis(c, [[0.2, 0.78], [0.8, 0.78]]);
    [[0.32, 0.56], [0.5, 0.36], [0.68, 0.48]].forEach(([x, y]) => garis(c, [[x!, y!], [x!, 0.74]]));
  },

  // Panah serong ke kanan atas.
  panah: (c) => {
    garis(c, [[0.26, 0.74], [0.74, 0.26]]);
    garis(c, [[0.45, 0.26], [0.74, 0.26], [0.74, 0.55]]);
  },

  // Kisi 2x2 dengan tanda tambah di sudut kanan bawah.
  kisi: (c) => {
    const s = 0.2;
    [[0.22, 0.22], [0.56, 0.22], [0.22, 0.56]].forEach(([x, y]) => c.strokeRect(x!, y!, s, s));
    garis(c, [[0.66, 0.56], [0.66, 0.8]]);
    garis(c, [[0.54, 0.68], [0.78, 0.68]]);
  },

  // Mata sederhana.
  mata: (c) => {
    c.beginPath();
    c.moveTo(0.18, 0.5);
    c.quadraticCurveTo(0.5, 0.2, 0.82, 0.5);
    c.quadraticCurveTo(0.5, 0.8, 0.18, 0.5);
    c.closePath();
    c.stroke();
    lingkaran(c, 0.5, 0.5, 0.11);
  },

  // Graf simpul berbentuk segitiga.
  simpul: (c) => {
    const p: [number, number][] = [[0.5, 0.24], [0.24, 0.72], [0.76, 0.72]];
    garis(c, p, true);
    p.forEach(([x, y]) => {
      c.save();
      c.globalCompositeOperation = "destination-out";
      lingkaran(c, x, y, 0.1, true);
      c.restore();
      lingkaran(c, x, y, 0.085);
    });
  },
};

const tembolok = new Map<NamaGlif, Texture>();

/**
 * Mengembalikan tekstur untuk sebuah glif. Hasilnya disimpan di tembolok
 * karena beberapa tile boleh memakai glif yang sama.
 */
export function teksturGlif(nama: NamaGlif): Texture {
  const tersimpan = tembolok.get(nama);
  if (tersimpan) return tersimpan;

  const kanvas = document.createElement("canvas");
  kanvas.width = kanvas.height = UKURAN;
  const c = kanvas.getContext("2d");
  if (!c) throw new Error("konteks 2d tidak tersedia untuk menggambar glif");

  c.scale(UKURAN, UKURAN);
  c.strokeStyle = "#ffffff";
  c.fillStyle = "#ffffff";
  c.lineWidth = 0.055;
  c.lineCap = "round";
  c.lineJoin = "round";
  pelukis[nama](c);

  const tekstur = new CanvasTexture(kanvas);
  tekstur.colorSpace = SRGBColorSpace;
  tekstur.minFilter = LinearFilter;
  tekstur.magFilter = LinearFilter;
  tekstur.anisotropy = 4;
  tembolok.set(nama, tekstur);
  return tekstur;
}
