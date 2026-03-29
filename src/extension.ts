import * as vscode from 'vscode';
import * as http from 'http';
import * as https from 'https';
import { verifyNodeServerJs } from './dockerVerify';

function postJSON(url: string, payload: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const data = Buffer.from(JSON.stringify(payload));
    const u = new URL(url);
    const isHttps = u.protocol === 'https:';
    const opts: (http.RequestOptions | https.RequestOptions) = {
      method: 'POST',
      hostname: u.hostname,
      port: u.port || (isHttps ? 443 : 80),
      path: u.pathname + (u.search || ''),
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length,
      },
    };
    const req = (isHttps ? https : http).request(opts as any, (res) => {
      const chunks: any[] = [];
      res.on('data', (d) => chunks.push(d));
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');
        try {
          resolve(JSON.parse(body));
        } catch {
          resolve({ statusCode: res.statusCode, body });
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

export function activate(context: vscode.ExtensionContext) {
  const hello = vscode.commands.registerCommand('devskill.helloWorld', async () => {
    vscode.window.showInformationMessage('DevSkill Evaluator: Hello from MVP extension!');
  });

  const submit = vscode.commands.registerCommand('devskill.submitCurrent', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage('No active editor. Open a JS/TS file for the problem.');
      return;
    }

    const code = editor.document.getText();

    // For MVP: fixed problem and runtime selection
    const problemId = 'runtime-server-hello';
    const language = editor.document.languageId; // 'javascript' | 'typescript' etc.

    const pick = await vscode.window.showQuickPick([
      { label: 'Node.js (local Docker verify)', value: 'node' },
      { label: 'Deno (future)', value: 'deno' },
      { label: 'Bun (future)', value: 'bun' },
    ], { placeHolder: 'Select runtime to evaluate against' });

    if (!pick) { return; }

    const runtime = pick.value;

    // 1) Local verification in Linux container via Docker/Podman (Windows/Mac/Linux 지원)
    //    비용 절약 + 실제 리눅스 환경 재현
    let localPassed: boolean | undefined;
    let localInfo = '';
    if (runtime === 'node') {
      vscode.window.setStatusBarMessage('DevSkill: Running local container verify...', 2000);
      try {
        const { passed, info } = await verifyNodeServerJs(code);
        localPassed = passed;
        localInfo = info;
        vscode.window.showInformationMessage(`Local verify: ${passed ? 'passed' : 'failed'} - ${info}`);
      } catch (e: any) {
        vscode.window.showWarningMessage(`Local verify error: ${e?.message || e}`);
      }
    }

    // 2) 서버 제출(옵션): 현재는 stub 채점
    const apiBase = vscode.workspace.getConfiguration('devskill').get<string>('apiBase') || 'http://localhost:8080';
    const url = `${apiBase.replace(/\/$/, '')}/api/v1/submissions`;

    const payload: any = { problemId, language, runtime, code };
    if (typeof localPassed === 'boolean') {
      payload.localVerify = { passed: localPassed, info: localInfo };
    }

    vscode.window.setStatusBarMessage('DevSkill: Submitting to server...', 2000);
    try {
      const res = await postJSON(url, payload);
      vscode.window.showInformationMessage(`Server result: ${res.status || res.statusCode} | score=${res.score ?? '-'} | notes=${res.notes ?? ''}`);
    } catch (e: any) {
      vscode.window.showErrorMessage(`DevSkill submit failed: ${e?.message || e}`);
    }
  });

  context.subscriptions.push(hello, submit);
}

export function deactivate() {}
