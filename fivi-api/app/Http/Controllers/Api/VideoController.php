<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Jobs\ProcessVideoTranscription;
use App\Models\Video;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\File;

class VideoController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'url' => ['required', 'url'],
            'title' => ['nullable', 'string', 'max:255'],
        ]);

        $url = trim($validated['url']);
        $existingVideo = Video::where('video_url', $url)->first();

        if ($existingVideo) {
            if ($existingVideo->transcription_status === 'failed') {
                $existingVideo->transcriptSegments()->delete();
                $existingVideo->delete();
            } else {
                return response()->json(['message' => 'Video ini sudah ada di database dengan status: ' . $existingVideo->transcription_status], 409);
            }
        }

        // Ekstrak ID dari URL
        preg_match('/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i', $url, $matches);
        $videoId = $matches[1] ?? null;

        $title = !empty($validated['title']) ? $validated['title'] : ($videoId ? "Video YouTube $videoId" : "Video YouTube");

        $video = Video::create([
            'title' => $title,
            'source' => 'YouTube',
            'video_url' => $url,
            'thumbnail_url' => $videoId ? "https://img.youtube.com/vi/{$videoId}/hqdefault.jpg" : null,
            'transcription_status' => 'pending',
            'transcription_progress' => 0,
        ]);

        ProcessVideoTranscription::dispatch($video);

        return response()->json(['message' => 'Video berhasil ditambahkan ke antrean.', 'data' => $video], 201);
    }

    public function status(Video $video): JsonResponse
    {
        return response()->json([
            'data' => [
                'id' => $video->id,
                'title' => $video->title,
                'transcription_status' => $video->transcription_status,
                'transcription_progress' => $video->transcription_progress,
            ],
        ]);
    }

    public function activeQueue(): JsonResponse
    {
        $activeVideos = Video::query()
            ->whereIn('transcription_status', ['pending', 'processing'])
            ->orderBy('created_at', 'desc')
            ->select(['id', 'title', 'thumbnail_url', 'transcription_status', 'transcription_progress', 'created_at'])
            ->get();

        return response()->json(['data' => $activeVideos]);
    }

    // Menangani Input Video / Folder Lokal
    public function storeLocal(Request $request): JsonResponse
    {
        $validated = $request->validate(['path' => ['required', 'string']]);
        $path = trim($validated['path']);

        if (!file_exists($path)) {
            return response()->json(['message' => 'Path tidak ditemukan! Pastikan lokasi folder/file sudah benar.'], 422);
        }

        $videosToProcess = [];
        $sourceName = 'Local'; 

        // Cek apakah input berupa Folder atau File tunggal
        if (is_dir($path)) {
            $sourceName = 'Folder: ' . rtrim($path, '\\/');
            $files = File::files($path);
            
            foreach ($files as $file) {
                if (in_array(strtolower($file->getExtension()), ['mp4', 'mkv', 'avi', 'mov', 'webm'])) {
                    $videosToProcess[] = $file->getRealPath();
                }
            }

            if (empty($videosToProcess)) {
                return response()->json(['message' => 'Tidak ada file video di dalam folder tersebut.'], 422);
            }
        } else {
            $videosToProcess[] = $path;
            $sourceName = 'File: ' . basename(dirname($path));
        }

        $dispatchedCount = 0;

        foreach ($videosToProcess as $videoPath) {
            $existingVideo = Video::where('video_url', $videoPath)->first();

            if ($existingVideo && $existingVideo->transcription_status === 'failed') {
                $existingVideo->transcriptSegments()->delete();
                $existingVideo->delete();
                $existingVideo = null;
            }

            if (!$existingVideo) {
                $video = Video::create([
                    'title' => basename($videoPath),
                    'source' => $sourceName, 
                    'video_url' => $videoPath,
                    'thumbnail_url' => null,
                    'transcription_status' => 'pending',
                    'transcription_progress' => 0,
                ]);

                ProcessVideoTranscription::dispatch($video);
                $dispatchedCount++;
            }
        }

        if ($dispatchedCount === 0) {
            return response()->json(['message' => 'Semua video dalam folder tersebut sudah diproses/masuk antrean.'], 409);
        }

        return response()->json(['message' => "$dispatchedCount video berhasil dimasukkan ke antrean."], 201);
    }

    public function syncFolder(Request $request): JsonResponse
    {
        $validated = $request->validate(['source' => ['required', 'string']]);
        $sourceName = $validated['source'];

        if (!str_starts_with($sourceName, 'Folder: ')) {
            return response()->json(['message' => 'Sumber tidak valid.'], 400);
        }

        $path = substr($sourceName, 8); 
        $removedCount = 0;
        $addedCount = 0;

        $existingVideos = Video::where('source', $sourceName)->get();

        // JIKA FOLDER UTAMANYA SUDAH TERHAPUS/GANTI NAMA DI WINDOWS
        if (!is_dir($path)) {
            foreach ($existingVideos as $video) {
                $video->transcriptSegments()->delete(); 
                $video->delete(); 
                $removedCount++;
            }
            return response()->json(['message' => "Folder tidak ditemukan. $removedCount video telah dihapus dari database."]);
        }

        // 1. SCAN OUT (Hapus video yang filenya sudah hilang)
        foreach ($existingVideos as $video) {
            if (!file_exists($video->video_url)) {
                $video->transcriptSegments()->delete();
                $video->delete();
                $removedCount++;
            }
        }

        // 2. SCAN IN (Tambah video baru)
        $files = File::files($path);
        
        foreach ($files as $file) {
            if (in_array(strtolower($file->getExtension()), ['mp4', 'mkv', 'avi', 'mov', 'webm'])) {
                $videoPath = $file->getRealPath();
                
                if (!Video::where('video_url', $videoPath)->exists()) {
                    $video = Video::create([
                        'title' => basename($videoPath),
                        'source' => $sourceName,
                        'video_url' => $videoPath,
                        'thumbnail_url' => null,
                        'transcription_status' => 'pending',
                        'transcription_progress' => 0,
                    ]);

                    ProcessVideoTranscription::dispatch($video);
                    $addedCount++;
                }
            }
        }

        return response()->json(['message' => "Sync Selesai: $addedCount ditambahkan, $removedCount dihapus."]);
    }

    public function destroy($id): JsonResponse
    {
        $video = Video::find($id);
        
        if (!$video) {
            return response()->json(['message' => 'Video tidak ditemukan'], 404);
        }

        $video->transcriptSegments()->delete();
        $video->delete();

        return response()->json(['message' => 'Video berhasil dibatalkan dan dihapus.']);
    }
}