import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

export function userConfigPath(env = process.env) {
  const root = env.XDG_CONFIG_HOME || join(homedir(), ".config");
  return join(root, "letta-acp-bridge", "config.json");
}

export function findProjectRoot(cwd = process.cwd()) {
  try {
    return execFileSync("git", ["rev-parse", "--show-toplevel"], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return resolve(cwd);
  }
}

export function projectConfigPath(projectRoot) {
  return join(projectRoot, ".letta-acp-bridge", "config.json");
}

export function readConfig(path) {
  if (!existsSync(path)) return { version: 1, profiles: {} };
  let config;
  try {
    config = JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new Error(`Cannot read Letta profile config ${path}: ${error.message}`);
  }
  if (
    config.version !== 1 ||
    !config.profiles ||
    typeof config.profiles !== "object" ||
    Array.isArray(config.profiles)
  ) {
    throw new Error(`Invalid Letta profile config ${path}: expected version 1 with profiles`);
  }
  return config;
}

function validateProfile(name, profile) {
  if (!profile || typeof profile !== "object" || Array.isArray(profile)) {
    throw new Error(`Invalid Letta profile ${name}: expected an object`);
  }
  if (typeof profile.agentId !== "string" || !profile.agentId.trim()) {
    throw new Error(`Invalid Letta profile ${name}: agentId is required`);
  }
  if (profile.server !== undefined) {
    if (
      !profile.server ||
      typeof profile.server.command !== "string" ||
      !profile.server.command.trim()
    ) {
      throw new Error(`Invalid Letta profile ${name}: server.command must be a non-empty string`);
    }
    if (
      profile.server.args !== undefined &&
      (!Array.isArray(profile.server.args) ||
        profile.server.args.some((arg) => typeof arg !== "string"))
    ) {
      throw new Error(`Invalid Letta profile ${name}: server.args must be an array of strings`);
    }
  }
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map(
      (key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`,
    ).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function resolveProfile({
  cwd = process.cwd(),
  userPath = userConfigPath(),
  projectRoot = findProjectRoot(cwd),
  profileName,
} = {}) {
  const user = readConfig(userPath);
  const projectPath = projectConfigPath(projectRoot);
  const project = readConfig(projectPath);
  const profiles = { ...user.profiles, ...project.profiles };
  const name = profileName || project.defaultProfile || user.defaultProfile;

  if (!name) {
    throw new Error(
      "No Letta profile selected. Pass --profile <name> or configure a default with letta-acp-bridge profile add.",
    );
  }
  if (typeof name !== "string" || !/^[A-Za-z0-9._-]+$/.test(name)) {
    throw new Error(`Invalid Letta profile name: ${JSON.stringify(name)}`);
  }
  const profile = profiles[name];
  if (!profile) {
    throw new Error(
      `Letta profile ${JSON.stringify(name)} was not found. Run letta-acp-bridge profile add --name ${name}.`,
    );
  }
  validateProfile(name, profile);
  const fingerprint = createHash("sha256")
    .update(canonicalJson(profile))
    .digest("hex")
    .slice(0, 8);

  return {
    name,
    profile,
    fingerprint,
    sessionName: `${name}-${fingerprint}`,
    projectRoot,
    userPath,
    projectPath,
  };
}
