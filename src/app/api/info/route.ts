import { NextRequest, NextResponse } from 'next/server';
import { validateUrl } from '@/lib/security/ssrf';
import { fetchUrlMetadata } from '@/lib/worker/downloader';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { url } = body;

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'A valid URL string is required' }, { status: 400 });
    }

    // SSRF Guard
    const validation = await validateUrl(url);
    if (!validation.valid || !validation.sanitizedUrl) {
      return NextResponse.json({ error: validation.error || 'Blocked by security policy' }, { status: 403 });
    }

    const metadata = await fetchUrlMetadata(validation.sanitizedUrl);
    return NextResponse.json(metadata);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to retrieve video metadata' },
      { status: 500 }
    );
  }
}
