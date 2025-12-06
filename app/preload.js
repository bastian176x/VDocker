// preload.js
const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("api", {
  hello: () => "hola desde preload"
});
