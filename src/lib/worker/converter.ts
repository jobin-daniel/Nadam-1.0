import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { detectFfmpeg, detectFfprobe } from '../security/binaries';

export interface ConvertOptions {
  inputPath: string;
  outputPath: string;
  bitrate?: '128k' | '192k' | '256k' | '320k' | 'V0';
  sampleRate?: 44100 | 48000;
  tags?: {
    title?: string;
    artist?: string;
    album?: string;
    year?: string;
    genre?: string;
  };
  thumbnailPath?: string;
  totalDurationSeconds?: number;
  onProgress?: (percent: number) => void;
  abortSignal?: AbortSignal;
}

export async function getFfmpegPath(): Promise<string> {
  const status = await detectFfmpeg();
  if (!status.installed || !status.path) {
    throw new Error(status.error || 'ffmpeg is not installed or available');
  }
  return status.path;
}

export async function getFfprobePath(): Promise<string> {
  const status = await detectFfprobe();
  if (!status.installed || !status.path) {
    throw new Error(status.error || 'ffprobe is not installed or available');
  }
  return status.path;
}

export async function getMediaDuration(filePath: string): Promise<number> {
  const probePath = await getFfprobePath();
  const args = [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    filePath,
  ];

  return new Promise((resolve, reject) => {
    const proc = spawn(probePath, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (d) => { stdout += d.toString(); });
    proc.stderr.on('data', (d) => { stderr += d.toString(); });

    proc.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(`ffprobe failed: ${stderr.trim()}`));
      }
      const dur = parseFloat(stdout.trim());
      resolve(isNaN(dur) ? 0 : dur);
    });
    proc.on('error', reject);
  });
}

function parseFfmpegTime(timeStr: string): number {
  const parts = timeStr.trim().split(':');
  if (parts.length === 3) {
    const hours = parseFloat(parts[0]);
    const minutes = parseFloat(parts[1]);
    const seconds = parseFloat(parts[2]);
    return hours * 3600 + minutes * 60 + seconds;
  }
  return 0;
}

export async function convertToMp3(options: ConvertOptions): Promise<string> {
  const ffmpeg = await getFfmpegPath();
  const {
    inputPath,
    outputPath,
    bitrate = '320k',
    sampleRate = 44100,
    tags = {},
    thumbnailPath,
    totalDurationSeconds,
    onProgress,
    abortSignal,
  } = options;

  let totalDuration = totalDurationSeconds;
  if (!totalDuration || totalDuration <= 0) {
    try {
      totalDuration = await getMediaDuration(inputPath);
    } catch {
      totalDuration = 0;
    }
  }

  const hasThumbnail = Boolean(thumbnailPath && fs.existsSync(thumbnailPath));

  const args: string[] = ['-y', '-i', inputPath];

  if (hasThumbnail && thumbnailPath) {
    args.push('-i', thumbnailPath);
  }

  // Audio codec and sampling
  args.push('-c:a', 'libmp3lame');
  args.push('-ar', String(sampleRate));

  // Bitrate handling
  if (bitrate === 'V0') {
    args.push('-q:a', '0');
  } else {
    args.push('-b:a', bitrate);
  }

  if (hasThumbnail) {
    args.push('-map', '0:a:0');
    args.push('-map', '1:0');
    args.push('-c:v', 'copy');
    args.push('-id3v2_version', '3');
    args.push('-metadata:s:v', 'title=Album cover');
    args.push('-metadata:s:v', 'comment=Cover (front)');
  } else {
    args.push('-vn');
  }

  // ID3 metadata tags
  if (tags.title) args.push('-metadata', `title=${tags.title}`);
  if (tags.artist) args.push('-metadata', `artist=${tags.artist}`);
  if (tags.album) args.push('-metadata', `album=${tags.album}`);
  if (tags.year) args.push('-metadata', `date=${tags.year}`);
  if (tags.genre) args.push('-metadata', `genre=${tags.genre}`);

  args.push(outputPath);

  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpeg, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';

    if (abortSignal) {
      abortSignal.addEventListener('abort', () => {
        try { proc.kill('SIGKILL'); } catch {}
        reject(new Error('Conversion canceled by user'));
      });
    }

    const timeRegex = /time=(\d{2}:\d{2}:\d{2}(?:\.\d+)?)/;

    proc.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      stderr += text;

      if (onProgress && totalDuration && totalDuration > 0) {
        const match = timeRegex.exec(text);
        if (match) {
          const currentSec = parseFfmpegTime(match[1]);
          const pct = Math.min(99, Math.round((currentSec / totalDuration) * 100));
          onProgress(pct);
        }
      }
    });

    proc.on('error', (err) => {
      reject(new Error(`ffmpeg execution error: ${err.message}`));
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(`ffmpeg conversion failed with exit code ${code}: ${stderr.slice(-500)}`));
      }
      if (onProgress) onProgress(100);
      resolve(outputPath);
    });
  });
}
