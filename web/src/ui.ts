// Lapisan antarmuka: navigasi, bab, HUD, dan penunjuk khusus.
//
// Seluruh isi dibangun dari src/content.ts, jadi menambah atau menata ulang bab
// cukup dilakukan di sana — berkas ini tidak memuat naskah apa pun.

import { chapters, situs, type Chapter } from "./content";

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
  const jenama = el("a", "jenama", situs.nama);
  jenama.href = "#isi";

  const tautan = el("nav", "nav-tautan");
  tautan.setAttribute("aria-label", "Navigasi utama");
  situs.nav.forEach((nama, i) => {
    const a = el("a", undefined, nama);
    a.href = `#bab-${i}`;
    tautan.append(a);
  });

  const bahasa = el("div", "bahasa");
  bahasa.setAttribute("aria-label", "Pilihan bahasa");
  situs.bahasa.forEach((kode, i) => {
    const s = el("span", undefined, kode);
    if (i === 0) s.setAttribute("aria-current", "true");
    bahasa.append(s);
  });

  const cta = el("a", "tombol tombol-utama", situs.cta.label);
  cta.href = situs.cta.href;

  wadah.append(jenama, tautan, bahasa, cta);
}

function bangunSatuBab(bab: Chapter, indeks: number): HTMLElement {
  const bagian = el("section", "bab");
  bagian.id = `bab-${indeks}`;
  bagian.dataset.bab = String(indeks);
  if (indeks === 0) bagian.dataset.tata = "sambutan";
  bagian.setAttribute("aria-label", `${bab.nomor} — ${bab.nama}`);

  const isi = el("div", "bab-isi");

  if (bab.kicker) isi.append(el("p", "kicker", bab.kicker));

  if (bab.judul) {
    const h = el(indeks === 0 ? "h1" : "h2", "judul");
    bab.judul.forEach((baris) => h.append(el("span", undefined, baris)));
    isi.append(h);
  }

  // Bab sambutan mengelompokkan paragraf dan tombol di kolom kanan.
  const tujuan = indeks === 0 ? el("div", "sisi-kanan") : isi;

  if (bab.teks) tujuan.append(el("p", "sokong", bab.teks));

  if (bab.butir) {
    const ul = el("ul", "butir");
    bab.butir.forEach((b) => {
      const li = el("li");
      li.append(el("b", undefined, b.label), el("p", undefined, b.teks));
      ul.append(li);
    });
    tujuan.append(ul);
  }

  if (bab.aksi) {
    const kotak = el("div", "aksi");
    bab.aksi.forEach((a) => {
      const tombol = el("a", `tombol ${a.utama ? "tombol-utama" : "tombol-sunyi"}`, a.label);
      tombol.href = a.href;
      kotak.append(tombol);
    });
    tujuan.append(kotak);
  }

  if (tujuan !== isi) isi.append(tujuan);
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
    const label = el("small", undefined, "CHAPTER");
    this.nama = el("strong");
    kotak.append(label, this.nama);
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

  /** Dipanggil tiap kerangka; mengejar posisi tetikus agar terasa punya bobot. */
  perbarui() {
    this.x += (this.tujuanX - this.x) * 0.18;
    this.y += (this.tujuanY - this.y) * 0.18;
    this.simpul.style.transform = `translate3d(${this.x}px, ${this.y}px, 0)`;
  }
}

/**
 * Mencampur warna antarmuka mengikuti tema dunia 3D, supaya teks tetap
 * terbaca ketika latar berbalik dari hitam ke putih.
 */
export function terapkanTemaAntarmuka(nilai: number) {
  const campur = (gelap: number[], terang: number[]) =>
    gelap.map((v, i) => Math.round(v + (terang[i]! - v) * nilai));
  const rgb = (c: number[]) => `rgb(${c[0]} ${c[1]} ${c[2]})`;
  const rgba = (c: number[], a: number) => `rgb(${c[0]} ${c[1]} ${c[2]} / ${a})`;

  const akar = document.documentElement.style;
  akar.setProperty("--teks", rgb(campur([243, 246, 251], [9, 14, 24])));
  akar.setProperty("--teks-redup", rgb(campur([159, 176, 201], [85, 99, 122])));
  akar.setProperty("--garis", rgba(campur([255, 255, 255], [10, 16, 28]), 0.18 + nilai * 0.08));
  akar.setProperty("--panel", rgba(campur([8, 12, 20], [255, 255, 255]), 0.55));
  const latar = campur([4, 6, 12], [236, 239, 245]);
  akar.setProperty("--latar", rgb(latar));
  // Dipakai scrim, yang perlu warna latar dengan alfa yang berubah-ubah.
  akar.setProperty("--latar-rgb", `${latar[0]} ${latar[1]} ${latar[2]}`);
}
