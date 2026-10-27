// Package habit berisi model domain dan perhitungan statistik.
// Paket ini sengaja bebas dari database dan HTTP supaya mudah dites.
package habit

import (
	"errors"
	"fmt"
	"sort"
	"strings"
	"time"
)

// Layout tanggal yang dipakai di seluruh aplikasi (dan sebagai format
// penyimpanan di SQLite, supaya urutan leksikografis = urutan kronologis).
const Layout = "2006-01-02"

// Date adalah satu hari kalender tanpa jam dan tanpa zona waktu.
type Date string

// DateOf mengambil bagian tanggal dari t, memakai zona waktu t sendiri.
func DateOf(t time.Time) Date { return Date(t.Format(Layout)) }

// ParseDate membaca tanggal berformat YYYY-MM-DD.
func ParseDate(s string) (Date, error) {
	t, err := time.Parse(Layout, s)
	if err != nil {
		return "", fmt.Errorf("tanggal %q tidak valid: %w", s, err)
	}
	return DateOf(t), nil
}

// Time mengubah Date menjadi tengah malam UTC pada hari tersebut.
func (d Date) Time() time.Time {
	t, err := time.Parse(Layout, string(d))
	if err != nil {
		return time.Time{}
	}
	return t
}

// AddDays menggeser tanggal sebanyak n hari (n boleh negatif).
func (d Date) AddDays(n int) Date { return DateOf(d.Time().AddDate(0, 0, n)) }

// Weekday mengembalikan hari dalam seminggu, dengan Senin sebagai hari ke-0.
func (d Date) Weekday() int { return (int(d.Time().Weekday()) + 6) % 7 }

func (d Date) String() string { return string(d) }

// Habit adalah satu kebiasaan yang dilacak.
type Habit struct {
	ID        int64
	Name      string
	Color     string
	CreatedAt time.Time
}

// Galat validasi nama habit. Keduanya dipisahkan dari galat basis data
// supaya lapisan HTTP bisa menampilkannya langsung kepada pengguna.
var (
	ErrNamaKosong         = errors.New("nama habit tidak boleh kosong")
	ErrNamaTerlaluPanjang = fmt.Errorf("nama habit maksimal %d karakter", MaxNamaLen)
)

// MaxNamaLen membatasi panjang nama agar tata letak grid tetap rapi.
const MaxNamaLen = 60

// NormalizeNama merapikan spasi dan memvalidasi panjang nama habit.
func NormalizeNama(s string) (string, error) {
	s = strings.Join(strings.Fields(s), " ")
	if s == "" {
		return "", ErrNamaKosong
	}
	if len([]rune(s)) > MaxNamaLen {
		return "", ErrNamaTerlaluPanjang
	}
	return s, nil
}

// Stats merangkum performa sebuah habit.
type Stats struct {
	Current int // panjang runtutan hari yang sedang berjalan
	Best    int // runtutan terpanjang yang pernah dicapai
	Done    int // jumlah hari selesai di dalam jendela pengamatan
	Window  int // besar jendela pengamatan, dalam hari
	Rate    int // Done/Window dalam persen, dibulatkan
}

// ComputeStats menghitung statistik dari himpunan hari yang sudah selesai.
//
// Runtutan yang sedang berjalan dihitung mundur dari hari ini. Jika hari ini
// belum ditandai selesai, perhitungan dimulai dari kemarin: hari yang sedang
// berlangsung belum berakhir, jadi tidak adil kalau langsung memutus runtutan.
func ComputeStats(done map[Date]bool, today Date, window int) Stats {
	if window < 1 {
		window = 1
	}
	st := Stats{Window: window}

	anchor := today
	if !done[anchor] {
		anchor = anchor.AddDays(-1)
	}
	for done[anchor] {
		st.Current++
		anchor = anchor.AddDays(-1)
	}

	// Runtutan terbaik: urutkan tanggal lalu cari deretan terpanjang.
	dates := make([]Date, 0, len(done))
	for d, ok := range done {
		if ok {
			dates = append(dates, d)
		}
	}
	sort.Slice(dates, func(i, j int) bool { return dates[i] < dates[j] })

	run := 0
	for i, d := range dates {
		if i > 0 && dates[i-1].AddDays(1) == d {
			run++
		} else {
			run = 1
		}
		if run > st.Best {
			st.Best = run
		}
	}
	if st.Current > st.Best {
		st.Best = st.Current
	}

	// Tingkat penyelesaian di dalam jendela yang berakhir hari ini.
	from := today.AddDays(-(window - 1))
	for d, ok := range done {
		if ok && d >= from && d <= today {
			st.Done++
		}
	}
	st.Rate = int((float64(st.Done)/float64(window))*100 + 0.5)

	return st
}
