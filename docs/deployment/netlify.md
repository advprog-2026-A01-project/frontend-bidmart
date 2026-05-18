
## Audit dan Refactor API Call Frontend

Untuk milestone 100%, frontend BidMart harus mengikuti aturan arsitektur berikut:

~~~text
Frontend -> API Gateway only
~~~

Artinya frontend tidak boleh memanggil service internal secara langsung, seperti:

~~~text
Auth Service
Catalog Service
Auction-Wallet Service
Database
gRPC endpoint
~~~

Frontend hanya boleh memanggil API Gateway melalui `VITE_API_BASE_URL`.

Contoh local:

~~~env
VITE_API_BASE_URL=http://localhost:8080
~~~

Contoh staging/Netlify:

~~~env
VITE_API_BASE_URL=https://<api-gateway-staging-url>
~~~

### Kenapa perlu aturan ini?

Karena dalam arsitektur microservice BidMart, API Gateway adalah satu-satunya public backend entry point.

Dengan begitu:

- frontend tidak perlu tahu lokasi internal service
- Auth, Catalog, dan Auction-Wallet tidak perlu diekspos langsung ke user
- route service bisa berubah tanpa mengubah banyak kode frontend
- deployment staging/production lebih aman
- integrasi antar tim lebih mudah

Alur yang benar:

~~~text
Frontend
   |
   | REST / HTTP
   v
API Gateway
   |
   +--> Auth Service
   +--> Catalog Service
   +--> Auction-Wallet Service
~~~

Alur yang salah:

~~~text
Frontend -> Auth Service langsung
Frontend -> Catalog Service langsung
Frontend -> Auction-Wallet Service langsung
Frontend -> Database
Frontend -> gRPC port
~~~

### Cara mengecek pelanggaran API boundary

Jalankan:

~~~bash
npm run check:api-boundary
~~~

atau langsung:

~~~bash
bash scripts/check-api-boundary.sh
~~~

Script ini akan mengecek apakah masih ada:

- hardcoded `localhost`
- hardcoded service port seperti `8081`, `8082`, `8083`, `9091`, `5432`, `5434`
- direct relative call seperti `fetch("/api/...")`
- URL internal service di source frontend

Jika script ini gagal, jangan disable script-nya. Perbaiki file yang ditunjukkan oleh output command.

### Helper resmi untuk API call

Gunakan helper berikut:

~~~ts
import { apiFetch, apiUrl, authHeaders } from "../lib/apiClient";
~~~

Path import bisa berbeda tergantung lokasi file.

Jika file berada jauh dari `src/lib/apiClient.ts`, gunakan relative path yang sesuai, misalnya:

~~~ts
import { apiFetch } from "../../lib/apiClient";
~~~

Jika project sudah memiliki alias `@`, boleh gunakan:

~~~ts
import { apiFetch, apiUrl, authHeaders } from "@/lib/apiClient";
~~~

Namun jika alias belum dikonfigurasi, gunakan relative import agar build tidak error.

### Contoh GET request

Sebelum:

~~~ts
const response = await fetch("http://localhost:8082/api/catalog/listings");
~~~

Sesudah:

~~~ts
const response = await apiFetch("/api/catalog/listings");
~~~

Maksudnya:

~~~text
Frontend memanggil /api/catalog/listings melalui API Gateway.
Gateway yang akan meneruskan request ke Catalog Service.
~~~

### Contoh POST request

Sebelum:

~~~ts
const response = await fetch("http://localhost:8081/api/auth/login", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify(payload),
});
~~~

Sesudah:

~~~ts
const response = await apiFetch("/api/auth/login", {
  method: "POST",
  body: JSON.stringify(payload),
});
~~~

`apiFetch` otomatis menambahkan `Content-Type: application/json`.

### Contoh request dengan token

Sebelum:

~~~ts
const response = await fetch("http://localhost:8081/api/auth/me", {
  headers: {
    Authorization: `Bearer ${token}`,
  },
});
~~~

Sesudah:

~~~ts
const response = await apiFetch("/api/auth/me", {
  method: "GET",
  headers: authHeaders(token),
});
~~~

### Contoh endpoint Catalog

Frontend cukup memanggil path Gateway:

~~~ts
const response = await apiFetch("/api/catalog/listings");
~~~

Jangan memanggil:

~~~ts
fetch("http://localhost:8082/api/catalog/listings");
~~~

Karena `8082` adalah port internal Catalog Service.

### Contoh endpoint Auction-Wallet

Frontend cukup memanggil path Gateway:

~~~ts
const response = await apiFetch("/api/auctions");
const response = await apiFetch("/api/bids");
const response = await apiFetch("/api/wallet");
~~~

Jangan memanggil:

~~~ts
fetch("http://localhost:8083/api/bids");
~~~

Karena `8083` adalah port internal Auction-Wallet Service.

### Kalau memakai FormData

Jika endpoint memakai `FormData`, jangan pakai helper yang memaksa `Content-Type: application/json`.

Gunakan `apiUrl` langsung:

~~~ts
const formData = new FormData();
formData.append("file", file);

const response = await fetch(apiUrl("/api/catalog/upload"), {
  method: "POST",
  body: formData,
});
~~~

Browser akan mengatur `Content-Type: multipart/form-data` secara otomatis.

Jika perlu token:

~~~ts
const headers = new Headers();
headers.set("Authorization", `Bearer ${token}`);

const response = await fetch(apiUrl("/api/catalog/upload"), {
  method: "POST",
  headers,
  body: formData,
});
~~~

### Rule untuk teman frontend

Saat menambahkan fitur baru, gunakan aturan berikut:

~~~text
1. Jangan hardcode localhost di source frontend.
2. Jangan hardcode port service internal.
3. Jangan call Auth/Catalog/Auction-Wallet langsung.
4. Semua API call harus lewat API Gateway.
5. Gunakan VITE_API_BASE_URL untuk base URL.
6. Gunakan apiClient.ts untuk request JSON biasa.
7. Jalankan npm run check:api-boundary sebelum commit.
~~~

### Jika check gagal

Langkah perbaikannya:

~~~text
1. Baca file dan line yang ditunjukkan oleh output script.
2. Cari API call yang masih hardcoded.
3. Ganti URL penuh atau fetch("/api/...") menjadi apiFetch("/api/...").
4. Jika butuh URL manual, gunakan apiUrl("/api/...").
5. Jika butuh Authorization header, gunakan authHeaders(token).
6. Jalankan ulang npm run check:api-boundary.
7. Jika sudah bersih, lanjut npm run build.
~~~

### Checklist sebelum commit frontend

Sebelum commit perubahan frontend, jalankan:

~~~bash
npm run check:api-boundary
npm run build
npm run verify:netlify
~~~

Atau jalankan full quality script:

~~~bash
bash scripts/generate-quality-reports.sh
bash scripts/verify-quality-reports.sh
~~~

Jika semua command berhasil, perubahan frontend aman untuk di-commit.

