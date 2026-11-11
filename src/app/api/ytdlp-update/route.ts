import { NextResponse } from 'next/server';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { getYtDlpPath } from '@/lib/worker/downloader';

const execFileAsync = promisify(execFile);

export async function POST() {
  try {
    const ytdlpPath = await getYtDlpPath();

    // 1. Try yt-dlp self-update: yt-dlp -U
    try {
      const { stdout } = await execFileAsync(ytdlpPath, ['-U']);
      return NextResponse.json({
        success: true,
        output: stdout.trim(),
        message: 'yt-dlp updated successfully',
      });
    } catch (selfUpdateError: any) {
      // 2. If self-update failed, try pip update
      try {
        const { stdout } = await execFileAsync('python3', [
          '-m',
          'pip',
          'install',
          '--upgrade',
          'yt-dlp',
          '--break-system-packages',
        ]);
        return NextResponse.json({
          success: true,
          output: stdout.trim(),
          message: 'yt-dlp updated via pip',
        });
      } catch (pipError: any) {
        return NextResponse.json({
          success: false,
          error: `Self-update failed: ${selfUpdateError.message}. Pip update failed: ${pipError.message}`,
        }, { status: 500 });
      }
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
