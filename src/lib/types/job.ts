export type JobType = 'download' | 'upload' | 'render';
export type JobStatus = 'queued' | 'downloading' | 'converting' | 'completed' | 'failed' | 'canceled';

export interface SpeedSettings {
  speed: number;
  preservePitch: boolean;
  pitchSemitones?: number;
}

export interface AudioEnhancements {
  normalize?: boolean;
  voiceEnhance?: boolean;
}

export interface JobProgress {
  percent: number;
  stage: 'initializing' | 'downloading' | 'converting' | 'rendering' | 'tagging' | 'completed';
  speed?: string;
  eta?: string;
  downloadedBytes?: number;
  totalBytes?: number;
  message?: string;
}

export interface JobRecord {
  id: string;
  type: JobType;
  status: JobStatus;
  progress: JobProgress;
  sourceUrl?: string;
  title: string;
  thumbnail?: string;
  duration?: number;
  channel?: string;
  bitrate: string;
  outputPath?: string;
  originalPath?: string;
  error?: string;
  createdAt: number;
  completedAt?: number;
  batchId?: string;
  speedSettings?: SpeedSettings;
  audioEnhancements?: AudioEnhancements;
}

export interface VideoMetadata {
  id: string;
  url: string;
  title: string;
  thumbnail?: string;
  duration: number; // in seconds
  channel?: string;
  description?: string;
  isPlaylist?: boolean;
  playlistItems?: PlaylistItem[];
}

export interface PlaylistItem {
  index: number;
  id: string;
  url: string;
  title: string;
  duration: number;
  thumbnail?: string;
  channel?: string;
}

export interface CreateJobInput {
  url?: string;
  bitrate?: '128k' | '192k' | '256k' | '320k' | 'V0';
  title?: string;
  artist?: string;
  album?: string;
  selectedIndices?: number[];
}

export interface BulkJobInput {
  urls: string[];
  speedSettings?: SpeedSettings;
  audioEnhancements?: AudioEnhancements;
  bitrate?: '128k' | '192k' | '256k' | '320k' | 'V0';
  appendSpeedTag?: boolean;
  album?: string;
  customArtist?: string;
  expandPlaylists?: boolean;
}
