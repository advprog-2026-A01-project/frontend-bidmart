# BidMart Frontend

`frontend-bidmart` adalah frontend React untuk aplikasi BidMart dalam arsitektur microservices.

Frontend ini berasal dari frontend monolith lama BidMart, lalu dipisahkan ke repository sendiri agar sesuai dengan arsitektur microservices.

Frontend ini menggunakan:

- React
- Vite
- TypeScript
- Tailwind CSS
- API Gateway integration

---

# Role dalam Arsitektur BidMart

Frontend ini adalah client-side application yang digunakan oleh user untuk mengakses fitur BidMart, seperti:

- browse auction/listing;
- login dan register;
- melihat profile;
- mengakses admin panel;
- mengakses wallet panel;
- nantinya melakukan bidding dan transaksi.

Frontend **bukan backend service** dan **bukan microservice backend**. Frontend adalah UI/client app.

Dalam arsitektur BidMart, frontend hanya boleh berkomunikasi dengan:

```text
bidmart-api-gateway
```

Frontend tidak boleh memanggil backend service langsung.

---

# Arsitektur Local Saat Ini

```text
frontend-bidmart
   ↓
bidmart-api-gateway
   ↓
bidmart-auth-service
   ↓
auth_db
```

Local port:

| Component | URL / Port |
|---|---|
| Frontend | `http://localhost:5173` |
| API Gateway | `http://localhost:8080` |
| Auth Service | `http://localhost:8081` |
| Auth DB | `localhost:5434/auth_db` |
| Catalog Service | `http://localhost:8082` |
| Auction-Wallet Service | `http://localhost:8083` |

Saat ini integrasi yang sudah divalidasi:

```text
Frontend → API Gateway → Auth Service → auth_db
```

---

# Kenapa Frontend Harus Lewat API Gateway?

Frontend tidak boleh hardcode URL service seperti:

```text
http://localhost:8081
http://localhost:8082
http://localhost:8083
```

Frontend cukup tahu satu backend entry point:

```text
http://localhost:8080
```

Alasannya:

1. API Gateway menjadi single public backend entry point.
2. Frontend tidak perlu tahu lokasi setiap backend service.
3. JWT access token divalidasi di Gateway.
4. Gateway meneruskan request ke service yang sesuai.
5. Nanti Catalog Service dan Auction-Wallet Service bisa ditambahkan tanpa mengubah banyak logic frontend.
6. Deployment lebih rapi karena frontend hanya diarahkan ke satu backend URL.

---

# Service Mapping Melalui Gateway

Frontend melakukan request ke API Gateway:

```text
VITE_API_BASE_URL=http://localhost:8080
```

Lalu Gateway meneruskan request ke service yang sesuai.

## Auth Service

```text
Frontend:
GET  /api/auth/captcha
POST /api/auth/login
GET  /api/users/me/profile

Gateway forward ke:
bidmart-auth-service
```

Routes:

```text
/api/auth/**
/api/admin/**
/api/rbac/**
/api/db/**
/api/users/**
```

## Catalog Service

Nantinya:

```text
Frontend:
GET /api/listings
GET /api/categories

Gateway forward ke:
bidmart-catalog-service
```

Routes:

```text
/api/catalog/**
/api/categories/**
/api/listings/**
```

Jika Catalog Service belum berjalan, request terkait catalog/listings bisa menghasilkan error seperti `502 Bad Gateway`.

## Auction-Wallet Service

Nantinya:

```text
Frontend:
POST /api/bids
GET  /api/wallet/me/info

Gateway forward ke:
bidmart-auction-wallet-service
```

Routes:

```text
/api/auctions/**
/api/bids/**
/api/wallet/**
```

Jika Auction-Wallet Service belum berjalan, fitur bid/wallet bisa menghasilkan error seperti `502 Bad Gateway`.

---

# Environment Variables

Frontend memakai Vite environment variable.

Buat file:

```text
.env.local
```

Isi:

```text
VITE_API_BASE_URL=http://localhost:8080
```

File `.env.local` hanya untuk local development dan tidak boleh di-commit.

File yang boleh di-commit adalah:

```text
.env.example
```

Isi `.env.example`:

```text
VITE_API_BASE_URL=http://localhost:8080
```

---

# API Client

Frontend memiliki central API helper di:

```text
src/api/http.ts
```

Semua API call sebaiknya memakai helper tersebut agar request otomatis diarahkan ke `VITE_API_BASE_URL`.

Contoh:

```ts
apiFetch('/api/auth/login')
```

Akan diarahkan menjadi:

```text
http://localhost:8080/api/auth/login
```

Dengan begitu frontend tidak perlu hardcode URL backend service.

---

# Local Development Setup

## 1. Install Dependencies

```bash
npm install
```

## 2. Setup Environment

Buat `.env.local`:

```bash
cat > .env.local <<'ENV'
VITE_API_BASE_URL=http://localhost:8080
ENV
```

Pastikan `.gitignore` memiliki:

```text
node_modules
dist
.env.local
.env.*.local
!.env.example
```

---

# Local Run Order

Agar frontend login berjalan, backend harus dijalankan terlebih dahulu.

## Terminal 1 — Start Auth DB dan Auth Service

```bash
cd ~/Documents/Fasilkom/Progjut/BidMart-Microservices/bidmart-auth-service

./scripts/start-local-auth-db.sh
./scripts/run-local-auth.sh
```

Auth Service harus berjalan di:

```text
http://localhost:8081
```

Cek:

```bash
curl -s http://localhost:8081/api/db/ping | jq
```

Expected:

```json
{
  "db": 1
}
```

## Terminal 2 — Start API Gateway

```bash
cd ~/Documents/Fasilkom/Progjut/BidMart-Microservices/bidmart-api-gateway

./scripts/run-local-gateway.sh
```

API Gateway harus berjalan di:

```text
http://localhost:8080
```

Cek:

```bash
curl -s http://localhost:8080/actuator/health | jq
```

## Terminal 3 — Smoke Test Gateway

Sebelum menjalankan frontend, pastikan Gateway dan Auth Service sudah benar:

```bash
cd ~/Documents/Fasilkom/Progjut/BidMart-Microservices/bidmart-api-gateway

./scripts/smoke-auth-gateway.sh
```

Expected akhir:

```text
==> OK: Auth Service + API Gateway integration passed
```

## Terminal 4 — Start Frontend

```bash
cd ~/Documents/Fasilkom/Progjut/BidMart-Microservices/frontend-bidmart

npm run dev
```

Frontend akan berjalan di:

```text
http://localhost:5173
```

---

# Login Local

Untuk local development, gunakan akun admin bootstrap:

```text
username: admin
password: admin12345
```

Alur login:

```text
Browser
   ↓
frontend-bidmart
   ↓
POST http://localhost:8080/api/auth/login
   ↓
bidmart-api-gateway
   ↓
bidmart-auth-service
   ↓
auth_db
```

Jika login berhasil, frontend akan menerima:

```text
accessToken
refreshToken
tokenType
expiresIn
```

Access token berbentuk JWT dan dikirim pada protected request sebagai:

```text
Authorization: Bearer <accessToken>
```

---

# Verifikasi Integrasi Frontend ke Gateway

Buka browser:

```text
http://localhost:5173
```

Lalu:

1. buka DevTools;
2. masuk tab Network;
3. filter XHR/Fetch;
4. klik Account;
5. login memakai:
   ```text
   admin / admin12345
   ```

Request yang benar harus mengarah ke:

```text
http://localhost:8080/api/auth/captcha
http://localhost:8080/api/auth/login
http://localhost:8080/api/auth/me
```

atau endpoint lain di `localhost:8080`.

Request yang salah adalah jika frontend langsung memanggil:

```text
http://localhost:8081
http://localhost:8082
http://localhost:8083
```

---

# Build

Untuk memastikan frontend bisa di-build:

```bash
npm run build
```

Output build akan masuk ke:

```text
dist/
```

Folder `dist/` tidak perlu di-commit.

Preview production build:

```bash
npm run preview
```

---

# Useful Commands

## Run Development Server

```bash
npm run dev
```

## Build

```bash
npm run build
```

## Preview Build

```bash
npm run preview
```

## Check Hardcoded Backend URLs

```bash
grep -RIn \
  "localhost:8081\|localhost:8082\|localhost:8083\|bidmart-a01-190e4c7e01d5.herokuapp.com" \
  src vite.config.ts .env* 2>/dev/null || true
```

Expected:

```text
No output
```

Jika ada output dari file frontend, berarti masih ada hardcoded backend URL yang perlu dipindahkan ke API Gateway.

---

# Current Integration Status

Yang sudah berhasil divalidasi:

```text
frontend-bidmart
   ↓
bidmart-api-gateway
   ↓
bidmart-auth-service
   ↓
auth_db
```

Validated behavior:

```text
Frontend can open locally ✅
Captcha request goes through Gateway ✅
Login request goes through Gateway ✅
Admin login works ✅
Protected request works after login ✅
No direct frontend call to Auth Service ✅
```

---

# Notes for Future Services

Saat `bidmart-catalog-service` dan `bidmart-auction-wallet-service` sudah berjalan, frontend tidak perlu mengubah base URL.

Frontend tetap memakai:

```text
VITE_API_BASE_URL=http://localhost:8080
```

Yang berubah hanya route endpoint yang dipanggil.

Contoh future endpoint:

```text
GET  /api/listings
POST /api/listings
GET  /api/wallet/me/info
POST /api/bids
```

Semua tetap dipanggil melalui:

```text
http://localhost:8080
```

---

# Troubleshooting

## Frontend muncul, tapi login error `Internal Server Error`

Kemungkinan Auth Service mati atau Auth DB belum hidup.

Cek Auth DB:

```bash
docker ps | grep bidmart-auth-db
```

Cek Auth Service:

```bash
curl -s http://localhost:8081/api/db/ping | jq
```

Cek Gateway smoke test:

```bash
cd ../bidmart-api-gateway
./scripts/smoke-auth-gateway.sh
```

## Captcha tidak muncul

Kemungkinan request `/api/auth/captcha` gagal.

Cek di browser DevTools → Network.

Expected:

```text
GET http://localhost:8080/api/auth/captcha 200
```

Kalau status `500`, cek terminal Auth Service.

Kalau status `502`, Auth Service kemungkinan belum jalan.

## Login gagal `invalid_credentials`

Pastikan credential local:

```text
username: admin
password: admin12345
```

Jangan gunakan password lain seperti `admin123`.

## Request masih ke `localhost:8081`

Cek apakah masih ada hardcoded URL:

```bash
grep -RIn "localhost:8081" src vite.config.ts .env* 2>/dev/null || true
```

Pastikan `.env.local` berisi:

```text
VITE_API_BASE_URL=http://localhost:8080
```

Setelah mengubah `.env.local`, restart Vite:

```bash
Ctrl + C
npm run dev
```

## Wallet error

Jika `bidmart-auction-wallet-service` belum berjalan, fitur Wallet bisa gagal. Itu normal untuk saat ini.

Frontend sudah diarahkan ke Gateway, tetapi service tujuan untuk wallet belum tersedia.

---

# Repository Context

Repository ini adalah bagian dari GitHub organization:

```text
advprog-2026-A01-project
```

Related repositories:

```text
bidmart-auth-service
bidmart-api-gateway
bidmart-catalog-service
bidmart-auction-wallet-service
bidmart-deployment
```

Frontend ini harus selalu dikembangkan dengan asumsi bahwa API call melewati `bidmart-api-gateway`.
