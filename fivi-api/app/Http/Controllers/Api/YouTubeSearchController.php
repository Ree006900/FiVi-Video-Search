<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Illuminate\Http\Client\ConnectionException;

class YouTubeSearchController extends Controller
{
    public function search(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'q' => ['required', 'string', 'min:2', 'max:200'],
            'pageToken' => ['nullable', 'string', 'max:500'],
            'maxResults' => ['nullable', 'integer', 'min:1', 'max:25'],
        ]);

        $query = trim($validated['q']);
        $maxResults = (int) ($validated['maxResults'] ?? 10);
        $pageToken = $validated['pageToken'] ?? '';

        $cacheKey = hash('sha256', Str::lower($query) . '|' . $maxResults . '|' . $pageToken);

        // 1. Periksa cache pencarian (menghindari limitasi API YouTube)
        $cache = DB::table('youtube_search_caches')
            ->where('cache_key', $cacheKey)
            ->where('expires_at', '>', now())
            ->first();

        if ($cache) {
            return response()->json(json_decode($cache->response_json, true) + ['cached' => true]);
        }

        // 2. Ambil API Key dari .env / config
        $apiKey = config('services.youtube.key');
        if (!$apiKey) {
            return response()->json(['message' => 'YouTube API Key belum dikonfigurasi.'], 500);
        }

        // 3. Pencarian lewat YouTube Data API v3
        try {
            $response = Http::timeout(15)->get('https://www.googleapis.com/youtube/v3/search', [
                'part' => 'snippet',
                'q' => $query,
                'type' => 'video',
                'maxResults' => $maxResults,
                'pageToken' => $pageToken ?: null,
                'regionCode' => 'ID',
                'relevanceLanguage' => 'id',
                'key' => $apiKey,
            ]);
        } catch (ConnectionException $e) {
            return response()->json(['message' => 'Tidak dapat terhubung ke YouTube.'], 503);
        }

        if ($response->failed()) {
            Log::warning('YouTube API request failed', [
                'status' => $response->status(),
                'reason' => $response->json('error.errors.0.reason'),
            ]);

            return response()->json([
                'message' => 'Pencarian YouTube gagal.',
                'reason' => $response->json('error.errors.0.reason') ?? 'youtube_api_error',
            ], $response->status() >= 500 ? 502 : $response->status());
        }

        $apiData = $response->json();

        // 4. Transformasi format data YouTube untuk frontend
        $videos = collect($apiData['items'] ?? [])->map(function (array $item) {
            $videoId = $item['id']['videoId'] ?? null;
            $snippet = $item['snippet'] ?? [];

            if (!$videoId) return null;

            return [
                'video_id' => $videoId,
                'title' => $snippet['title'] ?? '',
                'description' => $snippet['description'] ?? '',
                'channel_title' => $snippet['channelTitle'] ?? '',
                'published_at' => $snippet['publishedAt'] ?? null,
                'thumbnail_url' => $snippet['thumbnails']['high']['url'] 
                                ?? $snippet['thumbnails']['medium']['url'] 
                                ?? $snippet['thumbnails']['default']['url'] ?? null,
                'video_url' => 'https://www.youtube.com/watch?v=' . $videoId,
            ];
        })->filter()->values();

        $result = [
            'query' => $query,
            'results_count' => $videos->count(),
            'next_page_token' => $apiData['nextPageToken'] ?? null,
            'previous_page_token' => $apiData['prevPageToken'] ?? null,
            'data' => $videos,
            'cached' => false,
        ];

        // 5. Simpan hasil ke Cache selama 24 jam
        DB::table('youtube_search_caches')->updateOrInsert(
            ['cache_key' => $cacheKey],
            [
                'query' => $query,
                'response_json' => json_encode(collect($result)->except('cached')->all(), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                'expires_at' => now()->addHours(24),
                'created_at' => now(),
                'updated_at' => now(),
            ]
        );

        return response()->json($result);
    }
}