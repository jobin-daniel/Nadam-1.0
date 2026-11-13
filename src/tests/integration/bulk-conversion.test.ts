import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { convertToMp3, getMediaDuration } from '../../lib/worker/converter';
import { detectFfmpeg } from '../../lib/security/binaries';
import { jobRepo } from '../../lib/db/repository';

test('Integration: Convert audio to MP3 with 1.5x speed and pitch preservation', async () => {
  const testDir = path.resolve('./storage/test_samples');
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }

  const sampleWav = path.join(testDir, 'sample_3sec_sine.wav');
  const outputMp3 = path.join(testDir, 'sample_1_5x_speed.mp3');

  if (fs.existsSync(sampleWav)) fs.unlinkSync(sampleWav);
  if (fs.existsSync(outputMp3)) fs.unlinkSync(outputMp3);

  // 1. Generate 3.0 second sine wave at 440 Hz
  const ffmpegStatus = await detectFfmpeg();
  assert.equal(ffmpegStatus.installed, true);
  const ffmpegPath = ffmpegStatus.path!;

  await new Promise<void>((resolve, reject) => {
    const proc = spawn(ffmpegPath, [
      '-y',
      '-f', 'lavfi',
      '-i', 'sine=frequency=440:duration=3',
      sampleWav,
    ]);
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Failed to generate test wav: ${code}`));
    });
    proc.on('error', reject);
  });

  assert.equal(fs.existsSync(sampleWav), true);

  // 2. Convert to MP3 with 1.5x speed (3.0s / 1.5 = 2.0s duration expected)
  await convertToMp3({
    inputPath: sampleWav,
    outputPath: outputMp3,
    bitrate: '320k',
    speedSettings: {
      speed: 1.5,
      preservePitch: true,
    },
    tags: {
      title: 'Sine Wave [1.5x]',
      artist: 'Bulk Converter Test',
      album: 'Speed Test Album',
    },
  });

  assert.equal(fs.existsSync(outputMp3), true);

  // 3. Verify output duration with ffprobe: expected ~2.0 seconds (+/- 0.1s)
  const duration = await getMediaDuration(outputMp3);
  assert.ok(
    duration >= 1.9 && duration <= 2.1,
    `Expected duration to be ~2.0s at 1.5x speed, got ${duration}s`
  );

  // 4. Test database job record with batch_id and speedSettings
  const testJobId = `job_bulk_${Date.now()}`;
  jobRepo.create({
    id: testJobId,
    type: 'download',
    status: 'completed',
    progress: { percent: 100, stage: 'completed', message: 'Done' },
    title: 'Sine Wave [1.5x]',
    bitrate: '320k',
    outputPath: outputMp3,
    duration: Math.round(duration),
    batchId: 'batch_test_123',
    speedSettings: { speed: 1.5, preservePitch: true },
    createdAt: Date.now(),
  });

  const retrieved = jobRepo.getById(testJobId);
  assert.ok(retrieved !== null);
  assert.equal(retrieved!.batchId, 'batch_test_123');
  assert.equal(retrieved!.speedSettings?.speed, 1.5);
  assert.equal(retrieved!.speedSettings?.preservePitch, true);

  const batchJobs = jobRepo.listByBatch('batch_test_123');
  assert.ok(batchJobs.some((j) => j.id === testJobId));

  // Clean test files & DB
  jobRepo.delete(testJobId);
  try {
    fs.unlinkSync(sampleWav);
    fs.unlinkSync(outputMp3);
  } catch {}
});
