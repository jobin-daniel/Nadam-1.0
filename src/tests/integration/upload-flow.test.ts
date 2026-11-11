import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { convertToMp3, getMediaDuration } from '../../lib/worker/converter.ts';
import { libraryRepo, jobRepo } from '../../lib/db/repository.ts';
import { detectFfmpeg } from '../../lib/security/binaries.ts';

test('Integration: Generate sample audio, convert to MP3, and verify with ffprobe', async () => {
  const testDir = path.resolve('./storage/test_samples');
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }

  const sampleWav = path.join(testDir, 'sample_sine.wav');
  const outputMp3 = path.join(testDir, 'sample_converted.mp3');

  // Clean previous
  if (fs.existsSync(sampleWav)) fs.unlinkSync(sampleWav);
  if (fs.existsSync(outputMp3)) fs.unlinkSync(outputMp3);

  // 1. Generate 2-second sine wave using ffmpeg
  const ffmpegStatus = await detectFfmpeg();
  assert.equal(ffmpegStatus.installed, true);
  const ffmpegPath = ffmpegStatus.path!;

  await new Promise<void>((resolve, reject) => {
    const proc = spawn(ffmpegPath, [
      '-y',
      '-f', 'lavfi',
      '-i', 'sine=frequency=440:duration=2',
      sampleWav,
    ]);
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Failed to generate test wav: ${code}`));
    });
    proc.on('error', reject);
  });

  assert.equal(fs.existsSync(sampleWav), true);

  // 2. Convert to MP3 using our converter with ID3 tags
  await convertToMp3({
    inputPath: sampleWav,
    outputPath: outputMp3,
    bitrate: '320k',
    sampleRate: 44100,
    tags: {
      title: 'Test Sine Wave',
      artist: 'Audio Unit Test',
      album: 'DSP Suite Test Album',
    },
  });

  assert.equal(fs.existsSync(outputMp3), true);

  // 3. Verify duration with ffprobe
  const duration = await getMediaDuration(outputMp3);
  assert.ok(duration >= 1.9 && duration <= 2.1, `Expected duration ~2s, got ${duration}`);

  // 4. Verify database persistence
  const testId = `lib_test_${Date.now()}`;
  libraryRepo.create({
    id: testId,
    title: 'Test Sine Wave',
    artist: 'Audio Unit Test',
    album: 'DSP Suite Test Album',
    duration: Math.round(duration),
    fileSize: fs.statSync(outputMp3).size,
    bitrate: '320k',
    filePath: outputMp3,
    isEdited: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  const retrieved = libraryRepo.getById(testId);
  assert.ok(retrieved !== null);
  assert.equal(retrieved!.title, 'Test Sine Wave');
  assert.equal(retrieved!.bitrate, '320k');

  // Test updating tags
  libraryRepo.updateTags(testId, { title: 'Updated Title' });
  const updated = libraryRepo.getById(testId);
  assert.equal(updated!.title, 'Updated Title');

  // Clean test DB item
  libraryRepo.delete(testId);
  assert.equal(libraryRepo.getById(testId), null);
});

test('Integration: Convert MP3 with WebP thumbnail and corrupt thumbnail fallback', async () => {
  const testDir = path.resolve('./storage/test_samples');
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }

  const sampleWav = path.join(testDir, 'sample_sine.wav');
  const webpThumb = path.join(testDir, 'test_thumb.webp');
  const corruptThumb = path.join(testDir, 'corrupt_thumb.jpg');
  const outputMp3Webp = path.join(testDir, 'out_webp_thumb.mp3');
  const outputMp3Corrupt = path.join(testDir, 'out_corrupt_thumb.mp3');

  const ffmpegStatus = await detectFfmpeg();
  const ffmpegPath = ffmpegStatus.path!;

  // 1. Generate WebP image
  await new Promise<void>((resolve, reject) => {
    const proc = spawn(ffmpegPath, [
      '-y',
      '-f', 'lavfi',
      '-i', 'color=c=blue:s=120x120:d=1',
      '-vframes', '1',
      webpThumb,
    ]);
    proc.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`Failed to create webp: ${code}`))));
    proc.on('error', reject);
  });

  // 2. Convert with WebP thumbnail (tests -c:v mjpeg attached_pic fix for code 234)
  await convertToMp3({
    inputPath: sampleWav,
    outputPath: outputMp3Webp,
    bitrate: '192k',
    sampleRate: 44100,
    thumbnailPath: webpThumb,
    tags: { title: 'WebP Cover Test', artist: 'Tester' },
  });

  assert.ok(fs.existsSync(outputMp3Webp), 'MP3 with WebP cover should exist');
  const dur1 = await getMediaDuration(outputMp3Webp);
  assert.ok(dur1 > 1.5, 'Duration should be ~2s');

  // 3. Write corrupted thumbnail and verify fallback doesn't crash
  fs.writeFileSync(corruptThumb, 'not a valid image format at all');
  await convertToMp3({
    inputPath: sampleWav,
    outputPath: outputMp3Corrupt,
    bitrate: '128k',
    sampleRate: 44100,
    thumbnailPath: corruptThumb,
    tags: { title: 'Corrupt Cover Test', artist: 'Tester' },
  });

  assert.ok(fs.existsSync(outputMp3Corrupt), 'MP3 with corrupt cover fallback should exist');
  const dur2 = await getMediaDuration(outputMp3Corrupt);
  assert.ok(dur2 > 1.5, 'Duration should be ~2s');

  // Clean up
  if (fs.existsSync(webpThumb)) fs.unlinkSync(webpThumb);
  if (fs.existsSync(corruptThumb)) fs.unlinkSync(corruptThumb);
  if (fs.existsSync(outputMp3Webp)) fs.unlinkSync(outputMp3Webp);
  if (fs.existsSync(outputMp3Corrupt)) fs.unlinkSync(outputMp3Corrupt);
});
