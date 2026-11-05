# 🎙️ FiVi (Find Video) – AI Video Search & Indexing

![FiVi Preview](https://img.shields.io/badge/Status-Active-success) ![Laravel](https://img.shields.io/badge/Laravel-FF2D20?logo=laravel&logoColor=white) ![React](https://img.shields.io/badge/React-20232A?logo=react&logoColor=61DAFB) ![Python](https://img.shields.io/badge/Python-14354C?logo=python&logoColor=white) ![Gemini](https://img.shields.io/badge/Gemini_AI-8E75B2?logo=googlebard&logoColor=white)

**FiVi (Find Video)** adalah aplikasi web *open-source* yang memungkinkan pengguna untuk mencari momen spesifik di dalam video (baik bersumber dari YouTube maupun file lokal) hanya dengan mencari kata atau kalimat yang diucapkan.

Proyek ini dibangun menggunakan arsitektur **Monorepo** yang memisahkan Frontend (React), Backend (Laravel), dan Transcriber (Python Faster-Whisper).

---

## ✨ Fitur Utama

- 🔍 **Pencarian Kata Spesifik (Timestamp):** Cari kata yang diucapkan di dalam video dan langsung lompat ke detik video saat kata tersebut diucapkan.
- 📖 **Konteks Transkrip:** Menampilkan kalimat sebelum dan sesudah kata yang dicari agar konteks pembicaraan tidak hilang.
- 🤖 **Rangkuman AI & Chat:** Terintegrasi dengan Gemini API untuk membuat ringkasan otomatis dari seluruh transkrip dan menjawab pertanyaan spesifik seputar isi video.
- 📁 **Sinkronisasi Folder Lokal:** Memindai isi folder di PC Anda, memasukkan file video baru ke antrean secara otomatis, dan menghapus data video yang filenya sudah tidak ada.
- ⚙️ **Background Processing:** Antrean transkripsi diproses di latar belakang menggunakan *Queue Worker* Laravel sehingga antarmuka web tetap responsif (dilengkapi indikator persentase & tombol batal).

---

## 🛠️ Teknologi yang Digunakan

Proyek ini terdiri dari 3 bagian utama:
1. **Frontend (`/fivi-web`):** React.js, Vite, CSS Native.
2. **Backend (`/fivi-api`):** Laravel 11, MySQL (Mengurus API, database, dan antrean).
3. **Transcriber (`/transcriber`):** Python, Faster-Whisper (Large-v3-turbo), yt-dlp, FFmpeg.

---

## ⚙️ Persyaratan Sistem (Prerequisites)

Sebelum menginstal aplikasi ini, pastikan komputer Anda (atau server) sudah terinstal:
- [PHP](https://www.php.net/) (Minimal v8.2) & [Composer](https://getcomposer.org/)
- [Node.js](https://nodejs.org/) & npm
- [Python](https://www.python.org/) (Minimal v3.10)
- **[FFmpeg](https://ffmpeg.org/)** (Wajib diinstal dan didaftarkan ke *System PATH Windows/Linux*)
  <details>
  <summary><b>💡 Klik di sini untuk panduan instalasi FFmpeg (Khusus Windows)</b></summary>
  
  1. Unduh FFmpeg dari [gyan.dev](https://www.gyan.dev/ffmpeg/builds/) (Pilih file berakhiran `.zip` seperti `ffmpeg-release-essentials.zip`).
  2. Ekstrak file zip tersebut. Ubah nama folder hasil ekstraknya menjadi `ffmpeg` agar lebih singkat.
  3. Pindahkan folder `ffmpeg` tersebut ke dalam Local Disk `C:\` (sehingga jalurnya menjadi `C:\ffmpeg`).
  4. Buka menu Start Windows, ketik **Environment Variables**, lalu tekan Enter (pilih *Edit the system environment variables*).
  5. Klik tombol **Environment Variables...** di pojok kanan bawah.
  6. Pada kotak bagian bawah (*System variables*), cari baris bernama **Path**, lalu klik tombol **Edit...**.
  7. Klik tombol **New**, lalu ketikkan teks ini persis: `C:\ffmpeg\bin`
  8. Klik **OK** di semua ketiga jendela yang terbuka untuk menyimpan.
  9. Buka Terminal/Command Prompt baru, lalu ketik `ffmpeg -version`. Jika muncul teks informasi versi, berarti FFmpeg sudah siap digunakan!
  </details>
- Database MySQL (XAMPP / Laragon / MySQL Server)

---

## 🚀 Cara Instalasi & Menjalankan Proyek

Langkah pertama, *clone repository* ini ke komputer Anda:
```bash
git clone https://github.com/Ree006900/FiVi-Video-Search.git
cd FiVi-Video-Search
```

### 1. Setup Backend (Laravel)
Buka terminal dan masuk ke folder `fivi-api`:
```bash
cd fivi-api
composer install
copy .env.example .env
php artisan key:generate
```
- Buka file `.env` di folder `fivi-api` menggunakan *text editor*.
- Sesuaikan pengaturan database (buat database baru di MySQL bernama `fivi-db` dan pastikan DB_CONNECTION=mysql) dan tambahkan API Key Anda:
  ```env
  DB_DATABASE=fivi-db
  DB_USERNAME=root
  DB_PASSWORD=

  # API Youtube
  YOUTUBE_API_KEY=masukkan_api_key_youtube_anda_di_sini
  
  # API Gemini
  GEMINI_API_KEY=masukkan_api_key_gemini_anda_di_sini

  # Pastikan Queue menggunakan database
  QUEUE_CONNECTION=database
  ```
- Jalankan migrasi database:
  ```bash
  php artisan migrate
  ```
- Nyalakan server Laravel dan Worker Antrean (Anda membutuhkan 2 terminal terpisah):
  ```bash
  # Terminal 1 (Menjalankan API Server)
  php artisan serve
  
  # Terminal 2 (Menjalankan Queue Worker - Biarkan tetap menyala)
  php artisan queue:work
  ```

### 2. Setup Transcriber (Python)
Buka terminal baru (CMD) dan masuk ke folder `transcriber`:
```bash
cd transcriber

# Buat virtual environment (Direkomendasikan)
python -m venv venv

# Aktifkan virtual environment (Windows)
venv\Scripts\activate
# (Untuk Linux/Mac: source venv/bin/activate)

# Instal dependensi yang dibutuhkan
pip install faster-whisper yt-dlp requests
```
*(Catatan: Script Python ini tidak perlu dijalankan secara manual. Ia akan otomatis dipanggil oleh Queue Worker Laravel saat ada video yang masuk antrean).*

### 3. Setup Frontend (React)
Buka terminal baru dan masuk ke folder `fivi-web`:
```bash
cd fivi-web
npm install
npm run dev
```

---

## 💡 Cara Menggunakan Aplikasi

1. Buka browser dan akses **`http://localhost:5173`**.
2. Klik tombol **"Tambah Video"** di pojok kanan atas.
3. Anda bisa memilih dua mode:
   - **YouTube:** Masukkan URL video publik.
   - **Lokal:** Masukkan *path* folder di komputer Anda (contoh: `D:\VideoBelajar`).
4. Video akan masuk ke **Panel Antrean** (di pojok kanan bawah). Tunggu hingga proses memuat model AI dan transkripsi mencapai 100%.
5. Jika sudah selesai, ketikkan kata kunci yang ingin dicari pada kolom pencarian di halaman Beranda.
6. Temukan momennya, dan klik tombol "Lihat Momen" untuk menonton, atau "Rangkum & AI" untuk bertanya seputar isi video.

---

## 🚧 Batasan Sistem (Limitasi)
- **Performa Perangkat:** Kecepatan transkripsi (*Speech-to-Text*) sangat bergantung pada kemampuan CPU/GPU *host* (komputer) yang menjalankan *script* Python.
- **Batasan YouTube:** Tidak dapat mengunduh dan mentranskripsikan video yang bersifat *Private* atau dibatasi usia (*Age-restricted*).
- **Pemindaian Folder:** Sistem tidak memantau perubahan folder lokal secara *real-time*. Jika Anda menghapus atau menambah video ke dalam folder secara manual, Anda harus menekan tombol **"Sync"** di halaman web agar database diperbarui.

---

## 📝 Lisensi
Proyek FiVi dibuat untuk tujuan edukasi dan portofolio.
