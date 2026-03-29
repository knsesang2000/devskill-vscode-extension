import * as vscode from 'vscode';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as cp from 'child_process';
import * as http from 'http';

function execAsync(cmd: string, args: string[], options: cp.SpawnOptions = {}): Promise<{ stdout: string; stderr: string; code: number }>{
  return new Promise((resolve, reject) => {
    const child = cp.spawn(cmd, args, { ...options, shell: false });
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', d => stdout += d.toString());
    child.stderr?.on('data', d => stderr += d.toString());
    child.on('error', reject);
    child.on('close', (code) => resolve({ stdout, stderr, code: code ?? 0 }));
  });
}

async function ensureDockerCli(): Promise<'docker' | 'podman'> {
  for (const bin of ['docker', 'podman']) {
    try {
      const { code } = await execAsync(bin, ['--version']);
      if (code === 0) return bin as any;
    } catch {}
  }
  throw new Error('Docker or Podman CLI not found. Install Docker Desktop (Win/Mac) or Docker/Podman (Linux).');
}

function pickRandomPort(): number {
  const base = 3000 + Math.floor(Math.random() * 5000);
  return base;
}

function httpGet(url: string, timeoutMs = 3000): Promise<{ status: number; body: string }>{
  return new Promise((resolve, reject) => {
    const req = http.get(url, res => {
      const chunks: Buffer[] = [];
      res.on('data', d => chunks.push(d));
      res.on('end', () => resolve({ status: res.statusCode || 0, body: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error('timeout'));
    });
  });
}

export async function verifyNodeServerJs(code: string): Promise<{ passed: boolean; info: string }>{
  const runtime = await ensureDockerCli();
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'devskill-'));
  const appPath = path.join(tmp, 'app.js');
  fs.writeFileSync(appPath, code, 'utf8');

  const hostPort = pickRandomPort();
  const image = 'node:20-alpine';
  const name = `devskill_node_${Date.now()}`;

  // Pull image (best-effort)
  await execAsync(runtime, ['pull', image]).catch(() => ({} as any));

  // Run container in detached mode
  const args = ['run', '-d', '--name', name, '-p', `${hostPort}:3000`, '-v', `${tmp}:/app`, '-w', '/app', image, 'node', 'app.js'];
  const run = await execAsync(runtime, args);
  if (run.code !== 0) {
    throw new Error(`Failed to start container: ${run.stderr || run.stdout}`);
  }

  // Wait up to ~10s for server
  let passed = false;
  let attempt = 0;
  while (attempt++ < 10 && !passed) {
    await new Promise(r => setTimeout(r, 1000));
    try {
      const res = await httpGet(`http://127.0.0.1:${hostPort}/health`, 2000);
      if (res.status === 200 && /status\"?\s*:\s*\"?ok\"?/i.test(res.body)) {
        passed = true;
        break;
      }
    } catch {}
  }

  // Cleanup
  await execAsync(runtime, ['rm', '-f', name]).catch(() => ({} as any));

  return { passed, info: passed ? `OK at http://localhost:${hostPort}/health` : 'No valid response from /health within timeout' };
}
