// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import { ApiLensProvider } from "./ApiLensProvider";
import { ApiListDataProvider } from "./ApiOutlineProvider";
import { ApiExploreDataProvider } from "./apiExploreProvider";
import { FilterViewProvider } from "./viewProvider";
import axios from "axios";
import DataCenter from "./DataCenter";
import { ServerApi } from "./apiLensUtil";
let disposables: vscode.Disposable[] = [];
// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  console.log(
    'Congratulations, your extension "request-pointer" is now active!'
  );

  const apiExploreDataProvider = new ApiExploreDataProvider(context);
  //--- apilens
  vscode.languages.registerCodeLensProvider(
    [
      { scheme: "file", language: "typescript" },
      { scheme: "file", language: "javascript" },
    ],
    new ApiLensProvider()
  );
  // let disposable = vscode.commands.registerCommand(
  //   "request-pointer.helloWorld",
  //   async () => {
  //     console.log(vscode.workspace.workspaceFolders);
  //     apiExploreDataProvider.clear(vscode.workspace.workspaceFolders);
  //     await apiExploreDataProvider.rebuild();
  //   }
  // );
  // context.subscriptions.push(disposable);
  disposables.push(
    vscode.commands.registerCommand(
      "RestApiFinder.codelensAction",
      (args: any) => {
        vscode.window.showInformationMessage(
          `CodeLens action clicked with args=${args}`
        );
      }
    )
  );
  // disposables.push(disposable);

  // -- apioutline
  const treeDataProvider = new ApiListDataProvider(context);
  vscode.window.createTreeView("api.views.explorer", {
    treeDataProvider,
  });
  treeDataProvider.didChange();
  // 跳转事件
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "RestApiFinder.api.selection",
      (range: vscode.Range) => {
        const editor = vscode.window.activeTextEditor;
        if (editor !== undefined) {
          editor.selection = new vscode.Selection(range.start, range.end);
          editor.revealRange(
            range,
            vscode.TextEditorRevealType.InCenterIfOutsideViewport
          );
          vscode.window.showTextDocument(editor.document);
        }
      }
    )
  );
  // -- explore tree

  var apiExporeTreeView = vscode.window.createTreeView("api-tree-view", {
    treeDataProvider: apiExploreDataProvider,
  });

  // context.subscriptions.push(apiExploreDataProvider)
  context.subscriptions.push(apiExporeTreeView);

  const explorWorkspaceDisposable =
    vscode.workspace.onDidChangeWorkspaceFolders(async () => {
      apiExploreDataProvider.clear(vscode.workspace.workspaceFolders);
      await apiExploreDataProvider.rebuild();
    });
  const exploreConfigDisposable = vscode.workspace.onDidChangeConfiguration(
    async e => {
      apiExploreDataProvider.clear(vscode.workspace.workspaceFolders);
      await apiExploreDataProvider.rebuild();
    }
  );
  context.subscriptions.push(explorWorkspaceDisposable, exploreConfigDisposable);
  apiExploreDataProvider.clear(vscode.workspace.workspaceFolders);
  apiExploreDataProvider.rebuild();
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "api-file.openurl",
      (fsPath: string, range: vscode.Range) => {
        vscode.workspace
          .openTextDocument(vscode.Uri.file(fsPath))
          .then(document => {
            vscode.window.showTextDocument(document, { preview: false });
          })
          .then(() => {
            const textEditor = vscode.window.activeTextEditor;
            if (!textEditor) {
              return;
            }
            const selection = new vscode.Selection(range.start, range.end);
            textEditor.selection = selection;
            textEditor.revealRange(
              selection,
              vscode.TextEditorRevealType.Default
            );
          });
      }
    )
  );
  disposables.push(explorWorkspaceDisposable, exploreConfigDisposable);

  axios.get("http://localhost:3000/apimanage/serverapiforPlugin").then(res => {
    res.data.forEach((api: any) => {
      if (!api.method || !api.puri) {return;};
      let rawUrl = "";
      if (api.puri && api.puri.indexOf("=>") > 0) {
        rawUrl = `/api/${api.server}/${api.puri.split("=>")[1]}`;
      }
      const sapi: ServerApi = {
        serverName: api.server,
        rawUrl: rawUrl,
        method: api.method.toUpperCase(),
      };
      DataCenter.addServerApi(sapi);
    });
  });

  // 刷新按钮
  context.subscriptions.push(
    vscode.commands.registerCommand("RestApiFinder.refreshEntry", () => {
      apiExploreDataProvider.clear(vscode.workspace.workspaceFolders);
      apiExploreDataProvider.rebuild();
    }),
    vscode.commands.registerCommand("RestApiFinder.setfilter", filter => {
      apiExploreDataProvider.updateFilter(filter);
    })
  );

  // search view
  const viewProvider = new FilterViewProvider(context.extensionUri);
  const viewDisposable = vscode.window.registerWebviewViewProvider(
    FilterViewProvider.viewType,
    viewProvider
  );
  context.subscriptions.push(viewDisposable);
  disposables.push(viewDisposable);
}

// This method is called when your extension is deactivated
export function deactivate() {
  if (disposables) {
    disposables.forEach(item => item.dispose());
  }
  disposables = [];
}
