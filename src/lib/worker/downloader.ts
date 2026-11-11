import { spawn } from 'node:child_process';
import { detectYtDlp } from '../security/binaries';
import { VideoMetadata, PlaylistItem } from '../types/job';

export interface DownloadProgressInfo {
  percent: number;
  speed?: string;
  eta?: string;
  downloadedBytes?: number;
  totalBytes?: number;
}

export async function getYtDlpPath(): Promise<string> {
  const status = await detectYtDlp();
  if (!status.installed || !status.path) {
    throw new Error(status.error || 'yt-dlp is not installed or available');
  }
  return status.path;
}

export async function fetchUrlMetadata(url: string): Promise<VideoMetadata> {
  const binary = await getYtDlpPath();

  const args = [
    '--dump-single-json',
    '--flat-playlist',
    '--no-warnings',
    '--no-check-certificates',
    url,
  ];

  return new Promise<VideoMetadata>((resolve, reject) => {
    const proc = spawn(binary, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('error', (err) => {
      reject(new Error(`Failed to run yt-dlp: ${err.message}`));
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(`yt-dlp failed (code ${code}): ${stderr.trim() || 'Unknown error'}`));
      }

      try {
        const json = JSON.parse(stdout);
        const isPlaylist = Boolean(json._type === 'playlist' || Array.isArray(json.entries));

        let playlistItems: PlaylistItem[] | undefined;
        if (isPlaylist && Array.isArray(json.entries)) {
          playlistItems = json.entries.map((entry: any, index: number) => ({
            index,
            id: entry.id || String(index),
            url: entry.url || entry.webpage_url || (entry.id ? `https://www.youtube.com/watch?v=${entry.id}` : url),
            title: entry.title || `Track ${index + 1}`,
            duration: Number(entry.duration) || 0,
            thumbnail: entry.thumbnails?.[0]?.url || entry.thumbnail || '',
            channel: entry.uploader || entry.channel || entry.artist || '',
          }));
        }

        const metadata: VideoMetadata = {
          id: json.id || 'media',
          url: json.webpage_url || url,
          title: json.title || 'Untitled Audio',
          thumbnail: json.thumbnail || json.thumbnails?.[0]?.url,
          duration: Number(json.duration) || 0,
          channel: json.uploader || json.channel || json.artist,
          description: json.description,
          isPlaylist,
          playlistItems,
        };

        resolve(metadata);
      } catch (err: any) {
        reject(new Error(`Failed to parse metadata from yt-dlp: ${err.message}`));
      }
    });
  });
}

export function downloadMedia(
  url: string,
  outputFilePath: string,
  onProgress: (info: DownloadProgressInfo) => void,
  abortSignal?: AbortSignal
): Promise<string> {
  return new Promise(async (resolve, reject) => {
    let binary: string;
    try {
      binary = await getYtDlpPath();
    } catch (err) {
      return reject(err);
    }

    // Download best available audio or best stream
    const args = [
      '-f', 'ba/b',
      '--newline',
      '--no-playlist',
      '--no-check-certificates',
      '-o', outputFilePath,
      url,
    ];

    const proc = spawn(binary, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';

    if (abortSignal) {
      abortSignal.addEventListener('abort', () => {
        try {
          proc.kill('SIGKILL');
        } catch {}
        reject(new Error('Download canceled by user'));
      });
    }

    const progressRegex = /\[download\]\s+(\d+(?:\.\d+)?)%\s+of\s+~?\s*(\S+)\s+at\s+(\S+)\s+ETA\s+(\S+)/;
    const simplePercentRegex = /\[download\]\s+(\d+(?:\.\d+)?)%/;

    proc.stdout.on('data', (chunk) => {
      const lines = chunk.toString().split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        const match = progressRegex.exec(trimmed);
        if (match) {
          const percent = parseFloat(match[1]);
          const speed = match[3];
          const eta = match[4];
          onProgress({ percent, speed, eta });
          continue;
        }

        const simpleMatch = simplePercentRegex.exec(trimmed);
        if (simpleMatch) {
          const percent = parseFloat(simpleMatch[1]);
          onProgress({ percent });
        }
      }
    });

    proc.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    proc.on('error', (err) => {
      reject(new Error(`yt-dlp execution error: ${err.message}`));
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(`Download failed with exit code ${code}: ${stderr.trim()}`));
      }
      resolve(outputFilePath);
    });
  });
}
