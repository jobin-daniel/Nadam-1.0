import { NextRequest, NextResponse } from 'next/server';
import { jobQueue } from '@/lib/worker/queue';

export async function POST(req: NextRequest) {
  try {
    const { batchId } = await req.json();

    if (!batchId || typeof batchId !== 'string') {
      return NextResponse.json({ error: 'batchId is required' }, { status: 400 });
    }

    const count = jobQueue.cancelBatch(batchId);
    return NextResponse.json({ success: true, canceledCount: count });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
