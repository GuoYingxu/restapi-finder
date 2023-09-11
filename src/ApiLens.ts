import * as vscode from "vscode"
import * as ts from "typescript"
import { finder } from "./apiLensUtil"
import { getServerApi } from "./DataCenter"

export class ApiLens {
  provider: ApiLensProvider
  constructor(
    context: vscode.ExtensionContext,
    disposibles: vscode.Disposable[]
  ) {
    this.provider = new ApiLensProvider(context, disposibles)

    vscode.languages.registerCodeLensProvider(
      [
        { scheme: "file", language: "typescript" },
        { scheme: "file", language: "javascript" },
      ],
      this.provider
    )

    const disposable = vscode.commands.registerCommand(
      "QstDevToolkit.codelensAction",
      (args: any) => {
        vscode.window.showInformationMessage(
          `CodeLens action clicked with args=${args}`
        )
      }
    )
    context.subscriptions.push(disposable)
    disposibles.push(disposable)
  }
}

/**
 * CodelensProvider
 */
export class ApiLensProvider implements vscode.CodeLensProvider {
  private codeLenses: vscode.CodeLens[] = []
  private _onDidChangeCodeLenses: vscode.EventEmitter<void> =
    new vscode.EventEmitter<void>()
  public readonly onDidChangeCodeLenses: vscode.Event<void> =
    this._onDidChangeCodeLenses.event

  constructor(
    context: vscode.ExtensionContext,
    disposibles: vscode.Disposable[]
  ) {
    const disposable = vscode.workspace.onDidChangeConfiguration(_ => {
      this._onDidChangeCodeLenses.fire()
    })
    context.subscriptions.push(disposable)
    disposibles.push(disposable)
  }

  public provideCodeLenses(
    document: vscode.TextDocument,
    token: vscode.CancellationToken
  ): vscode.CodeLens[] {
    this.codeLenses = []
    const list = finder(document)
    list.forEach(m => {
      if (m.range) {
        const key = m.rawUrl
        const api = getServerApi(key)
        if (api) {
          m.exist = true
          m.serverName = api.serverName
        }
        this.codeLenses.push(m)
      }
    })
    return this.codeLenses
  }

  public resolveCodeLens(
    codeLens: vscode.CodeLens,
    token: vscode.CancellationToken
  ) {
    return codeLens
  }
}
