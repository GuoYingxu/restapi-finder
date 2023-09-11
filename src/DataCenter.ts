import axios from "axios"
import * as vscode from "vscode"
/**
 * 数据处理模块
 *
 */

/**
 * 服务端提供的 serverapi 对象
 */
export interface ServerApi {
  method: string
  rawUrl: string
  serverName: string
}

// 服务端提供的接口
// 从clair 服务获取的数据列表
// 该数据为后端代码提供的接口列表
// 用于匹配当前项目的请求。
const serverApiMap: Map<string, ServerApi> = new Map()
/**
 * 添加到serverapi
 * @param sapi
 */
function addServerApi(sapi: ServerApi) {
  const key = sapi.rawUrl
  serverApiMap.set(key, sapi)
}
/**
 * 根据key 获取serverapi 对象
 * @param key
 * @returns
 */
function getServerApi(key: string): ServerApi | undefined {
  return serverApiMap.get(key)
}
/**
 * 清空serverapi
 * @returns
 */
function clearServerApi() {
  return serverApiMap.clear()
}

export { getServerApi, addServerApi }

// 模块
let _modules: string[] = []
export function setModules(modules: string[]) {
  _modules = modules
}
export function getModules(): string[] {
  return _modules.sort((a, b) => (a > b ? 1 : -1))
}

/**
 * 解析出来的请求 对象 结构
 */
export interface ApiRefs {
  //接口url
  url: string
  // 接口方法
  method: string
  // 格式化后的接口url
  purl: string
  // 服务名称(模块名称)
  moduleName: string
  // 后端是否存在
  exist: boolean
  // 文件名称
  fileName: string
  // 文件地址
  filePath: string
  // 文件定位
  position: vscode.Range
}
// 请求对象map
// 一个url 可能存在于多个文件中所以value 是list
const apiRefsMap: Map<string, ApiRefs[]> = new Map()

/**
 * 清空 apiRefsMap
 */
export function clearApiRefs() {
  apiRefsMap.clear()
}
/**
 * 添加一个 apiRefs
 * @param key  `${method}:${rawUrl}`格式
 * @param value
 */
export function addApiRefs(key: string, value: ApiRefs[]) {
  if (value) {
    apiRefsMap.set(key, value)
  }
}
/**
 * 根据key 查询apiRefs对象
 * @param key
 * @returns
 */
export function getApiRefs(key: string): ApiRefs[] | undefined {
  return apiRefsMap.get(key)
}
/**
 * 获取apiRefs 所有的uri
 * @returns
 */
export function getAllRefsUri(): string[] {
  return Array.from(apiRefsMap.keys())
}

export function asyncApiRefs(): void {
  const url = "http://localhost:3000/apimanage/uploadAllClientrefs"

  axios
    .post(url, { clientName: projectName, list: transformList() })
    .then(res => {
      vscode.window.showInformationMessage("上传完成！")
    })
    .catch(err => {
      console.log(err)
      vscode.window.showErrorMessage("上传失败！", err.message)
    })
}

function transformList() {
  return Array.from(apiRefsMap.keys())
    .map(key => {
      const refs = apiRefsMap.get(key)
      if (refs && refs.length > 0) {
        const ref = refs[0]
        const method = ref.method
        const uri = ref.url
        const puri = ref.purl
        const serverName = ref.moduleName
        const files = refs
          .map(r => {
            const url = r.filePath.replace(/.*\/(src\/)(.*)/, "$1$2")
            return `${url}:${(r.position.start, r.position.end)}`
          })
          .join(";")
        return {
          clientName: projectName,
          version: projectVersion,
          evnName: "develop",
          method: method,
          uri: uri,
          puri: puri,
          serverName: serverName,
          files: files,
        }
      } else {
        return undefined
      }
    })
    .filter(item => !!item)
}

// function getClientName()

let projectName: string
let projectVersion: string
export function setProjectName(name: string) {
  projectName = name
}
export function getProjectName(): string {
  return projectName
}
export function setVersion(version: string) {
  projectVersion = version
}
export function getVersion(): string {
  return projectVersion
}
