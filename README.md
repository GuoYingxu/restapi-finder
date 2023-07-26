# request-pointer README

This is the README for your extension "request-pointer". After writing up a brief description, we recommend including the following sections.

## Features

1. 分析当前 ts/js/vue 文件中使用 axios 发起的 request 请求
2. 收集整个项目中 ts/js/vue 文件中使用 axios 发起的 request 请求
3. 支持对整个项目中的 axiso 请求 url 进行搜索

## Requirements

If you have any requirements or dependencies, add a section describing those and how to install and configure them.

## Extension Settings

This extension contributes the following settings:

- `api.requestInstanceRegx`: 一个正则表达式，用于识别请求的 axios 的 instance，比如：`^(Axios|axiosNormalInstance|axisInstance)$`.
- `api.modules`: 一个数组，用于对请求进行分类 比如 [{"base":0,"course":0}].

## Known Issues

Calling out known issues can help limit users opening duplicate issues against your extension.

## Release Notes

Users appreciate release notes as you update your extension.

### 1.0.0

Initial release of ...

### 1.0.1

Fixed issue #.

### 1.1.0

Added features X, Y, and Z.

---

## Following extension guidelines

Ensure that you've read through the extensions guidelines and follow the best practices for creating your extension.

- [Extension Guidelines](https://code.visualstudio.com/api/references/extension-guidelines)

## Working with Markdown

You can author your README using Visual Studio Code. Here are some useful editor keyboard shortcuts:

- Split the editor (`Cmd+\` on macOS or `Ctrl+\` on Windows and Linux).
- Toggle preview (`Shift+Cmd+V` on macOS or `Shift+Ctrl+V` on Windows and Linux).
- Press `Ctrl+Space` (Windows, Linux, macOS) to see a list of Markdown snippets.

## For more information

- [Visual Studio Code's Markdown Support](http://code.visualstudio.com/docs/languages/markdown)
- [Markdown Syntax Reference](https://help.github.com/articles/markdown-basics/)

**Enjoy!**
