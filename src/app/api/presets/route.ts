import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { getDatabase } from '@/lib/db';

export async function GET() {
  try {
    const db = getDatabase();
    const rows = db.prepare('SELECT * FROM presets ORDER BY created_at DESC').all();
    const presets = rows.map((r: any) => ({
      id: r.id,
      type: r.type,
      name: r.name,
      data: JSON.parse(r.data_json),
      createdAt: r.created_at,
    }));
    return NextResponse.json({ presets });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type, name, data } = body;

    if (!type || !name || !data) {
      return NextResponse.json({ error: 'type, name, and data are required' }, { status: 400 });
    }

    const db = getDatabase();
    const id = `preset_${crypto.randomUUID().slice(0, 8)}`;
    db.prepare(`
      INSERT INTO presets (id, type, name, data_json, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, type, name, JSON.stringify(data), Date.now());

    return NextResponse.json({ id, name, type }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id query param is required' }, { status: 400 });
    }

    const db = getDatabase();
    db.prepare('DELETE FROM presets WHERE id = ?').run(id);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
