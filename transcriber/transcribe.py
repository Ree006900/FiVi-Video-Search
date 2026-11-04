import os
import sys
import re
import argparse
import subprocess
import tempfile
from pathlib import Path
from urllib.parse import urlparse

import requests
import yt_dlp

# Tambahkan lokasi paket Python milik pengguna secara manual agar dependensi terdeteksi.
USER_SITE_PACKAGES = (
    r"C:\Users\user\AppData\Local\Packages"
    r"\PythonSoftwareFoundation.Python.3.11_qbz5n2kfra8p0"
    r"\LocalCache\local-packages\Python311\site-packages"
)

if os.path.isdir(USER_SITE_PACKAGES):
    sys.path.insert(0, USER_SITE_PACKAGES)

from faster_whisper import WhisperModel

# Konfigurasi endpoint API Laravel.
API_BASE = "http://127.0.0.1:8000/api"
IMPORT_API_URL = f"{API_BASE}/videos/import-transcript"
STATUS_API_URL = f"{API_BASE}/videos"


def update_transcription_status(video_id, status, progress=0):
    """Mengirim update status dan persentase progres ke database Laravel."""
    if not video_id:
        return False
        
    url = f"{STATUS_API_URL}/{video_id}/transcription-status"
    try:
        response = requests.patch(
            url,
            json={"status": status, "progress": progress},
            timeout=30,
        )
        response.raise_for_status()
        return True
    except requests.RequestException:
        return False


def is_url(value):
    """Memeriksa apakah string input merupakan URL yang valid."""
    parsed = urlparse(value)
    return parsed.scheme in ("http", "https") and bool(parsed.netloc)


def get_duration(file_path):
    """Mengambil total durasi media menggunakan ffprobe untuk kalkulasi progres."""
    try:
        result = subprocess.run(
            [
                "ffprobe",
                "-v", "error",
                "-show_entries", "format=duration",
                "-of", "default=noprint_wrappers=1:nokey=1",
                str(file_path),
            ],
            capture_output=True,
            text=True,
            check=True,
        )
        return round(float(result.stdout.strip()))
    except Exception as error:
        print(f"Peringatan: durasi tidak terbaca: {error}", flush=True)
        return None


def safe_filename(name):
    """Membersihkan judul agar aman saat dijadikan nama file."""
    name = re.sub(r'[<>:"/\\|?*]', "_", name)
    name = re.sub(r"\s+", " ", name).strip()
    return name[:100] or "transcript"


def download_audio(url, temp_dir):
    """Mengunduh format audio terbaik dari YouTube menggunakan yt-dlp."""
    options = {
        "format": "bestaudio/best",
        "outtmpl": str(Path(temp_dir) / "audio.%(ext)s"),
        "noplaylist": True,
        "quiet": False,
        "no_warnings": False,
    }

    print("Mengambil informasi video dan mengunduh audio...", flush=True)

    with yt_dlp.YoutubeDL(options) as ydl:
        info = ydl.extract_info(url, download=True)

    # Cari file audio yang berhasil diunduh secara penuh (mengabaikan file .part).
    downloaded_files = [
        path
        for path in Path(temp_dir).glob("audio.*")
        if path.is_file() and not path.name.endswith((".part", ".ytdl"))
    ]

    if not downloaded_files:
        raise FileNotFoundError("File audio hasil unduhan tidak ditemukan.")

    return downloaded_files[0], info


def transcribe_file(model, media_path, duration, video_id):
    """Melakukan transkripsi utama menggunakan model Faster-Whisper."""
    segments, info = model.transcribe(
        str(media_path),
        language="id",
        beam_size=5,
        vad_filter=False,
        condition_on_previous_text=False,
    )

    results = []
    last_reported_progress = 0

    for segment in segments:
        text = segment.text.strip()
        if not text:
            continue

        item = {
            "text": text,
            "start_time": max(0, round(segment.start)),
            "end_time": max(0, round(segment.end)),
        }
        results.append(item)

        # Kalkulasi persentase progres berdasarkan posisi audio saat ini.
        if duration and duration > 0:
            current_progress = int((item["end_time"] / duration) * 100)
            current_progress = min(99, current_progress)
            
            # Laporkan ke Laravel hanya jika progres naik kelipatan 5% agar tidak spam API.
            if current_progress >= last_reported_progress + 5:
                update_transcription_status(video_id, "processing", current_progress)
                last_reported_progress = current_progress

        print(f"[{item['start_time']}s - {item['end_time']}s] {text}", flush=True)

    return results, info.language


def send_to_laravel(payload):
    """Mengirim hasil transkrip ke Laravel untuk disimpan ke database FiVi."""
    print("\nMengirim transkrip ke database FiVi...", flush=True)

    try:
        response = requests.post(
            IMPORT_API_URL,
            json=payload,
            timeout=120,
        )

        if response.ok:
            try:
                data = response.json()
            except ValueError:
                data = {}

            print("\nBerhasil mengirim transkrip ke Laravel!", flush=True)
            print(f"Respons: {data}", flush=True)
            return True

        print(f"\nGagal menyimpan. HTTP {response.status_code}", flush=True)
        print(response.text, flush=True)
        return False

    except requests.RequestException as error:
        print("\nTidak dapat terhubung ke Laravel.", flush=True)
        print(f"Detail: {error}", flush=True)
        return False


def main():
    parser = argparse.ArgumentParser(
        description="Transkripsikan video lokal atau URL video dan simpan hasilnya ke FiVi."
    )

    parser.add_argument("input", help="URL video atau lokasi file video lokal")
    parser.add_argument("--title", help="Judul video (opsional)")
    parser.add_argument("--url", help="URL video asli untuk file lokal")
    parser.add_argument("--source", help="Sumber video, misalnya YouTube atau Local")
    parser.add_argument("--video-id", type=int, help="ID video yang sedang diproses di Laravel")

    args = parser.parse_args()
    temp_context = None

    try:
        input_value = args.input

        if is_url(input_value):
            if args.url:
                print("Peringatan: --url diabaikan...", flush=True)

            # Buat folder sementara untuk menyimpan unduhan audio YouTube.
            temp_context = tempfile.TemporaryDirectory(prefix="fivi_")

            # Update progres 5%: Mengunduh audio.
            if args.video_id:
                update_transcription_status(args.video_id, "processing", 5)
            
            media_path, info = download_audio(input_value, temp_context.name)

            title = info.get("title") or args.title or "Video tanpa judul"
            video_url = input_value
            source = args.source or "YouTube"

        else:
            # Proses input sebagai lokasi file video lokal.
            media_path = Path(input_value).expanduser().resolve()
            
            if not media_path.is_file():
                raise FileNotFoundError(f"File video lokal tidak ditemukan: {media_path}")
                
            title = args.title or media_path.name
            video_url = str(media_path)
            source = args.source or "Local"
            
            # Update progres 10%: Memuat file lokal.
            if args.video_id:
                update_transcription_status(args.video_id, "processing", 10)

        duration = get_duration(media_path)

        # Update progres 15%: Memuat model AI.
        if args.video_id:
            update_transcription_status(args.video_id, "processing", 15)
            
        print("\nMemuat model Whisper...", flush=True)

        model = WhisperModel(
            "large-v3-turbo",
            device="cpu",
            compute_type="int8",
        )

        print("Memulai transkripsi...\n", flush=True)
        
        # Update progres 20%: Mulai proses transkripsi.
        if args.video_id:
            update_transcription_status(args.video_id, "processing", 20)

        segments, detected_language = transcribe_file(
            model,
            media_path,
            duration,
            args.video_id
        )

        if not segments:
            raise RuntimeError("Tidak ada ucapan yang berhasil dikenali dari video.")

        payload = {
            "title": title,
            "source": source,
            "video_url": video_url,
            "duration_seconds": duration,
            "segments": segments,
        }

        print(f"\nBahasa terdeteksi: {detected_language}", flush=True)
        print(f"Jumlah segmen: {len(segments)}", flush=True)

        if not send_to_laravel(payload):
            raise RuntimeError("Transkrip gagal disimpan ke Laravel.")

        # Update status antrean menjadi selesai (completed).
        if args.video_id:
            if not update_transcription_status(args.video_id, "completed"):
                raise RuntimeError("Transkrip terkirim, tetapi status completed gagal diperbarui di Laravel.")

    except Exception as error:
        print(f"\nTerjadi kesalahan: {error}", flush=True)

        # Update status antrean menjadi gagal (failed) jika terjadi error.
        if args.video_id:
            update_transcription_status(args.video_id, "failed")

        raise

    finally:
        # Bersihkan direktori sementara jika menggunakan sumber YouTube.
        if temp_context is not None:
            temp_context.cleanup()


if __name__ == "__main__":
    main()