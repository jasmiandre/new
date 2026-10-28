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

const jepit = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/** Smootherstep kuintik: berangkat dan berhenti tanpa sentakan. */
const halus = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);

/**
 * Seberapa cepat kamera menyusul posisi gulir, dalam detik.
 *
 * Lenis sudah menghaluskan gulir halamannya, tetapi kamera yang mengikuti
 * angka itu persis tetap terasa ditarik tali: ia berangkat dan berhenti
 * seketika bersama jari. Penundaan kecil memberi kamera bobot — ia menyusul,
 * lalu mengendap. Terlalu besar dan halaman terasa lamban, jadi nilainya
 * sengaja ditahan di bawah seperlima detik.
 */
const TAU_KAMERA = 0.16;

/** Memudarkan isi tiap bab di awal dan akhir bagiannya. */
function perbaruiIsiBab() {
  const tinggi = window.innerHeight;
  for (const [indeks, b] of bagian.entries()) {
    const kotak = b.getBoundingClientRect();
    const total = kotak.height - tinggi;
    if (total <= 0) continue;

    const lokal = jepit(-kotak.top / total, 0, 1);
    // Bab pertama sudah berada di puncak halaman saat dimuat, jadi ia tidak
    // punya "masuk" untuk dipudarkan — tanpa pengecualian ini hero tampil kosong.
    const masuk = indeks === 0 ? 1 : halus(jepit(lokal / 0.12, 0, 1));
    const keluar = halus(jepit((1 - lokal) / 0.16, 0, 1));
    const tampak = Math.min(masuk, keluar);

    const isi = b.firstElementChild as HTMLElement | null;
    if (!isi) continue;
    isi.style.opacity = String(tampak);
    // Naskah ikut mundur sedikit saat memudar, seperti menjauh dari fokus.
    const mundur = 1 - tampak;
    isi.style.transform = `translate3d(0, ${mundur * 26}px, 0) scale(${1 - mundur * 0.018})`;
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
  let sebelumnya = awal;
  let kemajuanKamera = 0;

  const kerangka = (waktu: number) => {
    lenis.raf(waktu);

    // Selisih waktu dijepit: setelah tab kembali aktif, satu lompatan besar
    // akan menarik kamera sejauh apa pun dalam satu kerangka.
    const dt = Math.min(0.05, (waktu - sebelumnya) / 1000);
    sebelumnya = waktu;

    // Pengikut teredam, tidak bergantung laju kerangka: kamera selalu menempuh
    // pecahan jarak yang sama per satuan waktu, entah layarnya 60 atau 120 Hz.
    kemajuanKamera += (kemajuan - kemajuanKamera) * (1 - Math.exp(-dt / TAU_KAMERA));

    // Gerak menganggur dibekukan ketika pengguna minta gerak dikurangi.
    const detik = kurangiGerak ? 0 : (waktu - awal) / 1000;

    dunia?.gambar(kurangiGerak ? kemajuan : kemajuanKamera, detik);
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
