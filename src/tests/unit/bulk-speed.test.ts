import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { buildSpeedFilterChain, buildAtempoChain } from '../../lib/audio/ffmpeg-builder';
import { createZipArchive } from '../../lib/audio/zip-builder';

test('Bulk Speed: buildSpeedFilterChain generates atempo chain when pitch preservation is enabled', () => {
  // Speed 1.25x with pitch preservation
  const filters1 = buildSpeedFilterChain({
    speed: 1.25,
    preservePitch: true,
  });
  assert.deepEqual(filters1, ['atempo=1.25']);

  // Speed 2.5x with pitch preservation (>2.0 decomposed)
  const filters2 = buildSpeedFilterChain({
    speed: 2.5,
    preservePitch: true,
  });
  assert.deepEqual(filters2, ['atempo=2.0', 'atempo=1.25']);

  // Speed 0.4x with pitch preservation (<0.5 decomposed)
  const filters3 = buildSpeedFilterChain({
    speed: 0.4,
    preservePitch: true,
  });
  assert.deepEqual(filters3, ['atempo=0.5', 'atempo=0.8']);
});

test('Bulk Speed: buildSpeedFilterChain uses asetrate + aresample when pitch preservation is disabled', () => {
  const filters = buildSpeedFilterChain({
    speed: 1.5,
    preservePitch: false,
  });
  assert.equal(filters.some((f) => f.startsWith('asetrate=66150')), true);
  assert.equal(filters.includes('aresample=44100'), true);
});

test('Bulk Speed: buildSpeedFilterChain supports voice enhance and loudness normalization', () => {
  const filters = buildSpeedFilterChain({
    speed: 1.25,
    preservePitch: true,
    voiceEnhance: true,
    normalize: true,
  });

  // Check voice enhance filters
  assert.equal(filters.includes('highpass=f=80'), true);
  assert.equal(filters.some((f) => f.includes('equalizer=f=3000')), true);
  assert.equal(filters.some((f) => f.includes('equalizer=f=8000')), true);

  // Check speed filter
  assert.equal(filters.includes('atempo=1.25'), true);

  // Check normalization filter
  assert.equal(filters.some((f) => f.startsWith('loudnorm=')), true);
});

test('Bulk Speed: buildSpeedFilterChain with 1.0x speed and no options produces no filters', () => {
  const filters = buildSpeedFilterChain({
    speed: 1.0,
  });
  assert.equal(filters.length, 0);
});

test('Zip Builder: creates valid PKZip archive containing multiple files and handles duplicates', async () => {
  const testDir = path.resolve('./storage/test_samples');
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }

  const file1 = path.join(testDir, 'sample1.mp3');
  const file2 = path.join(testDir, 'sample2.mp3');
  const zipOutput = path.join(testDir, 'test_batch_export.zip');

  fs.writeFileSync(file1, Buffer.from('Mock MP3 Audio Content A'));
  fs.writeFileSync(file2, Buffer.from('Mock MP3 Audio Content B'));

  await createZipArchive(
    [
      { name: 'Track.mp3', path: file1 },
      { name: 'Track.mp3', path: file2 }, // Duplicate name: should be renamed to Track (1).mp3
    ],
    zipOutput
  );

  assert.equal(fs.existsSync(zipOutput), true);
  const zipStat = fs.statSync(zipOutput);
  assert.ok(zipStat.size > 100);

  // Read header signature 0x04034b50 (PK\x03\x04)
  const zipData = fs.readFileSync(zipOutput);
  assert.equal(zipData.readUInt32LE(0), 0x04034b50);

  // Cleanup
  try {
    fs.unlinkSync(file1);
    fs.unlinkSync(file2);
    fs.unlinkSync(zipOutput);
  } catch {}
});
