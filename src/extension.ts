// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode"
import { ApiLens } from "./ApiLens"
import { FilterViewProvider } from "./viewProvider"
import axios from "axios"
import { Configuration } from "./Configuration"
import { ApiExplorer, ApiFileNode } from "./ApiExplorer"
import { ServerApi, addServerApi, joinPath } from "./DataCenter"
import { ApiOutline } from "./ApiOutline"
let disposables: vscode.Disposable[] = []
// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  // 读取配置
  new Configuration(context, disposables)
  // apiExplorer
  new ApiExplorer(context, disposables)

  new ApiOutline(context, disposables)
  //--- apilens
  new ApiLens(context, disposables)

  // 文件跳转
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "api-file.openurl",
      (element: ApiFileNode) => {
        if (element.type === "file" || element.type === "range") {
          const fsPath = element.fsPath
          const range = element.range
          if (fsPath) {
            vscode.workspace
              .openTextDocument(vscode.Uri.file(fsPath))
              .then(document => {
                vscode.window.showTextDocument(document, { preview: false })
              })
              .then(() => {
                const textEditor = vscode.window.activeTextEditor
                if (!textEditor) {
                  return
                }
                if (range) {
                  const selection = new vscode.Selection(range.start, range.end)
                  textEditor.selection = selection
                  textEditor.revealRange(
                    selection,
                    vscode.TextEditorRevealType.Default
                  )
                }
              })
          }
        }
      }
    )
  )
  const host = vscode.workspace.getConfiguration().get("api.server")
  if (host) {
    const url = joinPath(host.toString(), "/apimanage/serverapiforPlugin")
    axios
      .get(url)
      .then(res => {
        console.log(res.data.length)
        res.data.forEach((api: any) => {
          if (!api.puri) return
          const sapi: ServerApi = {
            serverName: api.server,
            rawUrl: api.puri,
            method: api.method?.toUpperCase(),
          }
          if (api.puri === "/api/admin/majors/{param}") {
            console.log(
              "===========================================/api/admin/majors/{param}"
            )
          }
          addServerApi(sapi)
        })
      })
      .catch(err => {
        vscode.window.showInformationMessage("获取远程接口信息失败！")
      })
  }
  // search view
  const viewProvider = new FilterViewProvider(context.extensionUri)
  const viewDisposable = vscode.window.registerWebviewViewProvider(
    FilterViewProvider.viewType,
    viewProvider
  )
  context.subscriptions.push(viewDisposable)
  disposables.push(viewDisposable)
}

// This method is called when your extension is deactivated
export function deactivate() {
  if (disposables) {
    disposables.forEach(item => item.dispose())
  }
  disposables = []
}
