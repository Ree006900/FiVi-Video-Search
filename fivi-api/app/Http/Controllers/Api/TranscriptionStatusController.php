<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Video;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TranscriptionStatusController extends Controller
{
    public function update(Request $request, Video $video): JsonResponse
    {
        $validated = $request->validate([
            'status' => ['required', 'in:processing,completed,failed'],
            'progress' => ['nullable', 'integer', 'min:0', 'max:100'],
        ]);

        $video->update([
            'transcription_status' => $validated['status'],
            'transcription_progress' => $validated['progress'] ?? $video->transcription_progress,
        ]);

        return response()->json([
            'message' => 'Status berhasil diperbarui.',
            'status' => $video->transcription_status,
            'progress' => $video->transcription_progress,
        ]);
    }
}