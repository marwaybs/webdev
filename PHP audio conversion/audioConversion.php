<?php
require_once 'vendor/autoload.php';
//use FFMpeg;

$ffmpeg = FFMpeg\FFMpeg::create();
$audio = $ffmpeg->open('sample.wav');

$format = new FFMpeg\Format\Audio\Flac();
$format->on('progress', function ($audio, $format, $percentage) {
    echo "$percentage % transcoded";
});

$format
    ->setAudioChannels(2)
    ->setAudioKiloBitrate(256);

$audio->save($format, 'track.flac');
?>
