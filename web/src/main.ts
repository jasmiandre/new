// Titik masuk: menyambungkan gulir, dunia 3D, dan antarmuka.

import Lenis from "lenis";
import "./styles.css";
import { bangunBab, bangunNav, Hud, Penunjuk, terapkanTemaAntarmuka } from "./ui";
import { Dunia, nilaiTema, webglTersedia } from "./world/scene";

const kurangiGerak = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function wajib<T extends HTMLElement>(id: string): T {
  const n = document.getElementById(id);
  if (!n) throw new Error(`elemen #${id} tidak ditemukan`);
  return n as T;
}

const kanvas = wajib<HTMLCanvasElement>("dunia");
const wadahBab = wajib("isi");

bangunNav(wajib("nav"));
const bagian = bangunBab(wadahBab);
const hud = new Hud(wajib("hud"));
const penunjuk = new Penunjuk(wajib("penunjuk"));

// Dunia 3D hanya dibangun kalau peramban benar-benar sanggup. Tanpa WebGL,
// situs tetap utuh: isi dan tata letaknya sudah lengkap tanpa kanvas.
let dunia: Dunia | null = null;
if (webglTersedia()) {
  try {
    dunia = new Dunia(kanvas);
  } catch (galat) {
    console.warn("dunia 3D tidak dapat dijalankan:", galat);
    dunia = null;
  }
}
if (!dunia) kanvas.style.display = "none";

// Gulir halus. Dengan prefers-reduced-motion, penghalusan dimatikan sehingga
// gulir kembali mengikuti perilaku bawaan peramban.
const lenis = new Lenis({
  autoRaf: false,
  duration: 1.05,
  smoothWheel: !kurangiGerak,
});

let kemajuan = 0;
lenis.on("scroll", ({ scroll, limit }: { scroll: number; limit: number }) => {
  kemajuan = limit > 0 ? Math.min(1, Math.max(0, scroll / limit)) : 0;
});

/** Memudarkan isi tiap bab di awal dan akhir bagiannya. */
function perbaruiIsiBab() {
  const tinggi = window.innerHeight;
  for (const [indeks, b] of bagian.entries()) {
    const kotak = b.getBoundingClientRect();
    const total = kotak.height - tinggi;
    if (total <= 0) continue;

    const lokal = Math.min(1, Math.max(0, -kotak.top / total));
    // Bab pertama sudah berada di puncak halaman saat dimuat, jadi ia tidak
    // punya "masuk" untuk dipudarkan — tanpa pengecualian ini hero tampil kosong.
    const masuk = indeks === 0 ? 1 : Math.min(1, lokal / 0.1);
    const keluar = Math.min(1, (1 - lokal) / 0.14);
    const tampak = Math.min(masuk, keluar);

    const isi = b.firstElementChild as HTMLElement | null;
    if (!isi) continue;
    isi.style.opacity = String(tampak);
    isi.style.transform = `translateY(${(1 - tampak) * 18}px)`;
    // Bab yang sudah tak terlihat tidak boleh lagi menangkap tetikus.
    isi.style.visibility = tampak < 0.02 ? "hidden" : "visible";
  }
}

let mulai = performance.now();
function kerangka(waktu: number) {
  lenis.raf(waktu);

  // Gerak menganggur dibekukan ketika pengguna minta gerak dikurangi.
  const detik = kurangiGerak ? 0 : (waktu - mulai) / 1000;

  dunia?.gambar(kemajuan, detik);
  terapkanTemaAntarmuka(nilaiTema(kemajuan));
  hud.perbarui(kemajuan);
  penunjuk.perbarui();
  perbaruiIsiBab();

  requestAnimationFrame(kerangka);
}

window.addEventListener("resize", () => dunia?.ubahUkuran());

// Tautan dalam halaman diserahkan ke Lenis agar ikut mulus.
document.addEventListener("click", (e) => {
  const a = (e.target as Element | null)?.closest<HTMLAnchorElement>('a[href^="#"]');
  if (!a) return;
  const tujuan = document.querySelector(a.getAttribute("href")!);
  if (!tujuan) return;
  e.preventDefault();
  lenis.scrollTo(tujuan as HTMLElement);
});

mulai = performance.now();
requestAnimationFrame(kerangka);
