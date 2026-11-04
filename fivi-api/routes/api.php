<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\TranscriptSearchController;

Route::get('/user', function (Request $request) {
    return $request->user();
})->middleware('auth:sanctum');

Route::get('/search', [TranscriptSearchController::class, 'search']);
Route::get('/search/sources', [\App\Http\Controllers\Api\TranscriptSearchController::class, 'getSources']);


//Transcript import
use App\Http\Controllers\Api\TranscriptImportController;

Route::post('/videos/import-transcript', [
    TranscriptImportController::class,
    'store',
]);

//API YouTube
use App\Http\Controllers\Api\YouTubeSearchController;

Route::get('/youtube/search', [
    YouTubeSearchController::class,
    'search',
]);

// Route Video Controller
use App\Http\Controllers\Api\VideoController;
Route::post('/videos', [VideoController::class, 'store']);
Route::get('/videos/queue', [VideoController::class, 'activeQueue']);
Route::get('/videos/{video}/status', [VideoController::class, 'status']);
Route::get('/videos/queue', [\App\Http\Controllers\Api\VideoController::class, 'activeQueue']);
Route::post('/videos/local', [\App\Http\Controllers\Api\VideoController::class, 'storeLocal']);
Route::post('/videos/sync-folder', [\App\Http\Controllers\Api\VideoController::class, 'syncFolder']);
Route::delete('/videos/{id}', [\App\Http\Controllers\Api\VideoController::class, 'destroy']);


//Route status controller
use App\Http\Controllers\Api\TranscriptionStatusController;
Route::patch(
    '/videos/{video}/transcription-status',
    [TranscriptionStatusController::class, 'update']
);
// Membaca status transkripsi video
Route::get(
    '/videos/{video}/transcription-status',
    [VideoController::class, 'status']
);

//Ai Rangkuman
use App\Http\Controllers\Api\AiAssistantController;

Route::post('/videos/{video}/ask', [AiAssistantController::class, 'ask']);

//Local Video
use Illuminate\Support\Facades\File;

Route::get('/play-local', function (Request $request) {
    $path = $request->query('path');

    // 1. Cek apakah filenya benar-benar ada di komputer/laptop Anda
    if (!File::exists($path)) {
        return response()->json(['message' => 'Video tidak ditemukan di path tersebut.'], 404);
    }

    // 2. Laravel merespons dengan menyajikan file tersebut sebagai streaming video
    return response()->file($path);
});