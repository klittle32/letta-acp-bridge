import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveProfile } from "./profile-config.mjs";
import { run } from "./process.mjs";
import { acpxInvocation } from "./runtime.mjs";

const HELP = `Usage: letta-acp-bridge message [--verbose] [--profile <name>] <message>\n`;

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

  const invocation = acpxInvocation(process.env);
  const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
  const agent = join(packageRoot, "bin", "letta-acp-server.js");
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
}
