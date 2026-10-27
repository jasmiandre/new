package web

import (
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"net/url"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/jasmiandre/new/internal/habit"

	"github.com/jasmiandre/new/internal/store"
)

// hariUji adalah "hari ini" yang dipaku untuk semua tes: Selasa, 27 Okt 2026.
const hariUji = "2026-10-27"

func jamUji() time.Time { return time.Date(2026, 10, 27, 12, 0, 0, 0, time.UTC) }

// siapkan membangun server lengkap dengan basis data sementara.
func siapkan(t *testing.T) (*Server, *store.Store) {
	t.Helper()
	st, err := store.Open(filepath.Join(t.TempDir(), "uji.db"))
	if err != nil {
		t.Fatalf("store.Open: %v", err)
	}
	t.Cleanup(func() { st.Close() })

	// Galat server dibuang agar keluaran tes tetap bersih.
	senyap := slog.New(slog.NewTextHandler(io.Discard, nil))
	srv, err := New(st, Options{Now: jamUji, Logger: senyap})
	if err != nil {
		t.Fatalf("New: %v", err)
	}
	return srv, st
}

func get(t *testing.T, srv *Server, jalur string) *httptest.ResponseRecorder {
	t.Helper()
	rec := httptest.NewRecorder()
	srv.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, jalur, nil))
	return rec
}

func post(t *testing.T, srv *Server, jalur string, form url.Values) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(http.MethodPost, jalur, strings.NewReader(form.Encode()))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	rec := httptest.NewRecorder()
	srv.ServeHTTP(rec, req)
	return rec
}

func TestBerandaKeadaanKosong(t *testing.T) {
	srv, _ := siapkan(t)
	rec := get(t, srv, "/")

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, mau 200", rec.Code)
	}
	if ct := rec.Header().Get("Content-Type"); !strings.HasPrefix(ct, "text/html") {
		t.Errorf("Content-Type = %q, mau text/html", ct)
	}
	body := rec.Body.String()
	if !strings.Contains(body, "Belum ada habit yang dilacak") {
		t.Error("keadaan kosong tidak tergambar")
	}
	if !strings.Contains(body, hariUji) {
		t.Errorf("halaman harus menampilkan tanggal hari ini %s", hariUji)
	}
}

func TestBuatHabitLaluTampilDiBeranda(t *testing.T) {
	srv, _ := siapkan(t)

	rec := post(t, srv, "/habits", url.Values{"nama": {"Lari pagi"}})
	if rec.Code != http.StatusSeeOther {
		t.Fatalf("status = %d, mau 303", rec.Code)
	}
	if loc := rec.Header().Get("Location"); loc != "/" {
		t.Errorf("Location = %q, mau /", loc)
	}

	body := get(t, srv, "/").Body.String()
	if !strings.Contains(body, "Lari pagi") {
		t.Error("habit baru tidak muncul di beranda")
	}
	if strings.Contains(body, "Belum ada habit yang dilacak") {
		t.Error("keadaan kosong masih tergambar padahal sudah ada habit")
	}
	// Habit pertama harus mendapat warna pertama dari palet.
	if !strings.Contains(body, Palet[0]) {
		t.Errorf("kartu harus memakai warna %s dari palet", Palet[0])
	}
}

func TestBuatHabitNamaKosongDitolak(t *testing.T) {
	srv, st := siapkan(t)

	rec := post(t, srv, "/habits", url.Values{"nama": {"   "}})
	if rec.Code != http.StatusSeeOther {
		t.Fatalf("status = %d, mau 303", rec.Code)
	}
	loc := rec.Header().Get("Location")
	if !strings.Contains(loc, "galat=") {
		t.Errorf("Location = %q, mau memuat pesan galat", loc)
	}

	daftar, _ := st.ListHabits(context.Background())
	if len(daftar) != 0 {
		t.Errorf("tersimpan %d habit, mau 0", len(daftar))
	}
}

func TestBuatHabitNamaTerlaluPanjangDitolak(t *testing.T) {
	srv, st := siapkan(t)

	rec := post(t, srv, "/habits", url.Values{"nama": {strings.Repeat("a", 61)}})
	if !strings.Contains(rec.Header().Get("Location"), "galat=") {
		t.Error("nama terlalu panjang harus menghasilkan pesan galat")
	}
	daftar, _ := st.ListHabits(context.Background())
	if len(daftar) != 0 {
		t.Errorf("tersimpan %d habit, mau 0", len(daftar))
	}
}

func TestPesanGalatTergambarDiBeranda(t *testing.T) {
	srv, _ := siapkan(t)
	body := get(t, srv, "/?galat=Ada+yang+salah").Body.String()
	if !strings.Contains(body, "Ada yang salah") {
		t.Error("pesan galat dari parameter kueri tidak tergambar")
	}
}

// Pesan galat berasal dari parameter kueri, jadi harus di-escape sebagai HTML.
func TestPesanGalatDiEscape(t *testing.T) {
	srv, _ := siapkan(t)
	body := get(t, srv, "/?galat=%3Cscript%3Ealert(1)%3C%2Fscript%3E").Body.String()
	if strings.Contains(body, "<script>alert(1)</script>") {
		t.Error("pesan galat tidak di-escape: ada risiko injeksi HTML")
	}
	if !strings.Contains(body, "&lt;script&gt;") {
		t.Error("pesan galat harus muncul dalam bentuk ter-escape")
	}
}

func TestNamaHabitDiEscape(t *testing.T) {
	srv, st := siapkan(t)
	if _, err := st.CreateHabit(context.Background(), `<img src=x onerror=alert(1)>`, "#f97316"); err != nil {
		t.Fatalf("CreateHabit: %v", err)
	}
	body := get(t, srv, "/").Body.String()
	if strings.Contains(body, "<img src=x") {
		t.Error("nama habit tidak di-escape: ada risiko injeksi HTML")
	}
}

func TestGridMenggambarKotakLaluDanMasaDepan(t *testing.T) {
	srv, st := siapkan(t)
	if _, err := st.CreateHabit(context.Background(), "Lari pagi", "#f97316"); err != nil {
		t.Fatalf("CreateHabit: %v", err)
	}
	body := get(t, srv, "/").Body.String()

	// Grid berakhir pada hari Minggu di minggu yang memuat Selasa 2026-10-27,
	// yaitu 2026-11-01, jadi selalu ada 5 kotak masa depan: Rabu sampai Minggu.
	const masaDepan = 5
	bisaDiklik := Weeks*7 - masaDepan
	if n := strings.Count(body, "data-sel"); n != bisaDiklik {
		t.Errorf("ada %d kotak yang bisa diklik, mau %d", n, bisaDiklik)
	}
	if n := strings.Count(body, "sel depan"); n != masaDepan {
		t.Errorf("ada %d kotak masa depan, mau %d", n, masaDepan)
	}
	// Kotak paling awal selalu jatuh pada hari Senin.
	awal := habit.Date(hariUji).AddDays(-1).AddDays(-(Weeks - 1) * 7)
	if awal.Weekday() != 0 {
		t.Fatalf("kotak paling awal %s bukan hari Senin", awal)
	}
	if !strings.Contains(body, `title="`+awal.String()+`"`) {
		t.Errorf("kotak paling awal (%s) tidak tergambar", awal)
	}
	if !strings.Contains(body, "sel hari-ini") {
		t.Error("kotak hari ini harus punya penanda khusus")
	}
}

func TestToggleMembalikStatusDanMengembalikanStatistik(t *testing.T) {
	srv, st := siapkan(t)
	h, err := st.CreateHabit(context.Background(), "Meditasi", "#22d3ee")
	if err != nil {
		t.Fatalf("CreateHabit: %v", err)
	}
	jalur := "/habits/" + itoa(h.ID) + "/toggle"

	rec := post(t, srv, jalur, url.Values{"hari": {hariUji}})
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, mau 200 (badan: %s)", rec.Code, rec.Body.String())
	}
	if ct := rec.Header().Get("Content-Type"); !strings.HasPrefix(ct, "application/json") {
		t.Errorf("Content-Type = %q, mau application/json", ct)
	}

	var jawab struct {
		Selesai bool           `json:"selesai"`
		Stats   map[string]int `json:"stats"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &jawab); err != nil {
		t.Fatalf("mengurai JSON: %v", err)
	}
	if !jawab.Selesai {
		t.Error("toggle pertama harus menandai selesai")
	}
	if jawab.Stats["current"] != 1 {
		t.Errorf("stats.current = %d, mau 1", jawab.Stats["current"])
	}
	if jawab.Stats["window"] != StatsWindow {
		t.Errorf("stats.window = %d, mau %d", jawab.Stats["window"], StatsWindow)
	}

	// Toggle kedua harus membatalkan tanda dan mengosongkan runtutan.
	rec = post(t, srv, jalur, url.Values{"hari": {hariUji}})
	if err := json.Unmarshal(rec.Body.Bytes(), &jawab); err != nil {
		t.Fatalf("mengurai JSON kedua: %v", err)
	}
	if jawab.Selesai {
		t.Error("toggle kedua harus membatalkan tanda selesai")
	}
	if jawab.Stats["current"] != 0 {
		t.Errorf("stats.current = %d, mau 0", jawab.Stats["current"])
	}
}

func TestToggleMenolakTanggalMasaDepan(t *testing.T) {
	srv, st := siapkan(t)
	h, _ := st.CreateHabit(context.Background(), "Meditasi", "")

	rec := post(t, srv, "/habits/"+itoa(h.ID)+"/toggle", url.Values{"hari": {"2026-12-01"}})
	if rec.Code != http.StatusBadRequest {
		t.Errorf("status = %d, mau 400", rec.Code)
	}
	hari, _ := st.Entries(context.Background(), h.ID)
	if len(hari) != 0 {
		t.Error("tanggal masa depan tidak boleh tersimpan")
	}
}

func TestToggleMenolakMasukanTidakValid(t *testing.T) {
	srv, st := siapkan(t)
	h, _ := st.CreateHabit(context.Background(), "Meditasi", "")

	cases := []struct {
		nama   string
		jalur  string
		hari   string
		status int
	}{
		{"tanggal ngawur", "/habits/" + itoa(h.ID) + "/toggle", "besok", http.StatusBadRequest},
		{"tanggal kosong", "/habits/" + itoa(h.ID) + "/toggle", "", http.StatusBadRequest},
		{"id bukan angka", "/habits/abc/toggle", hariUji, http.StatusBadRequest},
		{"id nol", "/habits/0/toggle", hariUji, http.StatusBadRequest},
		{"habit tak dikenal", "/habits/4040/toggle", hariUji, http.StatusNotFound},
	}
	for _, c := range cases {
		rec := post(t, srv, c.jalur, url.Values{"hari": {c.hari}})
		if rec.Code != c.status {
			t.Errorf("%s: status = %d, mau %d", c.nama, rec.Code, c.status)
		}
	}
}

func TestGantiNama(t *testing.T) {
	srv, st := siapkan(t)
	h, _ := st.CreateHabit(context.Background(), "Nama lama", "")

	rec := post(t, srv, "/habits/"+itoa(h.ID)+"/rename", url.Values{"nama": {"Nama baru"}})
	if rec.Code != http.StatusSeeOther {
		t.Fatalf("status = %d, mau 303", rec.Code)
	}
	body := get(t, srv, "/").Body.String()
	if !strings.Contains(body, "Nama baru") || strings.Contains(body, "Nama lama") {
		t.Error("nama habit tidak berubah di beranda")
	}

	if rec := post(t, srv, "/habits/"+itoa(h.ID)+"/rename", url.Values{"nama": {"  "}}); !strings.Contains(rec.Header().Get("Location"), "galat=") {
		t.Error("nama kosong harus menghasilkan pesan galat")
	}
	if rec := post(t, srv, "/habits/4040/rename", url.Values{"nama": {"X"}}); rec.Code != http.StatusNotFound {
		t.Errorf("status = %d, mau 404", rec.Code)
	}
}

func TestHapusHabit(t *testing.T) {
	srv, st := siapkan(t)
	h, _ := st.CreateHabit(context.Background(), "Sementara", "")

	rec := post(t, srv, "/habits/"+itoa(h.ID)+"/delete", nil)
	if rec.Code != http.StatusSeeOther {
		t.Fatalf("status = %d, mau 303", rec.Code)
	}
	daftar, _ := st.ListHabits(context.Background())
	if len(daftar) != 0 {
		t.Errorf("tersisa %d habit, mau 0", len(daftar))
	}
	if rec := post(t, srv, "/habits/4040/delete", nil); rec.Code != http.StatusNotFound {
		t.Errorf("status = %d, mau 404", rec.Code)
	}
}

// Statistik di HTML harus mencerminkan riwayat yang sudah tersimpan.
func TestStatistikTergambarDiKartu(t *testing.T) {
	srv, st := siapkan(t)
	ctx := context.Background()
	h, _ := st.CreateHabit(ctx, "Lari pagi", "#f97316")
	for _, hari := range []string{"2026-10-25", "2026-10-26", "2026-10-27"} {
		if _, err := st.Toggle(ctx, h.ID, mustDate(t, hari)); err != nil {
			t.Fatalf("Toggle %s: %v", hari, err)
		}
	}

	body := get(t, srv, "/").Body.String()
	if !strings.Contains(body, `<strong data-stat="current">3</strong>`) {
		t.Error("runtutan 3 hari tidak tergambar di kartu")
	}
	if !strings.Contains(body, `<strong data-stat="best">3</strong>`) {
		t.Error("runtutan terbaik tidak tergambar di kartu")
	}
	if !strings.Contains(body, "Selesai hari ini") {
		t.Error("tombol hari ini harus menunjukkan keadaan selesai")
	}
}

func TestAsetStatisDisajikan(t *testing.T) {
	srv, _ := siapkan(t)
	for _, c := range []struct{ jalur, mau string }{
		{"/static/app.css", "text/css"},
		{"/static/app.js", "javascript"},
	} {
		rec := get(t, srv, c.jalur)
		if rec.Code != http.StatusOK {
			t.Errorf("%s: status = %d, mau 200", c.jalur, rec.Code)
		}
		if ct := rec.Header().Get("Content-Type"); !strings.Contains(ct, c.mau) {
			t.Errorf("%s: Content-Type = %q, mau memuat %q", c.jalur, ct, c.mau)
		}
		if rec.Body.Len() == 0 {
			t.Errorf("%s: badan kosong", c.jalur)
		}
	}
}

func TestHealthz(t *testing.T) {
	srv, _ := siapkan(t)
	rec := get(t, srv, "/healthz")
	if rec.Code != http.StatusOK {
		t.Errorf("status = %d, mau 200", rec.Code)
	}
	if strings.TrimSpace(rec.Body.String()) != "ok" {
		t.Errorf("badan = %q, mau \"ok\"", rec.Body.String())
	}
}

func TestJalurTakDikenal404(t *testing.T) {
	srv, _ := siapkan(t)
	if rec := get(t, srv, "/entah"); rec.Code != http.StatusNotFound {
		t.Errorf("status = %d, mau 404", rec.Code)
	}
}

func TestMetodeSalahDitolak(t *testing.T) {
	srv, _ := siapkan(t)
	rec := get(t, srv, "/habits")
	if rec.Code != http.StatusMethodNotAllowed {
		t.Errorf("status = %d, mau 405", rec.Code)
	}
}
