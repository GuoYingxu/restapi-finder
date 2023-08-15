import * as vscode from "vscode"
import { ApiFileNode } from "./ApiExplorer"
import * as path from "path"
import { ApiModel, parseDocument } from "./apiLensUtil"
import { parseModuleName } from "./ApiExplorerUtil"
import { ApiRefs, getModules, getServerApi } from "./DataCenter"
export class ApiOutline {
  outlineTreeDataProvider: ApiOutlineTreeDataProvider
  constructor(
    context: vscode.ExtensionContext,
    disposibles: vscode.Disposable[]
  ) {
    this.outlineTreeDataProvider = new ApiOutlineTreeDataProvider(
      context,
      disposibles
    )
    vscode.window.createTreeView("api.views.explorer", {
      treeDataProvider: this.outlineTreeDataProvider,
    })
  }
  public init() {
    this.outlineTreeDataProvider.didChange()
  }
}
/**
 * outline tree provider
 * 单个文件 api 展示
 */

export class ApiOutlineTreeDataProvider
  implements vscode.TreeDataProvider<ApiFileNode>
{
  models: ApiFileNode[] = []
  private _onDidChangeTreeData: vscode.EventEmitter<
    ApiFileNode | undefined | void
  > = new vscode.EventEmitter<ApiFileNode | undefined | void>()
  readonly onDidChangeTreeData?:
    | vscode.Event<void | ApiFileNode | ApiFileNode[] | null | undefined>
    | undefined = this._onDidChangeTreeData.event

  constructor(
    private readonly context: vscode.ExtensionContext,
    disposibles: vscode.Disposable[]
  ) {
    const configChange = vscode.workspace.onDidChangeConfiguration(event => {
      const configList = ["api.requestInstanceRegx", "api.modules"]
      const affected = configList.some(item => event.affectsConfiguration(item))
      if (affected) {
        this.didChange()
      }
    })
    const activeTextChange = vscode.window.onDidChangeActiveTextEditor(() =>
      this.didChange()
    )
    const activeEditorChange = vscode.workspace.onDidChangeTextDocument(() => {
      this.didChange()
    })
    context.subscriptions.push(configChange, activeTextChange)
    disposibles.push(configChange, activeTextChange)

    this.didChange()
  }

  public getTreeItem(element: ApiFileNode): vscode.TreeItem {
    return {
      label: this.getLabel(element),
      iconPath: this.getIcon(element),
      collapsibleState:
        element.isWorkspaceNode || element.type === "module"
          ? vscode.TreeItemCollapsibleState.Expanded
          : element.type === "range"
          ? vscode.TreeItemCollapsibleState.None
          : vscode.TreeItemCollapsibleState.Collapsed,
      command: {
        title: "open",
        command: "api-file.openurl",
        arguments: [element],
      },
    }
  }

  public refresh() {
    this._onDidChangeTreeData.fire()
  }
  public didChange() {
    console.log("didchage")
    this.models = []
    this.buildTree()
    this.refresh()
  }

  public buildTree() {
    console.log("buildtree")
    const editor = vscode.window.activeTextEditor
    if (editor) {
      const map: Map<string, ApiRefs[]> = new Map()
      const moduleNames = getModules()
      const list = parseDocument(editor.document)
      list.forEach((api: ApiModel) => {
        let moduleName = parseModuleName(api.url)
        if (!moduleNames.includes(moduleName)) {
          moduleName = "otherModule"
        }
        // 参数替换成:param
        const rawUrl = api.url.replace(/\${.*?}/g, ":param")
        let sapi = getServerApi(rawUrl)
        // 请求对象
        const apiRefs: ApiRefs = {
          url: api.url,
          method: api.method,
          purl: rawUrl,
          moduleName: moduleName,
          exist: !!sapi,
          fileName: editor.document.fileName,
          filePath: editor.document.uri.fsPath,
          position: api.range,
        }
        let key = `${api.method}:${rawUrl}`
        let apiRefsList = map.get(key)
        if (apiRefsList) {
          apiRefsList.push(apiRefs)
          map.set(key, apiRefsList)
        } else {
          map.set(key, [apiRefs])
        }
      })

      Array.from(map.keys()).forEach(key => {
        this.models.push(this.buildApiNode(key, map))
      })
    }
  }

  public buildApiNode(key: string, map: Map<string, ApiRefs[]>) {
    const refs = map.get(key)
    // api节点
    const apiNode: ApiFileNode = {
      isWorkspaceNode: false,
      type: "api",
      label: key,
      fsPath: "",
      nodes: [],
      visible: true,
      isFolder: false,
    }
    if (refs && refs.length > 0) {
      apiNode.method = refs[0].method
      apiNode.url = refs[0].url
      apiNode.module = refs[0].moduleName
      apiNode.exist = refs[0].exist
      const positionNodes: ApiFileNode[] = []
      refs.forEach((api: ApiRefs) => {
        // 生成位置节点
        const rangeNodes: ApiFileNode = {
          isWorkspaceNode: false,
          type: "range",
          label: `line ${api.position?.start.line}:[${api.position?.start.character},${api.position?.end.character}]`,
          nodes: [],
          fsPath: api.filePath,
          visible: true,
          isFolder: false,
          range: api.position,
          module: api.moduleName,
        }
        positionNodes.push(rangeNodes)
      })
      apiNode.count = positionNodes.length
      apiNode.nodes = positionNodes
      apiNode.isFolder = true
    }
    return apiNode
  }

  /**
   * 节点label 方法
   * @param element
   * @returns
   */
  public getLabel(element: ApiFileNode): vscode.TreeItemLabel | string {
    // appName ，返回模块名称 + 接口数量
    if (element.type === "module") {
      return `${element.label}(${element.count})`
    }
    if (element.type === "api") {
      return `${element.url}${element.exist ? "" : "[未找到]"}`
    }
    return element.label
  }

  public getChildren(element?: ApiFileNode | undefined): ApiFileNode[] {
    return element
      ? element.nodes.sort((a, b) => (a.label > b.label ? 1 : -1))
      : this.models.sort((a, b) => (a.label > b.label ? 1 : -1))
  }

  /**
   * 节点图标
   * @param element
   */
  public getIcon(element: ApiFileNode) {
    if (element.type === "file") {
      return this.context.asAbsolutePath(
        path.join("resources/icons", "code.svg")
      )
    }
    if (element.type === "range") {
      return new vscode.ThemeIcon("eye")
    }

    if (element.type === "module") {
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
}
