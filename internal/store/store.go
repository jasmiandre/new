// Package store menyimpan habit dan catatan harian di SQLite.
package store

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/jasmiandre/new/internal/habit"

	_ "modernc.org/sqlite" // driver SQLite murni Go, tanpa cgo
)

// ErrTidakDitemukan dikembalikan saat habit dengan id tertentu tidak ada.
var ErrTidakDitemukan = errors.New("habit tidak ditemukan")

const skema = `
CREATE TABLE IF NOT EXISTS habits (
	id         INTEGER PRIMARY KEY AUTOINCREMENT,
	name       TEXT    NOT NULL,
	color      TEXT    NOT NULL DEFAULT '',
	created_at TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS entries (
	habit_id INTEGER NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
	day      TEXT    NOT NULL,
	PRIMARY KEY (habit_id, day)
);

CREATE INDEX IF NOT EXISTS entries_by_day ON entries(day);
`

// Store adalah pegangan ke basis data.
type Store struct {
	db *sql.DB
}

// Open membuka (atau membuat) basis data pada path tertentu dan menyiapkan
// skemanya. Gunakan ":memory:" untuk basis data sementara di memori.
func Open(path string) (*Store, error) {
	// _pragma=foreign_keys(1) diperlukan agar ON DELETE CASCADE berjalan;
	// SQLite mematikannya secara bawaan.
	dsn := path + "?_pragma=foreign_keys(1)&_pragma=busy_timeout(5000)"
	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, fmt.Errorf("membuka basis data: %w", err)
	}
	// SQLite hanya melayani satu penulis; membatasi kolam koneksi menghindari
	// galat "database is locked" di bawah beban bersamaan.
	db.SetMaxOpenConns(1)

	if _, err := db.Exec(skema); err != nil {
		db.Close()
		return nil, fmt.Errorf("menyiapkan skema: %w", err)
	}
	return &Store{db: db}, nil
}

// Close menutup basis data.
func (s *Store) Close() error { return s.db.Close() }

// CreateHabit menambahkan habit baru dan mengembalikannya lengkap dengan id.
func (s *Store) CreateHabit(ctx context.Context, nama, warna string) (habit.Habit, error) {
	nama, err := habit.NormalizeNama(nama)
	if err != nil {
		return habit.Habit{}, err
	}
	dibuat := time.Now().UTC()
	res, err := s.db.ExecContext(ctx,
		`INSERT INTO habits (name, color, created_at) VALUES (?, ?, ?)`,
		nama, warna, dibuat.Format(time.RFC3339),
	)
	if err != nil {
		return habit.Habit{}, fmt.Errorf("menyimpan habit: %w", err)
	}
	id, err := res.LastInsertId()
	if err != nil {
		return habit.Habit{}, fmt.Errorf("membaca id habit: %w", err)
	}
	return habit.Habit{ID: id, Name: nama, Color: warna, CreatedAt: dibuat}, nil
}

// ListHabits mengembalikan semua habit, yang terlama lebih dulu.
func (s *Store) ListHabits(ctx context.Context) ([]habit.Habit, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT id, name, color, created_at FROM habits ORDER BY id`)
	if err != nil {
		return nil, fmt.Errorf("membaca daftar habit: %w", err)
	}
	defer rows.Close()

	var out []habit.Habit
	for rows.Next() {
		var h habit.Habit
		var dibuat string
		if err := rows.Scan(&h.ID, &h.Name, &h.Color, &dibuat); err != nil {
			return nil, fmt.Errorf("memindai habit: %w", err)
		}
		h.CreatedAt, _ = time.Parse(time.RFC3339, dibuat)
		out = append(out, h)
	}
	return out, rows.Err()
}

// RenameHabit mengganti nama habit.
func (s *Store) RenameHabit(ctx context.Context, id int64, nama string) error {
	nama, err := habit.NormalizeNama(nama)
	if err != nil {
		return err
	}
	res, err := s.db.ExecContext(ctx, `UPDATE habits SET name = ? WHERE id = ?`, nama, id)
	if err != nil {
		return fmt.Errorf("mengganti nama habit: %w", err)
	}
	return cekTerpengaruh(res)
}

// DeleteHabit menghapus habit beserta seluruh catatan hariannya.
func (s *Store) DeleteHabit(ctx context.Context, id int64) error {
	res, err := s.db.ExecContext(ctx, `DELETE FROM habits WHERE id = ?`, id)
	if err != nil {
		return fmt.Errorf("menghapus habit: %w", err)
	}
	return cekTerpengaruh(res)
}

// Toggle membalik status satu hari untuk sebuah habit dan mengembalikan status
// barunya: true berarti hari itu kini ditandai selesai.
func (s *Store) Toggle(ctx context.Context, id int64, hari habit.Date) (bool, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return false, fmt.Errorf("memulai transaksi: %w", err)
	}
	defer tx.Rollback() //nolint:errcheck // tak berpengaruh setelah Commit berhasil

	var ada int
	err = tx.QueryRowContext(ctx, `SELECT COUNT(1) FROM habits WHERE id = ?`, id).Scan(&ada)
	if err != nil {
		return false, fmt.Errorf("memeriksa habit: %w", err)
	}
	if ada == 0 {
		return false, ErrTidakDitemukan
	}

	var terisi int
	err = tx.QueryRowContext(ctx,
		`SELECT COUNT(1) FROM entries WHERE habit_id = ? AND day = ?`, id, hari).Scan(&terisi)
	if err != nil {
		return false, fmt.Errorf("memeriksa catatan harian: %w", err)
	}

	selesai := terisi == 0
	if selesai {
		_, err = tx.ExecContext(ctx,
			`INSERT INTO entries (habit_id, day) VALUES (?, ?)`, id, hari)
	} else {
		_, err = tx.ExecContext(ctx,
			`DELETE FROM entries WHERE habit_id = ? AND day = ?`, id, hari)
	}
	if err != nil {
		return false, fmt.Errorf("memperbarui catatan harian: %w", err)
	}
	if err := tx.Commit(); err != nil {
		return false, fmt.Errorf("menyimpan perubahan: %w", err)
	}
	return selesai, nil
}

// EntriesRange mengembalikan hari-hari yang selesai untuk semua habit dalam
// rentang [dari, sampai] inklusif, dipetakan berdasarkan id habit.
func (s *Store) EntriesRange(ctx context.Context, dari, sampai habit.Date) (map[int64]map[habit.Date]bool, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT habit_id, day FROM entries WHERE day >= ? AND day <= ?`, dari, sampai)
	if err != nil {
		return nil, fmt.Errorf("membaca catatan harian: %w", err)
	}
	defer rows.Close()

	out := map[int64]map[habit.Date]bool{}
	for rows.Next() {
		var id int64
		var hari habit.Date
		if err := rows.Scan(&id, &hari); err != nil {
			return nil, fmt.Errorf("memindai catatan harian: %w", err)
		}
		if out[id] == nil {
			out[id] = map[habit.Date]bool{}
		}
		out[id][hari] = true
	}
	return out, rows.Err()
}

// Entries mengembalikan seluruh hari yang selesai untuk satu habit, tanpa
// batas rentang. Dipakai untuk menghitung runtutan terbaik sepanjang waktu.
func (s *Store) Entries(ctx context.Context, id int64) (map[habit.Date]bool, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT day FROM entries WHERE habit_id = ?`, id)
	if err != nil {
		return nil, fmt.Errorf("membaca catatan harian: %w", err)
	}
	defer rows.Close()

	out := map[habit.Date]bool{}
	for rows.Next() {
		var hari habit.Date
		if err := rows.Scan(&hari); err != nil {
			return nil, fmt.Errorf("memindai catatan harian: %w", err)
		}
		out[hari] = true
	}
	return out, rows.Err()
}

func cekTerpengaruh(res sql.Result) error {
	n, err := res.RowsAffected()
	if err != nil {
		return fmt.Errorf("membaca jumlah baris terpengaruh: %w", err)
	}
	if n == 0 {
		return ErrTidakDitemukan
	}
	return nil
}
