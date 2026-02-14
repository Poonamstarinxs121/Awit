import { pool } from '../db/index.js';
import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';

const STORAGE_DIR = path.resolve(process.cwd(), 'uploads', 'deliverables');

async function ensureStorageDir(tenantId: string): Promise<string> {
  const dir = path.join(STORAGE_DIR, tenantId);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

export async function saveDeliverable(
  tenantId: string,
  taskId: string,
  uploadedBy: string,
  uploaderType: 'agent' | 'user',
  originalFilename: string,
  mimeType: string,
  fileBuffer: Buffer
): Promise<{ id: string; filename: string }> {
  const dir = await ensureStorageDir(tenantId);
  const ext = path.extname(originalFilename);
  const uniqueName = `${crypto.randomUUID()}${ext}`;
  const storagePath = path.join(dir, uniqueName);

  await fs.writeFile(storagePath, fileBuffer);

  const result = await pool.query(
    `INSERT INTO task_deliverables (tenant_id, task_id, uploaded_by, uploader_type, filename, original_filename, mime_type, file_size, storage_path)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id, filename`,
    [tenantId, taskId, uploadedBy, uploaderType, uniqueName, originalFilename, mimeType, fileBuffer.length, storagePath]
  );

  return result.rows[0];
}

export async function getTaskDeliverables(tenantId: string, taskId: string): Promise<any[]> {
  const result = await pool.query(
    `SELECT id, task_id, uploaded_by, uploader_type, original_filename, mime_type, file_size, created_at
     FROM task_deliverables WHERE tenant_id = $1 AND task_id = $2
     ORDER BY created_at DESC`,
    [tenantId, taskId]
  );
  return result.rows;
}

export async function getDeliverableFile(tenantId: string, deliverableId: string): Promise<{ buffer: Buffer; filename: string; mimeType: string } | null> {
  const result = await pool.query(
    `SELECT storage_path, original_filename, mime_type FROM task_deliverables WHERE id = $1 AND tenant_id = $2`,
    [deliverableId, tenantId]
  );
  if (result.rows.length === 0) return null;

  const { storage_path, original_filename, mime_type } = result.rows[0];
  try {
    const buffer = await fs.readFile(storage_path);
    return { buffer, filename: original_filename, mimeType: mime_type };
  } catch {
    return null;
  }
}

export async function deleteDeliverable(tenantId: string, deliverableId: string): Promise<boolean> {
  const result = await pool.query(
    `DELETE FROM task_deliverables WHERE id = $1 AND tenant_id = $2 RETURNING storage_path`,
    [deliverableId, tenantId]
  );
  if (result.rows.length === 0) return false;

  try {
    await fs.unlink(result.rows[0].storage_path);
  } catch { /* file already deleted */ }
  return true;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
