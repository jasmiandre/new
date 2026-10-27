package main

import (
	"embed"
	"errors"
	"fmt"
	"io/fs"
	"net/http"
	"strings"
)

// Berkas hasil build Vite ditanam ke dalam binari. Direktorinya selalu ada di
// repositori (lewat .gitkeep), tetapi isinya baru muncul setelah
// "npm run build" dijalankan di dalam web/ — lihat buatHandler.
//
//go:embed all:web/dist
var aset embed.FS

// ErrBelumDibangun menandakan binari dikompilasi tanpa hasil build frontend.
var ErrBelumDibangun = errors.New("web/dist kosong: jalankan \"npm run build\" di dalam web/ sebelum mengompilasi")

// buatHandler menyiapkan penyaji berkas statis dari aset yang ditanam.
func buatHandler() (http.Handler, error) {
	dist, err := fs.Sub(aset, "web/dist")
	if err != nil {
		return nil, fmt.Errorf("membaca aset: %w", err)
	}
	if _, err := fs.Stat(dist, "index.html"); err != nil {
		return nil, ErrBelumDibangun
	}

	berkas := http.FileServerFS(dist)
	mux := http.NewServeMux()

	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "text/plain; charset=utf-8")
		fmt.Fprintln(w, "ok")
	})

	mux.HandleFunc("GET /", func(w http.ResponseWriter, r *http.Request) {
		bersih := strings.TrimPrefix(r.URL.Path, "/")

		// Vite menyisipkan sidik jari isi pada nama berkas di /assets/, jadi
		// berkas itu tidak pernah berubah diam-diam dan aman disimpan lama.
		// index.html justru tidak boleh disimpan, supaya rilis baru langsung
		// terpakai.
		if strings.HasPrefix(bersih, "assets/") {
			w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
		} else {
			w.Header().Set("Cache-Control", "no-cache")
		}

		// Situs ini satu halaman; jalur yang tidak dikenal dikembalikan ke
		// index.html agar tautan dalam tetap bekerja saat dimuat langsung.
		if bersih != "" && bersih != "index.html" {
			if _, err := fs.Stat(dist, bersih); err != nil {
				r = r.Clone(r.Context())
				r.URL.Path = "/"
			}
		}

		berkas.ServeHTTP(w, r)
	})

	return mux, nil
}
