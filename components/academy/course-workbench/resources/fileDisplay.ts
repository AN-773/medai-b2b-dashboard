import {
  File as FileIcon,
  FileArchive,
  FileAudio,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideo,
  Presentation,
  type LucideIcon,
} from 'lucide-react';
import type { CourseResource } from '@/types/CourseResourceTypes';

/** Extensions treated as recordings (see `rejectionFor` in the panel). */
export const VIDEO_EXTENSIONS = ['mp4', 'mov', 'webm', 'm4v', 'mkv', 'avi'];

export const extensionOf = (fileName: string) =>
  (fileName.split('.').pop() || '').toLowerCase();

export const formatFileSize = (bytes: number) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  const value = bytes / 1024 ** exponent;
  const digits = value >= 10 || exponent === 0 ? 0 : 1;
  return `${value.toFixed(digits)} ${units[exponent]}`;
};

export const formatTimestamp = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
};

const FILE_TYPE_LABELS: Record<string, string> = {
  'application/pdf': 'PDF',
  'application/msword': 'DOC',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
  'application/vnd.ms-powerpoint': 'PPT',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'PPTX',
  'application/vnd.ms-excel': 'XLS',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'XLSX',
  'text/plain': 'TXT',
  'text/csv': 'CSV',
  'text/markdown': 'MD',
};

export const fileTypeLabel = (value: string, fileName: string) => {
  const trimmed = value.split(';')[0].trim();
  const knownLabel = FILE_TYPE_LABELS[trimmed.toLowerCase()];
  if (knownLabel) return knownLabel;
  const extension = /\.([a-z0-9]{1,10})$/i.exec(fileName)?.[1];
  if (extension) return extension.toUpperCase();
  if (!trimmed) return 'File';
  return trimmed.includes('/') ? trimmed.split('/')[1].toUpperCase() : trimmed;
};

export const iconForResource = (resource: CourseResource): LucideIcon => {
  const type = (resource.fileType || '').toLowerCase();
  const ext = extensionOf(resource.fileName);
  const has = (...needles: string[]) =>
    needles.some((needle) => type.includes(needle) || ext === needle);

  if (has('pdf')) return FileText;
  if (type.startsWith('image/') || has('png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'))
    return FileImage;
  if (type.startsWith('video/') || has(...VIDEO_EXTENSIONS)) return FileVideo;
  if (type.startsWith('audio/') || has('mp3', 'wav', 'm4a', 'ogg')) return FileAudio;
  if (has('spreadsheet', 'excel', 'csv', 'xls', 'xlsx')) return FileSpreadsheet;
  if (has('presentation', 'powerpoint', 'ppt', 'pptx')) return Presentation;
  if (has('zip', 'rar', '7z', 'gzip', 'compressed')) return FileArchive;
  if (has('word', 'document', 'doc', 'docx', 'txt', 'rtf')) return FileText;
  return FileIcon;
};
