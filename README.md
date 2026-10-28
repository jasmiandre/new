# Landing page panel.ai.id

Halaman arahan scroll-telling untuk [panel.ai.id](https://panel.ai.id) — panel
kontrol hosting berbasis cluster. Seluruh halaman adalah **satu sistem 3D yang
hidup**, bukan rangkaian animasi: keadaannya dihitung ulang tiap kerangka dari
posisi gulir, dan dikompilasi menjadi satu binari Go.

![Hero](docs/hero.png)

## Gagasan utamanya

Klaim inti produk ini — *kalau satu region berhenti menjawab, dua sisanya
mengambil alih* — tidak diceritakan lewat paragraf, melainkan **diperagakan
di tempat**.

Ada tepat satu salinan sistem tiga region di seluruh halaman. Menggulir tidak
memindahkan kamu ke diagram berikutnya; menggulir **menjalankan** cerita pada
diagram yang sama. Region benar-benar meredup di depan mata, izinnya
kedaluwarsa, kepemimpinan berpindah, lalu trafik berbelok.

| Bab | Yang terjadi pada sistem |
| --- | --- |
| 00 Panel | Bidikan luas; sistem dibaca sebagai bentuk, label disembunyikan |
| 01 Region | Kamera mendekat ke satu region |
| 02 Replikasi | Denyut mengalir dari pemimpin ke dua region lain |
| 03 Padam | region-2 meredup berangsur; izin 41 kedaluwarsa |
| 04 Berbelok | region-3 menyala sebagai pemimpin dengan izin 42 |
| 05 Pulih | region-2 hidup lagi, tautannya memerah — nomor lama ditolak |
| 06 Akses awal | Bidikan luas lagi |

![Momen ambil alih](docs/failover.png)

Karena seluruh keadaan adalah fungsi murni dari kemajuan gulir, **menggulir
naik benar-benar memutar balik cerita**: region yang padam menyala kembali
persis seperti ia meredup.

## Menjalankan

Butuh Go 1.24+ dan Node 22+.

```bash
make run     # bangun frontend, tanam ke binari, jalankan
make dev     # server Vite dengan muat-ulang panas
```

Lalu buka <http://127.0.0.1:8080>.

## Mengganti isi

- **`web/src/content.ts`** — seluruh naskah, urutan bab, dan label status.
- **`web/src/world/keadaan.ts`** — jadwal cerita: kapan region padam, kapan
  izinnya kedaluwarsa, kapan kepemimpinan berpindah. Angkanya ditulis dalam
  satuan bab, jadi peristiwa bisa digeser tanpa menyentuh kode 3D.
- **`web/src/world/scene.ts`** — titik acuan kamera per bab.

Naskah saat ini mengikuti konvensi panel.ai.id: tiap klaim berlabel *sudah
diuji di cluster kami* atau *sedang dikerjakan*. Angka failover berasal dari
uji di cluster pengembangan; perpindahan website pelanggan antar region masih
ditandai sebagai sedang dikerjakan.

## Struktur

```
main.go                  titik masuk: flag, server HTTP, penutupan rapi
handler.go               penyaji aset yang ditanam, beserta aturan temboloknya
web/src/content.ts       naskah, urutan bab, label status
web/src/ui.ts            navigasi, bab, HUD, penunjuk khusus
web/src/world/keadaan.ts keadaan cluster sebagai fungsi menerus dari gulir
web/src/world/regions.ts tiga region: menara, simpul, tautan, label izin
web/src/world/scene.ts   renderer, lintasan kamera melengkung, suasana
web/src/world/grid.ts    shader bidang grid tak hingga
web/src/world/labels.ts  label teks yang digambar ke canvas saat runtime
```

## Lapisan yang membuatnya terasa seperti rekaman

Gerak yang benar saja belum cukup; tanpa empat lapisan ini hasilnya masih
terbaca sebagai animasi, bukan film.

- **Bidikan ditahan, lalu berpindah.** Kamera diam pada komposisinya selama
  sekitar separuh bab, lalu berpindah di bagian tengah peralihan. Diukur lewat
  selisih antar-bingkai: sekitar 2 di tengah bab, melonjak ke 9 di perbatasan.
  Film tersusun dari bidikan yang ditahan, bukan kamera yang tidak pernah
  berhenti.
- **Kamera punya bobot.** Posisinya mengejar posisi gulir lewat pengikut
  teredam bertetapan 0,16 detik, bukan mengikutinya persis. Tanpa ini kamera
  berangkat dan berhenti seketika bersama jari.
- **Pemetaan nada ACES dan bloom.** Kurva nada film meratakan sorotan alih-alih
  memotongnya di putih, dan bloom membuat cahaya tampak meluber ke lensa.
- **Bintik film dan vignette**, dikerjakan setelah pemetaan nada, dengan bintik
  lebih kentara di bayangan — seperti film sungguhan.

Ditambah napas kamera: goyangan rotasi di bawah 0,002 radian yang membuat
bidikan terasa dipegang orang, bukan dipaku ke rig. Semuanya berhenti sendiri
saat `prefers-reduced-motion` aktif, karena waktu yang masuk dibekukan di nol.

## Catatan rancangan

- **Kamera mengorbit, bukan meluncur di rel.** Posisinya diambil dari kurva
  Catmull-Rom yang melewati satu titik acuan per bab, sehingga perpindahannya
  melengkung mulus alih-alih patah di tiap titik.
- **Bingkai digeser lewat titik pandang.** Memandang titik di sebelah kiri
  subjek mendorong sistem ke paruh kanan layar, tempat naskah tidak berada —
  lebih stabil daripada memutar kamera setelah `lookAt`.
- **Label berukuran tetap di layar.** Kamera menjauh sampai lebih dari seratus
  satuan pada bidikan luas; tanpa penskalaan terhadap jarak, label yang terbaca
  dari dekat menyusut jadi noda.
- **Label memudar pada bidikan luas.** Di bab rata tengah, label 3D akan
  menumpuk tepat di atas naskah. Menyembunyikannya di situ sekaligus membuat
  bidikan pembuka terbaca sebagai bentuk murni.
- **Tema tidak dibalik.** Merek panel.ai.id gelap sepenuhnya. Yang berubah
  mengikuti cerita adalah warna pijar grid: hijau selama izin hidup, jingga
  saat kedaluwarsa.
- **Kabut dihitung manual di shader.** `ShaderMaterial` tidak mewarisi
  `scene.fog`.
- **Tanpa `OutputPass` di ujung rantai pasca-pemrosesan.** Pada versi three ini
  lintasan adegan sudah menulis nilai siap-tampil ke target composer, sehingga
  menambahkan `OutputPass` berarti mengenkode sRGB untuk kedua kalinya: hitam
  pekat merek terangkat jadi kabut abu. Pemetaan nada karena itu dikerjakan
  oleh lintasan adegan.
- **Rasio piksel ditahan di layar sempit.** Bloom mengerjakan beberapa lintasan
  blur tiap kerangka; pada kerapatan ponsel selisihnya tidak terlihat sementara
  bebannya hampir separuh.
- **Tetap utuh tanpa WebGL**, dan `prefers-reduced-motion` mematikan
  penghalusan gulir, gerak menganggur, serta penunjuk khusus.

## Membuat yang serupa

`docs/prompt-ulang.md` memuat prompt siap pakai untuk membangun situs bergaya
sama di repositori lain, lengkap dengan daftar jebakan yang ditemui.

## Riwayat

Repositori ini pernah berisi **Pelacak Habit** (Go + SQLite) dan sebuah situs
studio contoh. Keduanya masih utuh di riwayat git.

## Lisensi

MIT
