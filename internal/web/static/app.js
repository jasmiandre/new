// Pelacak Habit — interaksi sisi klien.
//
// Halaman sepenuhnya digambar di server; skrip ini hanya menghindari muat ulang
// saat menandai hari. Tanpa JavaScript aktif, menambah, mengganti nama, dan
// menghapus habit tetap bekerja lewat pengiriman formulir biasa.

(function () {
  "use strict";

  var HARI_INI = document.querySelector("[data-toggle-harian]")
    ? document.querySelector("[data-toggle-harian]").dataset.hari
    : null;

  /** Mengirim permintaan toggle dan mengembalikan jawaban yang sudah diurai. */
  async function kirimToggle(habitID, hari) {
    var res = await fetch("/habits/" + encodeURIComponent(habitID) + "/toggle", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "hari=" + encodeURIComponent(hari),
    });
    if (!res.ok) {
      throw new Error((await res.text()).trim() || "permintaan gagal");
    }
    return res.json();
  }

  /** Menyelaraskan tampilan satu kartu dengan status terbaru dari server. */
  function perbaruiKartu(kartu, hari, data) {
    var sel = kartu.querySelector('.sel[data-hari="' + hari + '"]');
    if (sel) {
      sel.classList.toggle("selesai", data.selesai);
      sel.setAttribute("aria-pressed", String(data.selesai));
    }

    if (hari === HARI_INI) {
      var tombol = kartu.querySelector("[data-toggle-harian]");
      if (tombol) {
        tombol.classList.toggle("aktif", data.selesai);
        tombol.setAttribute("aria-pressed", String(data.selesai));
        var label = tombol.querySelector("[data-label-harian]");
        if (label) {
          label.textContent = data.selesai ? "Selesai hari ini" : "Tandai hari ini";
        }
      }
    }

    if (!data.stats) return;
    Object.keys(data.stats).forEach(function (kunci) {
      var el = kartu.querySelector('[data-stat="' + kunci + '"]');
      if (el) el.textContent = data.stats[kunci];
    });
  }

  function tampilkanGalat(pesan) {
    var banner = document.querySelector(".galat");
    if (!banner) {
      banner = document.createElement("p");
      banner.className = "galat";
      banner.setAttribute("role", "alert");
      var kepala = document.querySelector(".kepala");
      kepala.parentNode.insertBefore(banner, kepala.nextSibling);
    }
    banner.textContent = pesan;
  }

  /** Menangani klik pada kotak grid maupun tombol "tandai hari ini". */
  async function tangani(pemicu, hari) {
    var kartu = pemicu.closest(".kartu");
    if (!kartu) return;
    var habitID = kartu.dataset.habit;

    // Mencegah klik ganda mengirim dua permintaan untuk hari yang sama.
    if (pemicu.dataset.sibuk === "1") return;
    pemicu.dataset.sibuk = "1";
    try {
      perbaruiKartu(kartu, hari, await kirimToggle(habitID, hari));
    } catch (err) {
      tampilkanGalat("Gagal menyimpan: " + err.message);
    } finally {
      delete pemicu.dataset.sibuk;
    }
  }

  document.addEventListener("click", function (ev) {
    var sel = ev.target.closest("[data-sel]");
    if (sel) {
      tangani(sel, sel.dataset.hari);
      return;
    }
    var harian = ev.target.closest("[data-toggle-harian]");
    if (harian) {
      tangani(harian, harian.dataset.hari);
      return;
    }
    // Klik di luar menu habit menutup menu yang sedang terbuka.
    document.querySelectorAll("details.menu[open]").forEach(function (d) {
      if (!d.contains(ev.target)) d.open = false;
    });
  });

  // Penghapusan tidak bisa dibatalkan, jadi mintakan konfirmasi lebih dulu.
  document.addEventListener("submit", function (ev) {
    var pesan = ev.target.dataset.konfirmasi;
    if (pesan && !window.confirm(pesan)) ev.preventDefault();
  });

  document.addEventListener("keydown", function (ev) {
    if (ev.key !== "Escape") return;
    document.querySelectorAll("details.menu[open]").forEach(function (d) {
      d.open = false;
    });
  });
})();
