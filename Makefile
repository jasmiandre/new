BINARY := situs

.PHONY: all web build run dev test lint tidy clean

## all: bangun frontend lalu binari
all: build

## web: bangun frontend ke web/dist
web:
	cd web && npm ci && npm run build

## build: bangun frontend lalu tanam ke satu binari Go
build: web
	go build -o $(BINARY) .

## run: bangun semuanya lalu jalankan di http://127.0.0.1:8080
run: build
	./$(BINARY)

## dev: server pengembangan Vite dengan muat-ulang panas
dev:
	cd web && npm run dev

## test: tes Go dan pemeriksaan tipe frontend
test:
	go test ./...
	cd web && npx tsc --noEmit

## lint: periksa format dan kesalahan umum
lint:
	@test -z "$$(gofmt -l .)" || { echo "berkas belum terformat:"; gofmt -l .; exit 1; }
	go vet ./...

## tidy: rapikan daftar dependensi Go
tidy:
	go mod tidy

## clean: hapus hasil kompilasi dan build
clean:
	rm -f $(BINARY)
	rm -rf web/dist/assets web/dist/index.html
