<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('transcript_segments', function (Blueprint $table) {
            $table->id();

            // Relasi ke tabel videos (akan ikut terhapus jika video dihapus)
            $table->foreignId('video_id')
                  ->constrained('videos')
                  ->cascadeOnDelete();

            $table->longText('text');
            $table->unsignedInteger('start_time');
            $table->unsignedInteger('end_time');

            $table->timestamps();

            // Index untuk mempercepat pencarian timestamp pada video tertentu
            $table->index(['video_id', 'start_time']);
        });
    }

    public function down(): void {
        Schema::dropIfExists('transcript_segments');
    }
};