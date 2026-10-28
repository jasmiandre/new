// Tiga region sebagai satu sistem hidup di dalam dunia 3D.
//
// Hanya ada SATU salinan sistem ini di seluruh halaman. Keadaannya dihitung
// ulang tiap kerangka dari posisi gulir (lihat keadaan.ts), jadi region benar-
// benar meredup di depan mata, izinnya kedaluwarsa, dan kepemimpinan berpindah
// — bukan berganti karena kamera melewati salinan lain.

import {
  AdditiveBlending,
  BoxGeometry,
  CircleGeometry,
  Color,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  ShaderMaterial,
  Vector3,
  type Camera,
} from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { REGION } from "../content";
import type { Keadaan } from "./keadaan";
import { RASIO_LABEL, teksturLabel } from "./labels";

const _bantu = new Vector3();

const HIJAU = new Color("#3bd671");
const SLATE = new Color("#7d93bd");
const PADAM = new Color("#1a2232");
const JINGGA = new Color("#f2561d");

const TINGGI_MENARA = 6;
const JARI_JARI_SISTEM = 22;
const JUMLAH_NODE = 3;

/** Posisi ketiga region, membentuk segitiga sama sisi mengelilingi titik asal. */
export const POSISI_REGION = [0, 1, 2].map((i) => {
  const sudut = (i / 3) * Math.PI * 2 - Math.PI / 2;
  return new Vector3(
    Math.cos(sudut) * JARI_JARI_SISTEM,
    0,
    Math.sin(sudut) * JARI_JARI_SISTEM,
  );
});

/**
 * Tinggi label sebagai pecahan tinggi layar. Kamera menjauh sampai lebih dari
 * seratus satuan pada bab pandangan luas; tanpa penskalaan ini, label yang
 * terbaca dari dekat menyusut jadi noda yang tak bisa dibaca sama sekali.
 */
const TINGGI_LAYAR_LABEL = 0.045;

/** Tinggi layar dalam satuan dunia pada jarak tertentu, untuk fov 46 derajat. */
const TINGGI_DUNIA_PER_JARAK = 2 * Math.tan((46 * Math.PI) / 180 / 2);

function skalaLabel(jarak: number, tinggiDasar: number): number {
  const mau = jarak * TINGGI_DUNIA_PER_JARAK * TINGGI_LAYAR_LABEL;
  return Math.min(4, Math.max(0.6, mau / tinggiDasar));
}

const KABUT = /* glsl */ `
  uniform vec3  uKabut;
  uniform float uKabutDekat;
  uniform float uKabutJauh;
  varying float vKedalaman;
`;

const kabutUniforms = () => ({
  uKabut: { value: new Color("#0b0f19") },
  uKabutDekat: { value: 40 },
  uKabutJauh: { value: 260 },
});

interface PunyaUniform {
  uniforms: Record<string, { value: unknown }>;
}

function setKabut(m: PunyaUniform, warna: Color, dekat: number, jauh: number) {
  (m.uniforms.uKabut!.value as Color).copy(warna);
  m.uniforms.uKabutDekat!.value = dekat;
  m.uniforms.uKabutJauh!.value = jauh;
}

// --- menara dan simpul ---

const padatVert = /* glsl */ `
  varying vec3  vNormalDunia;
  varying vec3  vArahPandang;
  varying float vTinggi;
  ${KABUT}
  uniform float uTinggi;

  void main() {
    vTinggi = clamp(position.y / uTinggi + 0.5, 0.0, 1.0);
    vNormalDunia = normalize(mat3(modelMatrix) * normal);
    vec4 dunia = modelMatrix * vec4(position, 1.0);
    vArahPandang = normalize(cameraPosition - dunia.xyz);
    vec4 pandang = viewMatrix * dunia;
    vKedalaman = -pandang.z;
    gl_Position = projectionMatrix * pandang;
  }
`;

const padatFrag = /* glsl */ `
  precision highp float;
  varying vec3  vNormalDunia;
  varying vec3  vArahPandang;
  varying float vTinggi;
  ${KABUT}
  uniform vec3  uWarna;
  uniform float uNyala;

  void main() {
    vec3 warna = mix(uWarna * 0.22, uWarna, pow(vTinggi, 1.3)) * uNyala;
    float fresnel = pow(1.0 - clamp(dot(normalize(vNormalDunia), normalize(vArahPandang)), 0.0, 1.0), 2.5);
    warna += uWarna * fresnel * 0.45 * uNyala;
    float kabut = smoothstep(uKabutDekat, uKabutJauh, vKedalaman);
    gl_FragColor = vec4(mix(warna, uKabut, kabut), 1.0);
  }
`;

const cakramVert = /* glsl */ `
  varying vec2 vUv;
  ${KABUT}
  void main() {
    vUv = uv;
    vec4 pandang = modelViewMatrix * vec4(position, 1.0);
    vKedalaman = -pandang.z;
    gl_Position = projectionMatrix * pandang;
  }
`;

const cakramFrag = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  ${KABUT}
  uniform vec3  uWarna;
  uniform float uNyala;
  uniform float uWaktu;

  void main() {
    float r = length(vUv - 0.5) * 2.0;
    // Lingkar tepi yang berdenyut pelan, menandai batas wilayah region.
    float tepi = exp(-pow(r - 0.9, 2.0) * 160.0);
    float isi = (1.0 - smoothstep(0.0, 1.0, r)) * 0.4;
    float denyut = 0.75 + 0.25 * sin(uWaktu * 1.4);
    float a = (isi + tepi * denyut) * uNyala;
    float kabut = smoothstep(uKabutDekat, uKabutJauh, vKedalaman);
    gl_FragColor = vec4(uWarna * (1.0 - kabut), a);
  }
`;

const tautanVert = /* glsl */ `
  varying float vT;
  ${KABUT}
  void main() {
    vT = position.z + 0.5;
    vec4 pandang = modelViewMatrix * vec4(position, 1.0);
    vKedalaman = -pandang.z;
    gl_Position = projectionMatrix * pandang;
  }
`;

const tautanFrag = /* glsl */ `
  precision highp float;
  varying float vT;
  ${KABUT}
  uniform vec3  uWarna;
  uniform float uWaktu;
  uniform float uAktif;
  uniform float uArah;

  void main() {
    float p = fract(vT * uArah - uWaktu * 0.4);
    float denyut = exp(-pow(p - 0.5, 2.0) * 70.0);
    float a = (0.14 + denyut * 0.9) * uAktif;
    float kabut = smoothstep(uKabutDekat, uKabutJauh, vKedalaman);
    gl_FragColor = vec4(uWarna * (1.0 - kabut), a);
  }
`;

/** Satu region: menara pengendali, beberapa simpul hosting, dan batas wilayah. */
class Region {
  readonly group = new Group();
  readonly puncak = new Vector3();
  private readonly menara: ShaderMaterial;
  private readonly node: ShaderMaterial;
  private readonly cakram: ShaderMaterial;
  private readonly label: Mesh;
  private readonly simpulNode: Mesh[] = [];
  private readonly nama: string;
  private readonly tinggiLabel: number;
  private peranTerakhir = "";

  constructor(nama: string, posisi: Vector3) {
    this.nama = nama;

    this.menara = new ShaderMaterial({
      vertexShader: padatVert,
      fragmentShader: padatFrag,
      uniforms: {
        uWarna: { value: SLATE.clone() },
        uNyala: { value: 1 },
        uTinggi: { value: TINGGI_MENARA },
        ...kabutUniforms(),
      },
    });
    const badan = new Mesh(
      new RoundedBoxGeometry(1.4, TINGGI_MENARA, 1.4, 4, 0.2),
      this.menara,
    );
    badan.position.y = TINGGI_MENARA / 2;
    this.group.add(badan);

    // Simpul hosting yang melayani website pelanggan, mengelilingi pengendali.
    this.node = new ShaderMaterial({
      vertexShader: padatVert,
      fragmentShader: padatFrag,
      uniforms: {
        uWarna: { value: SLATE.clone() },
        uNyala: { value: 1 },
        uTinggi: { value: 1.1 },
        ...kabutUniforms(),
      },
    });
    for (let i = 0; i < JUMLAH_NODE; i++) {
      const sudut = (i / JUMLAH_NODE) * Math.PI * 2 + 0.6;
      const n = new Mesh(new RoundedBoxGeometry(1.1, 1.1, 1.1, 3, 0.16), this.node);
      n.position.set(Math.cos(sudut) * 4.6, 0.75, Math.sin(sudut) * 4.6);
      this.simpulNode.push(n);
      this.group.add(n);
    }

    this.cakram = new ShaderMaterial({
      vertexShader: cakramVert,
      fragmentShader: cakramFrag,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      side: DoubleSide,
      uniforms: {
        uWarna: { value: SLATE.clone() },
        uNyala: { value: 1 },
        uWaktu: { value: 0 },
        ...kabutUniforms(),
      },
    });
    const piringan = new Mesh(new CircleGeometry(7.5, 64), this.cakram);
    piringan.rotation.x = -Math.PI / 2;
    piringan.position.y = 0.04;
    this.group.add(piringan);

    const tinggiLabel = 1.5;
    this.tinggiLabel = tinggiLabel;
    this.label = new Mesh(
      new PlaneGeometry(tinggiLabel * RASIO_LABEL, tinggiLabel),
      new MeshBasicMaterial({ transparent: true, depthWrite: false, side: DoubleSide }),
    );
    this.label.position.y = TINGGI_MENARA + 1.9;
    this.group.add(this.label);

    this.group.position.copy(posisi);
    this.puncak.copy(posisi).setY(TINGGI_MENARA * 0.9);
  }

  /**
   * Menyesuaikan tampilan region dengan keadaannya saat ini.
   *
   * @param hidup   0 padam sampai 1 sehat
   * @param pimpin  bobot kepemimpinan 0..1
   * @param ditolak seberapa kuat penolakan epoch lama ditampilkan
   */
  perbarui(
    hidup: number,
    pimpin: number,
    ditolak: number,
    waktu: number,
    kamera: Camera,
    detail: number,
  ) {
    // Warna disusun berlapis: dasar pengikut, ditarik ke hijau oleh
    // kepemimpinan, ke jingga oleh penolakan, lalu diredupkan oleh kematian.
    const warna = SLATE.clone()
      .lerp(HIJAU, pimpin)
      .lerp(JINGGA, ditolak)
      .lerp(PADAM, 1 - hidup);

    const nyala = 0.14 + hidup * 0.86;
    (this.menara.uniforms.uWarna!.value as Color).copy(warna);
    this.menara.uniforms.uNyala!.value = nyala;
    (this.node.uniforms.uWarna!.value as Color).copy(warna);
    this.node.uniforms.uNyala!.value = nyala;
    (this.cakram.uniforms.uWarna!.value as Color).copy(warna);
    this.cakram.uniforms.uNyala!.value = hidup * (0.3 + pimpin * 0.7);
    this.cakram.uniforms.uWaktu!.value = waktu;

    // Simpul hosting berputar pelan selama regionnya masih hidup.
    this.simpulNode.forEach((n, i) => {
      n.rotation.y = waktu * 0.3 * hidup + i;
      n.position.y = 0.75 + Math.sin(waktu * 0.8 + i * 2) * 0.12 * hidup;
    });

    const peran =
      ditolak > 0.4 ? "nomor lama ditolak"
      : hidup < 0.3 ? "tidak menjawab"
      : pimpin > 0.5 ? "pemimpin"
      : "pengikut";

    if (peran !== this.peranTerakhir) {
      this.peranTerakhir = peran;
      const warnaSub =
        peran === "pemimpin" ? "#3bd671"
        : peran === "nomor lama ditolak" ? "#f2561d"
        : "#7c879f";
      const bahan = this.label.material as MeshBasicMaterial;
      // Warna menara untuk region padam nyaris hitam; dipakai di label, teksnya
      // ikut tak terbaca. Karena itu warna label diputuskan terpisah.
      bahan.map = teksturLabel(this.nama, { sub: peran, warnaSub });
      bahan.needsUpdate = true;
    }
    const bahanLabel = this.label.material as MeshBasicMaterial;
    bahanLabel.opacity = detail;
    this.label.visible = detail > 0.02;
    this.label.quaternion.copy(kamera.quaternion);
    this.label.scale.setScalar(
      skalaLabel(kamera.position.distanceTo(this.label.getWorldPosition(_bantu)), this.tinggiLabel),
    );
  }

  aturKabut(warna: Color, dekat: number, jauh: number) {
    setKabut(this.menara, warna, dekat, jauh);
    setKabut(this.node, warna, dekat, jauh);
    setKabut(this.cakram, warna, dekat, jauh);
  }

  dispose() {
    this.group.traverse((n) => {
      if (n instanceof Mesh) {
        n.geometry.dispose();
        (n.material as { dispose(): void }).dispose();
      }
    });
  }
}

/** Tautan replikasi antara dua region. */
class Tautan {
  readonly mesh: Mesh;
  private readonly material: ShaderMaterial;

  constructor(dari: Vector3, ke: Vector3) {
    this.material = new ShaderMaterial({
      vertexShader: tautanVert,
      fragmentShader: tautanFrag,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      uniforms: {
        uWarna: { value: SLATE.clone() },
        uWaktu: { value: 0 },
        uAktif: { value: 1 },
        uArah: { value: 1 },
        ...kabutUniforms(),
      },
    });
    // Kotak tipis, bukan bidang: pita datar lenyap begitu dilihat dari tepi.
    // Panjangnya sudah di sumbu z sejak awal, jadi scale.z benar-benar
    // memanjangkan dan vT di shader tetap 0..1 berapa pun jaraknya.
    this.mesh = new Mesh(new BoxGeometry(0.14, 0.14, 1), this.material);
    this.mesh.scale.z = dari.distanceTo(ke);
    this.mesh.position.copy(dari).lerp(ke, 0.5);
    this.mesh.lookAt(ke);
  }

  perbarui(warna: Color, aktif: number, arah: number, waktu: number) {
    (this.material.uniforms.uWarna!.value as Color).copy(warna);
    this.material.uniforms.uAktif!.value = aktif;
    this.material.uniforms.uArah!.value = arah;
    this.material.uniforms.uWaktu!.value = waktu;
  }

  aturKabut(warna: Color, dekat: number, jauh: number) {
    setKabut(this.material, warna, dekat, jauh);
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}

/** Seluruh sistem: tiga region, tautan di antaranya, dan label izin bersama. */
export class Sistem {
  readonly group = new Group();
  private readonly region: Region[] = [];
  private readonly tautan: { t: Tautan; a: number; b: number }[] = [];
  private readonly labelIzin: Mesh;
  private readonly tinggiLabelIzin: number;
  private epochTerakhir = -1;
  private izinSehatTerakhir = true;

  constructor() {
    REGION.forEach((nama, i) => {
      const r = new Region(nama, POSISI_REGION[i]!);
      this.region.push(r);
      this.group.add(r.group);
    });

    for (let i = 0; i < 3; i++) {
      for (let j = i + 1; j < 3; j++) {
        const t = new Tautan(this.region[i]!.puncak, this.region[j]!.puncak);
        this.tautan.push({ t, a: i, b: j });
        this.group.add(t.mesh);
      }
    }

    const tinggi = 1.3;
    this.tinggiLabelIzin = tinggi;
    this.labelIzin = new Mesh(
      new PlaneGeometry(tinggi * RASIO_LABEL, tinggi),
      new MeshBasicMaterial({ transparent: true, depthWrite: false, side: DoubleSide }),
    );
    this.labelIzin.position.set(0, TINGGI_MENARA + 12, 0);
    this.group.add(this.labelIzin);
  }

  /**
   * @param detail seberapa jelas label ditampilkan, 0..1. Pada bidikan luas
   *   nilainya nol: di situ sistem dibaca sebagai bentuk, dan label justru
   *   menumpuk di atas naskah yang rata tengah.
   */
  perbarui(k: Keadaan, waktu: number, kamera: Camera, detail: number) {
    this.region.forEach((r, i) =>
      r.perbarui(k.hidup[i]!, k.pimpin[i]!, i === 1 ? k.ditolak : 0, waktu, kamera, detail),
    );

    for (const { t, a, b } of this.tautan) {
      const hidupTerkecil = Math.min(k.hidup[a]!, k.hidup[b]!);
      const bobotPemimpin = Math.max(k.pimpin[a]!, k.pimpin[b]!);
      const tolak = a === 1 || b === 1 ? k.ditolak : 0;

      const warna = SLATE.clone()
        .lerp(HIJAU, bobotPemimpin * k.izin)
        .lerp(JINGGA, tolak)
        .lerp(PADAM, 1 - hidupTerkecil);

      // Denyut hanya mengalir selama ada pemimpin yang izinnya masih hidup.
      const aktif = hidupTerkecil * (0.3 + bobotPemimpin * 0.7) * (0.25 + k.izin * 0.75);
      // Arah aliran dibalik kalau pemimpinnya ada di ujung yang kedua.
      const arah = k.pimpin[b]! > k.pimpin[a]! ? -1 : 1;
      t.perbarui(warna, aktif, arah, k.izin > 0.1 ? waktu : 0);
    }

    const sehat = k.izin > 0.5;
    if (k.epoch !== this.epochTerakhir || sehat !== this.izinSehatTerakhir) {
      this.epochTerakhir = k.epoch;
      this.izinSehatTerakhir = sehat;
      const bahan = this.labelIzin.material as MeshBasicMaterial;
      bahan.map = teksturLabel(`epoch ${k.epoch}`, {
        sub: sehat ? "izin aktif" : "izin habis",
        warnaSub: sehat ? "#3bd671" : "#f2561d",
      });
      bahan.needsUpdate = true;
    }
    const bahanIzin = this.labelIzin.material as MeshBasicMaterial;
    bahanIzin.opacity = detail;
    this.labelIzin.visible = detail > 0.02;
    this.labelIzin.quaternion.copy(kamera.quaternion);
    this.labelIzin.scale.setScalar(
      skalaLabel(
        kamera.position.distanceTo(this.labelIzin.getWorldPosition(_bantu)),
        this.tinggiLabelIzin,
      ),
    );
  }

  aturKabut(warna: Color, dekat: number, jauh: number) {
    for (const r of this.region) r.aturKabut(warna, dekat, jauh);
    for (const { t } of this.tautan) t.aturKabut(warna, dekat, jauh);
  }

  dispose() {
    for (const r of this.region) r.dispose();
    for (const { t } of this.tautan) t.dispose();
    this.labelIzin.geometry.dispose();
    (this.labelIzin.material as MeshBasicMaterial).dispose();
  }
}
