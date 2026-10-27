// Command new menjalankan pelacak habit sebagai server web lokal.
//
// Seluruh antarmuka (HTML, CSS, JavaScript) ditanam ke dalam binari, jadi
// program ini satu berkas saja — tanpa runtime dan tanpa aset terpisah.
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

	"github.com/jasmiandre/new/internal/store"
	"github.com/jasmiandre/new/internal/web"
)

func main() {
	if err := jalankan(); err != nil {
		slog.Error("server berhenti", "galat", err)
		os.Exit(1)
	}
}

func jalankan() error {
	var (
		addr   = flag.String("addr", "127.0.0.1:8080", "alamat dengar, misal 127.0.0.1:8080")
		dbPath = flag.String("db", "habits.db", "jalur berkas basis data SQLite")
	)
	flag.Parse()

	st, err := store.Open(*dbPath)
	if err != nil {
		return err
	}
	defer st.Close()

	srv, err := web.New(st, web.Options{Logger: slog.Default()})
	if err != nil {
		return err
	}

	httpSrv := &http.Server{
		Addr:              *addr,
		Handler:           srv,
		ReadHeaderTimeout: 10 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	// Sinyal dari terminal harus menutup server dengan rapi supaya transaksi
	// SQLite yang sedang berjalan tidak terpotong.
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	galat := make(chan error, 1)
	go func() {
		slog.Info("pelacak habit siap", "alamat", "http://"+*addr, "basis_data", *dbPath)
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
