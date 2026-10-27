BINARY := habit

.PHONY: run build test lint tidy clean

## run: jalankan server di http://127.0.0.1:8080
run:
	go run . -addr 127.0.0.1:8080

## build: kompilasi menjadi satu binari
build:
	go build -o $(BINARY) .

## test: jalankan seluruh tes dengan pendeteksi data race
test:
	go test -race ./...

## lint: periksa format dan kesalahan umum
lint:
	@test -z "$$(gofmt -l .)" || { echo "berkas belum terformat:"; gofmt -l .; exit 1; }
	go vet ./...

## tidy: rapikan daftar dependensi
tidy:
	go mod tidy

## clean: hapus hasil kompilasi
clean:
	rm -f $(BINARY)
