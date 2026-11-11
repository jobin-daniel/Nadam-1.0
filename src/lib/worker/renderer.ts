import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { AudioEditSettings } from '../types/audio';
import { buildFfmpegFilterChain } from '../audio/ffmpeg-builder';
import { getFfmpegPath, getMediaDuration } from './converter';
import { sanitizeFilename, ensureStorageSubdirs } from '../security/sanitizer';
import { libraryRepo, jobRepo } from '../db/repository';

export interface RenderResult {
  id: string;
  title: string;
  filePath: string;
  fileSize: number;
  duration: number;
  bitrate: string;
}

export async function renderMasteredAudio(
  inputAudioId: string,
  settings: AudioEditSettings
): Promise<RenderResult> {
  const ffmpeg = await getFfmpegPath();
  const storageDir = path.resolve(process.env.STORAGE_DIR || './storage');
  ensureStorageSubdirs(storageDir);

  // 1. Resolve source input path
  let sourcePath: string | undefined;
  let originalLibraryItem = libraryRepo.getById(inputAudioId);

  if (originalLibraryItem?.filePath && fs.existsSync(originalLibraryItem.filePath)) {
    sourcePath = originalLibraryItem.filePath;
  } else {
    const job = jobRepo.getById(inputAudioId);
    if (job?.outputPath && fs.existsSync(job.outputPath)) {
      sourcePath = job.outputPath;
    } else if (job?.originalPath && fs.existsSync(job.originalPath)) {
      sourcePath = job.originalPath;
    }
  }

  if (!sourcePath || !fs.existsSync(sourcePath)) {
    throw new Error('Source audio file could not be located on disk');
  }

  const duration = (await getMediaDuration(sourcePath)) || originalLibraryItem?.duration || 0;

  // 2. Build the filter graph
  const { filterString } = buildFfmpegFilterChain(settings, duration);

  // 3. Prepare output path (never overwrite original!)
  const renderId = `render_${crypto.randomUUID().slice(0, 10)}`;
  const rawFilename = settings.exportFormat.filename || `${originalLibraryItem?.title || 'mastered'}.mp3`;
  const safeFilename = sanitizeFilename(rawFilename, 'mastered.mp3');
  const outputPath = path.join(storageDir, 'renders', `${renderId}_${safeFilename}`);

  const args: string[] = ['-y', '-i', sourcePath];

  // Apply filter graph if any filters are active
  if (filterString.trim()) {
    args.push('-af', filterString);
  }

  // Audio codec and sampling
  args.push('-c:a', 'libmp3lame');
  args.push('-ar', String(settings.exportFormat.sampleRate || 44100));

  // Bitrate handling
  const bitrate = settings.exportFormat.bitrate || '320k';
  if (bitrate === 'V0') {
    args.push('-q:a', '0');
  } else {
    args.push('-b:a', bitrate);
  }

  // ID3 Metadata tags
  const tags = settings.exportFormat.tags;
  const finalTitle = tags.title || originalLibraryItem?.title || path.basename(safeFilename, '.mp3');
  const finalArtist = tags.artist || originalLibraryItem?.artist || 'Video2MP3 Mastering';
  const finalAlbum = tags.album || originalLibraryItem?.album || 'Mastered Audio';

  args.push('-metadata', `title=${finalTitle}`);
  args.push('-metadata', `artist=${finalArtist}`);
  args.push('-metadata', `album=${finalAlbum}`);
  if (tags.year) args.push('-metadata', `date=${tags.year}`);
  if (tags.genre) args.push('-metadata', `genre=${tags.genre}`);

  // Prevent video streams
  args.push('-vn');
  args.push(outputPath);

  await new Promise<void>((resolve, reject) => {
    const proc = spawn(ffmpeg, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';

    proc.stderr.on('data', (d) => {
      stderr += d.toString();
    });

    proc.on('error', (err) => {
      reject(new Error(`FFmpeg spawn error: ${err.message}`));
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(`FFmpeg render failed (exit ${code}): ${stderr.slice(-600)}`));
      }
      resolve();
    });
  });

  if (!fs.existsSync(outputPath)) {
    throw new Error('Exported MP3 was not created');
  }

  const stat = fs.statSync(outputPath);
  const finalDuration = (await getMediaDuration(outputPath)) || duration;

  // Register the newly rendered master into Library
  libraryRepo.create({
    id: renderId,
    title: `${finalTitle} (Mastered)`,
    artist: finalArtist,
    album: finalAlbum,
    duration: Math.round(finalDuration),
    fileSize: stat.size,
    bitrate,
    filePath: outputPath,
    isEdited: true,
    parentItemId: originalLibraryItem ? originalLibraryItem.id : undefined,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  return {
    id: renderId,
    title: `${finalTitle} (Mastered)`,
    filePath: outputPath,
    fileSize: stat.size,
    duration: Math.round(finalDuration),
    bitrate,
  };
}
