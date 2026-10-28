// Lapisan antarmuka: navigasi, bab, dan HUD.
//
// Seluruh isi dibangun dari src/content.ts, jadi berkas ini tidak memuat
// naskah apa pun.

import { chapters, LABEL_STATUS, situs, type Chapter } from "./content";

const el = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  kelas?: string,
  teks?: string,
): HTMLElementTagNameMap[K] => {
  const n = document.createElement(tag);
  if (kelas) n.className = kelas;
  if (teks !== undefined) n.textContent = teks;
  return n;
};

export function bangunNav(wadah: HTMLElement) {
  const jenama = el("a", "jenama");
  jenama.href = "#isi";
  jenama.append(el("span", "jenama-tanda", "▤"), el("span", undefined, situs.nama));

  const tautan = el("nav", "nav-tautan");
  tautan.setAttribute("aria-label", "Navigasi utama");
  situs.nav.forEach((n) => {
    const a = el("a", undefined, n.label);
    a.href = n.href;
    tautan.append(a);
  });

  const status = el("div", "status");
  status.append(el("span", "status-titik"), el("span", undefined, situs.status));

  const bahasa = el("div", "bahasa");
  bahasa.setAttribute("aria-label", "Pilihan bahasa");
  situs.bahasa.forEach((kode, i) => {
    const s = el("span", undefined, kode);
    if (i === 0) s.setAttribute("aria-current", "true");
    bahasa.append(s);
  });

  const cta = el("a", "tombol tombol-utama", situs.cta.label);
  cta.href = situs.cta.href;

  wadah.append(jenama, tautan, status, bahasa, cta);
}

function bangunSatuBab(bab: Chapter, indeks: number): HTMLElement {
  const bagian = el("section", "bab");
  bagian.id = `bab-${indeks}`;
  bagian.dataset.tata = bab.tata;
  bagian.setAttribute("aria-label", `${bab.nomor} — ${bab.nama}`);

  const isi = el("div", "bab-isi");
  const kolom = el("div", "kolom");

  if (bab.kicker) {
    const k = el("p", "kicker");
    k.append(el("span", undefined, bab.kicker));
    kolom.append(k);
  }

  const h = el(indeks === 0 ? "h1" : "h2", "judul");
  bab.judul.forEach((baris) => h.append(el("span", undefined, baris)));
  kolom.append(h);

  if (bab.teks) kolom.append(el("p", "sokong", bab.teks));

  // Label status mengikuti konvensi panel.ai.id: tiap klaim menyebut apakah ia
  // sudah diuji atau masih dikerjakan.
  if (bab.status) {
    const tanda = el("p", `status-bab status-${bab.status}`);
    tanda.append(el("span", "status-titik"), el("span", undefined, LABEL_STATUS[bab.status]));
    kolom.append(tanda);
  }

  if (bab.metrik) {
    const daftar = el("dl", "metrik");
    bab.metrik.forEach((m) => {
      const kotak = el("div");
      kotak.append(el("dt", undefined, m.nilai), el("dd", undefined, m.label));
      daftar.append(kotak);
    });
    kolom.append(daftar);
  }

  // Catatan status sengaja ditaruh setelah metrik: ia membatasi klaim di
  // atasnya, jadi harus terbaca bersama angka-angka itu.
  if (bab.catatan) kolom.append(el("p", "catatan", bab.catatan));

  if (bab.aksi) {
    const kotak = el("div", "aksi");
    bab.aksi.forEach((a) => {
      const tombol = el("a", `tombol ${a.utama ? "tombol-utama" : "tombol-sunyi"}`, a.label);
      tombol.href = a.href;
      kotak.append(tombol);
    });
    kolom.append(kotak);
  }

  isi.append(kolom);
  bagian.append(isi);
  return bagian;
}

export function bangunBab(wadah: HTMLElement): HTMLElement[] {
  const bagian = chapters.map(bangunSatuBab);
  wadah.append(...bagian);
  return bagian;
}

/** Penanda bab di kiri bawah, mengikuti posisi gulir. */
export class Hud {
  private readonly nomor: HTMLElement;
  private readonly nama: HTMLElement;
  private terakhir = -1;

  constructor(wadah: HTMLElement) {
    this.nomor = el("div", "hud-nomor");
    const kotak = el("div", "hud-nama");
    this.nama = el("strong");
    kotak.append(el("small", undefined, "BAB"), this.nama);
    wadah.append(this.nomor, kotak);
    this.perbarui(0);
  }

  perbarui(kemajuan: number) {
    const i = Math.min(
      chapters.length - 1,
      Math.max(0, Math.floor(kemajuan * chapters.length)),
    );
    if (i === this.terakhir) return;
    this.terakhir = i;
    const bab = chapters[i]!;
    this.nomor.textContent = bab.nomor;
    this.nama.textContent = bab.nama;
  }
}

/** Lingkaran kecil yang mengikuti tetikus dan membesar di atas tautan. */
export class Penunjuk {
  private x = 0;
  private y = 0;
  private tujuanX = 0;
  private tujuanY = 0;

  constructor(private readonly simpul: HTMLElement) {
    window.addEventListener("pointermove", (e) => {
      if (e.pointerType !== "mouse") return;
      this.tujuanX = e.clientX;
      this.tujuanY = e.clientY;
      this.simpul.classList.add("tampak");
      const atas = (e.target as Element | null)?.closest("a, button");
      this.simpul.classList.toggle("besar", !!atas);
    });
    document.addEventListener("pointerleave", () => this.simpul.classList.remove("tampak"));
  }

  perbarui() {
    this.x += (this.tujuanX - this.x) * 0.18;
    this.y += (this.tujuanY - this.y) * 0.18;
    this.simpul.style.transform = `translate3d(${this.x}px, ${this.y}px, 0)`;
  }
}
