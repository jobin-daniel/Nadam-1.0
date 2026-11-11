import { NextRequest, NextResponse } from 'next/server';
import { renderMasteredAudio } from '@/lib/worker/renderer';
import { AudioEditSettings } from '@/lib/types/audio';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { audioId, settings } = body as { audioId: string; settings: AudioEditSettings };

    if (!audioId || !settings) {
      return NextResponse.json({ error: 'audioId and settings are required' }, { status: 400 });
    }

    const result = await renderMasteredAudio(audioId, settings);

    return NextResponse.json({
      success: true,
      render: {
        id: result.id,
        title: result.title,
        duration: result.duration,
        fileSize: result.fileSize,
        bitrate: result.bitrate,
        downloadUrl: `/api/render/${result.id}/download`,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Audio export failed' },
      { status: 500 }
    );
  }
}
