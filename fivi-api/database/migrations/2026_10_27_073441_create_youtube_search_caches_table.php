<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('youtube_search_caches', function (Blueprint $table) {
            $table->id();
            $table->string('cache_key', 64)->unique();
            $table->string('query', 200);
            $table->longText('response_json');
            $table->timestamp('expires_at');
            $table->timestamps();
        });
    }

    public function down(): void {
        Schema::dropIfExists('youtube_search_caches');
    }
};