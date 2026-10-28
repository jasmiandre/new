// Diagram cluster tiga pengendali, digambar di dalam dunia 3D.
//
// Satu salinan diagram ini berdiri di tiap bab narasi, masing-masing membeku
// pada satu momen cerita failover. Kamera terbang melewatinya satu per satu,
// jadi urutan waktu dibentangkan menjadi urutan ruang — seperti bingkai film
// yang dijajar.

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
import type { Fase } from "../content";
import { RASIO_LABEL, teksturLabel } from "./labels";

/** Peran sebuah pengendali pada satu momen cerita. */
type Peran = "LEADER" | "FOLLOWER" | "DOWN" | "DITOLAK";

const WARNA: Record<Peran, string> = {
  LEADER: "#3bd671", // hijau aksen panel.ai.id
  FOLLOWER: "#5e739a",
  DOWN: "#1e2638",
  DITOLAK: "#f2561d",
};

/** Keadaan ketiga pengendali, beserta nomor izin yang berlaku, per fase. */
interface Keadaan {
  peran: [Peran, Peran, Peran];
  epoch: number;
  /** 1 berarti izin masih hidup; 0 berarti sudah habis. */
  izin: number;
}

const KEADAAN: Record<Fase, Keadaan> = {
  "normal": { peran: ["FOLLOWER", "LEADER", "FOLLOWER"], epoch: 41, izin: 1 },
  "gangguan": { peran: ["FOLLOWER", "DOWN", "FOLLOWER"], epoch: 41, izin: 1 },
  "izin-habis": { peran: ["FOLLOWER", "DOWN", "FOLLOWER"], epoch: 41, izin: 0 },
  "pemimpin-baru": { peran: ["FOLLOWER", "DOWN", "LEADER"], epoch: 42, izin: 1 },
  "kembali": { peran: ["FOLLOWER", "DITOLAK", "LEADER"], epoch: 42, izin: 1 },
};

const NAMA = ["ctl-1", "ctl-2", "ctl-3"] as const;

/** Potongan shader kabut, dipakai ulang oleh semua material di berkas ini. */
const KABUT_UNIFORM = /* glsl */ `
  uniform vec3  uKabut;
  uniform float uKabutDekat;
  uniform float uKabutJauh;
  varying float vKedalaman;
`;

const kabutUniforms = () => ({
  uKabut: { value: new Color("#070b14") },
  uKabutDekat: { value: 30 },
  uKabutJauh: { value: 210 },
});

// --- menara pengendali ---

const menaraVert = /* glsl */ `
  varying vec3  vNormalDunia;
  varying vec3  vArahPandang;
  varying float vTinggi;
  varying float vKedalaman;

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

const menaraFrag = /* glsl */ `
  precision highp float;

  varying vec3  vNormalDunia;
  varying vec3  vArahPandang;
  varying float vTinggi;

  uniform vec3  uWarna;
  uniform float uNyala;
  uniform vec3  uKabut;
  uniform float uKabutDekat;
  uniform float uKabutJauh;
  varying float vKedalaman;

  void main() {
    // Menara menyala dari bawah ke atas: pangkalnya gelap, puncaknya pekat warna.
    vec3 warna = mix(uWarna * 0.12, uWarna, pow(vTinggi, 1.4)) * uNyala;

    float fresnel = pow(1.0 - clamp(dot(normalize(vNormalDunia), normalize(vArahPandang)), 0.0, 1.0), 2.5);
    warna += uWarna * fresnel * 0.5 * uNyala;

    float kabut = smoothstep(uKabutDekat, uKabutJauh, vKedalaman);
    gl_FragColor = vec4(mix(warna, uKabut, kabut), 1.0);
  }
`;

// --- cakram pijar di pangkal menara ---

const cakramFrag = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  ${KABUT_UNIFORM}
  uniform vec3  uWarna;
  uniform float uNyala;

  void main() {
    float r = length(vUv - 0.5) * 2.0;
    float a = (1.0 - smoothstep(0.0, 1.0, r)) * uNyala;
    float kabut = smoothstep(uKabutDekat, uKabutJauh, vKedalaman);
    gl_FragColor = vec4(uWarna * (1.0 - kabut), a * 0.75);
  }
`;

const cakramVert = /* glsl */ `
  varying vec2 vUv;
  ${KABUT_UNIFORM}
  void main() {
    vUv = uv;
    vec4 pandang = modelViewMatrix * vec4(position, 1.0);
    vKedalaman = -pandang.z;
    gl_Position = projectionMatrix * pandang;
  }
`;

// --- tautan antar pengendali ---

const tautanVert = /* glsl */ `
  varying float vT;
  ${KABUT_UNIFORM}
  void main() {
    // Geometri tautan membentang di sumbu z lokal, -0.5..0.5.
    vT = position.z + 0.5;
    vec4 pandang = modelViewMatrix * vec4(position, 1.0);
    vKedalaman = -pandang.z;
    gl_Position = projectionMatrix * pandang;
  }
`;

const tautanFrag = /* glsl */ `
  precision highp float;
  varying float vT;
  ${KABUT_UNIFORM}
  uniform vec3  uWarna;
  uniform float uWaktu;
  uniform float uAktif;

  void main() {
    // Denyut yang berjalan dari pemimpin menuju pengikut.
    float p = fract(vT - uWaktu * 0.45);
    float denyut = exp(-pow(p - 0.5, 2.0) * 90.0);
    float a = (0.16 + denyut * 0.85) * uAktif;

    float kabut = smoothstep(uKabutDekat, uKabutJauh, vKedalaman);
    gl_FragColor = vec4(uWarna * (1.0 - kabut), a);
  }
`;

interface MaterialKabut {
  uniforms: Record<string, { value: unknown }>;
}

function setKabut(m: MaterialKabut, warna: Color, dekat: number, jauh: number) {
  (m.uniforms.uKabut!.value as Color).copy(warna);
  m.uniforms.uKabutDekat!.value = dekat;
  m.uniforms.uKabutJauh!.value = jauh;
}

const TINGGI_MENARA = 4.6;
const JARI_JARI = 6.2;

/** Satu pengendali: menara, cakram pijar di pangkalnya, dan label melayang. */
class Simpul {
  readonly group = new Group();
  readonly puncak = new Vector3();
  private readonly menara: ShaderMaterial;
  private readonly cakram: ShaderMaterial;
  private readonly label: Mesh;
  private readonly nama: string;

  constructor(nama: string, posisi: Vector3) {
    this.nama = nama;

    this.menara = new ShaderMaterial({
      vertexShader: menaraVert,
      fragmentShader: menaraFrag,
      uniforms: {
        uWarna: { value: new Color(WARNA.FOLLOWER) },
        uNyala: { value: 1 },
        uTinggi: { value: TINGGI_MENARA },
        ...kabutUniforms(),
      },
    });

    const badan = new Mesh(
      new RoundedBoxGeometry(1.15, TINGGI_MENARA, 1.15, 4, 0.16),
      this.menara,
    );
    badan.position.y = TINGGI_MENARA / 2;
    this.group.add(badan);

    this.cakram = new ShaderMaterial({
      vertexShader: cakramVert,
      fragmentShader: cakramFrag,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      side: DoubleSide,
      uniforms: {
        uWarna: { value: new Color(WARNA.FOLLOWER) },
        uNyala: { value: 1 },
        ...kabutUniforms(),
      },
    });
    const piringan = new Mesh(new CircleGeometry(2.6, 48), this.cakram);
    piringan.rotation.x = -Math.PI / 2;
    piringan.position.y = 0.03;
    this.group.add(piringan);

    const tinggiLabel = 1.25;
    this.label = new Mesh(
      new PlaneGeometry(tinggiLabel * RASIO_LABEL, tinggiLabel),
      new MeshBasicMaterial({ transparent: true, depthWrite: false, side: DoubleSide }),
    );
    this.label.position.y = TINGGI_MENARA + 1.5;
    this.group.add(this.label);

    this.group.position.copy(posisi);
    this.puncak.copy(posisi).setY(TINGGI_MENARA * 0.88);
  }

  aturPeran(peran: Peran) {
    const warna = new Color(WARNA[peran]);
    const nyala = peran === "DOWN" ? 0.35 : 1;

    (this.menara.uniforms.uWarna!.value as Color).copy(warna);
    this.menara.uniforms.uNyala!.value = nyala;
    (this.cakram.uniforms.uWarna!.value as Color).copy(warna);
    this.cakram.uniforms.uNyala!.value = peran === "LEADER" ? 1 : peran === "DOWN" ? 0.08 : 0.3;

    const sub = peran === "DITOLAK" ? "epoch lama ditolak" : peran.toLowerCase();
    (this.label.material as MeshBasicMaterial).map = teksturLabel(this.nama, {
      sub,
      warna: peran === "DOWN" ? "#7c879f" : "#e6e9f0",
      // Warna menara untuk peran DOWN nyaris hitam supaya ia padam secara
      // visual; dipakai apa adanya di label, teksnya jadi tak terbaca.
      warnaSub: peran === "DOWN" ? "#7c879f" : WARNA[peran],
    });
    (this.label.material as MeshBasicMaterial).needsUpdate = true;
  }

  /** Label selalu menghadap kamera agar tetap terbaca dari sudut mana pun. */
  hadapKamera(kamera: Camera) {
    this.label.quaternion.copy(kamera.quaternion);
  }

  aturKabut(warna: Color, dekat: number, jauh: number) {
    setKabut(this.menara, warna, dekat, jauh);
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

/** Tautan bercahaya antara dua pengendali. */
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
        uWarna: { value: new Color(WARNA.FOLLOWER) },
        uWaktu: { value: 0 },
        uAktif: { value: 1 },
        ...kabutUniforms(),
      },
    });

    const panjang = dari.distanceTo(ke);
    // Kotak tipis, bukan bidang: pita datar lenyap begitu dilihat dari tepi,
    // dan tautan antar puncak menara memang nyaris mendatar. Panjangnya sudah
    // di sumbu z sejak awal, jadi scale.z benar-benar memanjangkan dan vT di
    // shader tetap 0..1 berapa pun jaraknya.
    const geo = new BoxGeometry(0.1, 0.1, 1);

    this.mesh = new Mesh(geo, this.material);
    this.mesh.scale.z = panjang;
    this.mesh.position.copy(dari).lerp(ke, 0.5);
    this.mesh.lookAt(ke);
  }

  atur(warna: Color, aktif: number) {
    (this.material.uniforms.uWarna!.value as Color).copy(warna);
    this.material.uniforms.uAktif!.value = aktif;
  }

  perbarui(waktu: number) {
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

/** Satu salinan diagram cluster, membeku pada satu fase cerita. */
export class Cluster {
  readonly group = new Group();
  private readonly simpul: Simpul[] = [];
  private readonly tautan: Tautan[] = [];
  private readonly labelIzin: Mesh;
  private readonly fase: Fase;

  constructor(posisi: Vector3, fase: Fase, putaran = 0) {
    this.fase = fase;
    const keadaan = KEADAAN[fase];

    // Tiga menara berdiri di titik-titik segitiga sama sisi.
    NAMA.forEach((nama, i) => {
      const sudut = (i / 3) * Math.PI * 2 - Math.PI / 2;
      const s = new Simpul(
        nama,
        new Vector3(Math.cos(sudut) * JARI_JARI, 0, Math.sin(sudut) * JARI_JARI),
      );
      s.aturPeran(keadaan.peran[i]!);
      this.simpul.push(s);
      this.group.add(s.group);
    });

    // Tautan dari pemimpin ke dua pengendali lain. Kalau tidak ada pemimpin
    // sama sekali — saat izin sudah habis — tautan digambar redup antar semua.
    const indeksPemimpin = keadaan.peran.findIndex((p) => p === "LEADER");
    for (let i = 0; i < 3; i++) {
      for (let j = i + 1; j < 3; j++) {
        const t = new Tautan(this.simpul[i]!.puncak, this.simpul[j]!.puncak);
        const menyentuhPemimpin = i === indeksPemimpin || j === indeksPemimpin;
        const menyentuhMati =
          keadaan.peran[i] === "DOWN" || keadaan.peran[j] === "DOWN";
        const ditolak =
          keadaan.peran[i] === "DITOLAK" || keadaan.peran[j] === "DITOLAK";

        if (ditolak) {
          t.atur(new Color(WARNA.DITOLAK), 0.55);
        } else if (menyentuhMati) {
          t.atur(new Color(WARNA.DOWN), 0.25);
        } else if (menyentuhPemimpin) {
          t.atur(new Color(WARNA.LEADER), 1);
        } else {
          t.atur(new Color(WARNA.FOLLOWER), 0.4);
        }

        this.tautan.push(t);
        this.group.add(t.mesh);
      }
    }

    // Label izin di tengah segitiga: nomor epoch yang sedang berlaku.
    const tinggi = 1.05;
    const warnaIzin = keadaan.izin === 0 ? WARNA.DITOLAK : WARNA.LEADER;
    this.labelIzin = new Mesh(
      new PlaneGeometry(tinggi * RASIO_LABEL, tinggi),
      new MeshBasicMaterial({
        map: teksturLabel(`epoch ${keadaan.epoch}`, {
          sub: keadaan.izin === 0 ? "izin habis" : "lease aktif",
          warnaSub: warnaIzin,
        }),
        transparent: true,
        depthWrite: false,
        side: DoubleSide,
      }),
    );
    this.labelIzin.position.y = TINGGI_MENARA + 3.4;
    this.group.add(this.labelIzin);

    this.group.position.copy(posisi);
    this.group.rotation.y = putaran;
  }

  perbarui(waktu: number, kamera: Camera) {
    // Denyut dihentikan begitu izin habis: tidak ada lagi yang memperbaruinya.
    const jalan = this.fase === "izin-habis" ? 0 : waktu;
    for (const t of this.tautan) t.perbarui(jalan);
    for (const s of this.simpul) s.hadapKamera(kamera);
    this.labelIzin.quaternion.copy(kamera.quaternion);
  }

  aturKabut(warna: Color, dekat: number, jauh: number) {
    for (const s of this.simpul) s.aturKabut(warna, dekat, jauh);
    for (const t of this.tautan) t.aturKabut(warna, dekat, jauh);
  }

  dispose() {
    for (const s of this.simpul) s.dispose();
    for (const t of this.tautan) t.dispose();
    this.labelIzin.geometry.dispose();
    (this.labelIzin.material as MeshBasicMaterial).dispose();
  }
}
