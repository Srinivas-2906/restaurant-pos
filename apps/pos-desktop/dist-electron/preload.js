"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld("kaana", {
    hubUrl: process.env.HUB_URL ?? "http://localhost:4100",
    terminalId: process.env.TERMINAL_ID ?? "pos-1",
});
