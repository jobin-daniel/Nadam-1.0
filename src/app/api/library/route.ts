import { NextResponse } from 'next/server';
import { libraryRepo } from '@/lib/db/repository';

export async function GET() {
  try {
    const items = libraryRepo.listAll();
    return NextResponse.json({ items });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
