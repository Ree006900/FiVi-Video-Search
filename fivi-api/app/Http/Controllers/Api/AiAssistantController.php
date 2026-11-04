<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Video;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;

class AiAssistantController extends Controller
{
    public function ask(Request $request, Video $video): JsonResponse
    {
        set_time_limit(300);

        $request->validate(['question' => 'nullable|string|max:1000']);

        $apiKey = env('GEMINI_API_KEY');
        if (!$apiKey) {
            return response()->json(['message' => 'API Key belum dikonfigurasi.'], 500);
        }
        
        $transcript = $video->transcriptSegments()->orderBy('start_time')->pluck('text')->implode(' ');

        if (empty($transcript)) {
            return response()->json(['message' => 'Transkrip belum tersedia untuk video ini.'], 404);
        }

        $userQuestion = $request->question;
        $prompt = $userQuestion 
            ? "Berdasarkan keseluruhan transkrip, jawab pertanyaan ini dengan singkat dan langsung pada intinya: '{$userQuestion}'.\n\nTranskrip: {$transcript}"
            : "Buat rangkuman singkat (maksimal 5 poin utama) yang merangkum poin penting dari awal hingga akhir video berikut:\n\nTranskrip: {$transcript}";
        
        $response = Http::withoutVerifying()
            ->timeout(300) 
            ->withHeaders(['Content-Type' => 'application/json'])
            ->post("https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key={$apiKey}", [
                'contents' => [['parts' => [['text' => $prompt]]]]
            ]);

        if ($response->successful()) {
            $aiText = $response->json('candidates.0.content.parts.0.text') ?? 'Maaf, saya tidak bisa menghasilkan teks saat ini.';
            return response()->json(['answer' => $aiText]);
        }

        $errorMessage = $response->json('error.message') ?? 'Gagal menghubungi AI.';
        return response()->json(['message' => 'API Error: ' . $errorMessage], 500);
    }
}