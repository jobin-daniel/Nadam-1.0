import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { jobQueue } from '../../lib/worker/queue.ts';
import { jobRepo, libraryRepo } from '../../lib/db/repository.ts';

test('Job Removal: Deletes downloaded and rendered files by default', () => {
  const storageDir = path.resolve('./storage');
  const downloadsDir = path.join(storageDir, 'downloads');
  const rendersDir = path.join(storageDir, 'renders');

  if (!fs.existsSync(downloadsDir)) fs.mkdirSync(downloadsDir, { recursive: true });
  if (!fs.existsSync(rendersDir)) fs.mkdirSync(rendersDir, { recursive: true });

  const testId = `job_del_test_${Date.now()}`;
  const mockDownload = path.join(downloadsDir, `${testId}_audio.mp3`);
  const mockRender = path.join(rendersDir, `render_${testId}_master.mp3`);

  fs.writeFileSync(mockDownload, 'mock download data');
  fs.writeFileSync(mockRender, 'mock render data');

  // Seed job and library records
  jobRepo.create({
    id: testId,
    type: 'download',
    status: 'completed',
    title: 'Test File For Deletion',
    bitrate: '320k',
    outputPath: mockDownload,
    progress: { percent: 100, stage: 'completed' },
    createdAt: Date.now(),
  });

  const libId = `lib_${testId}`;
  libraryRepo.create({
    id: libId,
    jobId: testId,
    title: 'Test File For Deletion',
    duration: 10,
    fileSize: 100,
    bitrate: '320k',
    filePath: mockDownload,
    isEdited: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  const renderLibId = `lib_render_${testId}`;
  libraryRepo.create({
    id: renderLibId,
    parentItemId: libId,
    title: 'Test File Render',
    duration: 10,
    fileSize: 100,
    bitrate: '320k',
    filePath: mockRender,
    isEdited: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  // Call removeJob with default options (delete both)
  jobQueue.removeJob(testId, { keepDownloads: false, keepRenders: false });

  // Verify job record deleted
  assert.equal(jobRepo.getById(testId), null);
  // Verify files deleted
  assert.equal(fs.existsSync(mockDownload), false, 'Download file should be deleted');
  assert.equal(fs.existsSync(mockRender), false, 'Render file should be deleted');
});

test('Job Removal: Preserves files when checkboxes are checked', () => {
  const storageDir = path.resolve('./storage');
  const downloadsDir = path.join(storageDir, 'downloads');
  const rendersDir = path.join(storageDir, 'renders');

  const testId = `job_preserve_${Date.now()}`;
  const mockDownload = path.join(downloadsDir, `${testId}_audio.mp3`);
  const mockRender = path.join(rendersDir, `render_${testId}_master.mp3`);

  fs.writeFileSync(mockDownload, 'mock download preserve');
  fs.writeFileSync(mockRender, 'mock render preserve');

  jobRepo.create({
    id: testId,
    type: 'download',
    status: 'completed',
    title: 'Test File Preserve',
    bitrate: '320k',
    outputPath: mockDownload,
    progress: { percent: 100, stage: 'completed' },
    createdAt: Date.now(),
  });

  // Call removeJob with keepDownloads: true and keepRenders: true
  jobQueue.removeJob(testId, { keepDownloads: true, keepRenders: true });

  // Job is cleared from queue
  assert.equal(jobRepo.getById(testId), null);
  // Physical files preserved
  assert.equal(fs.existsSync(mockDownload), true, 'Download file should be preserved on disk');
  assert.equal(fs.existsSync(mockRender), true, 'Render file should be preserved on disk');

  // Clean up
  try {
    fs.unlinkSync(mockDownload);
    fs.unlinkSync(mockRender);
  } catch {}
});
