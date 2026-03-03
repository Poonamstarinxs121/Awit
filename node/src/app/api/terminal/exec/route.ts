import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import path from 'path';
import os from 'os';
import { NODE_CONFIG } from '@/config/node';

const TIMEOUT_MS = 30000;

function isPathAllowed(resolvedPath: string): boolean {
  const openclawDir = path.resolve(NODE_CONFIG.openclawDir);
  const homeDir = path.resolve(os.homedir());
  return resolvedPath.startsWith(openclawDir) || resolvedPath.startsWith(homeDir);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { command, cwd } = body as { command?: string; cwd?: string };

    if (!command || typeof command !== 'string' || command.trim() === '') {
      return NextResponse.json(
        { error: 'command is required' },
        { status: 400 }
      );
    }

    let workingDir = path.resolve(NODE_CONFIG.openclawDir);

    if (cwd && typeof cwd === 'string') {
      workingDir = path.resolve(cwd);
      if (!isPathAllowed(workingDir)) {
        return NextResponse.json(
          { error: 'cwd must be within OPENCLAW_DIR or home directory' },
          { status: 403 }
        );
      }
    }

    const startTime = Date.now();

    const result = await new Promise<{ stdout: string; stderr: string; exitCode: number }>((resolve) => {
      exec(
        command,
        {
          cwd: workingDir,
          timeout: TIMEOUT_MS,
          maxBuffer: 1024 * 1024,
          env: { ...process.env, HOME: os.homedir() },
        },
        (error, stdout, stderr) => {
          const exitCode = error ? (error as any).code ?? 1 : 0;
          resolve({
            stdout: stdout ?? '',
            stderr: stderr ?? '',
            exitCode: typeof exitCode === 'number' ? exitCode : 1,
          });
        }
      );
    });

    const duration_ms = Date.now() - startTime;

    return NextResponse.json({
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
      duration_ms,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
