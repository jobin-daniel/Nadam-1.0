import { NextRequest, NextResponse } from 'next/server';
import { jobQueue } from '@/lib/worker/queue';
import { validateUrl } from '@/lib/security/ssrf';

export async function GET() {
  try {
    const jobs = jobQueue.listJobs();
    return NextResponse.json({ jobs });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { url, bitrate, title, artist, album, selectedIndices } = body;

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    const validation = await validateUrl(url);
    if (!validation.valid || !validation.sanitizedUrl) {
      return NextResponse.json({ error: validation.error || 'Blocked by security validation' }, { status: 403 });
    }

    const job = await jobQueue.enqueueDownloadJob({
      url: validation.sanitizedUrl,
      bitrate: bitrate || '320k',
      customTitle: title,
      tags: { title, artist, album },
    });

    return NextResponse.json({ job }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to enqueue job' }, { status: 500 });
  }
}
