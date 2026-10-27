// Package web menyajikan antarmuka HTTP untuk pelacak habit.
package web

import (
	"embed"
	"encoding/json"
	"errors"
	"fmt"
	"html/template"
	"io/fs"
	"log/slog"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/jasmiandre/new/internal/habit"
	"github.com/jasmiandre/new/internal/store"
)

//go:embed templates/*.html
var templateFS embed.FS

//go:embed static
var staticFS embed.FS

// Weeks adalah lebar grid dalam satuan minggu.
const Weeks = 18

// StatsWindow adalah panjang jendela, dalam hari, untuk menghitung
// tingkat penyelesaian yang ditampilkan di tiap kartu habit.
const StatsWindow = 30

// Palet warna untuk habit baru; dipilih bergilir agar tiap kartu mudah dibedakan.
var Palet = []string{
	"#f97316", // jingga
	"#22d3ee", // sian
	"#a78bfa", // lembayung
	"#4ade80", // hijau
	"#f472b6", // merah muda
	"#facc15", // kuning
}

// Server menangani seluruh permintaan HTTP aplikasi.
type Server struct {
	store *store.Store
	tmpl  *template.Template
	now   func() time.Time
	log   *slog.Logger
	mux   *http.ServeMux
}

// Options mengatur ketergantungan Server. Field yang dibiarkan nol akan
// memakai nilai bawaan yang masuk akal.
type Options struct {
	// Now dipakai sebagai sumber waktu. Disuntikkan agar tes bisa memaku
	// "hari ini" ke tanggal tetap.
	Now func() time.Time
	// Logger menerima galat sisi server.
	Logger *slog.Logger
}

// New membangun Server yang siap dipakai sebagai http.Handler.
func New(s *store.Store, opts Options) (*Server, error) {
	tmpl, err := template.ParseFS(templateFS, "templates/*.html")
	if err != nil {
		return nil, fmt.Errorf("mengurai template: %w", err)
	}

	srv := &Server{
		store: s,
		tmpl:  tmpl,
		now:   opts.Now,
		log:   opts.Logger,
	}
	if srv.now == nil {
		srv.now = time.Now
	}
	if srv.log == nil {
		srv.log = slog.Default()
	}
	srv.rute()
	return srv, nil
}

func (s *Server) rute() {
	statik, err := fs.Sub(staticFS, "static")
	if err != nil {
		// Hanya mungkin terjadi kalau direktori embed salah nama, yang akan
		// gagal saat kompilasi; jadi di sini aman untuk panik.
		panic(fmt.Sprintf("subdirektori static: %v", err))
	}

	s.mux = http.NewServeMux()
	s.mux.Handle("GET /static/", http.StripPrefix("/static/", http.FileServerFS(statik)))
	s.mux.HandleFunc("GET /{$}", s.beranda)
	s.mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "text/plain; charset=utf-8")
		fmt.Fprintln(w, "ok")
	})
	s.mux.HandleFunc("POST /habits", s.buatHabit)
	s.mux.HandleFunc("POST /habits/{id}/toggle", s.toggleHari)
	s.mux.HandleFunc("POST /habits/{id}/rename", s.gantiNama)
	s.mux.HandleFunc("POST /habits/{id}/delete", s.hapusHabit)
}

func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	s.mux.ServeHTTP(w, r)
}

// --- model tampilan ---

// sel adalah satu kotak di grid.
type sel struct {
	Tanggal habit.Date
	Selesai bool
	// Depan menandai tanggal sesudah hari ini: digambar pudar dan tidak bisa diklik.
	Depan bool
	// IniHariIni menandai kotak hari ini agar bisa diberi penanda khusus.
	IniHariIni bool
}

// kartu adalah satu habit beserta grid dan statistiknya.
type kartu struct {
	habit.Habit
	Stats         habit.Stats
	Sel           []sel
	SelesaiHarian bool
}

// halaman adalah data untuk template beranda.
type halaman struct {
	HariIni   habit.Date
	Kartu     []kartu
	Galat     string
	Weeks     int
	NamaHari  []string
	TotalHari int
}

// --- handler ---

func (s *Server) beranda(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	hariIni := habit.DateOf(s.now())

	habits, err := s.store.ListHabits(ctx)
	if err != nil {
		s.galatServer(w, r, "memuat daftar habit", err)
		return
	}

	// Grid selalu dimulai pada hari Senin agar baris sejajar dengan nama hari.
	seninIni := hariIni.AddDays(-hariIni.Weekday())
	mulai := seninIni.AddDays(-(Weeks - 1) * 7)
	totalHari := Weeks * 7
	akhir := mulai.AddDays(totalHari - 1)

	// Satu kueri untuk grid semua habit sekaligus, bukan satu kueri per habit.
	dalamRentang, err := s.store.EntriesRange(ctx, mulai, akhir)
	if err != nil {
		s.galatServer(w, r, "memuat catatan harian", err)
		return
	}

	kartu2 := make([]kartu, 0, len(habits))
	for _, h := range habits {
		// Runtutan terbaik butuh seluruh riwayat, bukan hanya yang tampil di grid.
		semua, err := s.store.Entries(ctx, h.ID)
		if err != nil {
			s.galatServer(w, r, "memuat riwayat habit", err)
			return
		}

		sel2 := make([]sel, 0, totalHari)
		// Kotak dikeluarkan kolom demi kolom (minggu demi minggu, Senin ke
		// Minggu) supaya cocok dengan grid-auto-flow: column di CSS.
		for i := range totalHari {
			d := mulai.AddDays(i)
			sel2 = append(sel2, sel{
				Tanggal:    d,
				Selesai:    dalamRentang[h.ID][d],
				Depan:      d > hariIni,
				IniHariIni: d == hariIni,
			})
		}

		kartu2 = append(kartu2, kartu{
			Habit:         h,
			Stats:         habit.ComputeStats(semua, hariIni, StatsWindow),
			Sel:           sel2,
			SelesaiHarian: semua[hariIni],
		})
	}

	s.render(w, r, halaman{
		HariIni:   hariIni,
		Kartu:     kartu2,
		Galat:     r.URL.Query().Get("galat"),
		Weeks:     Weeks,
		NamaHari:  []string{"Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"},
		TotalHari: totalHari,
	})
}

func (s *Server) buatHabit(w http.ResponseWriter, r *http.Request) {
	nama := r.FormValue("nama")

	// Warna dipilih bergilir dari palet berdasarkan jumlah habit yang ada.
	daftar, err := s.store.ListHabits(r.Context())
	if err != nil {
		s.galatServer(w, r, "memuat daftar habit", err)
		return
	}
	warna := Palet[len(daftar)%len(Palet)]

	if _, err := s.store.CreateHabit(r.Context(), nama, warna); err != nil {
		if pesan, cocok := galatValidasi(err); cocok {
			s.kembaliDenganGalat(w, r, pesan)
			return
		}
		s.galatServer(w, r, "menyimpan habit", err)
		return
	}
	http.Redirect(w, r, "/", http.StatusSeeOther)
}

func (s *Server) toggleHari(w http.ResponseWriter, r *http.Request) {
	id, ok := s.bacaID(w, r)
	if !ok {
		return
	}

	hari, err := habit.ParseDate(r.FormValue("hari"))
	if err != nil {
		http.Error(w, "tanggal tidak valid", http.StatusBadRequest)
		return
	}
	// Menandai hari yang belum datang tidak punya arti; tolak lebih awal.
	if hari > habit.DateOf(s.now()) {
		http.Error(w, "tidak bisa menandai tanggal di masa depan", http.StatusBadRequest)
		return
	}

	selesai, err := s.store.Toggle(r.Context(), id, hari)
	if err != nil {
		if errors.Is(err, store.ErrTidakDitemukan) {
			http.Error(w, "habit tidak ditemukan", http.StatusNotFound)
			return
		}
		s.galatServer(w, r, "memperbarui catatan harian", err)
		return
	}

	// Statistik dihitung ulang dan dikirim balik agar sisi klien bisa
	// memperbarui angka runtutan tanpa memuat ulang halaman.
	semua, err := s.store.Entries(r.Context(), id)
	if err != nil {
		s.galatServer(w, r, "memuat riwayat habit", err)
		return
	}
	st := habit.ComputeStats(semua, habit.DateOf(s.now()), StatsWindow)

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	if err := json.NewEncoder(w).Encode(map[string]any{
		"selesai": selesai,
		"stats": map[string]int{
			"current": st.Current,
			"best":    st.Best,
			"done":    st.Done,
			"window":  st.Window,
			"rate":    st.Rate,
		},
	}); err != nil {
		s.log.Error("menulis jawaban toggle", "galat", err)
	}
}

func (s *Server) gantiNama(w http.ResponseWriter, r *http.Request) {
	id, ok := s.bacaID(w, r)
	if !ok {
		return
	}
	err := s.store.RenameHabit(r.Context(), id, r.FormValue("nama"))
	if err != nil {
		if pesan, cocok := galatValidasi(err); cocok {
			s.kembaliDenganGalat(w, r, pesan)
			return
		}
		if errors.Is(err, store.ErrTidakDitemukan) {
			http.Error(w, "habit tidak ditemukan", http.StatusNotFound)
			return
		}
		s.galatServer(w, r, "mengganti nama habit", err)
		return
	}
	http.Redirect(w, r, "/", http.StatusSeeOther)
}

func (s *Server) hapusHabit(w http.ResponseWriter, r *http.Request) {
	id, ok := s.bacaID(w, r)
	if !ok {
		return
	}
	if err := s.store.DeleteHabit(r.Context(), id); err != nil {
		if errors.Is(err, store.ErrTidakDitemukan) {
			http.Error(w, "habit tidak ditemukan", http.StatusNotFound)
			return
		}
		s.galatServer(w, r, "menghapus habit", err)
		return
	}
	http.Redirect(w, r, "/", http.StatusSeeOther)
}

// --- pembantu ---

func (s *Server) bacaID(w http.ResponseWriter, r *http.Request) (int64, bool) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil || id <= 0 {
		http.Error(w, "id habit tidak valid", http.StatusBadRequest)
		return 0, false
	}
	return id, true
}

func (s *Server) render(w http.ResponseWriter, r *http.Request, data halaman) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	if err := s.tmpl.ExecuteTemplate(w, "index.html", data); err != nil {
		// Badan jawaban mungkin sudah separuh terkirim, jadi status tidak bisa
		// diubah lagi; cukup catat galatnya.
		s.log.Error("menggambar halaman", "galat", err, "jalur", r.URL.Path)
	}
}

func (s *Server) galatServer(w http.ResponseWriter, r *http.Request, konteks string, err error) {
	s.log.Error(konteks, "galat", err, "jalur", r.URL.Path)
	http.Error(w, "terjadi galat di server", http.StatusInternalServerError)
}

func (s *Server) kembaliDenganGalat(w http.ResponseWriter, r *http.Request, pesan string) {
	http.Redirect(w, r, "/?galat="+url.QueryEscape(pesan), http.StatusSeeOther)
}

// galatValidasi mengenali galat yang disebabkan masukan pengguna, dan
// mengembalikan pesan yang layak ditampilkan di antarmuka.
func galatValidasi(err error) (string, bool) {
	for _, v := range []error{habit.ErrNamaKosong, habit.ErrNamaTerlaluPanjang} {
		if errors.Is(err, v) {
			pesan := []rune(v.Error())
			pesan[0] = []rune(strings.ToUpper(string(pesan[0])))[0]
			return string(pesan) + ".", true
		}
	}
	return "", false
}
