import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const acpxEntry = fileURLToPath(import.meta.resolve("acpx"));
const lettaAcpEntry = fileURLToPath(import.meta.resolve("@letta-ai/letta-acp"));
const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));

export function acpxInvocation(env = process.env) {
  if (env.ACPX_BIN) return { command: env.ACPX_BIN, args: [] };
  return { command: process.execPath, args: [acpxEntry] };
}

export function acpxAgentInvocation() {
  return { argv: [process.execPath, join(packageRoot, "bin", "letta-acp-server.js")] };
}

export function lettaAcpInvocation(env = process.env) {
  if (env.LETTA_ACP_SERVER_COMMAND) {
    let args = [];
    if (env.LETTA_ACP_SERVER_ARGS_JSON) {
      args = JSON.parse(env.LETTA_ACP_SERVER_ARGS_JSON);
      if (!Array.isArray(args) || args.some((arg) => typeof arg !== "string")) {
        throw new Error("LETTA_ACP_SERVER_ARGS_JSON must be an array of strings");
      }
    }
    return { command: env.LETTA_ACP_SERVER_COMMAND, args };
  }
  return { command: process.execPath, args: [lettaAcpEntry] };
}
