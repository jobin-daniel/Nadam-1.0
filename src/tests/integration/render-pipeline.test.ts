import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { renderMasteredAudio } from '../../lib/worker/renderer.ts';
import { getMediaDuration } from '../../lib/worker/converter.ts';
import { libraryRepo } from '../../lib/db/repository.ts';
import { DEFAULT_AUDIO_SETTINGS, AudioEditSettings } from '../../lib/types/audio.ts';
import { detectFfmpeg, detectFfprobe } from '../../lib/security/binaries.ts';

test('Integration: Render mastered MP3 with Voice Enhance, EQ, and Speed via FFmpeg', async () => {
  const testDir = path.resolve('./storage/test_samples');
  if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });

  const inputWav = path.join(testDir, 'raw_input_session.wav');
  if (fs.existsSync(inputWav)) fs.unlinkSync(inputWav);

  // 1. Generate 4-second multi-tone sample wav with ffmpeg
  const ffmpegStatus = await detectFfmpeg();
  assert.equal(ffmpegStatus.installed, true);

  await new Promise<void>((resolve, reject) => {
    const proc = spawn(ffmpegStatus.path!, [
      '-y',
      '-f', 'lavfi',
      '-i', 'sine=frequency=1000:duration=4',
      inputWav,
    ]);
    proc.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`Failed to generate wav: ${code}`))));
    proc.on('error', reject);
  });

  assert.equal(fs.existsSync(inputWav), true);

  // 2. Register source in library
  const sourceId = `lib_src_${Date.now()}`;
  libraryRepo.create({
    id: sourceId,
    title: 'Raw Acoustic Session',
    artist: 'Antigravity Acoustic',
    album: 'Live Takes',
    duration: 4,
    fileSize: fs.statSync(inputWav).size,
    bitrate: '320k',
    filePath: inputWav,
    isEdited: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  // 3. Configure comprehensive mastering settings:
  // Voice Enhance + 10-band EQ + 1.25x speed + gain
  const settings: AudioEditSettings = {
    ...DEFAULT_AUDIO_SETTINGS,
    voiceEnhance: {
      enabled: true,
      intensity: 0.85,
      highpassFreq: 80,
      noiseReductionStrength: 0.6,
      presenceBoostDb: 3.0,
      deEsserCutDb: -3.0,
      compressionRatio: 3.5,
      normalizeTargetLufs: -16,
      preset: 'podcast',
    },
    equalizer: {
      enabled: true,
      bands: {
        ...DEFAULT_AUDIO_SETTINGS.equalizer.bands,
        250: -2.5,
        1000: 4.0,
        8000: 3.0,
      },
      preset: 'custom',
    },
    speedPitch: {
      speed: 1.25,
      preservePitch: true,
      pitchSemitones: 0,
    },
    volume: {
      gainDb: 2.0,
      peakNormalize: false,
    },
    exportFormat: {
      bitrate: '320k',
      sampleRate: 44100,
      filename: 'mastered_output_session.mp3',
      tags: {
        title: 'Mastered Acoustic Session',
        artist: 'Antigravity Studio Pro',
        album: 'Final Mastered Album',
        year: '2026',
      },
    },
  };

  // 4. Execute renderMasteredAudio
  const renderResult = await renderMasteredAudio(sourceId, settings);

  assert.ok(renderResult !== null);
  assert.ok(fs.existsSync(renderResult.filePath), 'Rendered MP3 file must exist on disk');
  assert.notEqual(renderResult.filePath, inputWav, 'Must never overwrite the original file');

  // 5. Probe rendered MP3 with ffprobe
  const ffprobeStatus = await detectFfprobe();
  assert.equal(ffprobeStatus.installed, true);

  const duration = await getMediaDuration(renderResult.filePath);
  // Original 4s duration divided by 1.25 speed factor should be ~3.2s
  assert.ok(duration >= 2.9 && duration <= 3.5, `Expected rendered duration ~3.2s, got ${duration}`);

  // 6. Verify library record
  const renderedItem = libraryRepo.getById(renderResult.id);
  assert.ok(renderedItem !== null);
  assert.equal(renderedItem!.isEdited, true);
  assert.equal(renderedItem!.parentItemId, sourceId);
  assert.equal(renderedItem!.title, 'Mastered Acoustic Session (Mastered)');
  assert.equal(renderedItem!.bitrate, '320k');

  // Clean test files & records
  try {
    fs.unlinkSync(inputWav);
    fs.unlinkSync(renderResult.filePath);
    libraryRepo.delete(sourceId);
    libraryRepo.delete(renderResult.id);
  } catch {}
});

test('Integration: Render mastered MP3 from a download job ID without foreign key failure', async () => {
  const testDir = path.resolve('./storage/test_samples');
  const tempWav = path.join(testDir, 'raw_job_sample.wav');

  const ffmpegStatus = await detectFfmpeg();
  await new Promise<void>((resolve, reject) => {
    const proc = spawn(ffmpegStatus.path!, ['-y', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=2', tempWav]);
    proc.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`Exit ${code}`))));
    proc.on('error', reject);
  });

  const { jobRepo } = await import('../../lib/db/repository.ts');
  const jobId = `job_standalone_${Date.now()}`;
  jobRepo.create({
    id: jobId,
    type: 'download',
    status: 'completed',
    title: 'Standalone Download Job',
    bitrate: '320k',
    outputPath: tempWav,
    originalPath: tempWav,
    duration: 2,
    progress: { percent: 100, stage: 'completed' },
    createdAt: Date.now(),
    completedAt: Date.now(),
  });

  // Render passing jobId (which is NOT in library table)
  const result = await renderMasteredAudio(jobId, DEFAULT_AUDIO_SETTINGS);
  assert.ok(result !== null);
  assert.ok(fs.existsSync(result.filePath));

  // Verify library item was created without FK constraint failure
  const libItem = libraryRepo.getById(result.id);
  assert.ok(libItem !== null);
  assert.equal(libItem!.parentItemId, null); // cleanly set to null!

  // Clean
  try {
    fs.unlinkSync(tempWav);
    fs.unlinkSync(result.filePath);
    jobRepo.delete(jobId);
    libraryRepo.delete(result.id);
  } catch {}
});
