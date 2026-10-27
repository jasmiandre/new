package store

import (
	"context"
	"errors"
	"path/filepath"
	"testing"

	"github.com/jasmiandre/new/internal/habit"
)

// bukaUji membuat basis data sementara yang dihapus otomatis setelah tes.
func bukaUji(t *testing.T) *Store {
	t.Helper()
	s, err := Open(filepath.Join(t.TempDir(), "uji.db"))
	if err != nil {
		t.Fatalf("Open: %v", err)
	}
	t.Cleanup(func() { s.Close() })
	return s
}

func TestCreateDanListHabit(t *testing.T) {
	s := bukaUji(t)
	ctx := context.Background()

	h1, err := s.CreateHabit(ctx, "Lari pagi", "#f97316")
	if err != nil {
		t.Fatalf("CreateHabit: %v", err)
	}
	if h1.ID == 0 {
		t.Error("habit baru harus punya id bukan nol")
	}
	if _, err := s.CreateHabit(ctx, "Baca buku", "#22d3ee"); err != nil {
		t.Fatalf("CreateHabit kedua: %v", err)
	}

	daftar, err := s.ListHabits(ctx)
	if err != nil {
		t.Fatalf("ListHabits: %v", err)
	}
	if len(daftar) != 2 {
		t.Fatalf("len(daftar) = %d, mau 2", len(daftar))
	}
	if daftar[0].Name != "Lari pagi" || daftar[1].Name != "Baca buku" {
		t.Errorf("urutan salah: %q, %q", daftar[0].Name, daftar[1].Name)
	}
	if daftar[0].Color != "#f97316" {
		t.Errorf("Color = %q, mau #f97316", daftar[0].Color)
	}
	if daftar[0].CreatedAt.IsZero() {
		t.Error("CreatedAt tidak boleh nol")
	}
}

func TestCreateHabitMenolakNamaKosong(t *testing.T) {
	s := bukaUji(t)
	if _, err := s.CreateHabit(context.Background(), "   ", ""); !errors.Is(err, habit.ErrNamaKosong) {
		t.Errorf("error = %v, mau ErrNamaKosong", err)
	}
}

func TestCreateHabitMerapikanNama(t *testing.T) {
	s := bukaUji(t)
	h, err := s.CreateHabit(context.Background(), "  Minum    air  ", "")
	if err != nil {
		t.Fatalf("CreateHabit: %v", err)
	}
	if h.Name != "Minum air" {
		t.Errorf("Name = %q, mau %q", h.Name, "Minum air")
	}
}

func TestListHabitsKosong(t *testing.T) {
	s := bukaUji(t)
	daftar, err := s.ListHabits(context.Background())
	if err != nil {
		t.Fatalf("ListHabits: %v", err)
	}
	if len(daftar) != 0 {
		t.Errorf("len(daftar) = %d, mau 0", len(daftar))
	}
}

func TestToggleMembalikStatus(t *testing.T) {
	s := bukaUji(t)
	ctx := context.Background()
	h, err := s.CreateHabit(ctx, "Meditasi", "")
	if err != nil {
		t.Fatalf("CreateHabit: %v", err)
	}

	selesai, err := s.Toggle(ctx, h.ID, "2026-10-27")
	if err != nil {
		t.Fatalf("Toggle pertama: %v", err)
	}
	if !selesai {
		t.Error("toggle pertama harus menandai selesai")
	}

	selesai, err = s.Toggle(ctx, h.ID, "2026-10-27")
	if err != nil {
		t.Fatalf("Toggle kedua: %v", err)
	}
	if selesai {
		t.Error("toggle kedua harus membatalkan tanda selesai")
	}

	hari, err := s.Entries(ctx, h.ID)
	if err != nil {
		t.Fatalf("Entries: %v", err)
	}
	if len(hari) != 0 {
		t.Errorf("len(hari) = %d, mau 0 setelah dibatalkan", len(hari))
	}
}

func TestToggleHabitTidakDikenal(t *testing.T) {
	s := bukaUji(t)
	if _, err := s.Toggle(context.Background(), 404, "2026-10-27"); !errors.Is(err, ErrTidakDitemukan) {
		t.Errorf("error = %v, mau ErrTidakDitemukan", err)
	}
}

func TestEntriesRangeMengelompokkanPerHabit(t *testing.T) {
	s := bukaUji(t)
	ctx := context.Background()
	a, _ := s.CreateHabit(ctx, "A", "")
	b, _ := s.CreateHabit(ctx, "B", "")

	for _, hari := range []habit.Date{"2026-10-25", "2026-10-26", "2026-10-27"} {
		if _, err := s.Toggle(ctx, a.ID, hari); err != nil {
			t.Fatalf("Toggle A %s: %v", hari, err)
		}
	}
	if _, err := s.Toggle(ctx, b.ID, "2026-10-27"); err != nil {
		t.Fatalf("Toggle B: %v", err)
	}

	hasil, err := s.EntriesRange(ctx, "2026-10-26", "2026-10-27")
	if err != nil {
		t.Fatalf("EntriesRange: %v", err)
	}
	// 2026-10-25 berada di luar rentang dan harus tersaring.
	if len(hasil[a.ID]) != 2 {
		t.Errorf("habit A punya %d hari dalam rentang, mau 2", len(hasil[a.ID]))
	}
	if hasil[a.ID]["2026-10-25"] {
		t.Error("tanggal di luar rentang tidak boleh ikut")
	}
	if len(hasil[b.ID]) != 1 {
		t.Errorf("habit B punya %d hari dalam rentang, mau 1", len(hasil[b.ID]))
	}
}

func TestEntriesRangeBatasInklusif(t *testing.T) {
	s := bukaUji(t)
	ctx := context.Background()
	h, _ := s.CreateHabit(ctx, "A", "")
	for _, hari := range []habit.Date{"2026-10-20", "2026-10-27"} {
		if _, err := s.Toggle(ctx, h.ID, hari); err != nil {
			t.Fatalf("Toggle %s: %v", hari, err)
		}
	}
	hasil, err := s.EntriesRange(ctx, "2026-10-20", "2026-10-27")
	if err != nil {
		t.Fatalf("EntriesRange: %v", err)
	}
	if len(hasil[h.ID]) != 2 {
		t.Errorf("dapat %d hari, mau 2 (kedua ujung rentang ikut)", len(hasil[h.ID]))
	}
}

func TestRenameHabit(t *testing.T) {
	s := bukaUji(t)
	ctx := context.Background()
	h, _ := s.CreateHabit(ctx, "Nama lama", "")

	if err := s.RenameHabit(ctx, h.ID, "Nama baru"); err != nil {
		t.Fatalf("RenameHabit: %v", err)
	}
	daftar, _ := s.ListHabits(ctx)
	if daftar[0].Name != "Nama baru" {
		t.Errorf("Name = %q, mau %q", daftar[0].Name, "Nama baru")
	}

	if err := s.RenameHabit(ctx, 404, "X"); !errors.Is(err, ErrTidakDitemukan) {
		t.Errorf("error = %v, mau ErrTidakDitemukan", err)
	}
	if err := s.RenameHabit(ctx, h.ID, "  "); !errors.Is(err, habit.ErrNamaKosong) {
		t.Errorf("error = %v, mau ErrNamaKosong", err)
	}
}

// Menghapus habit harus ikut menghapus catatan hariannya (ON DELETE CASCADE).
func TestDeleteHabitMenghapusCatatanHarian(t *testing.T) {
	s := bukaUji(t)
	ctx := context.Background()
	h, _ := s.CreateHabit(ctx, "Sementara", "")
	if _, err := s.Toggle(ctx, h.ID, "2026-10-27"); err != nil {
		t.Fatalf("Toggle: %v", err)
	}

	if err := s.DeleteHabit(ctx, h.ID); err != nil {
		t.Fatalf("DeleteHabit: %v", err)
	}
	daftar, _ := s.ListHabits(ctx)
	if len(daftar) != 0 {
		t.Errorf("len(daftar) = %d, mau 0", len(daftar))
	}

	var sisa int
	if err := s.db.QueryRow(`SELECT COUNT(1) FROM entries`).Scan(&sisa); err != nil {
		t.Fatalf("menghitung sisa catatan: %v", err)
	}
	if sisa != 0 {
		t.Errorf("tersisa %d catatan harian, mau 0 (cascade harus aktif)", sisa)
	}
}

func TestDeleteHabitTidakDikenal(t *testing.T) {
	s := bukaUji(t)
	if err := s.DeleteHabit(context.Background(), 404); !errors.Is(err, ErrTidakDitemukan) {
		t.Errorf("error = %v, mau ErrTidakDitemukan", err)
	}
}

// Data harus selamat setelah basis data ditutup dan dibuka kembali.
func TestDataBertahanSetelahDibukaUlang(t *testing.T) {
	path := filepath.Join(t.TempDir(), "tetap.db")
	ctx := context.Background()

	s1, err := Open(path)
	if err != nil {
		t.Fatalf("Open pertama: %v", err)
	}
	h, err := s1.CreateHabit(ctx, "Lari pagi", "#f97316")
	if err != nil {
		t.Fatalf("CreateHabit: %v", err)
	}
	if _, err := s1.Toggle(ctx, h.ID, "2026-10-27"); err != nil {
		t.Fatalf("Toggle: %v", err)
	}
	if err := s1.Close(); err != nil {
		t.Fatalf("Close: %v", err)
	}

	s2, err := Open(path)
	if err != nil {
		t.Fatalf("Open kedua: %v", err)
	}
	defer s2.Close()

	daftar, err := s2.ListHabits(ctx)
	if err != nil {
		t.Fatalf("ListHabits: %v", err)
	}
	if len(daftar) != 1 || daftar[0].Name != "Lari pagi" {
		t.Fatalf("daftar = %+v, mau satu habit bernama \"Lari pagi\"", daftar)
	}
	hari, err := s2.Entries(ctx, daftar[0].ID)
	if err != nil {
		t.Fatalf("Entries: %v", err)
	}
	if !hari["2026-10-27"] {
		t.Error("catatan harian hilang setelah dibuka ulang")
	}
}
