import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  chmodSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

import { resolveProfile } from "../skills/communicating-with-letta/scripts/profile-config.mjs";

const root = resolve(import.meta.dirname, "..");
const scripts = join(root, "skills", "communicating-with-letta", "scripts");

function writeJson(path, value) {
  mkdirSync(resolve(path, ".."), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

test("project profiles extend user profiles and replace same-name objects", () => {
  const temp = mkdtempSync(join(tmpdir(), "letta-profile-"));
  const userPath = join(temp, "user.json");
  const projectRoot = join(temp, "project");
  const projectPath = join(projectRoot, ".letta-acp-bridge", "config.json");

  writeJson(userPath, {
    version: 1,
    defaultProfile: "shared",
    profiles: {
      shared: {
        agentId: "agent-user",
        backend: "cloud-oauth",
        permissionMode: "standard",
        server: { command: "user-launcher", args: ["--user"] },
      },
      userOnly: { agentId: "agent-user-only" },
    },
  });
  writeJson(projectPath, {
    version: 1,
    profiles: {
      shared: { agentId: "agent-project" },
      projectOnly: { agentId: "agent-project-only" },
    },
  });

  const userFingerprint = resolveProfile({
    userPath,
    projectRoot: join(temp, "no-project-config"),
    profileName: "shared",
  }).fingerprint;
  const shared = resolveProfile({ userPath, projectRoot });
  assert.equal(shared.name, "shared");
  assert.equal(shared.profile.agentId, "agent-project");
  assert.equal(shared.profile.server, undefined);
  assert.match(shared.sessionName, /^shared-[a-f0-9]{8}$/);
  assert.notEqual(shared.fingerprint, userFingerprint);

  assert.equal(
    resolveProfile({ userPath, projectRoot, profileName: "userOnly" }).profile.agentId,
    "agent-user-only",
  );
  assert.equal(
    resolveProfile({ userPath, projectRoot, profileName: "projectOnly" }).profile.agentId,
    "agent-project-only",
  );
});

test("project default profile overrides the user default", () => {
  const temp = mkdtempSync(join(tmpdir(), "letta-profile-"));
  const userPath = join(temp, "user.json");
  const projectRoot = join(temp, "project");

  writeJson(userPath, {
    version: 1,
    defaultProfile: "user",
    profiles: { user: { agentId: "agent-user" } },
  });
  writeJson(join(projectRoot, ".letta-acp-bridge", "config.json"), {
    version: 1,
    defaultProfile: "project",
    profiles: { project: { agentId: "agent-project" } },
  });

  assert.equal(resolveProfile({ userPath, projectRoot }).name, "project");
});

test("setup writes a user profile without secrets", () => {
  const temp = mkdtempSync(join(tmpdir(), "letta-setup-"));
  execFileSync(join(scripts, "setup-letta-profile"), [
    "--scope", "user",
    "--name", "example-agent",
    "--agent-id", "agent-example",
    "--default",
  ], {
    env: { ...process.env, XDG_CONFIG_HOME: temp },
  });

  const configPath = join(temp, "letta-acp-bridge", "config.json");
  const config = JSON.parse(readFileSync(configPath, "utf8"));
  assert.equal(config.defaultProfile, "example-agent");
  assert.equal(config.profiles["example-agent"].agentId, "agent-example");
  assert.equal(JSON.stringify(config).includes("token"), false);
  assert.equal(JSON.stringify(config).includes("apiKey"), false);
  assert.equal(statSync(configPath).mode & 0o777, 0o600);
});

test("setup writes project scope without changing user scope", () => {
  const temp = mkdtempSync(join(tmpdir(), "letta-project-setup-"));
  const projectRoot = join(temp, "project");
  const configRoot = join(temp, "config");
  mkdirSync(projectRoot, { recursive: true });
  execFileSync(join(scripts, "setup-letta-profile"), [
    "--scope", "project",
    "--cwd", projectRoot,
    "--name", "local",
    "--agent-id", "agent-local",
  ], { env: { ...process.env, XDG_CONFIG_HOME: configRoot } });

  const projectConfig = JSON.parse(readFileSync(
    join(projectRoot, ".letta-acp-bridge", "config.json"),
    "utf8",
  ));
  assert.equal(projectConfig.profiles.local.agentId, "agent-local");
  assert.equal(projectConfig.defaultProfile, "local");
  assert.throws(() => readFileSync(join(configRoot, "letta-acp-bridge", "config.json")));
});

test("message uses the resolved profile and fingerprinted ACPX session", () => {
  const temp = mkdtempSync(join(tmpdir(), "letta-message-"));
  const projectRoot = join(temp, "project");
  const configRoot = join(temp, "config");
  const logPath = join(temp, "acpx.jsonl");
  const acpx = join(temp, "acpx-mock");
  mkdirSync(projectRoot, { recursive: true });
  writeJson(join(configRoot, "letta-acp-bridge", "config.json"), {
    version: 1,
    defaultProfile: "shared",
    profiles: {
      shared: {
        agentId: "agent-shared",
        backend: "cloud-oauth",
        permissionMode: "standard",
        server: { command: "/custom/launcher", args: ["arg with space"] },
      },
    },
  });
  writeFileSync(acpx, `#!/usr/bin/env node
import { appendFileSync, readFileSync } from "node:fs";
const prompt = process.argv.includes("prompt");
appendFileSync(process.env.ACPX_TEST_LOG, JSON.stringify({
  args: process.argv.slice(2),
  agentId: process.env.LETTA_AGENT_ID,
  command: process.env.LETTA_ACP_SERVER_COMMAND,
  serverArgs: process.env.LETTA_ACP_SERVER_ARGS_JSON,
  stdin: prompt ? readFileSync(0, "utf8") : "",
}) + "\\n");
`);
  chmodSync(acpx, 0o755);

  const env = { ...process.env };
  for (const key of [
    "LETTA_AGENT_ID",
    "LETTA_ACP_BACKEND",
    "LETTA_ACP_PERMISSION_MODE",
    "LETTA_ACP_SERVER_COMMAND",
    "LETTA_ACP_SERVER_ARGS",
    "LETTA_ACP_SERVER_ARGS_JSON",
  ]) delete env[key];
  execFileSync(join(scripts, "letta-message"), [
    "--profile", "shared", "hello from a harness",
  ], {
    cwd: projectRoot,
    env: {
      ...env,
      XDG_CONFIG_HOME: configRoot,
      ACPX_BIN: acpx,
      ACPX_TEST_LOG: logPath,
    },
  });

  const calls = readFileSync(logPath, "utf8").trim().split("\n").map(JSON.parse);
  assert.equal(calls.length, 2);
  assert.deepEqual(calls.map((call) => call.agentId), ["agent-shared", "agent-shared"]);
  assert.equal(calls[0].command, "/custom/launcher");
  assert.equal(calls[0].serverArgs, '["arg with space"]');
  const sessionName = calls[0].args.at(-1);
  assert.match(sessionName, /^shared-[a-f0-9]{8}$/);
  assert.equal(calls[1].args.includes(sessionName), true);
  assert.equal(calls[1].stdin, "hello from a harness\n");
});

test("ACP server preserves custom argv and applies safe defaults", () => {
  const temp = mkdtempSync(join(tmpdir(), "letta-server-"));
  const launcher = join(temp, "launcher");
  const output = join(temp, "output.json");
  writeFileSync(launcher, `#!/usr/bin/env node
import { writeFileSync } from "node:fs";
writeFileSync(process.env.SERVER_TEST_OUTPUT, JSON.stringify({
  args: process.argv.slice(2),
  backend: process.env.LETTA_ACP_BACKEND,
  permissionMode: process.env.LETTA_ACP_PERMISSION_MODE,
}));
`);
  chmodSync(launcher, 0o755);

  const env = { ...process.env };
  delete env.LETTA_ACP_BACKEND;
  delete env.LETTA_ACP_PERMISSION_MODE;
  execFileSync(join(scripts, "letta-acp-server"), [], {
    env: {
      ...env,
      LETTA_AGENT_ID: "agent-test",
      LETTA_ACP_SERVER_COMMAND: launcher,
      LETTA_ACP_SERVER_ARGS_JSON: '["arg with space","plain"]',
      SERVER_TEST_OUTPUT: output,
    },
  });

  assert.deepEqual(JSON.parse(readFileSync(output, "utf8")), {
    args: ["arg with space", "plain"],
    backend: "cloud-oauth",
    permissionMode: "standard",
  });
});
