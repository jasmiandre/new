// Bidang grid tak hingga tempat seluruh dunia berdiri.
//
// Pola digambar lewat shader dalam koordinat dunia, bukan sebagai tekstur.
// Dua akibatnya: polanya tetap tajam pada jarak berapa pun, dan bidangnya bisa
// mengikuti kamera tanpa membuat grid ikut bergeser — kamera jadi terasa
// melintasi permukaan yang benar-benar tak berujung.

import {
  Color,
  DoubleSide,
  Mesh,
  PlaneGeometry,
  ShaderMaterial,
  Vector3,
} from "three";

/** Jarak antar garis grid, dalam satuan dunia. */
export const SEL = 4;

/** Seberapa jauh grid masih terlihat sebelum pudar sepenuhnya. */
const JANGKAUAN = 260;

const vertexShader = /* glsl */ `
  varying vec3 vDunia;

  void main() {
    vec4 dunia = modelMatrix * vec4(position, 1.0);
    vDunia = dunia.xyz;
    gl_Position = projectionMatrix * viewMatrix * dunia;
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;

  varying vec3 vDunia;

  uniform vec3  uWarnaGaris;
  uniform vec3  uWarnaTanda;
  uniform vec3  uWarnaPijar;
  uniform vec3  uKamera;
  uniform vec3  uPijar;
  uniform float uSel;
  uniform float uJangkauan;
  uniform float uKuatPijar;
  uniform float uOpasitas;

  // Garis kisi dengan antialias: lebar garis mengikuti turunan koordinat
  // dunia, jadi garis yang jauh menipis dan memudar dengan sendirinya.
  float garis(vec2 p, float sel, float tebal) {
    vec2 q = abs(fract(p / sel - 0.5) - 0.5) * sel;
    vec2 w = fwidth(p) * tebal;
    vec2 m = 1.0 - smoothstep(vec2(0.0), w, q);
    return clamp(max(m.x, m.y), 0.0, 1.0);
  }

  // Tanda tambah di tiap titik kisi yang lebih renggang.
  float tanda(vec2 p, float sel, float lengan, float tebal) {
    vec2 q = (fract(p / sel + 0.5) - 0.5) * sel;
    vec2 aq = abs(q);
    vec2 w = fwidth(p) * tebal;
    float mendatar = (1.0 - smoothstep(0.0, w.y, aq.y)) *
                     (1.0 - smoothstep(lengan - w.x, lengan, aq.x));
    float tegak    = (1.0 - smoothstep(0.0, w.x, aq.x)) *
                     (1.0 - smoothstep(lengan - w.y, lengan, aq.y));
    return clamp(mendatar + tegak, 0.0, 1.0);
  }

  void main() {
    vec2 p = vDunia.xz;

    float jarak = length(p - uKamera.xz);
    float pudar = 1.0 - smoothstep(uJangkauan * 0.10, uJangkauan, jarak);
    if (pudar <= 0.001) discard;

    float g = garis(p, uSel, 1.0) * 0.6;
    float t = tanda(p, uSel * 3.0, uSel * 0.18, 0.8) * 0.5;

    // Cahaya biru lembut yang menyapu permukaan, seperti lampu besar di kejauhan.
    float jarakPijar = length(vDunia - uPijar);
    float pijar = exp(-jarakPijar / 38.0) * uKuatPijar;

    vec3 warna = uWarnaGaris * g + uWarnaTanda * t;
    float alfa = max(g, t);

    warna += uWarnaPijar * pijar;
    alfa = clamp(alfa + pijar * 0.5, 0.0, 1.0);

    gl_FragColor = vec4(warna, alfa * pudar * uOpasitas);
  }
`;

export class Grid {
  readonly mesh: Mesh;
  private readonly material: ShaderMaterial;

  constructor() {
    this.material = new ShaderMaterial({
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
      uniforms: {
        uWarnaGaris: { value: new Color("#5d6f91") },
        uWarnaTanda: { value: new Color("#8fa2c0") },
        uWarnaPijar: { value: new Color("#3bd671") },
        uKamera: { value: new Vector3() },
        uPijar: { value: new Vector3(70, 10, -120) },
        uSel: { value: SEL },
        uJangkauan: { value: JANGKAUAN },
        uKuatPijar: { value: 0.75 },
        uOpasitas: { value: 1 },
      },
    });

    // Bidang dibuat cukup besar untuk menutupi seluruh jangkauan pandang,
    // lalu diputar mendatar.
    this.mesh = new Mesh(new PlaneGeometry(JANGKAUAN * 2.4, JANGKAUAN * 2.4, 1, 1), this.material);
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.renderOrder = 0;
    this.mesh.frustumCulled = false;
  }

  /** Bidang mengikuti kamera; pola tetap terkunci pada koordinat dunia. */
  ikutiKamera(posisi: Vector3) {
    this.mesh.position.set(posisi.x, 0, posisi.z);
    (this.material.uniforms.uKamera!.value as Vector3).copy(posisi);
  }

  /** Memindahkan sumber cahaya yang menyapu grid. */
  aturPijar(posisi: Vector3) {
    (this.material.uniforms.uPijar!.value as Vector3).copy(posisi);
  }

  /**
   * Mengatur suasana grid. Alih-alih membalik tema gelap/terang, warna pijar
   * yang mengikuti cerita: hijau saat cluster sehat, jingga saat pemimpinnya
   * hilang. Merek panel.ai.id gelap sepenuhnya, jadi membalikkannya ke putih
   * akan terasa keluar dari identitasnya.
   */
  aturSuasana(warnaPijar: Color, kuatPijar: number) {
    (this.material.uniforms.uWarnaPijar!.value as Color).copy(warnaPijar);
    this.material.uniforms.uKuatPijar!.value = kuatPijar;
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
