import { NextRequest } from 'next/server';
import { jobQueue } from '@/lib/worker/queue';
import { JobRecord } from '@/lib/types/job';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const initialJob = jobQueue.getJob(id);

  if (!initialJob) {
    return new Response(JSON.stringify({ error: 'Job not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Send initial job status
      const initialChunk = `data: ${JSON.stringify(initialJob)}\n\n`;
      controller.enqueue(encoder.encode(initialChunk));

      if (['completed', 'failed', 'canceled'].includes(initialJob.status)) {
        controller.close();
        return;
      }

      // Subscribe to live queue updates
      const unsubscribe = jobQueue.subscribe(id, (updatedJob: JobRecord) => {
        try {
          const chunk = `data: ${JSON.stringify(updatedJob)}\n\n`;
          controller.enqueue(encoder.encode(chunk));

          if (['completed', 'failed', 'canceled'].includes(updatedJob.status)) {
            unsubscribe();
            controller.close();
          }
        } catch {
          unsubscribe();
        }
      });

      // Cleanup on abort
      req.signal.addEventListener('abort', () => {
        unsubscribe();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
