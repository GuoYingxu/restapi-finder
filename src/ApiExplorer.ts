import * as vscode from "vscode"
import * as path from "path"
import { initRoot, parseModuleName, parseWorkspace } from "./ApiExplorerUtil"
import {
  ApiRefs,
  getAllRefsUri,
  getApiRefs,
  getModules,
  asyncApiRefs,
  clearApiRefs,
} from "./DataCenter"
/**
 * apiExplorer
 * 展示整个项目所有的接口
 *
 *  根据模块进行展示
 *    -- moduleA
 *     |---api1
 *     |---api2
 *    -- moduleB
 *     |--- api3
 *     |--- api4
 *
 * 使用树型组件 TreeView
 *
 */
export class ApiExplorer {
  // treeView 数据源provider
  apiExplorerDataProvider: ApiExploreDataProvider
  // treeView 实例
  apiExplorerTreeView: vscode.TreeView<ApiFileNode>
  constructor(
    context: vscode.ExtensionContext,
    disposibles: vscode.Disposable[]
  ) {
    this.apiExplorerDataProvider = new ApiExploreDataProvider(
      context,
      disposibles
    )
    // 注册属性组件
    this.apiExplorerTreeView = vscode.window.createTreeView("api-tree-view", {
      treeDataProvider: this.apiExplorerDataProvider,
    })
    context.subscriptions.push(this.apiExplorerTreeView)
    // 注册事件： 工作区改变
    const workspaceDisposible = vscode.workspace.onDidChangeWorkspaceFolders(
      () => this.update("workspace")
    )
    // 注册事件： 配置变更
    const configDisposible = vscode.workspace.onDidChangeConfiguration(
      event => {
        const configList = ["api.requestInstanceRegx", "api.modules"]
        const affected = configList.some(item =>
          event.affectsConfiguration(item)
        )
        if (affected) {
          this.update("config")
        }
      }
    )
    context.subscriptions.push(workspaceDisposible, configDisposible)
    disposibles.push(workspaceDisposible, configDisposible)

    // 刷新按钮
    context.subscriptions.push(
      vscode.commands.registerCommand("RestApiFinder.refreshEntry", () =>
        this.update("refresh")
      ),
      vscode.commands.registerCommand("RestApiFinder.setfilter", filter => {
        this.apiExplorerDataProvider.updateFilter(filter)
      }),
      vscode.commands.registerCommand("RestApiFinder.upload", () => {
        asyncApiRefs()
      })
    )

    this.update("init")
  }
  /**
   * 更新数据
   */
  async update(tag: string) {
    this.apiExplorerDataProvider.clear(vscode.workspace.workspaceFolders)
    await this.apiExplorerDataProvider.rebuild()
  }
}
/**
 * 树节点 模型
 */
export interface ApiFileNode {
  // 是不是工作区根节点
  isWorkspaceNode: boolean
  // 节点类型：应用/接口/文件/定位/根节点
  type: "module" | "api" | "file" | "range" | "root"
  // 节点显示名称
  label: string
  // 子节点
  nodes: ApiFileNode[]
  // 文件地址
  fsPath: string
  // 是否显示
  visible: boolean
  // 是否是文件夹
  isFolder: boolean
  // 定位
  range?: vscode.Range
  //所属模块
  module?: string
  // 方法
  method?: string
  // url
  url?: string
  // 数量
  count?: number
  //exist
  exist?: boolean
  projectName?: string
}
/**
 * treeData Provider
 */
export class ApiExploreDataProvider
  implements vscode.TreeDataProvider<ApiFileNode>
{
  private _filter: string = ""
  private nodes: ApiFileNode[]
  private workspaceFolders: readonly vscode.WorkspaceFolder[] = []
  private _onDidChangeTreeData: vscode.EventEmitter<
    ApiFileNode | undefined | void
  > = new vscode.EventEmitter<ApiFileNode | undefined | void>()
  readonly onDidChangeTreeData?:
    | vscode.Event<void | ApiFileNode | ApiFileNode[] | null | undefined>
    | undefined = this._onDidChangeTreeData.event
  constructor(
    private readonly context: vscode.ExtensionContext,
    disposables: vscode.Disposable[]
  ) {
    const configDisposible = vscode.workspace.onDidChangeConfiguration(() =>
      this.didChange()
    )
    const activeTextDisposible = vscode.window.onDidChangeActiveTextEditor(() =>
      this.didChange()
    )
    this.context.subscriptions.push(configDisposible, activeTextDisposible)
    disposables.push(configDisposible, activeTextDisposible)
    this.nodes = []
  }
  /**
   * 返回节点对象
   * @param element
   */
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
  /**
   * 返回子节点列表
   * @param element
   */
  public getChildren(element?: ApiFileNode): ApiFileNode[] {
    if (element === undefined) {
      return this.nodes
    }

    let children = element.nodes.map(node => {
      if (node.type === "api") {
        if (this._filter) {
          if (new RegExp(`${this._filter}`, "ig").test(node.label)) {
            node.visible = true
          } else {
            node.visible = false
          }
        }
      }
      if (node.type === "module") {
        let c = node.nodes.filter(n => {
          if (this._filter) {
            return new RegExp(`${this._filter}`, "ig").test(n.label)
          }
          return true
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

  public updateFilter(filter: string) {
    this._filter = filter
    this.didChange()
  }
  /**
   * 清空数据
   */
  public clear(folders: readonly vscode.WorkspaceFolder[] | undefined) {
    this.nodes = []
    if (folders !== undefined) {
      this.workspaceFolders = folders
    }
  }

  public async addWorkSpaceFolders() {
    if (this.workspaceFolders) {
      this.nodes = await initRoot(this.workspaceFolders)
    } else {
      vscode.window.showErrorMessage("找到不项目根目录!")
    }
  }
  /**
   * 重新构建数据
   */
  public async rebuild() {
    clearApiRefs()
    if (this.workspaceFolders) {
      // 构建跟节点
      await this.addWorkSpaceFolders()
      await parseWorkspace(this.workspaceFolders)
      //构建树
      // --rootNode
      //  |-- modulename
      //     |-- api
      this.nodes.forEach(rootNode => {
        const configModules = getModules()
        if (configModules && configModules.length > 0) {
          // 构建moduleName
          configModules.forEach(cateName => {
            const list = getAllRefsUri().filter(path => {
              return cateName === parseModuleName(path)
            })
            const childrens = list.map(key => this.buildChildren(key, rootNode))
            rootNode.nodes.push({
              isWorkspaceNode: false,
              type: "module",
              label: cateName,
              nodes: childrens,
              fsPath: rootNode.fsPath,
              count: childrens.length,
              visible: childrens.length > 0,
              isFolder: false,
            })
          })
          const others = getAllRefsUri().filter(path => {
            return !configModules.includes(parseModuleName(path))
          })
          const otherChildrens = others.map(key =>
            this.buildChildren(key, rootNode)
          )
          rootNode.nodes.push({
            isWorkspaceNode: false,
            type: "module",
            label: "otherModule",
            nodes: otherChildrens,
            fsPath: rootNode.fsPath,
            count: otherChildrens.length,
            visible: otherChildrens.length > 0,
            isFolder: false,
          })
        } else {
          getAllRefsUri().forEach(key => {
            rootNode.nodes.push(this.buildChildren(key, rootNode))
          })
        }
      })
      this.refresh()
    }
  }

  /**
   * 构建api 节点
   *  ----- api
   *    |--- file
   *       |-- range
   * @param key
   * @param rootNode
   */
  public buildChildren(key: string, rootNode: ApiFileNode): ApiFileNode {
    const refs = getApiRefs(key)
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
      const fileMap: Map<string, ApiFileNode> = new Map()

      //生成file 节点
      refs.forEach((api: ApiRefs) => {
        const fsPath: string = api.filePath
        let fileNode: ApiFileNode | undefined = fileMap.get(fsPath)
        if (!fileNode) {
          fileNode = {
            isWorkspaceNode: false,
            type: "file",
            label: api.filePath.split(`/${rootNode.label}/`)[1],
            nodes: [],
            fsPath: api.filePath,
            isFolder: true,
            visible: true,
            range: api.position,
            module: api.moduleName,
          }
        } else {
          fileNode = fileMap.get(fsPath)
        }
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
        if (
          fileNode?.nodes.filter(n => n.label === rangeNodes.label).length === 0
        ) {
          fileNode?.nodes.push(rangeNodes)
        }
        if (fileNode) {
          fileMap.set(fsPath, fileNode)
        }
      })
      const filenodes = Array.from(fileMap.values())
      apiNode.count = filenodes.length
      apiNode.nodes = filenodes
      apiNode.isFolder = true
    }
    return apiNode
  }
  /**
   * 刷新数据
   */
  public refresh() {
    this._onDidChangeTreeData.fire()
  }
  /**
   * change 响应
   */
  public didChange() {
    this.refresh()
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
