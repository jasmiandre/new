// Dunia 3D: renderer, lintasan kamera melengkung, dan suasana.
//
// Kamera tidak lagi meluncur lurus melewati salinan-salinan beku. Ia bergerak
// di sepanjang kurva yang mengorbit satu sistem, mendekat ke region yang sedang
// diceritakan lalu menarik diri lagi untuk memperlihatkan keseluruhan. Posisi
// dan arah pandangnya tetap fungsi murni dari kemajuan gulir, jadi menggulir
// naik memutar balik pergerakan itu persis.

import {
  CatmullRomCurve3,
  Color,
  Fog,
  PerspectiveCamera,
  Scene,
  Vector3,
  WebGLRenderer,
} from "three";
import { chapters } from "../content";
import { Grid } from "./grid";
import { keadaanPada } from "./keadaan";
import { buatPasca, type Pasca } from "./pasca";
import { Sistem } from "./regions";

const WARNA_LATAR = new Color("#0b0f19");
const HIJAU = new Color("#3bd671");
const JINGGA = new Color("#f2561d");

/**
 * Satu titik acuan kamera per bab: tempat ia berdiri, titik yang dipandang,
 * dan kemiringan cakrawala.
 *
 * Bab bernaskah kiri sengaja memandang ke titik di sebelah kiri subjeknya,
 * supaya sistem jatuh di paruh kanan layar dan tidak bertabrakan dengan teks.
 */
const ACUAN: { posisi: Vector3; lihat: Vector3; guling: number; geser: number; detail: number }[] = [
  // 00 Panel — pandangan luas, sistem jauh dan rendah di layar
  { posisi: new Vector3(0, 30, 100), lihat: new Vector3(0, 21, 0), guling: -0.02, geser: 0, detail: 0 },
  // 01 Region — mendekat ke region-2
  { posisi: new Vector3(-58, 13, 46), lihat: new Vector3(-36, 6, 17), guling: 0.05, geser: 0.21, detail: 1 },
  // 02 Replikasi — naik, memperlihatkan ketiga tautan
  { posisi: new Vector3(-34, 38, 78), lihat: new Vector3(-17, 8, 19), guling: -0.04, geser: 0.15, detail: 1 },
  // 03 Padam — dekat ke region-2 saat ia meredup
  { posisi: new Vector3(-64, 15, 33), lihat: new Vector3(-38, 6, 16), guling: 0.07, geser: 0.21, detail: 1 },
  // 04 Berbelok — menarik diri, trafik berpindah ke region-3
  { posisi: new Vector3(-22, 34, 86), lihat: new Vector3(-12, 7, 17), guling: -0.05, geser: 0.15, detail: 1 },
  // 05 Pulih — kembali ke region-2
  { posisi: new Vector3(-56, 13, 48), lihat: new Vector3(-34, 6, 19), guling: 0.04, geser: 0.21, detail: 1 },
  // 06 Akses awal — luas lagi
  { posisi: new Vector3(0, 28, 106), lihat: new Vector3(0, 20, 0), guling: -0.02, geser: 0, detail: 0 },
];

const jepit = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/**
 * Smootherstep kuintik. Turunannya nol di KEDUA ujung, jadi gerak berangkat
 * dan berhenti tanpa sentakan — smoothstep biasa masih menyisakan percepatan
 * mendadak yang terbaca sebagai gerak kasar.
 */
const halus = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);

/** Porsi tiap bab yang dipakai untuk menahan bidikan, dibagi dua ujungnya. */
const TAHAN = 0.52;

/**
 * Mengubah kemajuan di dalam satu bab menjadi kemajuan kamera.
 *
 * Inilah yang membedakan rangkaian shot dari melayang terus-menerus: kamera
 * diam pada komposisinya selama sebagian besar bab, lalu berpindah ke
 * komposisi berikutnya di bagian tengah peralihan. Film tersusun dari bidikan
 * yang ditahan, bukan dari kamera yang tidak pernah berhenti bergerak.
 */
function tahanBidikan(t: number): number {
  const tepi = TAHAN / 2;
  if (t <= tepi) return 0;
  if (t >= 1 - tepi) return 1;
  return halus((t - tepi) / (1 - TAHAN));
}

export class Dunia {
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera: PerspectiveCamera;
  private readonly grid = new Grid();
  private readonly sistem = new Sistem();
  private readonly fog: Fog;
  private readonly jalurPosisi: CatmullRomCurve3;
  private readonly jalurLihat: CatmullRomCurve3;
  private readonly pasca: Pasca;
  private readonly sasaran = new Vector3();
  private readonly _maju = new Vector3();
  private readonly _kanan = new Vector3();

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setClearColor(WARNA_LATAR, 1);

    this.camera = new PerspectiveCamera(46, 1, 0.1, 700);
    this.fog = new Fog(WARNA_LATAR.getHex(), 40, 260);
    this.scene.fog = this.fog;

    this.scene.add(this.grid.mesh);
    this.sistem.aturKabut(WARNA_LATAR, this.fog.near, this.fog.far);
    this.scene.add(this.sistem.group);

    // Kurva Catmull-Rom membuat perpindahan antar acuan melengkung mulus,
    // bukan patah di tiap titik seperti interpolasi lurus.
    this.jalurPosisi = new CatmullRomCurve3(ACUAN.map((a) => a.posisi), false, "catmullrom", 0.4);
    this.jalurLihat = new CatmullRomCurve3(ACUAN.map((a) => a.lihat), false, "catmullrom", 0.4);

    this.pasca = buatPasca(this.renderer, this.scene, this.camera);

    this.ubahUkuran();
  }

  ubahUkuran() {
    const l = window.innerWidth;
    const t = window.innerHeight;
    // Bloom mengerjakan beberapa lintasan blur pada tiap kerangka, dan biayanya
    // tumbuh seiring jumlah piksel. Di layar sempit — yang hampir selalu
    // berarti ponsel — rasio piksel ditahan lebih rendah: pada kerapatan
    // setinggi itu selisihnya tidak terlihat, sedangkan beban rendernya hampir
    // separuh.
    const batasRasio = l < 760 ? 1.5 : 2;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, batasRasio));
    this.renderer.setSize(l, t, false);
    this.camera.aspect = l / t;
    this.camera.updateProjectionMatrix();
    this.pasca.ubahUkuran(l, t);
  }

  /**
   * Menentukan di antara acuan mana kamera berada, dan seberapa jauh
   * perpindahannya sudah berjalan setelah dilunakkan.
   *
   * Titik tengah bab ke-i jatuh tepat di acuan ke-i, jadi setengah bab di
   * kedua ujung halaman dipakai untuk menahan kamera di acuan pertama dan
   * terakhir — tanpa itu hero sudah bergerak sebelum pengguna menggulir.
   */
  private fase(kemajuan: number): { i: number; t: number } {
    const n = chapters.length;
    const skala = jepit(kemajuan * n - 0.5, 0, n - 1);
    const i = Math.min(Math.floor(skala), n - 2);
    return { i, t: tahanBidikan(skala - i) };
  }

  /** Mencampur satu nilai acuan memakai fase yang sama dengan kamera. */
  private acuanPada(f: { i: number; t: number }, ambil: (a: (typeof ACUAN)[number]) => number): number {
    const a = ambil(ACUAN[f.i]!);
    const b = ambil(ACUAN[f.i + 1]!);
    return a + (b - a) * f.t;
  }

  gambar(kemajuan: number, waktu: number) {
    const k = jepit(kemajuan, 0, 1);
    const f = this.fase(k);
    const u = (f.i + f.t) / (chapters.length - 1);

    this.jalurPosisi.getPoint(u, this.camera.position);
    this.jalurLihat.getPoint(u, this.sasaran);

    // Titik pandang digeser ke kiri sepanjang sumbu kanan kamera, sehingga
    // sistem terdorong ke paruh kanan layar dan kolom naskah tetap lapang.
    const geser = this.acuanPada(f, (a) => a.geser);
    if (geser !== 0) {
      this._maju.copy(this.sasaran).sub(this.camera.position);
      const jarak = this._maju.length();
      this._maju.divideScalar(jarak);
      this._kanan.copy(this._maju).cross(this.camera.up).normalize();
      this.sasaran.addScaledVector(this._kanan, -geser * jarak);
    }

    this.camera.lookAt(this.sasaran);
    this.camera.rotation.z += this.acuanPada(f, (a) => a.guling);

    // Napas kamera: goyangan amat kecil yang membuat bidikan terasa dipegang
    // orang, bukan dipaku ke rig. Diam sendirinya saat gerak dikurangi, karena
    // waktu yang masuk dibekukan di nol.
    this.camera.rotation.x += Math.sin(waktu * 0.27) * 0.0018;
    this.camera.rotation.y += Math.sin(waktu * 0.19 + 2.1) * 0.0022;
    this.camera.rotation.z += Math.sin(waktu * 0.23 + 0.7) * 0.0014;

    const keadaan = keadaanPada(k);

    this.grid.ikutiKamera(this.camera.position);
    // Pijar diletakkan di tengah sistem, jadi grid ikut menyala mengikuti
    // kesehatan izin: hijau selama ada pemimpin, jingga saat izinnya habis.
    this.grid.aturPijar(new Vector3(0, 4, 0));
    this.grid.aturSuasana(HIJAU.clone().lerp(JINGGA, 1 - keadaan.izin), 0.3);

    this.sistem.perbarui(keadaan, waktu, this.camera, this.acuanPada(f, (a) => a.detail));

    this.pasca.perbarui(waktu);
    this.pasca.composer.render();
  }

  dispose() {
    this.grid.dispose();
    this.sistem.dispose();
    this.pasca.dispose();
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
