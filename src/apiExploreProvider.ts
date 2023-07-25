import { resolveCliArgsFromVSCodeExecutablePath } from "@vscode/test-electron";
import { globby } from "globby";
import * as vscode from "vscode";
import { entries, escapeRegExp, flatten } from "lodash-es";
import { ApiModel, parseDocument } from "./apiLensUtil";

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
  method?:string
  url?:string
}
let nodes: ApiFileNode[] = [];
let workspaceFolders: readonly vscode.WorkspaceFolder[] | undefined = [];
let categories: string[] = [];
let apiMap: Map<string, ApiFileNode[]> = new Map();
let fileParseMap:Map<string,ApiModel[]> = new Map();
export class ApiFileModel {
  private _treeData: ApiFileNode[] = [];
  public get roots(): ApiFileNode[] {
    //const editor = vscode.window.activeTextEditor;
    return this._treeData;
  }

  public getChildren(parent: ApiFileNode): ApiFileNode[] {
    return [];
  }
}
export class ApiExploreDataProvider
  implements vscode.TreeDataProvider<ApiFileNode>
{
  private _onDidChangeTreeData: vscode.EventEmitter<
    ApiFileNode | undefined | void
  > = new vscode.EventEmitter<ApiFileNode | undefined | void>();
  readonly onDidChangeTreeData?: vscode.Event<void | ApiFileNode | undefined> =
    this._onDidChangeTreeData.event;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly model: ApiFileModel = new ApiFileModel()
  ) {
    this.context.subscriptions.push(
      vscode.workspace.onDidChangeConfiguration(() => this.didChange())
    );
    this.context.subscriptions.push(
      vscode.window.onDidChangeActiveTextEditor(() => this.didChange())
    );
  }
  public refresh(): any {
    console.log("fire");
    this._onDidChangeTreeData.fire();
  }

  public getTreeItem(element: ApiFileNode): vscode.TreeItem {
    return {
      label: this.getLabel(element),
      collapsibleState:element.isWorkspaceNode? vscode.TreeItemCollapsibleState.Expanded : element.type === 'range' ?vscode.TreeItemCollapsibleState.None :  vscode.TreeItemCollapsibleState.Collapsed,
      command: {
        title: "open",
        command: "api-file.openurl",
        arguments: [element.fsPath,element.range],
      },
      iconPath: this.getIcon(element)
    };
  }
  public  getLabel(element:ApiFileNode):vscode.TreeItemLabel | string {
    if(element.type === 'api') {
      return {
        label: element.label,
        highlights:  element.method ? [[0,element.method?.length ]] :void 0
      };
    }
    return element.label;
  }
  public getIcon(element:ApiFileNode) {
    if(element.type === 'file') {
      return vscode.ThemeIcon.File;
    }
    if(element.type === 'appName') {
      return vscode.ThemeIcon.Folder;
    }
    return undefined;
  }
  public getChildren(element?: ApiFileNode): ApiFileNode[] {
    if (element === undefined) {
      return nodes;
    }
    return element.nodes;
  }

  public didChange() {
    console.log("didChange");
    this.refresh();
  }
  public async clear(folders: readonly vscode.WorkspaceFolder[] | undefined) {
    nodes = [];
    categories = [];
    apiMap.clear();
    fileParseMap.clear();
    workspaceFolders = folders;
    addWorkspaceFolders();
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
      );
      await Promise.all(
        paths.map(async (entry) => {
          // 解析文件
          if (
            entry.dirent.isFile() &&
            entry.name.match(/\.(ts|js)$/) !== null
          ) {
            const document = await vscode.workspace.openTextDocument(
              vscode.Uri.file(entry.path)
            );
            let collector:ApiModel[] = [];
            if(fileParseMap.has(entry.path)){
              collector =  [];
            }else {
              collector = parseDocument(document);
              fileParseMap.set(entry.path,collector);
            }
            
            collector.forEach((m: ApiModel) => {
              const appName = m.url.replace(/.*\/api\/(.*?)\/.*/, "$1");
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
                method: m.method,
                url:m.url
              };
              if (appName) {
                // console.log("cateeeee", appName)
                if (categories.indexOf(appName) < 0) {
                  categories.push(appName);
                }
              }
              if (apiMap.get(apiNode.label)) {
                apiMap.get(apiNode.label)?.push(apiNode);
              } else {
                apiMap.set(apiNode.label, [apiNode]);
              }
            });
          }
        })
      );
      buildTree();
    }
    this.refresh();
  }
}
function buildTree() {
  nodes.forEach(rootNode => {
    console.log(categories);
    rootNode.nodes = [];
    categories.forEach(cate => {
      // console.log("name.....", cate)
      const childrens = Array.from(apiMap.keys()).filter(path => {
        return path.indexOf("api/" + cate) >= 0;
      });
      // console.log("childrens", cate, childrens)
      const list = childrens.map(key => buildChild(key,rootNode)).sort((a,b) => a.label > b.label ? 1:-1);
       
      rootNode.nodes.push({
        isWorkspaceNode: false,
        type: "appName",
        label: cate,
        nodes: list,
        fsPath: rootNode.fsPath,
        visible: true,
        isFolder: false,
      });
    });
    console.log(rootNode.nodes);
  });
}
function buildChild(key: string,rootNode:ApiFileNode): ApiFileNode {
  const list = apiMap.get(key);
  let fnodes: ApiFileNode[] = [];
  if (list) {
    const tempMap:Map<string,string> = new Map();
    list.forEach(node => {
      const rangeNodes:ApiFileNode[] = list.filter((n:ApiFileNode) => n.fsPath === node.fsPath);
      if(!tempMap.has(node.fsPath)) {
        tempMap.set(node.fsPath,node.label);
      const clist = rangeNodes.map(n =>  ({
        isWorkspaceNode:false,
        type:'range',
        label: `line ${n.range?.start.line}:[${n.range?.start.character},${n.range?.end.character}]`,
        nodes:[],
        fsPath:n.fsPath,
        visible:true,
        isFolder:false,
        range:n.range,
        module: n.module
      }));
      
      fnodes.push( {
        isWorkspaceNode: false,
        type: "file",
        label: node.fsPath.split(`/${rootNode.label}/`)[1],
        nodes: clist,
        fsPath: node.fsPath,
        visible: true,
        isFolder: false,
        range:node.range,
        module: node.module,
      });
    }
    });
  }
  let module ="";
  let method = "";
  let url = "";
  const orign = apiMap.get(key);
  if(orign && orign?.length>0) {
    module = orign[0].module || '';
    method = orign[0].method || '';
    url = orign[0].url || '';
    
  }
  return {
    isWorkspaceNode: false,
    type: "api",
    label: key + "(" + fnodes.length + ")",
    fsPath: key,
    nodes: fnodes,
    visible: true,
    isFolder: true,
    method,
    module,
    url,
  };
}

function addWorkspaceFolders() {
  if (workspaceFolders) {
    workspaceFolders.map(async folder => {
      nodes.push(createWorkspaceRootNode(folder));
      console.log("nodepush", nodes);
    });
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
  };
  return node;
}
