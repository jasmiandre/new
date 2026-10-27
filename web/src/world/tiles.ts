// Tile mengkilap yang melayang di atas grid.
//
// Tiap tile adalah kotak bersudut tumpul dengan gradien biru dan tepi yang
// menangkap cahaya, ditambah satu bidang tipis di depannya untuk glif. Memisah
// glif ke bidang sendiri jauh lebih sederhana daripada memetakan tekstur hanya
// ke satu sisi kotak.

import {
  Color,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  ShaderMaterial,
  Vector3,
} from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { NamaGlif } from "../content";
import { teksturGlif } from "./glyphs";

const vertexShader = /* glsl */ `
  varying vec3  vNormalDunia;
  varying vec3  vArahPandang;
  varying vec3  vLokal;
  varying float vKedalaman;

  void main() {
    vLokal = position;
    vNormalDunia = normalize(mat3(modelMatrix) * normal);
    vec4 dunia = modelMatrix * vec4(position, 1.0);
    vArahPandang = normalize(cameraPosition - dunia.xyz);

    vec4 pandang = viewMatrix * dunia;
    vKedalaman = -pandang.z;
    gl_Position = projectionMatrix * pandang;
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;

  varying vec3  vNormalDunia;
  varying vec3  vArahPandang;
  varying vec3  vLokal;
  varying float vKedalaman;

  uniform vec3  uTerang;   // ujung terang gradien
  uniform vec3  uGelap;    // ujung pekat gradien
  uniform vec3  uSetengah; // setengah ukuran kotak, untuk menormalkan gradien
  uniform float uKilau;
  uniform vec3  uKabut;
  uniform float uKabutDekat;
  uniform float uKabutJauh;

  void main() {
    // Gradien diagonal dari kiri-atas ke kanan-bawah pada muka tile.
    float t = clamp(
      (vLokal.x / uSetengah.x * -0.5 + vLokal.y / uSetengah.y * 0.5) * 0.5 + 0.5,
      0.0, 1.0
    );
    vec3 warna = mix(uGelap, uTerang, smoothstep(0.0, 1.0, t));

    // Tepi yang menangkap cahaya: makin menyerong dilihat, makin terang.
    float fresnel = pow(1.0 - clamp(dot(normalize(vNormalDunia), normalize(vArahPandang)), 0.0, 1.0), 3.0);
    warna += vec3(1.0) * fresnel * 0.55;

    // Sorot kecil dari satu arah cahaya tetap di kiri atas.
    vec3 arahCahaya = normalize(vec3(-0.45, 0.8, 0.55));
    float sorot = pow(max(dot(normalize(vNormalDunia), arahCahaya), 0.0), 18.0);
    warna += vec3(1.0) * sorot * uKilau;

    // Kabut dihitung sendiri: ShaderMaterial tidak mewarisi scene.fog, dan
    // tanpa ini tile yang jauh tetap pekat lalu terbaca sebagai gerombolan
    // yang mengambang alih-alih larut ke kejauhan.
    float kabut = smoothstep(uKabutDekat, uKabutJauh, vKedalaman);
    warna = mix(warna, uKabut, kabut);

    gl_FragColor = vec4(warna, 1.0);
  }
`;

/** Pembangkit acak dengan benih tetap, agar tata letak sama di tiap muat. */
function acakBerbenih(benih: number) {
  let s = benih >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export interface OpsiTile {
  glif: NamaGlif;
  posisi: Vector3;
  ukuran: number;
  putaran: Vector3;
  /** Beda fase agar tile tidak melayang serempak. */
  fase: number;
}

export class Tile {
  readonly group = new Group();
  private readonly material: ShaderMaterial;
  private readonly asal: Vector3;
  private readonly putaranAsal: Vector3;
  private readonly fase: number;

  constructor(opsi: OpsiTile) {
    const { ukuran } = opsi;
    const tebal = ukuran * 0.16;
    const setengah = new Vector3(ukuran / 2, ukuran / 2, tebal / 2);

    this.material = new ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uTerang: { value: new Color("#cfe4ff") },
        uGelap: { value: new Color("#1f63f5") },
        uSetengah: { value: setengah },
        uKilau: { value: 0.5 },
        uKabut: { value: new Color("#04060c") },
        uKabutDekat: { value: 30 },
        uKabutJauh: { value: 210 },
      },
    });

    const kotak = new Mesh(
      new RoundedBoxGeometry(ukuran, ukuran, tebal, 5, ukuran * 0.14),
      this.material,
    );
    this.group.add(kotak);

    const glif = new Mesh(
      new PlaneGeometry(ukuran * 0.46, ukuran * 0.46),
      new MeshBasicMaterial({
        map: teksturGlif(opsi.glif),
        transparent: true,
        depthWrite: false,
        side: DoubleSide,
      }),
    );
    // Sedikit di depan muka kotak agar tidak beradu kedalaman.
    glif.position.z = tebal / 2 + ukuran * 0.004;
    this.group.add(glif);

    this.asal = opsi.posisi.clone();
    this.putaranAsal = opsi.putaran.clone();
    this.fase = opsi.fase;

    this.group.position.copy(opsi.posisi);
    this.group.rotation.set(opsi.putaran.x, opsi.putaran.y, opsi.putaran.z);
  }

  /** Melayang pelan dan berayun, supaya dunia tidak pernah terasa beku. */
  perbarui(waktu: number) {
    const t = waktu + this.fase;
    this.group.position.y = this.asal.y + Math.sin(t * 0.55) * 0.3;
    this.group.rotation.x = this.putaranAsal.x + Math.sin(t * 0.4) * 0.06;
    this.group.rotation.y = this.putaranAsal.y + Math.cos(t * 0.32) * 0.08;
  }

  /** Menyamakan kabut tile dengan kabut adegan. */
  aturKabut(warna: Color, dekat: number, jauh: number) {
    (this.material.uniforms.uKabut!.value as Color).copy(warna);
    this.material.uniforms.uKabutDekat!.value = dekat;
    this.material.uniforms.uKabutJauh!.value = jauh;
  }

  /** Menyesuaikan warna tile terhadap tema yang sedang berlaku. */
  aturTema(campur: number) {
    (this.material.uniforms.uTerang!.value as Color)
      .copy(new Color("#cfe4ff")).lerp(new Color("#ffffff"), campur);
    (this.material.uniforms.uGelap!.value as Color)
      .copy(new Color("#1f63f5")).lerp(new Color("#2a6bf2"), campur);
    this.material.uniforms.uKilau!.value = 0.5 - campur * 0.2;
  }

  dispose() {
    this.group.traverse((n) => {
      if (n instanceof Mesh) {
        n.geometry.dispose();
        const m = n.material;
        Array.isArray(m) ? m.forEach((x) => x.dispose()) : m.dispose();
      }
    });
  }
}

/**
 * Menyebar tile di sepanjang lintasan kamera.
 *
 * Tile ditaruh berselang-seling di kiri dan kanan lintasan supaya pandangan
 * ke depan tetap lapang, dan diberi ketinggian serta putaran yang berbeda-beda
 * agar tidak terbaca sebagai barisan yang kaku.
 */
export function sebarTile(
  glifPerBab: NamaGlif[][],
  panjangLintasan: number,
  benih = 20261027,
): Tile[] {
  const acak = acakBerbenih(benih);
  const hasil: Tile[] = [];
  const jumlahBab = glifPerBab.length;

  glifPerBab.forEach((glif, indeksBab) => {
    // Geser sedikit ke depan supaya tile pertama tidak lahir di dalam kamera.
    const awal = (indeksBab / jumlahBab) * panjangLintasan + 10;
    const akhir = ((indeksBab + 1) / jumlahBab) * panjangLintasan;

    glif.forEach((nama, i) => {
      // Jitter kedalaman supaya tile tidak terbaca sebagai satu untaian rapi.
      const bagian = (i + 0.5) / glif.length + (acak() - 0.5) * 0.12;
      const z = -(awal + (akhir - awal) * bagian);

      // Naskah selalu menempati kolom kiri layar, jadi sebagian besar tile
      // ditaruh di kanan. Yang di kiri didorong jauh ke tepi dan ditinggikan
      // agar lewat di atas judul, bukan menimpanya.
      const keKiri = acak() < 0.28;
      const sisi = keKiri ? -1 : 1;
      const x = keKiri ? -(15 + acak() * 9) : 4 + acak() * 13;
      const y = keKiri ? 8 + acak() * 6 : 3 + acak() * 6;
      const ukuran = 4.2 + acak() * 3.4;

      hasil.push(
        new Tile({
          glif: nama,
          posisi: new Vector3(x, y, z),
          ukuran,
          putaran: new Vector3(
            (acak() - 0.5) * 0.5,
            -sisi * (0.25 + acak() * 0.4),
            (acak() - 0.5) * 0.35,
          ),
          fase: acak() * Math.PI * 2,
        }),
      );
    });
  });

  return hasil;
}
