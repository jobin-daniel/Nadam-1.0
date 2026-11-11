import { NextRequest, NextResponse } from 'next/server';
import { jobQueue } from '@/lib/worker/queue';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const retriedJob = jobQueue.retryJob(id);

  if (!retriedJob) {
    return NextResponse.json(
      { error: 'Cannot retry job. Only failed or canceled jobs can be retried.' },
      { status: 400 }
    );
  }

  return NextResponse.json({ job: retriedJob });
}
