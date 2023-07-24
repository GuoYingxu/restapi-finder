import { resolveCliArgsFromVSCodeExecutablePath } from "@vscode/test-electron"
import { globby } from "globby"
import * as vscode from "vscode"
import { entries, escapeRegExp, flatten } from "lodash-es"
import { ApiModel, parseDocument } from "./apiLensUtil"

export interface ApiFileNode {
  // indexs:number[]
  // url:string
  // title:string
  // range:vscode.Range
  // children?:ApiFileNode[]
  isWorkspaceNode: boolean
  type: string
  label: string
  nodes: ApiFileNode[]
  fsPath: string
  visible: boolean
  isFolder: boolean
  range?: vscode.Range
  module?: string
}
let nodes: ApiFileNode[] = []
let workspaceFolders: readonly vscode.WorkspaceFolder[] | undefined = []
const categories: string[] = []
const apiMap: Map<string, ApiFileNode[]> = new Map()
export class ApiFileModel {
  private _treeData: ApiFileNode[] = []
  public get roots(): ApiFileNode[] {
    //const editor = vscode.window.activeTextEditor;
    return this._treeData
  }

  public getChildren(parent: ApiFileNode): ApiFileNode[] {
    return []
  }
}
export class ApiExploreDataProvider
  implements vscode.TreeDataProvider<ApiFileNode>
{
  private _onDidChangeTreeData: vscode.EventEmitter<
    ApiFileNode | undefined | void
  > = new vscode.EventEmitter<ApiFileNode | undefined | void>()
  readonly onDidChangeTreeData?: vscode.Event<void | ApiFileNode | undefined> =
    this._onDidChangeTreeData.event

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly model: ApiFileModel = new ApiFileModel()
  ) {
    this.context.subscriptions.push(
      vscode.workspace.onDidChangeConfiguration(() => this.didChange())
    )
    this.context.subscriptions.push(
      vscode.window.onDidChangeActiveTextEditor(() => this.didChange())
    )
  }
  public refresh(): any {
    console.log("fire")
    this._onDidChangeTreeData.fire()
  }

  public getTreeItem(element: ApiFileNode): vscode.TreeItem {
    return {
      label: element.label,
      collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
      command: {
        title: "",
        command: "api-file.openurl",
        arguments: [],
      },
    }
  }
  public getChildren(element?: ApiFileNode): ApiFileNode[] {
    if (element === undefined) {
      return nodes
    }
    return element.nodes
  }

  public didChange() {
    console.log("didChange")
    this.refresh()
  }
  public async clear(folders: readonly vscode.WorkspaceFolder[] | undefined) {
    nodes = []
    workspaceFolders = folders
    addWorkspaceFolders()
  }

  /**
   * 重新构建树
   */
  public async rebuild() {
    if (workspaceFolders) {
      const paths = flatten(
        await Promise.all(
          workspaceFolders.map(cwd =>
            globby("src/**", {
              cwd: cwd.uri.fsPath,
              dot: false,
              absolute: true,
              onlyFiles: false,
              objectMode: true,
            })
          )
        )
      )
      await Promise.all(
        paths.map(async entry => {
          const fileNodes: ApiFileNode = {
            isWorkspaceNode: false,
            type: entry.dirent.isDirectory() ? "path" : "file",
            label: entry.dirent.name,
            nodes: [],
            fsPath: entry.path,
            visible:
              entry.dirent.isDirectory() ||
              entry.name.match(/\.(ts|js)$/) !== null,
            isFolder: entry.dirent.isDirectory(),
          }
          // 解析文件
          if (
            entry.dirent.isFile() &&
            entry.name.match(/\.(ts|js)$/) !== null
          ) {
            const document = await vscode.workspace.openTextDocument(
              vscode.Uri.file(entry.path)
            )
            const collector: ApiModel[] = parseDocument(document)
            collector.forEach((m: ApiModel) => {
              const appName = m.url.replace(/.*\/api\/(.*?)\/.*/, "$1")
              const apiNode: ApiFileNode = {
                isWorkspaceNode: false,
                type: "api",
                label: `${m.method}:${m.url}`,
                nodes: [],
                fsPath: entry.path,
                visible: true,
                isFolder: false,
                range: m.range,
                module: appName,
              }
              if (appName) {
                // console.log("cateeeee", appName)
                if (categories.indexOf(appName) < 0) {
                  categories.push(appName)
                }
              }
              if (apiMap.get(apiNode.label)) {
                apiMap.get(apiNode.label)?.push(apiNode)
              } else {
                apiMap.set(apiNode.label, [apiNode])
              }
            })
          }
        })
      )
      buildTree()
    }
    this.refresh()
  }
}
function buildTree() {
  nodes.forEach(rootNode => {
    console.log(categories)
    categories.forEach(cate => {
      // console.log("name.....", cate)
      const childrens = Array.from(apiMap.keys()).filter(path => {
        return path.indexOf("api/" + cate) >= 0
      })
      // console.log("childrens", cate, childrens)
      const list = childrens.map(key => buildChild(key))

      rootNode.nodes.push({
        isWorkspaceNode: false,
        type: "appName",
        label: cate,
        nodes: list,
        fsPath: rootNode.fsPath,
        visible: true,
        isFolder: false,
      })
    })
  })
}
function buildChild(key: string): ApiFileNode {
  const list = apiMap.get(key)
  let fnodes: ApiFileNode[] = []
  if (list) {
    fnodes = list.map(node => {
      return {
        isWorkspaceNode: false,
        type: "file",
        label: node.fsPath.split(/`$(node.module)`/)[1],
        nodes: [],
        fsPath: node.fsPath,
        visible: true,
        isFolder: false,
        module: node.module,
      }
    })
  }
  return {
    isWorkspaceNode: false,
    type: "api",
    label: key + "(" + fnodes.length + ")",
    fsPath: key,
    nodes: fnodes,
    visible: true,
    isFolder: true,
  }
}

function addWorkspaceFolders() {
  if (workspaceFolders) {
    workspaceFolders.map(async folder => {
      nodes.push(createWorkspaceRootNode(folder))
      console.log("nodepush", nodes)
    })
  }
}

function createWorkspaceRootNode(folder: vscode.WorkspaceFolder): ApiFileNode {
  const node: ApiFileNode = {
    isWorkspaceNode: true,
    type: "path",
    label: folder.uri.scheme === "file" ? folder.name : folder.uri.authority,
    nodes: [],
    fsPath:
      folder.uri.scheme === "file"
        ? folder.uri.fsPath
        : folder.uri.authority + folder.uri.fsPath,
    visible: true,
    isFolder: true,
  }
  return node
}
