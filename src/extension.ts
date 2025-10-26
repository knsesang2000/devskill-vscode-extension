import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand('devskill.helloWorld', async () => {
    vscode.window.showInformationMessage('DevSkill Evaluator: Hello from MVP extension!');
  });
  context.subscriptions.push(disposable);
}

export function deactivate() {}
