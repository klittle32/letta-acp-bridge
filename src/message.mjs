import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { createAcpRuntime, createAgentRegistry, createRuntimeStore } from "acpx/runtime";
import { resolveProfile } from "./profile-config.mjs";
import { run } from "./process.mjs";
import { acpxAgentInvocation, acpxInvocation } from "./runtime.mjs";

const HELP = `Usage: letta-acp-bridge message [--verbose] [--profile <name>] <message>\n`;
const PROFILE_ENV_KEYS = [
  "LETTA_AGENT_ID",
  "LETTA_ACP_BACKEND",
  "LETTA_ACP_PERMISSION_MODE",
  "LETTA_ACP_SERVER_COMMAND",
  "LETTA_ACP_SERVER_ARGS",
  "LETTA_ACP_SERVER_ARGS_JSON",
];

function parseArgs(argv) {
  let profileName;
  let verbose = false;
  const message = [];
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--profile") {
      if (!argv[i + 1] || ["--", "--profile", "--verbose"].includes(argv[i + 1])) {
        throw new Error("--profile requires a name");
      }
      profileName = argv[++i];
    } else if (argv[i] === "--verbose") verbose = true;
    else if (argv[i] === "--") {
      message.push(...argv.slice(i + 1));
      break;
    } else message.push(argv[i]);
  }
  return { profileName, verbose, message: message.join(" ") };
}

export async function sendMessage(argv, io = process) {
  if (argv.length === 1 && argv[0] === "--help") {
    io.stdout.write(HELP);
    return;
  }
  const parsed = parseArgs(argv);
  let message = parsed.message;
  if (!message && !io.stdin.isTTY) message = readFileSync(0, "utf8").trimEnd();
  if (!message) {
    throw new Error(HELP.trimEnd());
  }

  const cwd = process.env.LETTA_MESSAGE_CWD || process.cwd();
  const resolved = resolveProfile({ cwd, profileName: parsed.profileName });
  const skillPath = process.env.LETTA_ACP_BRIDGE_SKILL_PATH;
  const sessionName = skillPath
    ? `${resolved.sessionName}-${createHash("sha256").update(skillPath).digest("hex").slice(0, 8)}`
    : resolved.sessionName;
  const profile = resolved.profile;
  const env = {
    ...process.env,
    LETTA_AGENT_ID: profile.agentId,
    LETTA_ACP_BACKEND: profile.backend || "cloud-oauth",
    LETTA_ACP_PERMISSION_MODE: profile.permissionMode || "standard",
  };
  delete env.LETTA_ACP_SERVER_COMMAND;
  delete env.LETTA_ACP_SERVER_ARGS;
  delete env.LETTA_ACP_SERVER_ARGS_JSON;
  if (profile.server) {
    env.LETTA_ACP_SERVER_COMMAND = profile.server.command;
    env.LETTA_ACP_SERVER_ARGS_JSON = JSON.stringify(profile.server.args || []);
  }

  // Preserve the explicit ACPX executable override used by integration tests
  // and advanced callers. The package-local production path below never uses
  // the CLI's raw custom-agent command form.
  if (process.env.ACPX_BIN) {
    const invocation = acpxInvocation(process.env);
    const agent = acpxAgentInvocation().argv[1];
    await run(invocation.command, [
      ...invocation.args,
      "--cwd", cwd,
      agent,
      "sessions", "ensure", "--name", sessionName,
    ], { env, quiet: true });
    await run(invocation.command, [
      ...invocation.args,
      "--cwd", cwd,
      "--format", parsed.verbose ? "text" : "quiet",
      agent,
      "prompt", "--session", sessionName, "--file", "-",
    ], { env, stdin: `${message}\n` });
    return;
  }

  const agentName = "letta-acp-bridge";
  const stateDir = process.env.ACPX_STATE_DIR || join(homedir(), ".acpx");
  const runtime = createAcpRuntime({
    cwd,
    sessionStore: createRuntimeStore({ stateDir }),
    agentRegistry: createAgentRegistry({
      overrides: { [agentName]: acpxAgentInvocation().argv },
    }),
    permissionMode: "approve-reads",
  });

  // ACPX launches agents with the current process environment. Apply the
  // resolved profile only for this exchange, then restore the caller's env.
  const previousEnv = new Map(PROFILE_ENV_KEYS.map((key) => [key, process.env[key]]));
  for (const key of PROFILE_ENV_KEYS) {
    if (env[key] === undefined) delete process.env[key];
    else process.env[key] = env[key];
  }
  try {
    const handle = await runtime.ensureSession({
      sessionKey: sessionName,
      agent: agentName,
      mode: "persistent",
      cwd,
    });
    const turn = runtime.startTurn({
      handle,
      text: message,
      mode: "prompt",
      requestId: `letta-message-${Date.now()}`,
    });
    let output = "";
    for await (const event of turn.events) {
      if (event.type === "text_delta" && (parsed.verbose || event.stream !== "thought")) {
        output += event.text;
      } else if (parsed.verbose && event.type === "status" && event.text) {
        output += `[${event.tag || "status"}] ${event.text}\n`;
      }
    }
    const result = await turn.result;
    if (result.status === "failed") throw new Error(result.error.message);
    if (result.status === "cancelled") throw new Error("ACPX message turn was cancelled");
    if (output) {
      await new Promise((resolve, reject) => {
        io.stdout.write(output, (error) => error ? reject(error) : resolve());
      });
    }
    // The embedded runtime intentionally retains its ACP connection for reuse.
    // Tell executable callers to exit after stdout drains; closing the pipe
    // cleanly stops the local server without closing the persistent Letta
    // conversation or deleting ACPX session state.
    return { exitAfterMessage: true };
  } finally {
    for (const [key, value] of previousEnv) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}
