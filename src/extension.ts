// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode"
import { ApiLensProvider } from "./ApiLensProvider"
import { ApiListDataProvider } from "./ApiOutlineProvider"
import { ApiExploreDataProvider } from "./apiExploreProvider"
let disposables: vscode.Disposable[] = []
// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  console.log(
    'Congratulations, your extension "request-pointer" is now active!'
  )

  const apiExploreDataProvider = new ApiExploreDataProvider(context)
  //--- apilens
  vscode.languages.registerCodeLensProvider(
    [
      { scheme: "file", language: "typescript" },
      { scheme: "file", language: "javascript" },
    ],
    new ApiLensProvider()
  )
  let disposable = vscode.commands.registerCommand(
    "request-pointer.helloWorld",
    async () => {
      console.log(vscode.workspace.workspaceFolders)
      apiExploreDataProvider.clear(vscode.workspace.workspaceFolders)
      await apiExploreDataProvider.rebuild()
    }
  )
  context.subscriptions.push(disposable)
  disposables.push(
    vscode.commands.registerCommand(
      "request-pointer.codelensAction",
      (args: any) => {
        vscode.window.showInformationMessage(
          `CodeLens action clicked with args=${args}`
        )
      }
    )
  )
  disposables.push(disposable)

  // -- apioutline
  const treeDataProvider = new ApiListDataProvider(context)
  vscode.window.createTreeView("api.views.explorer", {
    treeDataProvider,
  })
  treeDataProvider.didChange()
  // 跳转事件
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "request-pointer.api.selection",
      (range: vscode.Range) => {
        const editor = vscode.window.activeTextEditor
        if (editor !== undefined) {
          editor.selection = new vscode.Selection(range.start, range.end)
          editor.revealRange(
            range,
            vscode.TextEditorRevealType.InCenterIfOutsideViewport
          )
          vscode.window.showTextDocument(editor.document)
        }
      }
    )
  )
  // -- explore tree

  var apiExporeTreeView = vscode.window.createTreeView("api-tree-view", {
    treeDataProvider: apiExploreDataProvider,
  })

  // context.subscriptions.push(apiExploreDataProvider)
  context.subscriptions.push(apiExporeTreeView)

  const explorWorkspaceDisposable =
    vscode.workspace.onDidChangeWorkspaceFolders(async () => {
      apiExploreDataProvider.clear(vscode.workspace.workspaceFolders)
      await apiExploreDataProvider.rebuild()
    })
  const exploreConfigDisposable = vscode.workspace.onDidChangeConfiguration(
    async e => {
      apiExploreDataProvider.clear(vscode.workspace.workspaceFolders)
      await apiExploreDataProvider.rebuild()
    }
  )
  context.subscriptions.push(explorWorkspaceDisposable, exploreConfigDisposable)
  apiExploreDataProvider.clear(vscode.workspace.workspaceFolders)
  apiExploreDataProvider.rebuild()
  context.subscriptions.push(
    vscode.commands.registerCommand("api-file.openurl", () => {})
  )
  disposables.push(explorWorkspaceDisposable, exploreConfigDisposable)
}

// This method is called when your extension is deactivated
export function deactivate() {
  if (disposables) {
    disposables.forEach(item => item.dispose())
  }
  disposables = []
}
