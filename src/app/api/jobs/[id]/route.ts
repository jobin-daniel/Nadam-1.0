import { NextRequest, NextResponse } from 'next/server';
import { jobQueue } from '@/lib/worker/queue';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const job = jobQueue.getJob(id);

  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  return NextResponse.json({ job });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);

  let keepDownloads = searchParams.get('keepDownloads') === 'true';
  let keepRenders = searchParams.get('keepRenders') === 'true';

  try {
    const contentType = req.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const body = await req.json();
      if (typeof body.keepDownloads === 'boolean') keepDownloads = body.keepDownloads;
      if (typeof body.keepRenders === 'boolean') keepRenders = body.keepRenders;
    }
  } catch {}

  const success = jobQueue.removeJob(id, { keepDownloads, keepRenders });

  return NextResponse.json({ success, id });
}
