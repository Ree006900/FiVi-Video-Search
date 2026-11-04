<?php

namespace Database\Seeders;

use App\Models\TranscriptSegment;
use App\Models\Video;
use Illuminate\Database\Seeder;

class DemoVideoSeeder extends Seeder
{
    public function run(): void
    {
        $video = Video::updateOrCreate(
            [
                'video_url' => 'https://www.youtube.com/watch?v=demo-indonesia-emas',
            ],
            [
                'title' => 'Contoh Pidato Indonesia Emas 2045',
                'source' => 'Demo FiVi',
                'thumbnail_url' => 'https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?auto=format&fit=crop&w=900&q=80',
                'duration_seconds' => 768,
                'transcription_status' => 'completed',
            ]
        );

        $segments = [
            [
                'text' => 'Kita harus mempersiapkan generasi muda untuk menyongsong Indonesia Emas pada tahun 2045.',
                'start_time' => 154,
                'end_time' => 160,
            ],
            [
                'text' => 'Pendidikan berkualitas merupakan fondasi untuk membangun masa depan Indonesia.',
                'start_time' => 210,
                'end_time' => 217,
            ],
            [
                'text' => 'Indonesia Emas bukan sekadar cita-cita, tetapi tujuan yang harus kita persiapkan mulai sekarang.',
                'start_time' => 432,
                'end_time' => 440,
            ],
        ];

        foreach ($segments as $segment) {
            TranscriptSegment::updateOrCreate(
                [
                    'video_id' => $video->id,
                    'start_time' => $segment['start_time'],
                ],
                [
                    'text' => $segment['text'],
                    'end_time' => $segment['end_time'],
                ]
            );
        }
    }
}