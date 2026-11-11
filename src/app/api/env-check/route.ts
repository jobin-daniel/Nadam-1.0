import { NextResponse } from 'next/server';
import { checkEnvironment } from '@/lib/security/binaries';

export async function GET() {
  try {
    const status = await checkEnvironment(true);
    return NextResponse.json(status);
  } catch (err: any) {
    return NextResponse.json(
      { ready: false, error: err.message || 'Failed to detect environment' },
      { status: 500 }
    );
  }
}
