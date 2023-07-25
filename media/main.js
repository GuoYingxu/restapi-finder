//@ts-check

// This script will be run within the webview itself
// It cannot access the main VS Code APIs directly.
;(function () {
  // @ts-ignore
  const vscode = acquireVsCodeApi()
  //   console.log(document.querySelector(".search-button"))
  // @ts-ignore
  document.querySelector(".search-button").addEventListener("click", () => {
    let input = document.querySelector(".filter-input")
    if (input) {
      // @ts-ignore
      let text = input.value.trim()
      if (text && text?.length > 0) {
        search(text)
      }
    }
  })
  document.querySelector(".clear-button")?.addEventListener("click", () => {
    let input = document.querySelector(".filter-input")
    if (input) {
      // @ts-ignore
      input.value = ""
      search("")
    }
  })

  // Handle messages sent from the extension to the webview
  window.addEventListener("clearfilter", event => {
    document.querySelector(".filter-input")?.setAttribute("text", "")
  })
  function search(text) {
    // @ts-ignore
    vscode.postMessage({ type: "apifilter", value: text })
  }
})()
