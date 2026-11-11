import { NextRequest, NextResponse } from 'next/server';
import fs from 'node:fs';
import NodeID3 from 'node-id3';
import { libraryRepo } from '@/lib/db/repository';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const item = libraryRepo.getById(id);

    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    // Remove file if exists
    if (item.filePath && fs.existsSync(item.filePath)) {
      try {
        fs.unlinkSync(item.filePath);
      } catch {}
    }

    if (item.thumbnailPath && fs.existsSync(item.thumbnailPath)) {
      try {
        fs.unlinkSync(item.thumbnailPath);
      } catch {}
    }

    libraryRepo.delete(id);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { title, artist, album } = body;

    const item = libraryRepo.getById(id);
    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    // Update ID3 tags directly in the MP3 file on disk
    if (item.filePath && fs.existsSync(item.filePath)) {
      const tags: NodeID3.Tags = {};
      if (title !== undefined) tags.title = title;
      if (artist !== undefined) tags.artist = artist;
      if (album !== undefined) tags.album = album;

      try {
        NodeID3.update(tags, item.filePath);
      } catch (e) {
        console.warn('Could not update ID3 tags in file:', e);
      }
    }

    libraryRepo.updateTags(id, { title, artist, album });

    const updated = libraryRepo.getById(id);
    return NextResponse.json({ item: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
