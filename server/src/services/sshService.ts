import crypto from 'crypto';
import { Client } from 'ssh2';
import { pool } from '../db/index.js';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'squidjob-dev-encryption-key-32b!';
const ALGORITHM = 'aes-256-cbc';

function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const key = Buffer.from(ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32));
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function decrypt(encryptedText: string): string {
  const [ivHex, encrypted] = encryptedText.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const key = Buffer.from(ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32));
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

export interface MachineRow {
  id: string;
  tenant_id: string;
  name: string;
  host: string;
  ssh_port: number;
  ssh_user: string;
  ssh_auth_type: 'key' | 'password';
  ssh_credential_encrypted: string;
  group_id: string | null;
  group_name: string | null;
  status: string;
  last_ping: string | null;
  description: string | null;
  created_at: string;
}

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  error?: string;
}

export async function executeRemoteCommand(machine: MachineRow, command: string): Promise<ExecResult> {
  const credential = decrypt(machine.ssh_credential_encrypted);
  return new Promise((resolve) => {
    const conn = new Client();
    let stdout = '';
    let stderr = '';

    const timeout = setTimeout(() => {
      conn.end();
      resolve({ stdout: '', stderr: 'Command timed out after 30 seconds', exitCode: 1, error: 'timeout' });
    }, 30000);

    conn.on('ready', () => {
      conn.exec(command, (err, stream) => {
        if (err) {
          clearTimeout(timeout);
          conn.end();
          resolve({ stdout: '', stderr: err.message, exitCode: 1, error: err.message });
          return;
        }
        stream
          .on('close', (code: number) => {
            clearTimeout(timeout);
            conn.end();
            resolve({ stdout: stdout.trim(), stderr: stderr.trim(), exitCode: code ?? 0 });
          })
          .on('data', (data: Buffer) => { stdout += data.toString(); })
          .stderr.on('data', (data: Buffer) => { stderr += data.toString(); });
      });
    }).on('error', (err) => {
      clearTimeout(timeout);
      resolve({ stdout: '', stderr: err.message, exitCode: 1, error: err.message });
    }).connect({
      host: machine.host,
      port: machine.ssh_port || 22,
      username: machine.ssh_user,
      ...(machine.ssh_auth_type === 'key'
        ? { privateKey: credential }
        : { password: credential }),
      readyTimeout: 10000,
    });
  });
}

export async function pingMachine(machine: MachineRow): Promise<{ online: boolean; latencyMs: number; error?: string }> {
  const start = Date.now();
  const result = await executeRemoteCommand(machine, 'echo ping');
  const latencyMs = Date.now() - start;
  return {
    online: result.exitCode === 0 && !result.error,
    latencyMs,
    error: result.error,
  };
}

export async function getMachines(tenantId: string): Promise<MachineRow[]> {
  const result = await pool.query(
    `SELECT m.*, mg.name as group_name
     FROM machines m
     LEFT JOIN machine_groups mg ON m.group_id = mg.id
     WHERE m.tenant_id = $1
     ORDER BY m.created_at ASC`,
    [tenantId]
  );
  return result.rows;
}

export async function getMachineById(tenantId: string, machineId: string): Promise<MachineRow | null> {
  const result = await pool.query(
    `SELECT m.*, mg.name as group_name
     FROM machines m
     LEFT JOIN machine_groups mg ON m.group_id = mg.id
     WHERE m.id = $1 AND m.tenant_id = $2`,
    [machineId, tenantId]
  );
  return result.rows[0] || null;
}

export async function createMachine(tenantId: string, data: {
  name: string;
  host: string;
  ssh_port?: number;
  ssh_user: string;
  ssh_auth_type: 'key' | 'password';
  ssh_credential: string;
  group_id?: string;
  description?: string;
}): Promise<MachineRow> {
  const encrypted = encrypt(data.ssh_credential);
  const result = await pool.query(
    `INSERT INTO machines (tenant_id, name, host, ssh_port, ssh_user, ssh_auth_type, ssh_credential_encrypted, group_id, description)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      tenantId, data.name, data.host, data.ssh_port || 22,
      data.ssh_user, data.ssh_auth_type, encrypted,
      data.group_id || null, data.description || null,
    ]
  );
  return { ...result.rows[0], group_name: null };
}

export async function updateMachine(tenantId: string, machineId: string, data: {
  name?: string;
  host?: string;
  ssh_port?: number;
  ssh_user?: string;
  ssh_auth_type?: 'key' | 'password';
  ssh_credential?: string;
  group_id?: string | null;
  description?: string;
}): Promise<MachineRow | null> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (data.name !== undefined) { fields.push(`name = $${idx++}`); values.push(data.name); }
  if (data.host !== undefined) { fields.push(`host = $${idx++}`); values.push(data.host); }
  if (data.ssh_port !== undefined) { fields.push(`ssh_port = $${idx++}`); values.push(data.ssh_port); }
  if (data.ssh_user !== undefined) { fields.push(`ssh_user = $${idx++}`); values.push(data.ssh_user); }
  if (data.ssh_auth_type !== undefined) { fields.push(`ssh_auth_type = $${idx++}`); values.push(data.ssh_auth_type); }
  if (data.ssh_credential !== undefined) { fields.push(`ssh_credential_encrypted = $${idx++}`); values.push(encrypt(data.ssh_credential)); }
  if ('group_id' in data) { fields.push(`group_id = $${idx++}`); values.push(data.group_id || null); }
  if (data.description !== undefined) { fields.push(`description = $${idx++}`); values.push(data.description); }

  if (fields.length === 0) return getMachineById(tenantId, machineId);

  values.push(machineId, tenantId);
  const result = await pool.query(
    `UPDATE machines SET ${fields.join(', ')} WHERE id = $${idx++} AND tenant_id = $${idx} RETURNING *`,
    values
  );
  if (!result.rows[0]) return null;
  return { ...result.rows[0], group_name: null };
}

export async function deleteMachine(tenantId: string, machineId: string): Promise<boolean> {
  const result = await pool.query(
    `DELETE FROM machines WHERE id = $1 AND tenant_id = $2 RETURNING id`,
    [machineId, tenantId]
  );
  return result.rows.length > 0;
}

export async function updateMachineStatus(machineId: string, status: string): Promise<void> {
  await pool.query(
    `UPDATE machines SET status = $1, last_ping = NOW() WHERE id = $2`,
    [status, machineId]
  );
}

export async function getMachineGroups(tenantId: string) {
  const result = await pool.query(
    `SELECT mg.*, COUNT(m.id)::int as machine_count
     FROM machine_groups mg
     LEFT JOIN machines m ON m.group_id = mg.id
     WHERE mg.tenant_id = $1
     GROUP BY mg.id
     ORDER BY mg.created_at ASC`,
    [tenantId]
  );
  return result.rows;
}

export async function createMachineGroup(tenantId: string, name: string, description?: string) {
  const result = await pool.query(
    `INSERT INTO machine_groups (tenant_id, name, description) VALUES ($1, $2, $3) RETURNING *`,
    [tenantId, name, description || null]
  );
  return result.rows[0];
}

export async function updateMachineGroup(tenantId: string, groupId: string, data: { name?: string; description?: string }) {
  const fields: string[] = [];
  const values: unknown[] = [];
  let idx = 1;
  if (data.name !== undefined) { fields.push(`name = $${idx++}`); values.push(data.name); }
  if (data.description !== undefined) { fields.push(`description = $${idx++}`); values.push(data.description); }
  if (fields.length === 0) return null;
  values.push(groupId, tenantId);
  const result = await pool.query(
    `UPDATE machine_groups SET ${fields.join(', ')} WHERE id = $${idx++} AND tenant_id = $${idx} RETURNING *`,
    values
  );
  return result.rows[0] || null;
}

export async function deleteMachineGroup(tenantId: string, groupId: string): Promise<boolean> {
  await pool.query(`UPDATE machines SET group_id = NULL WHERE group_id = $1 AND tenant_id = $2`, [groupId, tenantId]);
  const result = await pool.query(
    `DELETE FROM machine_groups WHERE id = $1 AND tenant_id = $2 RETURNING id`,
    [groupId, tenantId]
  );
  return result.rows.length > 0;
}

export async function getMachinesInGroup(tenantId: string, groupId: string): Promise<MachineRow[]> {
  const result = await pool.query(
    `SELECT m.*, mg.name as group_name
     FROM machines m
     LEFT JOIN machine_groups mg ON m.group_id = mg.id
     WHERE m.tenant_id = $1 AND m.group_id = $2`,
    [tenantId, groupId]
  );
  return result.rows;
}
