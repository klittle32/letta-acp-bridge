import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createInterface } from "node:readline/promises";
import {
  findProjectRoot,
  projectConfigPath,
  readConfig,
  userConfigPath,
} from "./profile-config.mjs";

function parseAddArgs(argv) {
  const options = { serverArgs: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help") options.help = true;
    else if (arg === "--default") options.makeDefault = true;
    else if (arg === "--server-arg") {
      if (!argv[i + 1]) throw new Error("Unknown or incomplete option: --server-arg");
      options.serverArgs.push(argv[++i]);
    } else if (arg.startsWith("--")) {
      const key = {
        "--scope": "scope",
        "--name": "name",
        "--agent-id": "agentId",
        "--backend": "backend",
        "--permission-mode": "permissionMode",
        "--server-command": "serverCommand",
        "--cwd": "cwd",
      }[arg];
      if (!key || !argv[i + 1]) throw new Error(`Unknown or incomplete option: ${arg}`);
      options[key] = argv[++i];
    } else throw new Error(`Unexpected argument: ${arg}`);
  }
  return options;
}

async function fillInteractive(options, io) {
  if (options.scope && options.name && options.agentId) return options;
  if (!io.stdin.isTTY) {
    throw new Error("--scope, --name, and --agent-id are required without an interactive terminal");
  }
  const rl = createInterface({ input: io.stdin, output: io.stdout });
  try {
    options.scope ||= await rl.question("Scope (user/project): ");
    options.name ||= await rl.question("Profile name: ");
    options.agentId ||= await rl.question("Letta agent ID: ");
    options.backend ||= (await rl.question("Backend [cloud-oauth]: ")) || "cloud-oauth";
    options.permissionMode ||=
      (await rl.question("Permission mode [standard]: ")) || "standard";
    if (!options.serverCommand) {
      options.serverCommand = await rl.question("Custom ACP server command [automatic]: ");
      if (options.serverCommand) {
        const value = (await rl.question("Server arguments as JSON [[]]: ")) || "[]";
        options.serverArgs = JSON.parse(value);
        if (
          !Array.isArray(options.serverArgs) ||
          options.serverArgs.some((arg) => typeof arg !== "string")
        ) throw new Error("Server arguments must be a JSON array of strings");
      }
    }
  } finally {
    rl.close();
  }
  return options;
}

function readExisting(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return { version: 1, profiles: {} };
    throw error;
  }
}

function writeAtomic(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  const temp = join(dirname(path), `.config.${process.pid}.${randomUUID()}.tmp`);
  try {
    writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, {
      mode: 0o600,
      flag: "wx",
    });
    renameSync(temp, path);
  } finally {
    try {
      unlinkSync(temp);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
}

export async function addProfile(argv, io = process) {
  const parsed = parseAddArgs(argv);
  if (parsed.help) {
    io.stdout.write(`Usage: letta-acp-bridge profile add --scope user|project --name <name> --agent-id <id> [options]\n\nOptions:\n  --backend <name>           Default: cloud-oauth\n  --permission-mode <mode>  Default: standard\n  --server-command <path>   Optional custom ACP server executable\n  --server-arg <value>      Repeat for each custom server argument\n  --default                 Make this profile the scope default\n  --cwd <path>              Project lookup directory\n`);
    return;
  }
  const options = await fillInteractive(parsed, io);
  if (!["user", "project"].includes(options.scope)) {
    throw new Error("--scope must be user or project");
  }
  if (!/^[A-Za-z0-9._-]+$/.test(options.name)) {
    throw new Error("Profile name may contain only letters, numbers, dot, underscore, and hyphen");
  }
  if (options.serverArgs.length && !options.serverCommand) {
    throw new Error("--server-arg requires --server-command");
  }

  const projectRoot = findProjectRoot(options.cwd || process.cwd());
  const path = options.scope === "user" ? userConfigPath() : projectConfigPath(projectRoot);
  const config = readExisting(path);
  if (
    config.version !== 1 ||
    !config.profiles ||
    typeof config.profiles !== "object" ||
    Array.isArray(config.profiles)
  ) throw new Error(`Invalid existing config: ${path}`);

  const profile = { agentId: options.agentId };
  if (options.backend) profile.backend = options.backend;
  if (options.permissionMode) profile.permissionMode = options.permissionMode;
  if (options.serverCommand) {
    profile.server = { command: options.serverCommand, args: options.serverArgs };
  }
  config.profiles[options.name] = profile;
  if (options.makeDefault || !config.defaultProfile) config.defaultProfile = options.name;
  writeAtomic(path, config);
  io.stdout.write(`Saved Letta profile ${options.name} to ${path}\n`);
}

export function listProfiles(argv, io = process) {
  let cwd = process.cwd();
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--cwd" && argv[i + 1]) cwd = argv[++i];
    else throw new Error(`Unknown or incomplete option: ${argv[i]}`);
  }
  const userPath = userConfigPath();
  const projectPath = projectConfigPath(findProjectRoot(cwd));
  const user = readConfig(userPath);
  const project = readConfig(projectPath);
  const names = [...new Set([...Object.keys(user.profiles), ...Object.keys(project.profiles)])].sort();
  if (!names.length) {
    io.stdout.write("No Letta profiles configured.\n");
    return;
  }
  for (const name of names) {
    const scope = Object.hasOwn(project.profiles, name) ? "project" : "user";
    const selected = name === (project.defaultProfile || user.defaultProfile) ? "*" : " ";
    io.stdout.write(`${selected} ${name} (${scope})\n`);
  }
}
