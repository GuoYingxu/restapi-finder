import * as vscode from "vscode"
import { ApiExploreDataProvider } from "./apiExploreProvider"
export class ApiExplorer {
  apiExplorerDataProvider: ApiExploreDataProvider
  apiExplorerTreeView: vscode.TreeView
  constructor(context: vscode.ExtensionContext) {
    this.apiExplorerDataProvider = new ApiExploreDataProvider(context)
    this.apiExplorerTreeView = vscode.window.createTreeView()
  }
}
