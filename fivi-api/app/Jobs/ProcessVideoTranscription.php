<?php

namespace App\Jobs;

use App\Models\Video;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Symfony\Component\Process\Process;

class ProcessVideoTranscription implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public $timeout = 0; // Biarkan berjalan tanpa batas waktu 

    public function __construct(public Video $video)
    {
    }

    public function handle(): void
    {
        $projectRoot = dirname(base_path());
        
        $pythonScript = $projectRoot . DIRECTORY_SEPARATOR . 'transcriber' . DIRECTORY_SEPARATOR . 'transcribe.py';
        
        // Menggunakan path absolut asli, dengan fallback ke 'python' bawaan Windows
        $pythonExe = 'python';
        
        // Pengecekan 1: File Python Script
        if (!file_exists($pythonScript)) {
            Log::error("FiVi Error: Script Python tidak ditemukan di: " . $pythonScript);
            $this->video->update(['transcription_status' => 'failed']);
            return;
        }

        // Pengecekan 2: Python Executable
        if (!file_exists($pythonExe)) {
            Log::warning("FiVi Warning: Python EXE absolut tidak ditemukan. Mencoba fallback ke 'python' global.");
            $pythonExe = 'python'; // Coba panggil python secara global jika path WindowsApps bermasalah
        }

        $logDirectory = storage_path('logs');
        if (!is_dir($logDirectory) && !mkdir($logDirectory, 0775, true) && !is_dir($logDirectory)) {
            Log::error("FiVi Error: Gagal membuat folder log di: " . $logDirectory);
            $this->video->update(['transcription_status' => 'failed']);
            return;
        }

        $logPath = $logDirectory . DIRECTORY_SEPARATOR . 'transcribe-' . $this->video->id . '.log';
        $logHandle = fopen($logPath, 'ab');

        if ($logHandle === false) {
            Log::error("FiVi Error: Gagal membuka/membuat file log di: " . $logPath);
            $this->video->update(['transcription_status' => 'failed']);
            return;
        }

        fwrite($logHandle, "\r\n[" . date('Y-m-d H:i:s') . "] Memulai proses transkripsi video " . $this->video->id . "\r\n");

        $sitePackages = 'C:\\Users\\user\\AppData\\Local\\Packages\\PythonSoftwareFoundation.Python.3.11_qbz5n2kfra8p0\\LocalCache\\local-packages\\Python311\\site-packages';

        // --- PERUBAHAN DI SINI ---
        // Membuat argumen bersifat dinamis sesuai sumber video (YouTube/Local)
        $process = new Process(
            [
                $pythonExe,
                $pythonScript,
                $this->video->video_url, // Berisi URL YouTube atau Path file Lokal
                '--title',
                $this->video->title ?? 'Video ' . $this->video->id,
                '--source',
                $this->video->source ?? 'YouTube', // Akan mengirim 'Local' atau 'YouTube'
                '--video-id',
                (string) $this->video->id,
            ],
            $projectRoot,
            ['PYTHONPATH' => $sitePackages]
        );

        $process->setTimeout(null);

        try {
            // Jalankan dan tunggu hingga selesai
            $process->run(function (string $type, string $output) use ($logHandle) {
                fwrite($logHandle, $output);
                fflush($logHandle);
            });

            fclose($logHandle);

        } catch (\Throwable $error) {
            fwrite($logHandle, "\r\nGAGAL MEMULAI PYTHON:\r\n" . $error->getMessage() . "\r\n");
            fclose($logHandle);
            $this->video->update(['transcription_status' => 'failed']);
        }
    }
}