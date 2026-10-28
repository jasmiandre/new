// Dunia 3D: renderer, lintasan kamera, dan suasana per bab.
//
// Satu diagram cluster berdiri di depan tiap bab, masing-masing membeku pada
// satu momen cerita failover. Kamera melaju lurus melewatinya, jadi urutan
// waktu dibentangkan menjadi urutan ruang.

import { Color, Fog, PerspectiveCamera, Scene, Vector3, WebGLRenderer } from "three";
import { chapters, type Fase } from "../content";
import { Cluster } from "./cluster";
import { Grid } from "./grid";

/** Panjang lintasan kamera dalam satuan dunia, dari awal sampai akhir gulir. */
const PANJANG_LINTASAN = 760;

/**
 * Jarak diagram di depan kamera saat babnya berada tepat di tengah layar.
 * Bab bernaskah rata tengah menaruh diagramnya jauh lebih ke depan: judul
 * besar menempati tengah layar, jadi diagram yang dekat akan tertimpa teks.
 * Dari jarak itu ia terbaca sebagai gugusan cahaya di kejauhan.
 */
const JARAK_DIAGRAM = { tengah: 108, kiri: 30 };

const WARNA_LATAR = new Color("#0b0f19");

/** Warna pijar yang menyapu grid, mengikuti keadaan cluster di bab itu. */
const PIJAR: Record<Fase, string> = {
  "normal": "#3bd671",
  "gangguan": "#f5b83d",
  "izin-habis": "#f2561d",
  "pemimpin-baru": "#3bd671",
  "kembali": "#3bd671",
};

interface Sikap {
  tinggi: number;
  geser: number;
  guling: number;
  tunduk: number;
}

const jepit = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const campur = (a: number, b: number, t: number) => a + (b - a) * t;
const halus = (t: number) => t * t * (3 - 2 * t);

/**
 * Sikap kamera untuk sebuah bab.
 *
 * Bab bernaskah rata tengah memakai pandangan lebih tinggi dan lebih menunduk,
 * supaya diagram turun ke sepertiga bawah layar dan judul besar punya ruang
 * kosong di tengah. Bab bernarasi menggeser kamera ke kiri agar diagramnya
 * jatuh di sisi kanan, berseberangan dengan kolom teks.
 */
function sikapBab(indeks: number): Sikap {
  const bab = chapters[indeks]!;
  if (bab.tata === "tengah") {
    return { tinggi: 10.5, geser: 0, guling: -0.03, tunduk: 0.40 };
  }
  // Arah geser berselang-seling supaya kamera terasa mengayun, bukan meluncur
  // di rel lurus, sementara diagram tetap di sisi kanan.
  const ayun = indeks % 2 === 0 ? 1 : -1;
  return {
    tinggi: 7.5 + ayun * 1.2,
    geser: -4.5 + ayun * 1.5,
    guling: ayun * 0.055,
    tunduk: 0.24,
  };
}

/**
 * Posisi mendatar diagram untuk sebuah bab. Bab rata tengah mendorong
 * diagramnya jauh ke samping: naskahnya menempati tengah layar, jadi gugusan
 * yang sejajar sumbu pandang akan terbaca sebagai noda di balik judul.
 */
function geserDiagram(indeks: number): number {
  return chapters[indeks]!.tata === "tengah" ? 34 : 7;
}

/** Titik tengah gulir untuk sebuah bab, dalam 0..1. */
function tengahBab(indeks: number): number {
  return (indeks + 0.5) / chapters.length;
}

/** Mencampur sikap kamera di antara titik tengah dua bab yang berdekatan. */
function sikapPada(kemajuan: number): Sikap {
  const n = chapters.length;
  const skala = jepit(kemajuan, 0, 1) * n - 0.5;
  const i = jepit(Math.floor(skala), 0, n - 2);
  const t = halus(jepit(skala - i, 0, 1));
  const a = sikapBab(i);
  const b = sikapBab(i + 1);
  return {
    tinggi: campur(a.tinggi, b.tinggi, t),
    geser: campur(a.geser, b.geser, t),
    guling: campur(a.guling, b.guling, t),
    tunduk: campur(a.tunduk, b.tunduk, t),
  };
}

/** Warna pijar pada satu titik gulir, dicampur antar bab agar tidak berkedip. */
function pijarPada(kemajuan: number): Color {
  const n = chapters.length;
  const skala = jepit(kemajuan, 0, 1) * n - 0.5;
  const i = jepit(Math.floor(skala), 0, n - 2);
  const t = halus(jepit(skala - i, 0, 1));
  return new Color(PIJAR[chapters[i]!.fase])
    .lerp(new Color(PIJAR[chapters[i + 1]!.fase]), t);
}

export class Dunia {
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera: PerspectiveCamera;
  private readonly grid = new Grid();
  private readonly cluster: Cluster[] = [];
  private readonly fog: Fog;
  private readonly sasaran = new Vector3();

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setClearColor(WARNA_LATAR, 1);

    this.camera = new PerspectiveCamera(46, 1, 0.1, 500);
    this.fog = new Fog(WARNA_LATAR.getHex(), 34, 190);
    this.scene.fog = this.fog;
    this.scene.add(this.grid.mesh);

    chapters.forEach((bab, i) => {
      const z = -tengahBab(i) * PANJANG_LINTASAN - JARAK_DIAGRAM[bab.tata];
      const c = new Cluster(
        new Vector3(geserDiagram(i), 0, z),
        bab.fase,
        // Diagram diputar sedikit supaya ketiga menaranya tidak pernah saling
        // menutupi tepat dari arah kamera.
        bab.tata === "tengah" ? 0.25 : -0.5,
      );
      c.aturKabut(WARNA_LATAR, this.fog.near, this.fog.far);
      this.cluster.push(c);
      this.scene.add(c.group);
    });

    this.ubahUkuran();
  }

  ubahUkuran() {
    const l = window.innerWidth;
    const t = window.innerHeight;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(l, t, false);
    this.camera.aspect = l / t;
    this.camera.updateProjectionMatrix();
  }

  gambar(kemajuan: number, waktu: number) {
    const k = jepit(kemajuan, 0, 1);
    const sikap = sikapPada(k);
    const z = -k * PANJANG_LINTASAN;

    this.camera.position.set(sikap.geser, sikap.tinggi, z);
    this.sasaran.set(sikap.geser * 0.3, sikap.tinggi - sikap.tunduk * 26, z - 34);
    this.camera.lookAt(this.sasaran);
    this.camera.rotation.z += sikap.guling;

    this.grid.ikutiKamera(this.camera.position);
    this.grid.aturPijar(new Vector3(sikap.geser + 22, 5, z - 58));
    this.grid.aturSuasana(pijarPada(k), 0.22);

    for (const c of this.cluster) c.perbarui(waktu, this.camera);

    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.grid.dispose();
    for (const c of this.cluster) c.dispose();
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
