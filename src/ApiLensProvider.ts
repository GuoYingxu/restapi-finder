import * as vscode from "vscode";
import * as ts from "typescript";
import { finder } from "./apiLensUtil";
import DataCenter from "./DataCenter";
/**
 * CodelensProvider
 */
export class ApiLensProvider implements vscode.CodeLensProvider {
  private codeLenses: vscode.CodeLens[] = [];
  private _onDidChangeCodeLenses: vscode.EventEmitter<void> =
    new vscode.EventEmitter<void>();
  public readonly onDidChangeCodeLenses: vscode.Event<void> =
    this._onDidChangeCodeLenses.event;

  constructor() {
    vscode.workspace.onDidChangeConfiguration(_ => {
      this._onDidChangeCodeLenses.fire();
    });
  }

  public provideCodeLenses(
    document: vscode.TextDocument,
    token: vscode.CancellationToken
  ): vscode.CodeLens[] {
    this.codeLenses = [];
    const list = finder(document);
    list.forEach(m => {
      if (m.range) {
        const key = m.rawUrl;
        const api = DataCenter.getServerApi(key);
        if (api) {
          console.log("=====matched");
          m.exist = true;
          m.serverName = api.serverName;
        }
        this.codeLenses.push(m);
      }
    });
    // const range = new vscode.Range(
    //   new vscode.Position(10, 12),
    //   new vscode.Position(10, 11)
    // )
    // const cl = new vscode.CodeLens(range)
    // this.codeLenses.push(cl)
    return this.codeLenses;
  }

  public resolveCodeLens(
    codeLens: vscode.CodeLens,
    token: vscode.CancellationToken
  ) {
    return codeLens;
  }
}
