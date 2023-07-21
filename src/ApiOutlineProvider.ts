import * as vscode from "vscode"
import * as ts from "typescript"
import { ApiLens, finder } from "./apiLensUtil"
export interface ApiNode {
  indexs: number[]
  url: string
  title: string
  range: vscode.Range
  children?: ApiNode[]
}
function buildTreeData(list: ApiLens[]): ApiNode[] {
  let map: Map<string, ApiNode> = new Map()
  if (list.length > 0) {
    list.forEach((apilens: ApiLens, index: number) => {
      const apiNode: ApiNode = {
        indexs: [index],
        url: apilens.rawUrl,
        title: apilens.label,
        range: apilens.range,
        children: [
          {
            indexs: [index, 0],
            url: apilens.rawUrl,
            title: apilens.label,
            range: apilens.range,
          },
        ],
      }

      if (map.get(apilens.label)) {
        let node = map.get(apilens.label)
        node?.children?.push({
          indexs: node.indexs.concat([node.children.length]),
          url: apilens.rawUrl,
          title: apilens.label,
          range: apilens.range,
        })
      }
      map.set(apilens.label, apiNode)
    })
  }
  return Array.from(map.values())
}

export class ApiListItemModel {
  private _treeData: ApiNode[] = []
  public get roots(): ApiNode[] {
    const editor = vscode.window.activeTextEditor
    if (editor !== undefined) {
      this._treeData = buildTreeData(finder(editor.document))
    }
    return this._treeData
  }

  public getChildren(parent: ApiNode): ApiNode[] {
    if (parent && parent.children) {
      return parent.children
    } else {
      return []
    }
  }
}

export class ApiListDataProvider implements vscode.TreeDataProvider<ApiNode> {
  private _onDidChangeTreeData: vscode.EventEmitter<
    ApiNode | undefined | void
  > = new vscode.EventEmitter<ApiNode | undefined | void>()
  readonly onDidChangeTreeData: vscode.Event<ApiNode | undefined | void> =
    this._onDidChangeTreeData.event
  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly model: ApiListItemModel = new ApiListItemModel()
  ) {
    this.context.subscriptions.push(
      vscode.workspace.onDidChangeConfiguration(() => this.didChange())
    )
    this.context.subscriptions.push(
      vscode.window.onDidChangeActiveTextEditor(() => this.didChange())
    )
  }
  public refresh(): any {
    this._onDidChangeTreeData.fire()
  }

  public getTreeItem(element: ApiNode): vscode.TreeItem {
    return {
      label: element.title,
      collapsibleState: 0,
      command: {
        title: "",
        command: "request-pointer.api.selection",
        arguments: [element.range],
      },
    }
  }

  public getChildren(element?: ApiNode): ApiNode[] {
    return element ? this.model.getChildren(element) : this.model.roots
  }

  public didChange() {
    this.refresh()
  }
}
