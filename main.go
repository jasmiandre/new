// Command new menyajikan situs sebagai satu binari mandiri.
//
// Seluruh HTML, CSS, JavaScript, dan font hasil build Vite ditanam ke dalam
// berkas yang bisa dijalankan ini, jadi memasangnya cukup dengan menyalin satu
// berkas — tanpa Node, tanpa direktori aset terpisah.
package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"
)

func main() {
	if err := jalankan(); err != nil {
		slog.Error("server berhenti", "galat", err)
		os.Exit(1)
	}
}

func jalankan() error {
	addr := flag.String("addr", "127.0.0.1:8080", "alamat dengar, misal 127.0.0.1:8080")
	flag.Parse()

	handler, err := buatHandler()
	if err != nil {
		return err
	}

	httpSrv := &http.Server{
		Addr:              *addr,
		Handler:           handler,
		ReadHeaderTimeout: 10 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	galat := make(chan error, 1)
	go func() {
		slog.Info("situs siap", "alamat", "http://"+*addr)
		fmt.Fprintf(os.Stderr, "\n  Buka http://%s di peramban.\n\n", *addr)
		if err := httpSrv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			galat <- err
			return
		}
		galat <- nil
	}()

	select {
	case err := <-galat:
		return err
	case <-ctx.Done():
		slog.Info("menutup server")
		tutupCtx, batal := context.WithTimeout(context.Background(), 5*time.Second)
		defer batal()
		return httpSrv.Shutdown(tutupCtx)
	}
}
