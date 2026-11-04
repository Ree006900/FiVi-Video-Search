<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\TranscriptSegment;
use App\Models\Video;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TranscriptSearchController extends Controller
{
    public function search(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'q' => ['required', 'string', 'min:2', 'max:200'],
            'source' => ['nullable', 'string'], 
        ]);

        $keyword = trim($validated['q']);
        $sourceFilter = $validated['source'] ?? 'all';
        $searchPattern = '%' . $keyword . '%';

        $query = Video::query()
            ->where('transcription_status', 'completed')
            ->whereHas('transcriptSegments', function ($q) use ($searchPattern) {
                $q->where('text', 'like', $searchPattern);
            });

        // Terapkan Filter Kategori (YouTube / Local Folder)
        if ($sourceFilter === 'youtube') {
            $query->where('source', 'YouTube');
        } elseif ($sourceFilter === 'local') {
            $query->where('source', '!=', 'YouTube'); // Cari di semua folder lokal
        } elseif ($sourceFilter !== 'all') {
            $query->where('source', $sourceFilter);   // Cari di folder spesifik
        }

        // 1. Ambil video beserta waktu kemunculan kata pertama
        $videos = $query->addSelect([
                'first_match_time' => TranscriptSegment::query()
                    ->select('start_time')
                    ->whereColumn('video_id', 'videos.id')
                    ->where('text', 'like', $searchPattern)
                    ->orderBy('start_time')
                    ->limit(1),
            ])
            ->orderBy('first_match_time')
            ->orderBy('id')
            ->paginate(30);

        $videoIds = $videos->getCollection()->pluck('id');

        // 2. Ambil semua segmen percakapan yang cocok
        $matchedSegments = TranscriptSegment::query()
            ->whereIn('video_id', $videoIds)
            ->where('text', 'like', $searchPattern)
            ->orderBy('video_id')
            ->orderBy('start_time')
            ->get()
            ->groupBy('video_id');

        // 3. Mapping hasil pencarian untuk dilengkapi dengan kalimat sebelum & sesudah
        $results = $videos->getCollection()->map(function ($video) use ($matchedSegments) {
            $segments = $matchedSegments->get($video->id, collect());

            $matches = $segments->map(function ($segment) {
                $previous = TranscriptSegment::query()
                    ->where('video_id', $segment->video_id)
                    ->where('start_time', '<', $segment->start_time)
                    ->orderByDesc('start_time')
                    ->first();

                $next = TranscriptSegment::query()
                    ->where('video_id', $segment->video_id)
                    ->where('start_time', '>', $segment->start_time)
                    ->orderBy('start_time')
                    ->first();

                return [
                    'id' => $segment->id,
                    'text' => $segment->text,
                    'start_time' => $segment->start_time,
                    'end_time' => $segment->end_time,
                    'context_before' => $previous ? $previous->only(['text', 'start_time', 'end_time']) : null,
                    'context_after' => $next ? $next->only(['text', 'start_time', 'end_time']) : null,
                ];
            })->values();

            return [
                'id' => $video->id,
                'video_id' => $video->id,
                'title' => $video->title,
                'source' => $video->source,
                'video_url' => $video->video_url,
                'thumbnail_url' => $video->thumbnail_url,
                'duration_seconds' => $video->duration_seconds,
                'text' => $matches->first()['text'] ?? '',
                'start_time' => $matches->first()['start_time'] ?? 0,
                'matches' => $matches,
            ];
        })->values();

        return response()->json([
            'query' => $keyword,
            'total' => $videos->total(),
            'current_page' => $videos->currentPage(),
            'last_page' => $videos->lastPage(),
            'data' => $results,
        ]);
    }

    public function getSources(): JsonResponse
    {
        $sources = Video::query()
            ->where('source', 'like', 'Folder: %')
            ->select('source')
            ->distinct()
            ->pluck('source');

        return response()->json(['data' => $sources]);
    }
}