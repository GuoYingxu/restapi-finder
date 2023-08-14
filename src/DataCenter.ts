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

/**
 * 解析出来的请求 对象 结构
 */
export interface ApiRefs {
  url: string
  method: string
  purl: string
  servername: string
  exist: boolean
  fileName: string
  position: string
}
// 请求对象map
const apiRefsMap: Map<string, ApiRefs> = new Map()
