import * as vscode from "vscode"
import { ApiFileNode } from "./ApiExplorer"
import { flatten } from "lodash-es"
import { globby } from "globby"
import { ApiModel, parseDocument } from "./apiLensUtil"
import {
  ApiRefs,
  addApiRefs,
  getApiRefs,
  getModules,
  getServerApi,
} from "./DataCenter"

export function initRoot(
  folders: readonly vscode.WorkspaceFolder[]
): ApiFileNode[] {
  console.log("initRoot")
  return folders.map((folder): ApiFileNode => {
    return {
      isWorkspaceNode: true,
      type: "root",
      label: folder.uri.scheme === "file" ? folder.name : folder.uri.authority,
      nodes: [],
      fsPath:
        folder.uri.scheme === "file"
          ? folder.uri.fsPath
          : folder.uri.authority + folder.uri.fsPath,
      visible: true,
      isFolder: true,
    }
  })
}
/**
 * 解析项目
 * @param folders
 */
export async function parseWorkspace(
  folders: readonly vscode.WorkspaceFolder[]
) {
  // glob 参数
  // TODO 作为配置参数传入
  const GLOB_INCLUDE = "src/**/*.{js|ts|vue}"
  const GLOB_EXCLUDE = "!*.config.*"
  // collect fils
  const paths = flatten(
    await Promise.all(
      folders.map(cwd =>
        globby(`src/**`, {
          cwd: cwd.uri.fsPath,
          dot: false,
          absolute: true,
          onlyFiles: false,
          objectMode: true,
        })
      )
    )
  )
  // console.log("paths:", paths)
  // 配置项的模块
  const moduleNames = getModules()
  // 解析文件
  await Promise.all(
    paths.map(async entry => {
      // TODO 支持 tsx 文件
      // 只解析 ts| js| vue 文件
      if (
        entry.dirent.isFile() &&
        entry.name.match(/\.(ts|js|vue)$/i) !== null &&
        entry.name.match(/\.config\.*/) == null
      ) {
        const document = await vscode.workspace.openTextDocument(
          vscode.Uri.file(entry.path)
        )

        const currentFileApis: ApiModel[] = parseDocument(document)

        currentFileApis.forEach((api: ApiModel) => {
          // 解析接口所属模块

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
            fileName: entry.name,
            filePath: entry.path,
            position: api.range,
          }

          let key = `${api.method}:${rawUrl}`
          let apiRefsList = getApiRefs(key)
          if (apiRefsList) {
            apiRefsList.push(apiRefs)
            addApiRefs(key, apiRefsList)
          } else {
            addApiRefs(key, [apiRefs])
          }
        })
      }
    })
  )
}
/**
 * 解析所属模块
 * 使用 xxxapi/{moduleName}/xxx的方式进行匹配
 * TODO 使用配置项规则解析moduleName
 * @param uri
 * @returns
 */
export function parseModuleName(uri: string) {
  return uri.replace(/.*\/api\/(.*?)\/.*/gi, "$1")
}
