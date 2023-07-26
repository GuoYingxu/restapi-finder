# request-pointer README

## Features

1. 分析当前 ts/js/vue 文件中使用 axios 发起的 request 请求
2. 收集整个项目中 ts/js/vue 文件中使用 axios 发起的 request 请求
3. 支持对整个项目中的 axiso 请求 url 进行搜索

## Extension Settings

- `api.requestInstanceRegx`: 一个正则表达式，用于识别请求的 axios 的 instance，比如：`^(Axios|axiosNormalInstance|axisInstance)$`.
- `api.modules`: 一个数组，用于对请求进行分类 比如 [{"base":0,"course":0}].

## Release Notes

### 1.0.0

1. 检索 url
2. 支持全局搜索
