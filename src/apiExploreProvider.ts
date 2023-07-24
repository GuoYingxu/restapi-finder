import { resolveCliArgsFromVSCodeExecutablePath } from '@vscode/test-electron';
import { globby } from 'globby';
import * as vscode from 'vscode';

export interface ApiFileNode{
  // indexs:number[]
  // url:string
  // title:string
  // range:vscode.Range
  // children?:ApiFileNode[]
  isWorkspaceNode: boolean
  type:  string
  label: string
  nodes:ApiFileNode[]
  fsPath: string
  visible: boolean
  isFolder: boolean
}
let nodes:ApiFileNode[] = [];
let workspaceFolders:  readonly vscode.WorkspaceFolder[] | undefined=[];
let flatNodes:ApiFileNode[] = [];
export class ApiFileModel { 
  private _treeData:ApiFileNode[] = [];
  public get roots(): ApiFileNode[] {
    //const editor = vscode.window.activeTextEditor;
     
    
    return this._treeData;
  }

  public getChildren(parent:ApiFileNode):ApiFileNode[] {
    return [];
  }

  
}
export class ApiExploreDataProvider implements vscode.TreeDataProvider<ApiFileNode> {
  private _onDidChangeTreeData: vscode.EventEmitter<ApiFileNode|undefined |void> = new vscode.EventEmitter<ApiFileNode |undefined |void>();
  readonly onDidChangeTreeData?: vscode.Event<void | ApiFileNode | undefined> = this._onDidChangeTreeData.event;

  constructor(
    private readonly context:vscode.ExtensionContext,
    private readonly model:  ApiFileModel = new  ApiFileModel()
  ) {
    this.context.subscriptions.push(
      vscode.workspace.onDidChangeConfiguration(() => this.didChange())
    );
    this.context.subscriptions.push(
      vscode.window.onDidChangeActiveTextEditor(() => this.didChange())
    );
  }
  public refresh():any {
    this._onDidChangeTreeData.fire();
  }

  public getTreeItem(element: ApiFileNode): vscode.TreeItem  {
      return {
        label:element.label,
        collapsibleState:1,
        command:{
          title:'',
          command:'api-file.openurl',
          arguments:[]
        }
      };
  }
  public getChildren(element?: ApiFileNode):  ApiFileNode[] {
    if(element === undefined) {
      let result:ApiFileNode[] = [];
      console.log(nodes);
      return nodes;
    }
    // if(element.isWorkspaceNode){

    //   return; 
    // }
    return [];
    //  return element ? this.model.getChildren(element) :this.model.roots;
  }

  public didChange() {
    this.refresh();
  }
  public async clear(folders:readonly vscode.WorkspaceFolder[]|undefined) {
    nodes = [];
    workspaceFolders = folders;
    await addWorkspaceFolders();
    this.refresh();
  }

  public rebuild(){
    
  }
}

async function addWorkspaceFolders() {
  if(workspaceFolders) {
    workspaceFolders.map(async folder => {
      nodes.push( await createWorkspaceRootNode(folder));
    });
  }
}

function createWorkspaceRootNode(folder:vscode.WorkspaceFolder):ApiFileNode {
  const node:ApiFileNode = {
    isWorkspaceNode:true,
    type:'path',
    label:folder.uri.scheme==='file' ?  folder.name: folder.uri.authority,
    nodes:[],
    fsPath: folder.uri.scheme === 'file' ? folder.uri.fsPath : ( folder.uri.authority + folder.uri.fsPath ),
    visible: true,
    isFolder: true
  };
  walkFiles(folder.uri.fsPath);
  return node;
}
function walkFiles(path:string) {
  if(path) {
    // const files = await globby(path);
    // console.log(files);
  }
} 