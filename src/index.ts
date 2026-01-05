import { defineApp } from "kly";
import { startTool } from "./tools/start";

export default defineApp({
  name: "cc",
  version: "0.1.0",
  description: "Fast Claude Code API provider switcher",
  tools: [startTool],
});
