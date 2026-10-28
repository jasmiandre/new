// Titik masuk: menyambungkan gulir, dunia 3D, dan antarmuka.

import Lenis from "lenis";
import "./styles.css";
import { bangunBab, bangunNav, Hud, Penunjuk } from "./ui";
import { Dunia, webglTersedia } from "./world/scene";

const kurangiGerak = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function wajib<T extends HTMLElement>(id: string): T {
  const n = document.getElementById(id);
  if (!n) throw new Error(`elemen #${id} tidak ditemukan`);
  return n as T;
}

const kanvas = wajib<HTMLCanvasElement>("dunia");

bangunNav(wajib("nav"));
const bagian = bangunBab(wajib("isi"));
const hud = new Hud(wajib("hud"));
const penunjuk = new Penunjuk(wajib("penunjuk"));

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
    isi.style.visibility = tampak < 0.02 ? "hidden" : "visible";
  }
}

async function mulai() {
  // Label simpul digambar ke canvas memakai Geist Mono. Menunggu font selesai
  // dimuat lebih dulu mencegah label tergambar dengan monospace bawaan sistem,
  // yang tidak bisa diperbaiki lagi setelah teksturnya jadi.
  try {
    await document.fonts.ready;
  } catch {
    // Peramban tanpa Font Loading API tetap jalan, hanya fontnya bawaan.
  }

  let dunia: Dunia | null = null;
  if (webglTersedia()) {
    try {
      dunia = new Dunia(kanvas);
    } catch (galat) {
      console.warn("dunia 3D tidak dapat dijalankan:", galat);
    }
  }
  if (!dunia) kanvas.style.display = "none";

  window.addEventListener("resize", () => dunia?.ubahUkuran());

  const awal = performance.now();
  const kerangka = (waktu: number) => {
    lenis.raf(waktu);
    // Gerak menganggur dibekukan ketika pengguna minta gerak dikurangi.
    const detik = kurangiGerak ? 0 : (waktu - awal) / 1000;

    dunia?.gambar(kemajuan, detik);
    hud.perbarui(kemajuan);
    penunjuk.perbarui();
    perbaruiIsiBab();

    requestAnimationFrame(kerangka);
  };
  requestAnimationFrame(kerangka);
}

// Tautan dalam halaman diserahkan ke Lenis agar ikut mulus.
document.addEventListener("click", (e) => {
  const a = (e.target as Element | null)?.closest<HTMLAnchorElement>('a[href^="#"]');
  if (!a) return;
  const tujuan = document.querySelector(a.getAttribute("href")!);
  if (!tujuan) return;
  e.preventDefault();
  lenis.scrollTo(tujuan as HTMLElement);
});

void mulai();
