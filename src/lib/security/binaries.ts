import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';

const execFileAsync = promisify(execFile);

export interface BinaryStatus {
  name: string;
  installed: boolean;
  path?: string;
  version?: string;
  error?: string;
  source: 'env' | 'system' | 'bundled' | 'missing';
}

export interface SystemEnvironmentStatus {
  ready: boolean;
  binaries: {
    ffmpeg: BinaryStatus;
    ffprobe: BinaryStatus;
    ytdlp: BinaryStatus;
  };
  storagePath: string;
}

// Cached check results
let cachedStatus: SystemEnvironmentStatus | null = null;
let lastCheckTime = 0;
const CACHE_TTL_MS = 10_000;

function fileExists(filePath?: string): boolean {
  if (!filePath) return false;
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

async function getVersion(binaryPath: string, versionFlag = '-version'): Promise<string> {
  const { stdout } = await execFileAsync(binaryPath, [versionFlag]);
  const firstLine = stdout.trim().split('\n')[0];
  return firstLine.replace(/Copyright.*$/, '').trim();
}

export async function detectFfmpeg(): Promise<BinaryStatus> {
  // 1. Env variable
  if (process.env.FFMPEG_PATH && fileExists(process.env.FFMPEG_PATH)) {
    try {
      const ver = await getVersion(process.env.FFMPEG_PATH);
      return { name: 'ffmpeg', installed: true, path: process.env.FFMPEG_PATH, version: ver, source: 'env' };
    } catch (e: any) {
      return { name: 'ffmpeg', installed: false, error: e.message, source: 'env' };
    }
  }

  // 2. System PATH
  try {
    const { stdout } = await execFileAsync('which', ['ffmpeg']);
    const sysPath = stdout.trim();
    if (sysPath && fileExists(sysPath)) {
      const ver = await getVersion(sysPath);
      return { name: 'ffmpeg', installed: true, path: sysPath, version: ver, source: 'system' };
    }
  } catch {
    // not in system path
  }

  // 3. Bundled static package (ffmpeg-static)
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ffmpegStatic = require('ffmpeg-static');
    if (ffmpegStatic && fileExists(ffmpegStatic)) {
      const ver = await getVersion(ffmpegStatic);
      return { name: 'ffmpeg', installed: true, path: ffmpegStatic, version: ver, source: 'bundled' };
    }
  } catch {
    // static package failed
  }

  return {
    name: 'ffmpeg',
    installed: false,
    source: 'missing',
    error: 'ffmpeg binary not found in PATH or bundled modules. Audio conversion requires FFmpeg.',
  };
}

export async function detectFfprobe(): Promise<BinaryStatus> {
  if (process.env.FFPROBE_PATH && fileExists(process.env.FFPROBE_PATH)) {
    try {
      const ver = await getVersion(process.env.FFPROBE_PATH);
      return { name: 'ffprobe', installed: true, path: process.env.FFPROBE_PATH, version: ver, source: 'env' };
    } catch (e: any) {
      return { name: 'ffprobe', installed: false, error: e.message, source: 'env' };
    }
  }

  try {
    const { stdout } = await execFileAsync('which', ['ffprobe']);
    const sysPath = stdout.trim();
    if (sysPath && fileExists(sysPath)) {
      const ver = await getVersion(sysPath);
      return { name: 'ffprobe', installed: true, path: sysPath, version: ver, source: 'system' };
    }
  } catch {
    // not in system path
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ffprobeInstaller = require('@ffprobe-installer/ffprobe');
    if (ffprobeInstaller?.path && fileExists(ffprobeInstaller.path)) {
      const ver = await getVersion(ffprobeInstaller.path);
      return { name: 'ffprobe', installed: true, path: ffprobeInstaller.path, version: ver, source: 'bundled' };
    }
  } catch {
    // static package failed
  }

  return {
    name: 'ffprobe',
    installed: false,
    source: 'missing',
    error: 'ffprobe binary not found. Media probing requires ffprobe.',
  };
}

export async function detectYtDlp(): Promise<BinaryStatus> {
  if (process.env.YTDLP_PATH && fileExists(process.env.YTDLP_PATH)) {
    try {
      const ver = await getVersion(process.env.YTDLP_PATH, '--version');
      return { name: 'yt-dlp', installed: true, path: process.env.YTDLP_PATH, version: ver, source: 'env' };
    } catch (e: any) {
      return { name: 'yt-dlp', installed: false, error: e.message, source: 'env' };
    }
  }

  // Common locations
  const searchPaths = ['yt-dlp', '/usr/local/bin/yt-dlp', '/opt/homebrew/bin/yt-dlp'];
  for (const bin of searchPaths) {
    try {
      const ver = await getVersion(bin, '--version');
      return { name: 'yt-dlp', installed: true, path: bin, version: ver, source: 'system' };
    } catch {
      // try next
    }
  }

  return {
    name: 'yt-dlp',
    installed: false,
    source: 'missing',
    error: 'yt-dlp binary not found. Video downloading requires yt-dlp installed (e.g. brew install yt-dlp or pip install yt-dlp).',
  };
}

export async function checkEnvironment(force = false): Promise<SystemEnvironmentStatus> {
  const now = Date.now();
  if (!force && cachedStatus && now - lastCheckTime < CACHE_TTL_MS) {
    return cachedStatus;
  }

  const [ffmpeg, ffprobe, ytdlp] = await Promise.all([
    detectFfmpeg(),
    detectFfprobe(),
    detectYtDlp(),
  ]);

  const storagePath = path.resolve(process.env.STORAGE_DIR || './storage');

  cachedStatus = {
    ready: ffmpeg.installed && ffprobe.installed && ytdlp.installed,
    binaries: {
      ffmpeg,
      ffprobe,
      ytdlp,
    },
    storagePath,
  };
  lastCheckTime = now;

  return cachedStatus;
}
