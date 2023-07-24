import * as vscode from "vscode";
import * as ts from "typescript";
export class ApiLens extends vscode.CodeLens {
  private _fileName: string;
  private _url: string;
  private _title: string;
  constructor(
    filename: string,
    range: vscode.Range,
    title: string,
    url: string
  ) {
    super(range, {
      arguments: ["1", false],
      command: "request-pointer.codelensAction",
      title: title,
    });
    this._url = url;
    this._fileName = filename;
    this._title = title;
  }
  get label() {
    return this._title.replace(/\${.*?}/g, ":param");
  }
  get rawUrl() {
    return this._url.replace(/\${.*?}/g, ":param");
  }

  get filename() {
    return this._fileName;
  }
}

export function finder(document: vscode.TextDocument): Array<ApiLens> {
  try {
    const sfile = ts.createSourceFile(
      document.uri.toString(),
      document.getText(),
      ts.ScriptTarget.Latest,
      true
    );
    const collector: Array<ApiModel> = [];
    // 遍历node
    walker(sfile, collector, document);
    return collector.map(model => {
      return new ApiLens(
        document.uri.toString(),
        model.range,
        `${model.method?.toUpperCase()}:${model.url}`,
        model.url
      );
    });
  } catch (e) {
    console.log(e);
  }

  return [];
}

/**
 * 解析文件
 * @param document
 */
export function parseDocument(document: vscode.TextDocument): Array<ApiModel> {
  try {
    const sfile = ts.createSourceFile(
      document.uri.toString(),
      document.getText(),
      ts.ScriptTarget.Latest,
      true
    );
    const collector: Array<ApiModel> = [];
    // 遍历node
    walker(sfile, collector, document);
    return collector;
  } catch (e) {
    console.log(e);
  }
  return [];
}
/**
 * 节点遍历方法
 * @param node
 * @param collector
 */
function walker(
  node: ts.Node,
  collector: Array<ApiModel>,
  document: vscode.TextDocument
) {
  switch (node.kind) {
    case ts.SyntaxKind.CallExpression:
      // 如果节点匹配
      const model = match(node, document);
      if (model) {
        collector.push(model);
      }
      break;
    default:
      break;
  }
  ts.forEachChild(node, cnode => {
    return walker(cnode, collector, document);
  });
}

export interface ApiModel {
  method: string
  url: string
  range: vscode.Range
}
/**
 * 匹配请求特征
 * @param node
 * @returns
 */
function match(
  node: ts.Node,
  document: vscode.TextDocument
): ApiModel | undefined {
  let isMatched = false;
  let apiModel: ApiModel | undefined;
  // 1. callExpression ->PropertyAccessExpression ->Identifier  is axios
  // 2. callExpression ->Identifier  is axios
  ts.forEachChild(node, cnode => {
    // 1 axios.get 形式
    if (ts.isPropertyAccessExpression(cnode)) {
      ts.forEachChild(cnode, ccnode => {
        if (
          ts.isIdentifier(ccnode) &&
          matchRequestLib(ccnode.escapedText.toString())
        ) {
          apiModel = getApiModel(node, document);
        }
      });
    }
    // 2
    // axios({...}) 形式
    if (
      ts.isIdentifier(cnode) &&
      matchRequestLib(cnode.escapedText.toString())
    ) {
      apiModel = getApiModel(node, document);
    }
  });
  return apiModel;
}
/**
 * 判断是否匹配请求类库的实例名称
 * @param text
 * @returns
 */
function matchRequestLib(text: string) {
  let regexString: string | undefined = vscode.workspace
    .getConfiguration()
    .get("api.requestInstanceRegx");
  if (!regexString) {
    regexString = "Axios|uapi|api";
  }
  return new RegExp(regexString, "ig").test(text);
}
/**
 * 解析apiModel
 * @param node
 * @returns
 */
function getApiModel(node: ts.Node, document: vscode.TextDocument): ApiModel {
  const model: any = { url: "" };
  let methodReady = false;
  ts.forEachChild(node, cnode => {
    // axios.get|axios.put|axios.patch|axios.delete 形式
    if (ts.isPropertyAccessExpression(cnode)) {
      ts.forEachChild(cnode, ccnode => {
        if (
          ts.isIdentifier(ccnode) &&
          !matchRequestLib(ccnode.escapedText.toString())
        ) {
          model.method = ccnode.escapedText.toString().toUpperCase();
          const textline = document.lineAt(document.positionAt(ccnode.pos));
          model.range = textline.range;
          methodReady = true;
        }
      });
    } else {
      // 其他类型 为 callee 的参数
      // 只取第一个参数
      if (!model.url && methodReady) {
        model.url = caculateExpressionText(cnode);
      }
      // axios({method:'get',url:'api/users'})
      if (!methodReady) {
        if (ts.isObjectLiteralExpression(cnode)) {
          ts.forEachChild(cnode, ccnode => {
            if (ts.isPropertyAssignment(ccnode)) {
              let i = 0;
              let key = "";
              ts.forEachChild(ccnode, cccnode => {
                // 第一个参数 key, 只取 method 和url
                if (
                  i === 0 &&
                  ts.isIdentifier(cccnode) &&
                  (cccnode.text === "method" || cccnode.text === "url")
                ) {
                  key =  cccnode.text === 'method' ? cccnode.text.toUpperCase()  : cccnode.text;
                  i++;
                } else if (i === 1 && key) {
                  //第二个参数为值
                  model[key] = caculateExpressionText(cccnode);
                  i++;
                }
              });
            }
          });
          if (model.method) {
            const textline = document.lineAt(document.positionAt(cnode.pos));
            model.range = textline.range;
          }
        }
      }
    }
  });
  return {
    url: getUrl(model.url),
    method: model.method,
    range: model.range,
  };
}
/**
 * 根据节点类型获取字符串内容
 * @param cnode
 */
function caculateExpressionText(node: ts.Node) {
  // 模板字符串
  // 如： axios.get(`api/user/${id}`)
  if (ts.isTemplateExpression(node)) {
    return node.getText();
  }
  // 普通字符串
  // 如：axios.get('api/userlist')
  if (ts.isStringLiteral(node)) {
    return node.text;
  }
  // 表达式
  // 如： axios.get('api/users/'+ userId)
  if (ts.isBinaryExpression(node)) {
    let res = "";
    ts.forEachChild(node, cnode => {
      res += caculateExpressionText(cnode);
    });
    return res;
  }
  // 变量
  if (ts.isIdentifier(node)) {
    return "${param}";
  }
  // 条件表达式
  if (ts.isConditionalExpression(node)) {
    return "${param}";
  }
  // 括号表达式
  if (ts.isParenthesizedExpression(node)) {
    return "${param}";
  }
  // url 是通过方法返回
  // 取node 的第二个子节点
  if (ts.isCallExpression(node)) {
    let index = 0;
    let res = "";
    ts.forEachChild(node, cnode => {
      if (index === 1) {
        res = caculateExpressionText(cnode);
      }
      index++;
    });
    return res;
  }
  return "";
}

/**
 * 截取url
 * @param url
 * @returns
 */
function getUrl(url: string) {
  if (!url) {return "";};
  url = url.replace(/`/g, "");
  if (url.indexOf("?") > 0) {
    return url.split("?")[0];
  }
  return url;
}
