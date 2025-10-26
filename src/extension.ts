import * as vscode from 'vscode';
import * as https from 'https';

function postJSON(url: string, payload: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const data = Buffer.from(JSON.stringify(payload));
    const u = new URL(url);
    const opts: https.RequestOptions = {
      method: 'POST',
      hostname: u.hostname,
      port: u.port || (u.protocol === 'https:' ? 443 : 80),
      path: u.pathname + (u.search || ''),
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length,
      },
    };
    const req = https.request(opts, (res) => {
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

    // For MVP: fixed problem and runtime detection heuristics
    const problemId = 'runtime-server-hello';
    const language = editor.document.languageId; // 'javascript' | 'typescript' etc.

    const pick = await vscode.window.showQuickPick([
      { label: 'Node.js', value: 'node' },
      { label: 'Deno', value: 'deno' },
      { label: 'Bun', value: 'bun' },
    ], { placeHolder: 'Select runtime to evaluate against' });

    if (!pick) { return; }

    const runtime = pick.value;

    // Backend URL (configure later via settings). For now, localhost:8080
    const apiBase = vscode.workspace.getConfiguration('devskill').get<string>('apiBase') || 'https://devskill-backend-go.fly.dev';
    const url = `${apiBase}/api/v1/submissions`;

    const payload = { problemId, language, runtime, code };

    vscode.window.setStatusBarMessage('DevSkill: Submitting...', 2000);
    try {
      const res = await postJSON(url, payload);
      vscode.window.showInformationMessage(`DevSkill: ${res.status || res.statusCode} | score=${res.score ?? '-'} | notes=${res.notes ?? ''}`);
    } catch (e: any) {
      vscode.window.showErrorMessage(`DevSkill submit failed: ${e?.message || e}`);
    }
  });

  context.subscriptions.push(hello, submit);
}

export function deactivate() {}
