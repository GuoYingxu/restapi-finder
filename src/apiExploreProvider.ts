import { resolveCliArgsFromVSCodeExecutablePath } from "@vscode/test-electron"
import { globby } from "globby"
import * as vscode from "vscode"
import { some, flatten } from "lodash-es"
import { ApiModel, parseDocument } from "./apiLensUtil"
import * as path from "path"

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
  method?: string
  url?: string
  count?: number
}
let nodes: ApiFileNode[] = []
let workspaceFolders: readonly vscode.WorkspaceFolder[] | undefined = []
let categories: string[] = []
let apiMap: Map<string, ApiFileNode[]> = new Map()
let fileParseMap: Map<string, ApiModel[]> = new Map()
let modules: any[] | undefined
let moduleNames: string[] = []
export class ApiExploreDataProvider
  implements vscode.TreeDataProvider<ApiFileNode>
{
  private _filter: string = ""
  private _onDidChangeTreeData: vscode.EventEmitter<
    ApiFileNode | undefined | void
  > = new vscode.EventEmitter<ApiFileNode | undefined | void>()
  readonly onDidChangeTreeData?: vscode.Event<void | ApiFileNode | undefined> =
    this._onDidChangeTreeData.event

  constructor(private readonly context: vscode.ExtensionContext) {
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

  public getTreeItem(element: ApiFileNode): vscode.TreeItem {
    return {
      label: this.getLabel(element),
      collapsibleState:
        element.isWorkspaceNode || element.type == "appName"
          ? vscode.TreeItemCollapsibleState.Expanded
          : element.type === "range"
          ? vscode.TreeItemCollapsibleState.None
          : vscode.TreeItemCollapsibleState.Collapsed,
      command: {
        title: "open",
        command: "api-file.openurl",
        arguments: [element.fsPath, element.range],
      },
      iconPath: this.getIcon(element),
    }
  }
  /** 着色 */
  public getLabel(element: ApiFileNode): vscode.TreeItemLabel | string {
    // if (element.type === "api") {
    //   return {
    //     label: element.label,
    //     // highlights: element.method ? [[0, element.method?.length]] : void 0,
    //   }
    // }
    if (element.type === "appName") {
      return element.label + `(${element.count})`
    }
    return element.label
  }
  public getIcon(element: ApiFileNode) {
    if (element.type === "file") {
      return this.context.asAbsolutePath(
        path.join("resources/icons", "code.svg")
      )
    }
    if (element.type === "range") {
      return new vscode.ThemeIcon("eye")
    }
    if (element.type === "appName") {
      return this.context.asAbsolutePath(
        path.join("resources/icons", "API.svg")
      )
    }
    if (element.type === "api") {
      if (element.method === "GET") {
        return this.context.asAbsolutePath(
          path.join("resources/icons", "GET.svg")
        )
      }
      if (element.method === "PUT") {
        return this.context.asAbsolutePath(
          path.join("resources/icons", "PUT.svg")
        )
      }
      if (element.method === "DELETE") {
        return this.context.asAbsolutePath(
          path.join("resources/icons", "DEL.svg")
        )
      }
      if (element.method === "PATCH") {
        return this.context.asAbsolutePath(
          path.join("resources/icons", "PAT.svg")
        )
      }
      if (element.method === "POST") {
        return this.context.asAbsolutePath(
          path.join("resources/icons", "POST.svg")
        )
      }
    }
    return void 0
  }
  public getChildren(element?: ApiFileNode): ApiFileNode[] {
    if (element === undefined) {
      return nodes
    }
    if (this._filter) {
      let children = element.nodes.map(node => {
        if (node.type === "api") {
          if (new RegExp(`${this._filter}`, "ig").test(node.label)) {
            node.visible = true
          } else {
            node.visible = false
          }
        }
        if (node.type === "appName") {
          let c = node.nodes.filter(n => {
            let match = new RegExp(`${this._filter}`, "ig").test(n.label)
            return match
          })
          if (c.length > 0) {
            node.visible = true
            node.count = c.length
          } else {
            node.visible = false
          }
        }
        return node
      })
      return children
        .filter(node => {
          return node.visible
        })
        .sort((a, b) => (a.label > b.label ? 1 : -1))
    }
    return element.nodes.sort((a, b) => (a.label > b.label ? 1 : -1))
  }
  public updateFilter(filter: string) {
    this._filter = filter
    this.didChange()
  }
  public didChange() {
    this.refresh()
  }
  public async clear(folders: readonly vscode.WorkspaceFolder[] | undefined) {
    nodes = []
    categories = []
    apiMap.clear()
    fileParseMap.clear()
    workspaceFolders = folders
    addWorkspaceFolders()
  }

  /**
   * 重新构建树
   */
  public async rebuild() {
    modules = vscode.workspace.getConfiguration().get("api.modules")

    if (modules) {
      moduleNames = flatten(modules.map(s => Object.keys(s)))
    }

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
          // 解析文件
          if (
            entry.dirent.isFile() &&
            entry.name.match(/\.(ts|js|vue)$/i) !== null
          ) {
            const document = await vscode.workspace.openTextDocument(
              vscode.Uri.file(entry.path)
            )
            let collector: ApiModel[] = []
            if (fileParseMap.has(entry.path)) {
              collector = []
            } else {
              collector = parseDocument(document)
              fileParseMap.set(entry.path, collector)
            }

            collector.forEach((m: ApiModel) => {
              let appName = m.url.replace(/.*\/api\/(.*?)\/.*/gi, "$1")
              if (!moduleNames.includes(appName)) {
                appName = "unDefinedModule"
              }
              const apiNode: ApiFileNode = {
                isWorkspaceNode: false,
                type: "api",
                label: ["GET", "POST", "DELETE", "PATCH", "PUT"].includes(
                  m.method
                )
                  ? m.url
                  : `${m.method}:${m.url}`,
                nodes: [],
                fsPath: entry.path,
                visible: true,
                isFolder: false,
                range: m.range,
                module: appName,
                method: m.method,
                url: m.url,
              }
              if (appName) {
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
    rootNode.nodes = []
    categories.forEach(cate => {
      const childrens = Array.from(apiMap.keys()).filter(path => {
        const temp = apiMap.get(path)
        if (temp && temp.length > 0) {
          return temp[0].module === cate
        }
        return false
      })
      const list = childrens
        .map(key => buildChild(key, rootNode))
        .sort((a, b) => (a.label > b.label ? 1 : -1))

      rootNode.nodes.push({
        isWorkspaceNode: false,
        type: "appName",
        label: cate,
        nodes: list,
        fsPath: rootNode.fsPath,
        count: list.length,
        visible: true,
        isFolder: false,
      })
    })
  })
}
function buildChild(key: string, rootNode: ApiFileNode): ApiFileNode {
  const list = apiMap.get(key)
  let fnodes: ApiFileNode[] = []
  if (list) {
    const tempMap: Map<string, string> = new Map()
    list.forEach(node => {
      const rangeNodes: ApiFileNode[] = list.filter(
        (n: ApiFileNode) => n.fsPath === node.fsPath
      )
      if (!tempMap.has(node.fsPath)) {
        tempMap.set(node.fsPath, node.label)
        const clist = rangeNodes.map(n => ({
          isWorkspaceNode: false,
          type: "range",
          label: `line ${n.range?.start.line}:[${n.range?.start.character},${n.range?.end.character}]`,
          nodes: [],
          fsPath: n.fsPath,
          visible: true,
          isFolder: false,
          range: n.range,
          module: n.module,
        }))

        fnodes.push({
          isWorkspaceNode: false,
          type: "file",
          label: node.fsPath.split(`/${rootNode.label}/`)[1],
          nodes: clist,
          fsPath: node.fsPath,
          visible: true,
          isFolder: false,
          range: node.range,
          module: node.module,
        })
      }
    })
  }
  let module = ""
  let method = ""
  let url = ""
  const orign = apiMap.get(key)
  if (orign && orign?.length > 0) {
    module = orign[0].module || ""
    method = orign[0].method || ""
    url = orign[0].url || ""
  }
  return {
    isWorkspaceNode: false,
    type: "api",
    label: key,
    fsPath: key,
    nodes: fnodes,
    visible: true,
    isFolder: true,
    method,
    module,
    url,
  }
}

function addWorkspaceFolders() {
  if (workspaceFolders) {
    workspaceFolders.map(async folder => {
      nodes.push(createWorkspaceRootNode(folder))
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
