<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Video extends Model
{
    protected $fillable = [
        'title',
        'source',
        'video_url',
        'thumbnail_url',
        'duration_seconds',
        'transcription_status',
        'transcription_progress',
    ];

    public function transcriptSegments(): HasMany
    {
        return $this->hasMany(TranscriptSegment::class);
    }
}