export interface LibraryItem {
  id: string;
  jobId?: string;
  title: string;
  artist?: string;
  album?: string;
  duration: number; // in seconds
  fileSize: number; // in bytes
  bitrate: string;
  filePath: string;
  thumbnailPath?: string;
  sourceUrl?: string;
  isEdited: boolean;
  parentItemId?: string;
  createdAt: number;
  updatedAt: number;
}
