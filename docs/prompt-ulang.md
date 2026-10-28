# Prompt untuk membuat situs bergaya sama di repo lain

Salin seluruh blok di bawah ke sesi Claude Code baru di repo tujuan, lalu isi
bagian bertanda `[ISI: ...]`.

Nilai prompt ini bukan pada deskripsi gayanya — itu bagian mudah — melainkan
pada daftar jebakan di bagian D. Semua jebakan itu benar-benar terjadi saat
membangun repo ini, dan masing-masing menghabiskan satu putaran perbaikan.

---

```text
Bangun situs scroll-telling satu halaman: SATU dunia 3D berkelanjutan yang
dilintasi kamera, digerakkan sepenuhnya oleh posisi gulir.

ACUAN ARSITEKTUR
Baca https://github.com/jasmiandre/new — terutama web/src/world/ dan
web/src/content.ts — lalu ikuti pola yang sama. Jangan salin naskah,
palet, atau glifnya; yang ditiru hanya strukturnya.

A. STACK
Vite + TypeScript + Three.js + Lenis. Tanpa kerangka UI, tanpa pustaka
animasi. Kalau aku minta satu binari, tanam hasil build ke server Go lewat
embed.

B. MEKANIK INTI — bagian yang paling menentukan
- Posisi kamera, warna kabut, dan peralihan tema HARUS fungsi murni dari
  kemajuan gulir 0..1. Jangan pakai animasi yang dipicu sekali jalan: kalau
  begitu, menggulir naik tidak akan menempuh lintasan yang sama.
- Isi tiap bab dipaku dengan position: sticky selama kamera melintasi
  bagiannya. Inilah yang membuatnya terasa seperti film — konten diam, dunia
  yang bergerak. Tanpa ini hasilnya cuma halaman menggulir biasa.
- Bidang grid tak hingga digambar lewat shader dalam koordinat dunia, bukan
  tekstur, dengan antialias memakai fwidth(). Bidangnya mengikuti kamera,
  tetapi polanya terkunci ke koordinat dunia supaya tidak ikut bergeser.
- Bab didefinisikan sebagai data di SATU berkas content.ts: nomor, nama,
  tema, judul, paragraf, dan daftar aset. Mesin 3D tidak boleh memuat teks
  apa pun.

C. YANG BERBEDA DARI ACUAN
- Tema: [ISI: palet, misal "hitam ke krem, aksen merah bata"].
  Dunia berbalik tema di bab [ISI: nama bab], dan warna teks antarmuka ikut
  dicampur mengikuti peralihan itu agar tetap terbaca di tengah transisi.
- Gambar: pakai berkas di [ISI: folder]. Tempatkan sebagai bidang bertekstur
  yang berdiri di atas grid, bukan sebagai <img> di DOM. Jaga rasio aspek
  aslinya, set texture.colorSpace = SRGBColorSpace dan anisotropy 4–8, dan
  pudarkan masuk setelah teksturnya selesai dimuat supaya tidak berkedip.
- Naskah: [ISI: atau tulis "pakai teks sementara, aku ganti nanti"].

D. JEBAKAN YANG WAJIB DIHINDARI
1. ShaderMaterial TIDAK mewarisi scene.fog. Hitung kabut sendiri di dalam
   shader, atau objek jauh tetap pekat dan terbaca sebagai gerombolan yang
   mengambang alih-alih larut ke kejauhan.
2. Konstanta blending Three.js: NormalBlending = 1, AdditiveBlending = 2.
   Impor namanya; jangan pernah menulis angkanya langsung. Salah satu angka
   membuat garis gelap lenyap total di atas latar terang.
3. Bab pertama tidak boleh memudar-masuk dari opasitas 0. Pada gulir 0 ia
   sudah berada di layar, jadi rumus fade biasa membuat hero tampil kosong
   saat halaman pertama kali dibuka.
4. Jauhkan objek 3D dari kolom teks, dan beri gradien tipis berwarna latar di
   tepi kiri dan bawah. Judul berukuran besar akan jatuh tepat di atas objek
   terang dan kehilangan kontras.
5. Set vite base: "./" supaya situs bisa disajikan dari subjalur, bukan hanya
   dari akar domain.
6. Batasi devicePixelRatio di 2. Di atas itu biaya render naik tajam tanpa
   perbedaan yang terlihat.
7. Tangani WebGL tidak tersedia: sembunyikan kanvas, dan pastikan seluruh isi
   tetap terbaca. Hormati prefers-reduced-motion dengan mematikan penghalusan
   gulir, ayunan menganggur, dan penunjuk khusus.
8. Kalau hasil build ditanam ke binari Go: simpan satu .gitkeep di direktori
   keluaran DAN kembalikan berkas itu setelah tiap build, karena Vite
   mengosongkan direktori tersebut. Tanpa itu go:embed gagal dikompilasi di
   klona baru.

E. CARA KERJA YANG AKU MINTA
Jangan bilang selesai sebelum kamu menjalankan situsnya sendiri dan menangkap
layar: hero, satu bab bertema terang, dan tampilan ponsel lebar 390px.
Periksa galat konsol, dan pastikan halaman tidak bisa digulir mendatar di
lebar ponsel. Uji juga gulir turun LALU naik lagi, dan pastikan penanda bab
serta tema kembali ke keadaan yang sama persis.

Perbaiki apa yang terlihat salah di tangkapan layar itu, bukan apa yang kamu
kira sudah benar. Semua jebakan di bagian D ditemukan lewat cara ini, tidak
satu pun lewat membaca ulang kode.
```

---

## Kalau repo acuan tidak bisa diakses

Sesi baru mungkin tidak punya akses ke `jasmiandre/new`. Kalau begitu, hapus
bagian ACUAN ARSITEKTUR — sisa prompt sudah berdiri sendiri. Atau sebutkan
berkas yang perlu ditiru polanya:

```
web/src/world/scene.ts   lintasan kamera dan peralihan tema
web/src/world/grid.ts    shader bidang grid tak hingga
web/src/world/tiles.ts   objek melayang, termasuk kabut manual
web/src/content.ts       seluruh naskah dan data bab
```
