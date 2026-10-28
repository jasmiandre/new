// Label teks untuk simpul di dunia 3D.
//
// Teks digambar ke <canvas> lalu dipakai sebagai tekstur, bukan dimuat sebagai
// gambar. Label dibuat setelah font selesai dimuat (lihat main.ts), supaya yang
// tergambar benar-benar Geist Mono dan bukan monospace bawaan sistem.

import { CanvasTexture, LinearFilter, SRGBColorSpace, type Texture } from "three";

/** Rasio lebar terhadap tinggi kanvas label. Dipakai juga untuk rasio bidangnya. */
export const RASIO_LABEL = 4;

const TINGGI = 128;
const LEBAR = TINGGI * RASIO_LABEL;

export interface OpsiLabel {
  /** Baris kedua yang lebih kecil, misal peran simpul. */
  sub?: string;
  warna?: string;
  warnaSub?: string;
}

const tembolok = new Map<string, Texture>();

/**
 * Mengembalikan tekstur berisi satu label, lengkap dengan baris peran
 * di bawahnya bila diminta. Hasilnya disimpan di tembolok karena beberapa
 * salinan cluster memakai label yang sama.
 */
export function teksturLabel(teks: string, opsi: OpsiLabel = {}): Texture {
  const warna = opsi.warna ?? "#e6e9f0";
  const warnaSub = opsi.warnaSub ?? "#959db0";
  const kunci = `${teks}|${opsi.sub ?? ""}|${warna}|${warnaSub}`;

  const tersimpan = tembolok.get(kunci);
  if (tersimpan) return tersimpan;

  const kanvas = document.createElement("canvas");
  kanvas.width = LEBAR;
  kanvas.height = TINGGI;
  const c = kanvas.getContext("2d");
  if (!c) throw new Error("konteks 2d tidak tersedia untuk menggambar label");

  c.textAlign = "center";
  c.textBaseline = "middle";

  const mono = '"Geist Mono Variable", ui-monospace, monospace';
  if (opsi.sub) {
    c.font = `500 44px ${mono}`;
    c.fillStyle = warna;
    c.fillText(teks, LEBAR / 2, TINGGI * 0.36);

    c.font = `400 26px ${mono}`;
    c.fillStyle = warnaSub;
    c.fillText(opsi.sub.toUpperCase(), LEBAR / 2, TINGGI * 0.68);
  } else {
    c.font = `500 48px ${mono}`;
    c.fillStyle = warna;
    c.fillText(teks, LEBAR / 2, TINGGI / 2);
  }

  const tekstur = new CanvasTexture(kanvas);
  tekstur.colorSpace = SRGBColorSpace;
  tekstur.minFilter = LinearFilter;
  tekstur.magFilter = LinearFilter;
  tekstur.anisotropy = 8;
  tembolok.set(kunci, tekstur);
  return tekstur;
}
