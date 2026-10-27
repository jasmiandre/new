// Dunia 3D: renderer, lintasan kamera, dan peralihan tema.
//
// Seluruh gerak digerakkan oleh satu angka — kemajuan gulir 0..1. Tidak ada
// pustaka animasi di sini: posisi kamera adalah fungsi murni dari kemajuan,
// jadi menggulir mundur selalu menghasilkan kerangka yang persis sama.

import {
  Color,
  Fog,
  PerspectiveCamera,
  Scene,
  Vector3,
  WebGLRenderer,
} from "three";
import { chapters, glifPerChapter } from "../content";
import { Grid } from "./grid";
import { sebarTile, type Tile } from "./tiles";

/** Panjang lintasan kamera dalam satuan dunia, dari awal sampai akhir gulir. */
const PANJANG_LINTASAN = 620;

const WARNA_GELAP = new Color("#04060c");
const WARNA_TERANG = new Color("#eceff5");

/** Sikap kamera pada satu titik lintasan. */
interface Sikap {
  tinggi: number;
  geser: number;
  guling: number;
  tunduk: number;
}

/**
 * Sikap kamera di tiap bab. Nilai di antara dua bab dicampur mulus, sehingga
 * kamera terasa mengayun alih-alih berpindah mendadak.
 */
const SIKAP: Sikap[] = [
  { tinggi: 6.5, geser: -3.0, guling: -0.14, tunduk: 0.20 }, // 00 sambutan
  { tinggi: 11.0, geser: 3.5, guling: 0.10, tunduk: 0.40 }, // 01 tentang
  { tinggi: 6.0, geser: -1.5, guling: -0.05, tunduk: 0.16 }, // 02 karya
  { tinggi: 9.5, geser: 3.0, guling: 0.12, tunduk: 0.34 }, // 03 proses
  { tinggi: 7.0, geser: -1.0, guling: -0.08, tunduk: 0.22 }, // 04 studio
];

const jepit = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const campur = (a: number, b: number, t: number) => a + (b - a) * t;
const halus = (t: number) => t * t * (3 - 2 * t);

/** Mencampur sikap kamera sesuai posisi di sepanjang seluruh lintasan. */
function sikapPada(kemajuan: number): Sikap {
  const n = SIKAP.length;
  const skala = jepit(kemajuan, 0, 1) * (n - 1);
  const i = Math.min(Math.floor(skala), n - 2);
  const t = halus(skala - i);
  const a = SIKAP[i]!;
  const b = SIKAP[i + 1]!;
  return {
    tinggi: campur(a.tinggi, b.tinggi, t),
    geser: campur(a.geser, b.geser, t),
    guling: campur(a.guling, b.guling, t),
    tunduk: campur(a.tunduk, b.tunduk, t),
  };
}

/**
 * Nilai tema pada satu titik gulir: 0 gelap, 1 terang.
 * Peralihan dibuat melebar di perbatasan bab agar pembalikan warna terasa
 * sebagai satu gerakan, bukan kedipan.
 */
export function nilaiTema(kemajuan: number): number {
  const n = chapters.length;
  const terang = (i: number) => (chapters[jepit(i, 0, n - 1)]!.tema === "terang" ? 1 : 0);

  const skala = jepit(kemajuan, 0, 0.9999) * n;
  const i = Math.floor(skala);
  const lokal = skala - i;
  const lebar = 0.22;

  if (lokal < lebar && i > 0) {
    return campur(terang(i - 1), terang(i), halus(lokal / lebar));
  }
  if (lokal > 1 - lebar && i < n - 1) {
    return campur(terang(i), terang(i + 1), halus((lokal - (1 - lebar)) / lebar));
  }
  return terang(i);
}

export class Dunia {
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera: PerspectiveCamera;
  private readonly grid = new Grid();
  private readonly tiles: Tile[];
  private readonly fog: Fog;
  private readonly sasaran = new Vector3();
  private temaTerakhir = -1;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setClearColor(WARNA_GELAP, 1);

    this.camera = new PerspectiveCamera(46, 1, 0.1, 500);
    this.fog = new Fog(WARNA_GELAP.getHex(), 30, 210);
    this.scene.fog = this.fog;

    this.scene.add(this.grid.mesh);

    this.tiles = sebarTile(glifPerChapter, PANJANG_LINTASAN);
    for (const t of this.tiles) this.scene.add(t.group);

    for (const t of this.tiles) t.aturKabut(WARNA_GELAP, this.fog.near, this.fog.far);

    this.ubahUkuran();
  }

  ubahUkuran() {
    const l = window.innerWidth;
    const t = window.innerHeight;
    // Rasio piksel dibatasi 2: di atas itu biaya render naik tajam tanpa
    // perbedaan yang terlihat.
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(l, t, false);
    this.camera.aspect = l / t;
    this.camera.updateProjectionMatrix();
  }

  /**
   * Menggambar satu kerangka.
   *
   * @param kemajuan posisi gulir yang sudah dihaluskan, 0..1
   * @param waktu    detik sejak halaman dimuat, untuk gerak menganggur
   */
  gambar(kemajuan: number, waktu: number) {
    const k = jepit(kemajuan, 0, 1);
    const sikap = sikapPada(k);
    const z = -k * PANJANG_LINTASAN;

    this.camera.position.set(sikap.geser, sikap.tinggi, z);
    this.sasaran.set(
      sikap.geser * 0.35,
      sikap.tinggi - sikap.tunduk * 26,
      z - 34,
    );
    this.camera.lookAt(this.sasaran);
    // Guling diterapkan setelah lookAt supaya cakrawala ikut miring.
    this.camera.rotation.z += sikap.guling;

    this.grid.ikutiKamera(this.camera.position);
    this.grid.aturPijar(
      new Vector3(sikap.geser + 48, 8, z - 110),
      1.15 - nilaiTema(k) * 0.95,
    );

    for (const t of this.tiles) t.perbarui(waktu);

    this.terapkanTema(nilaiTema(k));
    this.renderer.render(this.scene, this.camera);
  }

  private terapkanTema(nilai: number) {
    // Warna hanya dihitung ulang ketika memang berubah.
    if (Math.abs(nilai - this.temaTerakhir) < 0.002) return;
    this.temaTerakhir = nilai;

    const warna = WARNA_GELAP.clone().lerp(WARNA_TERANG, nilai);
    this.renderer.setClearColor(warna, 1);
    this.fog.color.copy(warna);
    this.grid.aturTema(nilai);
    for (const t of this.tiles) {
      t.aturTema(nilai);
      t.aturKabut(warna, this.fog.near, this.fog.far);
    }
  }

  dispose() {
    this.grid.dispose();
    for (const t of this.tiles) t.dispose();
    this.renderer.dispose();
  }
}

/** Memeriksa apakah peramban benar-benar bisa membuat konteks WebGL. */
export function webglTersedia(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}
