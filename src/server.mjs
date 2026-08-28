import { spawn } from "node:child_process";
import { lettaAcpInvocation } from "./runtime.mjs";

export function runServer(env = process.env) {
  if (!env.LETTA_AGENT_ID) {
    throw new Error("LETTA_AGENT_ID must identify the persistent Letta agent to use");
  }
  env.LETTA_ACP_BACKEND ||= "cloud-oauth";
  env.LETTA_ACP_PERMISSION_MODE ||= "standard";
  const invocation = lettaAcpInvocation(env);
  const child = spawn(invocation.command, invocation.args, { env, stdio: "inherit" });
  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.once(signal, () => child.kill(signal));
  }
  child.on("error", (error) => {
    console.error(`letta-acp-server: ${error.message}`);
    process.exitCode = 1;
  });
  child.on("close", (code, signal) => {
    if (signal) process.kill(process.pid, signal);
    else process.exitCode = code ?? 1;
  });
}
