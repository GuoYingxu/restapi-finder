import * as vscode from "vscode"
import { flatten } from "lodash-es"
import { setModules } from "./DataCenter"
export class Configuration {
  constructor(
    context: vscode.ExtensionContext,
    disposables: vscode.Disposable[]
  ) {
    const disposable = vscode.workspace.onDidChangeConfiguration(
      () => this.init
    )
    context.subscriptions.push(disposable)
    disposables.push(disposable)
    this.init()
  }
  init() {
    // 初始化配置
    const modules: any[] | undefined = vscode.workspace
      .getConfiguration()
      .get("api.modules")
    if (modules) {
      const moduleNames = flatten(modules.map(s => Object.keys(s)))
      setModules(moduleNames)
    }
  }
}
