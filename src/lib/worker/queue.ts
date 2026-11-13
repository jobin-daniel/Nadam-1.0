import EventEmitter from 'node:events';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { JobRecord, JobStatus, JobProgress, SpeedSettings, AudioEnhancements } from '../types/job';
import { jobRepo, libraryRepo } from '../db/repository';
import { downloadMedia, fetchUrlMetadata } from './downloader';
import { convertToMp3, getMediaDuration } from './converter';
import { sanitizeFilename, ensureStorageSubdirs } from '../security/sanitizer';

type JobEventListener = (job: JobRecord) => void;

interface ActiveJobContext {
  job: JobRecord;
  abortController: AbortController;
}

class JobQueueEngine extends EventEmitter {
  private activeJobs = new Map<string, ActiveJobContext>();
  private pendingQueue: string[] = [];
  private maxConcurrent = parseInt(process.env.MAX_CONCURRENT_JOBS || '3', 10);
  private storageDir = path.resolve(process.env.STORAGE_DIR || './storage');

  constructor() {
    super();
    this.setMaxListeners(100);
    ensureStorageSubdirs(this.storageDir);
  }

  public getJob(id: string): JobRecord | null {
    const active = this.activeJobs.get(id);
    if (active) return active.job;
    return jobRepo.getById(id);
  }

  public listJobs(): JobRecord[] {
    return jobRepo.listAll();
  }

  public subscribe(jobId: string, listener: JobEventListener): () => void {
    const eventName = `job:${jobId}`;
    this.on(eventName, listener);
    return () => this.off(eventName, listener);
  }

  private broadcast(job: JobRecord) {
    this.emit(`job:${job.id}`, job);
    this.emit('job:update', job);
  }

  public async enqueueDownloadJob(params: {
    url: string;
    bitrate?: '128k' | '192k' | '256k' | '320k' | 'V0';
    tags?: { title?: string; artist?: string; album?: string };
    customTitle?: string;
    batchId?: string;
    speedSettings?: SpeedSettings;
    audioEnhancements?: AudioEnhancements;
    skipInitialMetadata?: boolean;
    appendSpeedTag?: boolean;
  }): Promise<JobRecord> {
    const id = `job_${crypto.randomUUID().slice(0, 10)}`;
    const bitrate = params.bitrate || '320k';

    // Initial metadata fetch if possible and not explicitly skipped
    let metaTitle = params.customTitle || (params.skipInitialMetadata ? 'Queued track...' : 'Preparing Audio Download');
    let thumbnail: string | undefined;
    let duration = 0;
    let channel: string | undefined;

    if (!params.skipInitialMetadata) {
      try {
        const meta = await fetchUrlMetadata(params.url);
        metaTitle = params.customTitle || meta.title;
        thumbnail = meta.thumbnail;
        duration = meta.duration;
        channel = meta.channel;
      } catch {
        // Will attempt directly during download
      }
    }

    if (
      params.appendSpeedTag !== false &&
      params.speedSettings &&
      params.speedSettings.speed !== 1.0 &&
      metaTitle &&
      metaTitle !== 'Queued track...' &&
      !metaTitle.includes(`[${params.speedSettings.speed}x]`)
    ) {
      metaTitle = `${metaTitle} [${params.speedSettings.speed}x]`;
    }

    const job: JobRecord = {
      id,
      type: 'download',
      status: 'queued',
      progress: {
        percent: 0,
        stage: 'initializing',
        message: 'Queued for processing',
      },
      sourceUrl: params.url,
      title: metaTitle,
      thumbnail,
      duration,
      channel: channel || params.tags?.artist,
      bitrate,
      batchId: params.batchId,
      speedSettings: params.speedSettings,
      audioEnhancements: params.audioEnhancements,
      createdAt: Date.now(),
    };

    jobRepo.create(job);
    this.broadcast(job);

    this.pendingQueue.push(id);
    this.processNext();

    return job;
  }

  public async enqueueUploadJob(params: {
    originalFilePath: string;
    originalFileName: string;
    bitrate?: '128k' | '192k' | '256k' | '320k' | 'V0';
    tags?: { title?: string; artist?: string; album?: string };
  }): Promise<JobRecord> {
    const id = `job_${crypto.randomUUID().slice(0, 10)}`;
    const bitrate = params.bitrate || '320k';
    const cleanTitle = params.tags?.title || params.originalFileName.replace(/\.[^/.]+$/, '');

    let duration = 0;
    try {
      duration = await getMediaDuration(params.originalFilePath);
    } catch {}

    const job: JobRecord = {
      id,
      type: 'upload',
      status: 'queued',
      progress: {
        percent: 0,
        stage: 'initializing',
        message: 'Queued for audio extraction',
      },
      originalPath: params.originalFilePath,
      title: cleanTitle,
      duration,
      channel: params.tags?.artist || 'Local Upload',
      bitrate,
      createdAt: Date.now(),
    };

    jobRepo.create(job);
    this.broadcast(job);

    this.pendingQueue.push(id);
    this.processNext();

    return job;
  }

  public cancelJob(id: string): boolean {
    const active = this.activeJobs.get(id);
    if (active) {
      active.abortController.abort();
      active.job.status = 'canceled';
      active.job.progress = {
        percent: 0,
        stage: 'completed',
        message: 'Job was canceled by user',
      };
      jobRepo.updateStatus(id, 'canceled', active.job.progress);
      this.broadcast(active.job);
      this.activeJobs.delete(id);
      this.processNext();
      return true;
    }

    const pendingIndex = this.pendingQueue.indexOf(id);
    if (pendingIndex !== -1) {
      this.pendingQueue.splice(pendingIndex, 1);
      const job = jobRepo.getById(id);
      if (job) {
        job.status = 'canceled';
        job.progress = {
          percent: 0,
          stage: 'completed',
          message: 'Job canceled before start',
        };
        jobRepo.updateStatus(id, 'canceled', job.progress);
        this.broadcast(job);
      }
      return true;
    }

    return false;
  }

  public cancelBatch(batchId: string): number {
    let count = 0;
    // 1. Cancel active jobs
    for (const [id, ctx] of Array.from(this.activeJobs.entries())) {
      if (ctx.job.batchId === batchId) {
        if (this.cancelJob(id)) count++;
      }
    }
    // 2. Cancel pending jobs
    for (const id of [...this.pendingQueue]) {
      const job = jobRepo.getById(id);
      if (job?.batchId === batchId) {
        if (this.cancelJob(id)) count++;
      }
    }
    return count;
  }

  public listJobsByBatch(batchId: string): JobRecord[] {
    return jobRepo.listByBatch(batchId);
  }

  public removeJob(
    id: string,
    options: { keepDownloads?: boolean; keepRenders?: boolean } = {}
  ): boolean {
    // 1. Cancel if running or pending
    this.cancelJob(id);

    const job = jobRepo.getById(id);
    const storageDir = this.storageDir;
    const db = require('../db').getDatabase();

    // 2. Identify associated library records
    const libRows: any[] = db.prepare('SELECT * FROM library WHERE job_id = ? OR id = ?').all(id, id);

    // 3. Delete files in download folder if not keepDownloads
    if (!options.keepDownloads) {
      if (job?.outputPath && fs.existsSync(job.outputPath)) {
        try { fs.unlinkSync(job.outputPath); } catch {}
      }
      if (job?.originalPath && fs.existsSync(job.originalPath)) {
        try { fs.unlinkSync(job.originalPath); } catch {}
      }

      const downloadsDir = path.join(storageDir, 'downloads');
      if (fs.existsSync(downloadsDir)) {
        try {
          const files = fs.readdirSync(downloadsDir);
          for (const f of files) {
            if (f.startsWith(`${id}_`)) {
              try { fs.unlinkSync(path.join(downloadsDir, f)); } catch {}
            }
          }
        } catch {}
      }

      const thumbFile = path.join(storageDir, 'thumbnails', `${id}.jpg`);
      if (fs.existsSync(thumbFile)) {
        try { fs.unlinkSync(thumbFile); } catch {}
      }

      // Clean library records associated with download
      for (const row of libRows) {
        libraryRepo.delete(row.id);
      }
    }

    // 4. Delete files in render folder if not keepRenders
    if (!options.keepRenders) {
      const parentIds = [id, ...libRows.map((r) => r.id)];
      const placeholders = parentIds.map(() => '?').join(',');
      const renderRows: any[] = db.prepare(
        `SELECT * FROM library WHERE parent_item_id IN (${placeholders})`
      ).all(...parentIds);

      for (const rRow of renderRows) {
        if (rRow.file_path && fs.existsSync(rRow.file_path)) {
          try { fs.unlinkSync(rRow.file_path); } catch {}
        }
        libraryRepo.delete(rRow.id);
      }

      const rendersDir = path.join(storageDir, 'renders');
      if (fs.existsSync(rendersDir)) {
        try {
          const files = fs.readdirSync(rendersDir);
          for (const f of files) {
            if (parentIds.some((pid) => f.includes(pid))) {
              try { fs.unlinkSync(path.join(rendersDir, f)); } catch {}
            }
          }
        } catch {}
      }
    }

    // 5. Delete job record from database
    jobRepo.delete(id);

    // 6. Broadcast removal
    this.emit(`job:${id}`, { id, status: 'deleted' });
    this.emit('job:update', { id, status: 'deleted' });

    return true;
  }

  public retryJob(id: string): JobRecord | null {
    const existing = jobRepo.getById(id);
    if (!existing || (existing.status !== 'failed' && existing.status !== 'canceled')) {
      return null;
    }

    existing.status = 'queued';
    existing.error = undefined;
    existing.progress = {
      percent: 0,
      stage: 'initializing',
      message: 'Job re-queued',
    };
    jobRepo.updateStatus(id, 'queued', existing.progress);
    this.broadcast(existing);

    this.pendingQueue.push(id);
    this.processNext();
    return existing;
  }

  private async processNext() {
    if (this.activeJobs.size >= this.maxConcurrent) {
      return;
    }

    const nextId = this.pendingQueue.shift();
    if (!nextId) return;

    const job = jobRepo.getById(nextId);
    if (!job || job.status === 'canceled') {
      this.processNext();
      return;
    }

    const abortController = new AbortController();
    this.activeJobs.set(nextId, { job, abortController });

    this.executeJob(job, abortController.signal).finally(() => {
      this.activeJobs.delete(nextId);
      this.processNext();
    });
  }

  private async executeJob(job: JobRecord, abortSignal: AbortSignal) {
    try {
      if (job.type === 'download' && job.sourceUrl) {
        await this.runDownloadJob(job, abortSignal);
      } else if (job.type === 'upload' && job.originalPath) {
        await this.runUploadJob(job, abortSignal);
      }
    } catch (err: any) {
      if (abortSignal.aborted) {
        return;
      }
      job.status = 'failed';
      job.error = err.message || 'Unknown processing error';
      job.progress = {
        percent: 0,
        stage: 'completed',
        message: job.error,
      };
      jobRepo.updateStatus(job.id, 'failed', job.progress, job.error);
      this.broadcast(job);
    }
  }

  private async runDownloadJob(job: JobRecord, abortSignal: AbortSignal) {
    // If metadata was deferred during batch enqueue, fetch it now
    if (job.sourceUrl && (!job.duration || job.title === 'Queued track...' || job.title === 'Preparing Audio Download')) {
      try {
        const meta = await fetchUrlMetadata(job.sourceUrl);
        if (meta.title && (job.title === 'Queued track...' || job.title === 'Preparing Audio Download')) {
          let cleanTitle = meta.title;
          if (
            job.speedSettings &&
            job.speedSettings.speed !== 1.0 &&
            !cleanTitle.includes(`[${job.speedSettings.speed}x]`)
          ) {
            cleanTitle = `${cleanTitle} [${job.speedSettings.speed}x]`;
          }
          job.title = cleanTitle;
        }
        if (meta.thumbnail && !job.thumbnail) job.thumbnail = meta.thumbnail;
        if (meta.duration && !job.duration) job.duration = meta.duration;
        if (meta.channel && !job.channel) job.channel = meta.channel;
        jobRepo.updateStatus(job.id, job.status, job.progress);
        this.broadcast(job);
      } catch {
        // Fall back to defaults
      }
    }

    const safeBase = sanitizeFilename(job.title.replace(/\.mp3$/i, ''), 'audio');
    const rawDownloadPath = path.join(this.storageDir, 'temp', `${job.id}_raw`);
    const finalMp3Path = path.join(this.storageDir, 'downloads', `${job.id}_${safeBase}.mp3`);

    // Stage 1: Download
    job.status = 'downloading';
    job.progress = {
      percent: 0,
      stage: 'downloading',
      message: 'Starting audio download...',
    };
    jobRepo.updateStatus(job.id, 'downloading', job.progress);
    this.broadcast(job);

    await downloadMedia(
      job.sourceUrl!,
      rawDownloadPath,
      (info) => {
        job.progress = {
          percent: Math.round(info.percent),
          stage: 'downloading',
          speed: info.speed,
          eta: info.eta,
          message: `Downloading: ${info.percent.toFixed(1)}% (${info.speed || ''})`,
        };
        jobRepo.updateStatus(job.id, 'downloading', job.progress);
        this.broadcast(job);
      },
      abortSignal
    );

    // Stage 2: Convert to MP3
    job.status = 'converting';
    const speedMsg = job.speedSettings && job.speedSettings.speed !== 1.0
      ? `Converting to MP3 (${job.bitrate}) @ ${job.speedSettings.speed}x speed...`
      : `Converting to MP3 (${job.bitrate})...`;

    job.progress = {
      percent: 0,
      stage: 'converting',
      message: speedMsg,
    };
    jobRepo.updateStatus(job.id, 'converting', job.progress);
    this.broadcast(job);

    // Download thumbnail if available for cover art
    let localThumbPath: string | undefined;
    if (job.thumbnail && job.thumbnail.startsWith('http')) {
      try {
        const thumbDest = path.join(this.storageDir, 'thumbnails', `${job.id}.jpg`);
        const res = await fetch(job.thumbnail);
        if (res.ok) {
          const buffer = await res.arrayBuffer();
          fs.writeFileSync(thumbDest, Buffer.from(buffer));
          localThumbPath = thumbDest;
        }
      } catch {
        // Thumbnail download failed; proceed without cover art
      }
    }

    await convertToMp3({
      inputPath: rawDownloadPath,
      outputPath: finalMp3Path,
      bitrate: job.bitrate as any,
      sampleRate: 44100,
      tags: {
        title: job.title,
        artist: job.channel,
        album: job.speedSettings && job.speedSettings.speed !== 1.0 ? 'Speed Mastered' : undefined,
      },
      thumbnailPath: localThumbPath,
      totalDurationSeconds: job.duration,
      speedSettings: job.speedSettings,
      audioEnhancements: job.audioEnhancements,
      onProgress: (pct) => {
        job.progress = {
          percent: pct,
          stage: 'converting',
          message: job.speedSettings && job.speedSettings.speed !== 1.0
            ? `Encoding MP3 (${job.speedSettings.speed}x): ${pct}%`
            : `Encoding MP3: ${pct}%`,
        };
        jobRepo.updateStatus(job.id, 'converting', job.progress);
        this.broadcast(job);
      },
      abortSignal,
    });

    // Cleanup raw download temp file
    try {
      if (fs.existsSync(rawDownloadPath)) {
        fs.unlinkSync(rawDownloadPath);
      }
    } catch {}

    // Inspect final file size & duration
    const stats = fs.statSync(finalMp3Path);
    const finalDuration = (await getMediaDuration(finalMp3Path)) || job.duration || 0;

    // Stage 3: Completed & Save to Library
    job.status = 'completed';
    job.outputPath = finalMp3Path;
    job.originalPath = finalMp3Path;
    job.duration = finalDuration;
    jobRepo.updateCompleted(job.id, finalMp3Path, finalMp3Path);
    this.broadcast(job);

    // Add to library
    libraryRepo.create({
      id: `lib_${crypto.randomUUID().slice(0, 10)}`,
      jobId: job.id,
      title: job.title,
      artist: job.channel,
      album: job.speedSettings && job.speedSettings.speed !== 1.0 ? 'Speed Mastered' : undefined,
      duration: Math.round(finalDuration),
      fileSize: stats.size,
      bitrate: job.bitrate,
      filePath: finalMp3Path,
      thumbnailPath: localThumbPath,
      sourceUrl: job.sourceUrl,
      isEdited: Boolean(job.speedSettings && job.speedSettings.speed !== 1.0),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  }

  private async runUploadJob(job: JobRecord, abortSignal: AbortSignal) {
    const safeBase = sanitizeFilename(job.title.replace(/\.mp3$/i, ''), 'audio');
    const finalMp3Path = path.join(this.storageDir, 'downloads', `${job.id}_${safeBase}.mp3`);

    job.status = 'converting';
    job.progress = {
      percent: 0,
      stage: 'converting',
      message: `Extracting & converting audio to MP3 (${job.bitrate})...`,
    };
    jobRepo.updateStatus(job.id, 'converting', job.progress);
    this.broadcast(job);

    await convertToMp3({
      inputPath: job.originalPath!,
      outputPath: finalMp3Path,
      bitrate: job.bitrate as any,
      sampleRate: 44100,
      tags: {
        title: job.title,
        artist: job.channel,
      },
      totalDurationSeconds: job.duration,
      onProgress: (pct) => {
        job.progress = {
          percent: pct,
          stage: 'converting',
          message: `Converting to MP3: ${pct}%`,
        };
        jobRepo.updateStatus(job.id, 'converting', job.progress);
        this.broadcast(job);
      },
      abortSignal,
    });

    const stats = fs.statSync(finalMp3Path);
    const finalDuration = (await getMediaDuration(finalMp3Path)) || job.duration || 0;

    job.status = 'completed';
    job.outputPath = finalMp3Path;
    job.duration = finalDuration;
    jobRepo.updateCompleted(job.id, finalMp3Path, job.originalPath);
    this.broadcast(job);

    libraryRepo.create({
      id: `lib_${crypto.randomUUID().slice(0, 10)}`,
      jobId: job.id,
      title: job.title,
      artist: job.channel,
      duration: Math.round(finalDuration),
      fileSize: stats.size,
      bitrate: job.bitrate,
      filePath: finalMp3Path,
      isEdited: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  }
}

// Global singleton for Next.js dev & prod execution
declare global {
  // eslint-disable-next-line no-var
  var __jobQueueEngine: JobQueueEngine | undefined;
}

export const jobQueue = globalThis.__jobQueueEngine || new JobQueueEngine();
if (process.env.NODE_ENV !== 'production') {
  globalThis.__jobQueueEngine = jobQueue;
}
