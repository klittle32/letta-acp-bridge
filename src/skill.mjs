import { cpSync, existsSync, mkdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, parse, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

function messageWrapperSource(messageModuleUrl) {
  return `#!/usr/bin/env node

import { realpathSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { sendMessage } from ${JSON.stringify(messageModuleUrl)};

const skillPath = realpathSync(dirname(dirname(fileURLToPath(import.meta.url))));
process.env.LETTA_ACP_BRIDGE_SKILL_PATH = skillPath;

try {
  await sendMessage(process.argv.slice(2));
} catch (error) {
  console.error(\`letta-acp-bridge: \${error.message}\`);
  process.exitCode = 2;
}
`;
}

export function bundledSkillPath() {
  const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
  const path = join(packageRoot, "skills", "communicating-with-letta");
  return existsSync(path) ? realpathSync(path) : path;
}

export function installSkill(argv, io = process) {
  let target;
  let force = false;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--target" && argv[i + 1]) target = argv[++i];
    else if (argv[i] === "--force") force = true;
    else throw new Error(`Unknown or incomplete option: ${argv[i]}`);
  }
  if (!target) throw new Error("--target is required");
  const destination = isAbsolute(target) ? target : resolve(process.cwd(), target);
  if (destination === parse(destination).root) {
    throw new Error("Refusing to install a skill at the filesystem root");
  }
  if (existsSync(destination)) {
    if (!force) throw new Error(`Skill target already exists: ${destination}`);
    rmSync(destination, { recursive: true, force: true });
  }
  mkdirSync(dirname(destination), { recursive: true });
  cpSync(bundledSkillPath(), destination, { recursive: true, errorOnExist: true });
  const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
  const messageModuleUrl = pathToFileURL(join(packageRoot, "src", "message.mjs")).href;
  writeFileSync(
    join(destination, "scripts", "letta-message"),
    messageWrapperSource(messageModuleUrl),
    { mode: 0o755 },
  );
  io.stdout.write(`Installed communicating-with-letta skill to ${destination}\n`);
}
