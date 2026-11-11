import { getDatabase } from './index';
import { JobRecord, JobStatus, JobProgress } from '../types/job';
import { LibraryItem } from '../types/library';

export const jobRepo = {
  create(job: JobRecord): void {
    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT INTO jobs (
        id, type, status, title, source_url, thumbnail, duration,
        channel, bitrate, output_path, original_path, error,
        progress_json, created_at, completed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      job.id,
      job.type,
      job.status,
      job.title,
      job.sourceUrl || null,
      job.thumbnail || null,
      job.duration || null,
      job.channel || null,
      job.bitrate,
      job.outputPath || null,
      job.originalPath || null,
      job.error || null,
      JSON.stringify(job.progress),
      job.createdAt,
      job.completedAt || null
    );
  },

  updateStatus(id: string, status: JobStatus, progress?: JobProgress, error?: string): void {
    const db = getDatabase();
    if (progress && error !== undefined) {
      db.prepare(`
        UPDATE jobs
        SET status = ?, progress_json = ?, error = ?, completed_at = ?
        WHERE id = ?
      `).run(status, JSON.stringify(progress), error, Date.now(), id);
    } else if (progress) {
      db.prepare(`
        UPDATE jobs
        SET status = ?, progress_json = ?
        WHERE id = ?
      `).run(status, JSON.stringify(progress), id);
    } else {
      db.prepare(`
        UPDATE jobs
        SET status = ?
        WHERE id = ?
      `).run(status, id);
    }
  },

  updateCompleted(id: string, outputPath: string, originalPath?: string): void {
    const db = getDatabase();
    const completedProgress: JobProgress = {
      percent: 100,
      stage: 'completed',
      message: 'Processing complete',
    };
    db.prepare(`
      UPDATE jobs
      SET status = 'completed',
          output_path = ?,
          original_path = COALESCE(?, original_path),
          progress_json = ?,
          completed_at = ?
      WHERE id = ?
    `).run(outputPath, originalPath || null, JSON.stringify(completedProgress), Date.now(), id);
  },

  getById(id: string): JobRecord | null {
    const db = getDatabase();
    const row: any = db.prepare('SELECT * FROM jobs WHERE id = ?').get(id);
    if (!row) return null;

    return {
      id: row.id,
      type: row.type,
      status: row.status,
      title: row.title,
      sourceUrl: row.source_url,
      thumbnail: row.thumbnail,
      duration: row.duration,
      channel: row.channel,
      bitrate: row.bitrate,
      outputPath: row.output_path,
      originalPath: row.original_path,
      error: row.error,
      progress: JSON.parse(row.progress_json),
      createdAt: row.created_at,
      completedAt: row.completed_at,
    };
  },

  listAll(limit = 50): JobRecord[] {
    const db = getDatabase();
    const rows: any[] = db.prepare('SELECT * FROM jobs ORDER BY created_at DESC LIMIT ?').all(limit);
    return rows.map((row) => ({
      id: row.id,
      type: row.type,
      status: row.status,
      title: row.title,
      sourceUrl: row.source_url,
      thumbnail: row.thumbnail,
      duration: row.duration,
      channel: row.channel,
      bitrate: row.bitrate,
      outputPath: row.output_path,
      originalPath: row.original_path,
      error: row.error,
      progress: JSON.parse(row.progress_json),
      createdAt: row.created_at,
      completedAt: row.completed_at,
    }));
  },

  delete(id: string): void {
    const db = getDatabase();
    db.prepare('DELETE FROM jobs WHERE id = ?').run(id);
  },
};

export const libraryRepo = {
  create(item: LibraryItem): void {
    const db = getDatabase();
    db.prepare(`
      INSERT INTO library (
        id, job_id, title, artist, album, duration, file_size,
        bitrate, file_path, thumbnail_path, source_url, is_edited,
        parent_item_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      item.id,
      item.jobId || null,
      item.title,
      item.artist || null,
      item.album || null,
      item.duration,
      item.fileSize,
      item.bitrate,
      item.filePath,
      item.thumbnailPath || null,
      item.sourceUrl || null,
      item.isEdited ? 1 : 0,
      item.parentItemId || null,
      item.createdAt,
      item.updatedAt
    );
  },

  getById(id: string): LibraryItem | null {
    const db = getDatabase();
    const row: any = db.prepare('SELECT * FROM library WHERE id = ? OR job_id = ?').get(id, id);
    if (!row) return null;

    return {
      id: row.id,
      jobId: row.job_id,
      title: row.title,
      artist: row.artist,
      album: row.album,
      duration: row.duration,
      fileSize: row.file_size,
      bitrate: row.bitrate,
      filePath: row.file_path,
      thumbnailPath: row.thumbnail_path,
      sourceUrl: row.source_url,
      isEdited: Boolean(row.is_edited),
      parentItemId: row.parent_item_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  },

  listAll(): LibraryItem[] {
    const db = getDatabase();
    const rows: any[] = db.prepare('SELECT * FROM library ORDER BY created_at DESC').all();
    return rows.map((row) => ({
      id: row.id,
      jobId: row.job_id,
      title: row.title,
      artist: row.artist,
      album: row.album,
      duration: row.duration,
      fileSize: row.file_size,
      bitrate: row.bitrate,
      filePath: row.file_path,
      thumbnailPath: row.thumbnail_path,
      sourceUrl: row.source_url,
      isEdited: Boolean(row.is_edited),
      parentItemId: row.parent_item_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  },

  updateTags(id: string, tags: { title?: string; artist?: string; album?: string }): void {
    const db = getDatabase();
    db.prepare(`
      UPDATE library
      SET title = COALESCE(?, title),
          artist = COALESCE(?, artist),
          album = COALESCE(?, album),
          updated_at = ?
      WHERE id = ?
    `).run(tags.title || null, tags.artist || null, tags.album || null, Date.now(), id);
  },

  delete(id: string): void {
    const db = getDatabase();
    db.prepare('DELETE FROM library WHERE id = ?').run(id);
  },
};
