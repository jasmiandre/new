package habit

import "testing"

// doneSet membangun himpunan hari selesai dari daftar tanggal.
func doneSet(days ...string) map[Date]bool {
	m := make(map[Date]bool, len(days))
	for _, d := range days {
		m[Date(d)] = true
	}
	return m
}

func TestNormalizeNama(t *testing.T) {
	cases := []struct {
		in      string
		want    string
		wantErr bool
	}{
		{in: "  Lari   pagi ", want: "Lari pagi"},
		{in: "Baca buku", want: "Baca buku"},
		{in: "   ", wantErr: true},
		{in: "", wantErr: true},
		{in: string(make([]rune, MaxNamaLen+1)), wantErr: true},
	}
	for _, c := range cases {
		got, err := NormalizeNama(c.in)
		if c.wantErr {
			if err == nil {
				t.Errorf("NormalizeNama(%q) = %q, mau error", c.in, got)
			}
			continue
		}
		if err != nil {
			t.Errorf("NormalizeNama(%q) error tak terduga: %v", c.in, err)
			continue
		}
		if got != c.want {
			t.Errorf("NormalizeNama(%q) = %q, mau %q", c.in, got, c.want)
		}
	}
}

func TestDateAddDaysMelewatiBatasBulan(t *testing.T) {
	if got := Date("2026-02-28").AddDays(1); got != "2026-03-01" {
		t.Errorf("2026-02-28 + 1 hari = %s, mau 2026-03-01", got)
	}
	// 2024 tahun kabisat: 29 Februari harus ada.
	if got := Date("2024-02-28").AddDays(1); got != "2024-02-29" {
		t.Errorf("2024-02-28 + 1 hari = %s, mau 2024-02-29", got)
	}
	if got := Date("2026-01-01").AddDays(-1); got != "2025-12-31" {
		t.Errorf("2026-01-01 - 1 hari = %s, mau 2025-12-31", got)
	}
}

func TestDateWeekdaySeninNol(t *testing.T) {
	// 2026-10-26 adalah hari Senin.
	if got := Date("2026-10-26").Weekday(); got != 0 {
		t.Errorf("Senin harus 0, dapat %d", got)
	}
	if got := Date("2026-11-01").Weekday(); got != 6 {
		t.Errorf("Minggu harus 6, dapat %d", got)
	}
}

func TestComputeStatsHariIniSudahSelesai(t *testing.T) {
	done := doneSet("2026-10-25", "2026-10-26", "2026-10-27")
	st := ComputeStats(done, "2026-10-27", 30)
	if st.Current != 3 {
		t.Errorf("Current = %d, mau 3", st.Current)
	}
	if st.Best != 3 {
		t.Errorf("Best = %d, mau 3", st.Best)
	}
}

// Hari ini belum ditandai, tapi kemarin dan sebelumnya sudah: runtutan harus
// tetap hidup, karena hari ini belum berakhir.
func TestComputeStatsHariIniBelumSelesaiTidakMemutusRuntutan(t *testing.T) {
	done := doneSet("2026-10-25", "2026-10-26")
	st := ComputeStats(done, "2026-10-27", 30)
	if st.Current != 2 {
		t.Errorf("Current = %d, mau 2 (hari ini belum berakhir)", st.Current)
	}
}

// Dua hari bolong harus benar-benar memutus runtutan.
func TestComputeStatsRuntutanTerputus(t *testing.T) {
	done := doneSet("2026-10-20", "2026-10-21", "2026-10-22")
	st := ComputeStats(done, "2026-10-27", 30)
	if st.Current != 0 {
		t.Errorf("Current = %d, mau 0", st.Current)
	}
	if st.Best != 3 {
		t.Errorf("Best = %d, mau 3", st.Best)
	}
}

func TestComputeStatsBestDariRuntutanLama(t *testing.T) {
	done := doneSet(
		"2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04", "2026-09-05",
		"2026-10-26", "2026-10-27",
	)
	st := ComputeStats(done, "2026-10-27", 30)
	if st.Current != 2 {
		t.Errorf("Current = %d, mau 2", st.Current)
	}
	if st.Best != 5 {
		t.Errorf("Best = %d, mau 5", st.Best)
	}
}

func TestComputeStatsRateHanyaMenghitungDalamJendela(t *testing.T) {
	// Satu hari di dalam jendela 10 hari, satu hari jauh di luar jendela.
	done := doneSet("2026-10-27", "2026-01-01")
	st := ComputeStats(done, "2026-10-27", 10)
	if st.Done != 1 {
		t.Errorf("Done = %d, mau 1 (tanggal di luar jendela harus diabaikan)", st.Done)
	}
	if st.Rate != 10 {
		t.Errorf("Rate = %d, mau 10", st.Rate)
	}
	if st.Window != 10 {
		t.Errorf("Window = %d, mau 10", st.Window)
	}
}

func TestComputeStatsBatasJendelaInklusif(t *testing.T) {
	// Jendela 7 hari yang berakhir 2026-10-27 mencakup 2026-10-21..2026-10-27.
	done := doneSet("2026-10-21", "2026-10-20")
	st := ComputeStats(done, "2026-10-27", 7)
	if st.Done != 1 {
		t.Errorf("Done = %d, mau 1 (hari pertama jendela ikut, hari sebelumnya tidak)", st.Done)
	}
}

func TestComputeStatsKosong(t *testing.T) {
	st := ComputeStats(nil, "2026-10-27", 30)
	if st != (Stats{Window: 30}) {
		t.Errorf("statistik habit kosong = %+v, mau nol dengan Window 30", st)
	}
}

func TestComputeStatsRateDibulatkan(t *testing.T) {
	// 1 dari 3 hari = 33.33% -> 33.
	st := ComputeStats(doneSet("2026-10-27"), "2026-10-27", 3)
	if st.Rate != 33 {
		t.Errorf("Rate = %d, mau 33", st.Rate)
	}
	// 2 dari 3 hari = 66.67% -> 67.
	st = ComputeStats(doneSet("2026-10-27", "2026-10-26"), "2026-10-27", 3)
	if st.Rate != 67 {
		t.Errorf("Rate = %d, mau 67", st.Rate)
	}
}

func TestComputeStatsWindowTidakValidDijepit(t *testing.T) {
	st := ComputeStats(doneSet("2026-10-27"), "2026-10-27", 0)
	if st.Window != 1 {
		t.Errorf("Window = %d, mau dijepit ke 1", st.Window)
	}
	if st.Rate != 100 {
		t.Errorf("Rate = %d, mau 100", st.Rate)
	}
}

func TestParseDateMenolakFormatSalah(t *testing.T) {
	for _, s := range []string{"27-10-2026", "2026/10/27", "besok", "", "2026-13-01"} {
		if _, err := ParseDate(s); err == nil {
			t.Errorf("ParseDate(%q) berhasil, mau error", s)
		}
	}
	if d, err := ParseDate("2026-10-27"); err != nil || d != "2026-10-27" {
		t.Errorf("ParseDate(valid) = %q, %v", d, err)
	}
}
