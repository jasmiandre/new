package main

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// handlerUji menyiapkan handler, atau melewati tes jika frontend belum
// dibangun — pada klona baru, web/dist memang masih kosong.
func handlerUji(t *testing.T) http.Handler {
	t.Helper()
	h, err := buatHandler()
	if errors.Is(err, ErrBelumDibangun) {
		t.Skip("frontend belum dibangun; jalankan \"make web\" lebih dulu")
	}
	if err != nil {
		t.Fatalf("buatHandler: %v", err)
	}
	return h
}

func minta(t *testing.T, h http.Handler, jalur string) *httptest.ResponseRecorder {
	t.Helper()
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, jalur, nil))
	return rec
}

func TestBerandaMenyajikanHalaman(t *testing.T) {
	rec := minta(t, handlerUji(t), "/")

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, mau 200", rec.Code)
	}
	if ct := rec.Header().Get("Content-Type"); !strings.Contains(ct, "text/html") {
		t.Errorf("Content-Type = %q, mau text/html", ct)
	}
	if !strings.Contains(rec.Body.String(), `id="dunia"`) {
		t.Error("halaman harus memuat kanvas dunia 3D")
	}
}

// index.html tidak boleh disimpan di tembolok, agar rilis baru langsung terpakai.
func TestBerandaTidakDisimpanDiTembolok(t *testing.T) {
	rec := minta(t, handlerUji(t), "/")
	if cc := rec.Header().Get("Cache-Control"); cc != "no-cache" {
		t.Errorf("Cache-Control = %q, mau no-cache", cc)
	}
}

// Berkas di /assets/ bernama dengan sidik jari isinya, jadi aman disimpan lama.
func TestAsetDisimpanLama(t *testing.T) {
	h := handlerUji(t)

	// Nama berkas aset diambil dari rujukan di dalam index.html.
	body := minta(t, h, "/").Body.String()
	i := strings.Index(body, "/assets/")
	if i < 0 {
		t.Fatal("index.html tidak merujuk berkas di /assets/")
	}
	j := strings.IndexAny(body[i:], `"'`)
	jalur := body[i : i+j]

	rec := minta(t, h, jalur)
	if rec.Code != http.StatusOK {
		t.Fatalf("%s: status = %d, mau 200", jalur, rec.Code)
	}
	if cc := rec.Header().Get("Cache-Control"); !strings.Contains(cc, "immutable") {
		t.Errorf("%s: Cache-Control = %q, mau memuat immutable", jalur, cc)
	}
}

// Situs ini satu halaman: jalur yang tidak dikenal tetap menyajikan halaman,
// bukan 404, agar tautan dalam bisa dibuka langsung.
func TestJalurTakDikenalKembaliKeHalaman(t *testing.T) {
	rec := minta(t, handlerUji(t), "/bab-2")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, mau 200", rec.Code)
	}
	if !strings.Contains(rec.Body.String(), `id="dunia"`) {
		t.Error("jalur tak dikenal harus menyajikan halaman utama")
	}
}

func TestHealthz(t *testing.T) {
	rec := minta(t, handlerUji(t), "/healthz")
	if rec.Code != http.StatusOK {
		t.Errorf("status = %d, mau 200", rec.Code)
	}
	if strings.TrimSpace(rec.Body.String()) != "ok" {
		t.Errorf("badan = %q, mau \"ok\"", rec.Body.String())
	}
}
