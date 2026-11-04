<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('videos', function (Blueprint $table) {
            $table->id();
            $table->string('title');
            $table->string('source')->default('YouTube');
            $table->text('video_url')->unique();
            $table->string('thumbnail_url')->nullable();
            $table->unsignedInteger('duration_seconds')->nullable();
            
            $table->enum('transcription_status', [
                'pending',
                'processing',
                'completed',
                'failed',
            ])->default('pending');

            $table->integer('transcription_progress')->default(0);

            $table->timestamps();
        });
    }

    public function down(): void {
        Schema::dropIfExists('videos');
    }
};