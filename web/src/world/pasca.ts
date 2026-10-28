// Pasca-pemrosesan: lapisan yang membuat gambar terbaca sebagai rekaman
// kamera, bukan keluaran mentah renderer.
//
// Tiga hal yang mengerjakannya: pemetaan nada ACES, yang meratakan sorotan
// terang alih-alih memotongnya di putih; bloom, yang membuat cahaya tampak
// meluber ke lensa; dan bintik film tipis plus vignette, yang menghapus kesan
// "bersih sempurna" khas gambar sintetis.

import {
  ACESFilmicToneMapping,
  Camera,
  Scene,
  ShaderMaterial,
  Vector2,
  WebGLRenderer,
} from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";

/** Bintik film dan vignette, dikerjakan setelah pemetaan nada. */
const butiranShader = {
  uniforms: {
    tDiffuse: { value: null },
    uWaktu: { value: 0 },
    uButiran: { value: 0.032 },
    uVignette: { value: 0.55 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    precision highp float;
    uniform sampler2D tDiffuse;
    uniform float uWaktu;
    uniform float uButiran;
    uniform float uVignette;
    varying vec2 vUv;

    float acak(vec2 p) {
      return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
    }

    void main() {
      vec4 warna = texture2D(tDiffuse, vUv);

      // Bintik dibuat lebih kentara di bagian gelap, seperti film sungguhan:
      // bayangan selalu lebih berbintik daripada sorotan.
      float terang = dot(warna.rgb, vec3(0.299, 0.587, 0.114));
      float bobot = mix(1.0, 0.35, smoothstep(0.0, 0.6, terang));
      float bintik = acak(vUv * 1024.0 + fract(uWaktu) * 97.0) - 0.5;
      warna.rgb += bintik * uButiran * bobot;

      vec2 q = vUv - 0.5;
      warna.rgb *= 1.0 - dot(q, q) * uVignette;

      gl_FragColor = warna;
    }
  `,
};

export interface Pasca {
  composer: EffectComposer;
  /** Dipanggil tiap kerangka sebelum render, untuk menggerakkan bintik. */
  perbarui(waktu: number): void;
  ubahUkuran(lebar: number, tinggi: number): void;
  dispose(): void;
}

export function buatPasca(
  renderer: WebGLRenderer,
  scene: Scene,
  camera: Camera,
): Pasca {
  // ACES adalah kurva nada yang dipakai industri film. Tanpa ini, bagian
  // paling terang langsung terpotong jadi putih rata dan gambar terlihat
  // seperti render, bukan rekaman.
  //
  // Pemetaan nada sengaja dibiarkan dikerjakan oleh lintasan adegan, bukan
  // oleh OutputPass di ujung rantai. Pada versi three ini lintasan adegan
  // sudah menulis nilai siap-tampil ke target composer, sehingga menambahkan
  // OutputPass berarti mengenkode sRGB untuk kedua kalinya: hitam pekat merek
  // (#0b0f19) terangkat menjadi kabut abu di sekitar [58, 68, 88]. Diukur,
  // bukan diperkirakan.
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.92;

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  // Radius lebar membuat bloom menghalo ke seluruh bingkai dan mengangkat
  // hitam pekat merek menjadi kabut abu. Nilainya ditahan rapat: hanya bagian
  // yang benar-benar menyala yang boleh meluber, dan hanya sedikit.
  // Bloom kini bekerja pada nilai yang sudah dipetakan nadanya, jadi ambangnya
  // dibaca dalam ruang tampilan. Radius ditahan rapat: radius lebar membuat
  // cahaya menghalo ke seluruh bingkai dan mengangkat latar gelapnya.
  const bloom = new UnrealBloomPass(
    new Vector2(window.innerWidth, window.innerHeight),
    0.46, // kekuatan
    0.35, // radius
    0.74, // ambang
  );
  composer.addPass(bloom);

  // OutputPass menerapkan pemetaan nada dan konversi ruang warna.
  // composer.addPass(new OutputPass());

  // Bintik ditaruh paling akhir supaya bekerja di ruang tampilan, persis
  // seperti bintik yang melekat pada hasil cetak, bukan pada adegannya.
  const butiran = new ShaderPass(butiranShader);
  composer.addPass(butiran);

  const bahan = butiran.material as ShaderMaterial;

  return {
    composer,
    perbarui(waktu) {
      bahan.uniforms.uWaktu!.value = waktu;
    },
    ubahUkuran(lebar, tinggi) {
      composer.setSize(lebar, tinggi);
      bloom.setSize(lebar, tinggi);
    },
    dispose() {
      composer.dispose();
      bloom.dispose();
    },
  };
}
