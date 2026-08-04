import { contextBridge } from "electron";

contextBridge.exposeInMainWorld("kaana", {
  hubUrl: process.env.HUB_URL ?? "http://localhost:4100",
  terminalId: process.env.TERMINAL_ID ?? "pos-1",
});
