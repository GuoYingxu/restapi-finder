import { ServerApi } from "./apiLensUtil"

const serverApiMap: Map<string, ServerApi> = new Map()

function addServerApi(sapi: ServerApi) {
  const key = sapi.rawUrl
  serverApiMap.set(key, sapi)
  console.log("add:" + key)
}

function getServerApi(key: string): ServerApi | undefined {
  return serverApiMap.get(key)
}

export default { getServerApi, addServerApi }
