import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import { ensureStorageSubdirs } from '../security/sanitizer';

let dbInstance: Database.Database | null = null;

export function getDatabase(): Database.Database {
  if (dbInstance) {
    return dbInstance;
  }

  const storageDir = path.resolve(process.env.STORAGE_DIR || './storage');
  ensureStorageSubdirs(storageDir);

  const dbPath = path.resolve(process.env.DATABASE_PATH || path.join(storageDir, 'video2mp3.sqlite'));
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');

  // Initialize tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      status TEXT NOT NULL,
      title TEXT NOT NULL,
      source_url TEXT,
      thumbnail TEXT,
      duration INTEGER,
      channel TEXT,
      bitrate TEXT,
      output_path TEXT,
      original_path TEXT,
      error TEXT,
      progress_json TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      completed_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS library (
      id TEXT PRIMARY KEY,
      job_id TEXT,
      title TEXT NOT NULL,
      artist TEXT,
      album TEXT,
      duration INTEGER NOT NULL DEFAULT 0,
      file_size INTEGER NOT NULL DEFAULT 0,
      bitrate TEXT NOT NULL,
      file_path TEXT NOT NULL,
      thumbnail_path TEXT,
      source_url TEXT,
      is_edited INTEGER NOT NULL DEFAULT 0,
      parent_item_id TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY(parent_item_id) REFERENCES library(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS presets (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL, -- 'eq' or 'voice'
      name TEXT NOT NULL,
      data_json TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
    CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_library_created_at ON library(created_at DESC);
  `);

  dbInstance = db;
  return dbInstance;
}
