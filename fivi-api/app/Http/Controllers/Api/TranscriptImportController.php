<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Video;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class TranscriptImportController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'source' => 'nullable|string|max:100',
            'video_url' => 'required|string|max:2048',
            'duration_seconds' => 'nullable|integer|min:0',
            'segments' => 'required|array|min:1',
            'segments.*.text' => 'required|string',
            'segments.*.start_time' => 'required|integer|min:0',
            'segments.*.end_time' => 'required|integer|min:0',
        ]);

        $video = DB::transaction(function () use ($validated) {
            $video = Video::updateOrCreate(
                ['video_url' => $validated['video_url']],
                [
                    'title' => $validated['title'],
                    'source' => $validated['source'] ?? 'Local',
                    'duration_seconds' => $validated['duration_seconds'] ?? null,
                    'transcription_status' => 'completed',
                ]
            );

            // Ganti segmen lama jika video diimpor ulang
            $video->transcriptSegments()->delete();

            $video->transcriptSegments()->createMany(
                array_map(fn ($segment) => [
                    'text' => $segment['text'],
                    'start_time' => $segment['start_time'],
                    'end_time' => $segment['end_time'],
                ], $validated['segments'])
            );

            return $video;
        });

        return response()->json([
            'message' => 'Transkripsi berhasil disimpan.',
            'video_id' => $video->id,
            'title' => $video->title,
            'segments_saved' => count($validated['segments']),
        ], 201);
    }
}