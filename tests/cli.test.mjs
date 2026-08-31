import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const cli = join(root, "bin", "letta-acp-bridge.js");

function run(args, options = {}) {
  return execFileSync(cli, args, {
    encoding: "utf8",
    ...options,
    env: { ...process.env, ...options.env },
  });
}

test("message help prints usage without starting an exchange", () => {
  const temp = mkdtempSync(join(tmpdir(), "letta-cli-help-"));
  const output = run(["message", "--help"], {
    env: { XDG_CONFIG_HOME: temp },
  });

  assert.match(output, /^Usage: letta-acp-bridge message /);
});

test("profile add creates user and project profiles through the primary CLI", () => {
  const temp = mkdtempSync(join(tmpdir(), "letta-cli-profile-"));
  const configRoot = join(temp, "config");
  const projectRoot = join(temp, "project");
  mkdirSync(projectRoot, { recursive: true });

  run([
    "profile", "add",
    "--scope", "user",
    "--name", "johnny5",
    "--agent-id", "agent-johnny5",
    "--default",
  ], { env: { XDG_CONFIG_HOME: configRoot } });
  run([
    "profile", "add",
    "--scope", "project",
    "--cwd", projectRoot,
    "--name", "project-agent",
    "--agent-id", "agent-project",
  ], { env: { XDG_CONFIG_HOME: configRoot } });

  const user = JSON.parse(readFileSync(
    join(configRoot, "letta-acp-bridge", "config.json"),
    "utf8",
  ));
  const project = JSON.parse(readFileSync(
    join(projectRoot, ".letta-acp-bridge", "config.json"),
    "utf8",
  ));
  assert.equal(user.defaultProfile, "johnny5");
  assert.equal(user.profiles.johnny5.agentId, "agent-johnny5");
  assert.equal(project.profiles["project-agent"].agentId, "agent-project");
});

test("skill install requires an explicit empty target and supports explicit force", () => {
  const temp = mkdtempSync(join(tmpdir(), "letta-cli-skill-"));
  const target = join(temp, "communicating-with-letta");

  assert.throws(
    () => run(["skill", "install"]),
    (error) => String(error.stderr).includes("--target is required"),
  );
  run(["skill", "install", "--target", target]);
  assert.equal(existsSync(join(target, "SKILL.md")), true);
  assert.equal(existsSync(join(target, "scripts", "letta-message")), true);
  writeFileSync(join(target, "marker"), "preserve unless forced\n");

  assert.throws(
    () => run(["skill", "install", "--target", target]),
    (error) => String(error.stderr).includes("already exists"),
  );
  run(["skill", "install", "--target", target, "--force"]);
  assert.equal(existsSync(join(target, "marker")), false);
});

test("skill path prints the bundled canonical skill directory", () => {
  assert.equal(
    run(["skill", "path"]),
    `${join(root, "skills", "communicating-with-letta")}\n`,
  );
});

test("installed skill wrapper runs without resolving npm command shims", () => {
  const temp = mkdtempSync(join(tmpdir(), "letta-cli-wrapper-shim-"));
  const target = join(temp, "installed-skill");
  const bin = join(temp, "bin");
  mkdirSync(bin, { recursive: true });
  run(["skill", "install", "--target", target]);
  writeFileSync(join(bin, "letta-acp-bridge.cmd"), "@echo off\r\nexit /b 91\r\n");

  const result = spawnSync(process.execPath, [
    join(target, "scripts", "letta-message"), "--help",
  ], {
    encoding: "utf8",
    env: { ...process.env, PATH: bin },
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /^Usage: letta-acp-bridge message /);
  assert.equal(result.stderr, "");
});

test("installed skill wrapper preserves message error reporting and exit status", () => {
  const temp = mkdtempSync(join(tmpdir(), "letta-cli-wrapper-error-"));
  const target = join(temp, "installed-skill");
  const configRoot = join(temp, "config");
  run(["skill", "install", "--target", target]);

  const result = spawnSync(process.execPath, [
    join(target, "scripts", "letta-message"), "hello",
  ], {
    encoding: "utf8",
    env: { ...process.env, XDG_CONFIG_HOME: configRoot },
  });

  assert.equal(result.status, 2);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /^letta-acp-bridge: No Letta profile selected\./);
});

test("installed skill wrapper forwards messages and preserves its canonical scope", () => {
  const temp = mkdtempSync(join(tmpdir(), "letta-cli-wrapper-"));
  const target = join(temp, "installed-skill");
  const configRoot = join(temp, "config");
  const projectRoot = join(temp, "project");
  const stateDir = join(temp, ".acpx", "sessions");
  const serverLog = join(temp, "server.jsonl");
  const server = join(temp, "fake-acp-server.mjs");
  mkdirSync(projectRoot, { recursive: true });
  mkdirSync(join(configRoot, "letta-acp-bridge"), { recursive: true });
  writeFileSync(
    join(configRoot, "letta-acp-bridge", "config.json"),
    `${JSON.stringify({
      version: 1,
      defaultProfile: "johnny5",
      profiles: {
        johnny5: {
          agentId: "agent-johnny5",
          server: { command: process.execPath, args: [server] },
        },
      },
    })}\n`,
  );
  run(["skill", "install", "--target", target]);
  writeFileSync(server, `import { appendFileSync } from "node:fs";
import { createInterface } from "node:readline";
const log = (value) => appendFileSync(process.env.ACP_SERVER_TEST_LOG,
  JSON.stringify({ ...value, skillPath: process.env.LETTA_ACP_BRIDGE_SKILL_PATH }) + "\\n");
const send = (value) => process.stdout.write(JSON.stringify(value) + "\\n");
for await (const line of createInterface({ input: process.stdin })) {
  const request = JSON.parse(line);
  log({ method: request.method, params: request.params });
  if (request.method === "initialize") send({ jsonrpc: "2.0", id: request.id, result: {
    protocolVersion: 1, agentCapabilities: { loadSession: true }, authMethods: [],
  } });
  else if (request.method === "session/new") send({ jsonrpc: "2.0", id: request.id, result: {
    sessionId: "fake-session", modes: { currentModeId: "standard", availableModes: [] },
  } });
  else if (request.method === "session/prompt") {
    send({ jsonrpc: "2.0", method: "session/update", params: {
      sessionId: "fake-session", update: {
        sessionUpdate: "agent_message_chunk", content: { type: "text", text: "WINDOWS_WRAPPER_OK\\n" },
      },
    } });
    send({ jsonrpc: "2.0", id: request.id, result: { stopReason: "end_turn" } });
  }
}
`);

  const result = spawnSync(process.execPath, [
    join(target, "scripts", "letta-message"),
    "--profile", "johnny5", "hello", "from", "Windows",
  ], {
    cwd: projectRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      XDG_CONFIG_HOME: configRoot,
      ACPX_STATE_DIR: stateDir,
      ACP_SERVER_TEST_LOG: serverLog,
    },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "WINDOWS_WRAPPER_OK\n");
  assert.equal(result.stderr, "");
  const calls = readFileSync(serverLog, "utf8").trim().split("\n").map(JSON.parse);
  const prompt = calls.find((call) => call.method === "session/prompt");
  assert.equal(prompt.params.prompt[0].text, "hello from Windows");
  assert.equal(calls.every((call) => call.skillPath === realpathSync(target)), true);
  const sessionsDir = join(stateDir, "sessions");
  const records = readdirSync(sessionsDir)
    .filter((name) => name.endsWith(".json"));
  assert.equal(records.length, 1);
  const record = JSON.parse(readFileSync(join(sessionsDir, records[0]), "utf8"));
  assert.deepEqual(record.agent_argv.slice(0, 1), [process.execPath]);
  assert.match(record.agent_argv[1], /bin\/letta-acp-server\.js$/);
});

test("symlinked harness installs report one shared canonical skill scope", () => {
  const temp = mkdtempSync(join(tmpdir(), "letta-cli-shared-skill-"));
  const target = join(temp, "canonical-skill");
  const codexTarget = join(temp, "codex", "communicating-with-letta");
  const grokTarget = join(temp, "grok", "communicating-with-letta");
  const configRoot = join(temp, "config");
  const log = join(temp, "acpx.jsonl");
  const acpx = join(temp, "acpx-mock");
  const acpxScript = join(temp, "acpx-mock.mjs");
  mkdirSync(join(temp, "codex"), { recursive: true });
  mkdirSync(join(temp, "grok"), { recursive: true });
  mkdirSync(join(configRoot, "letta-acp-bridge"), { recursive: true });
  writeFileSync(
    join(configRoot, "letta-acp-bridge", "config.json"),
    `${JSON.stringify({
      version: 1,
      defaultProfile: "johnny5",
      profiles: { johnny5: { agentId: "agent-johnny5" } },
    })}\n`,
  );
  run(["skill", "install", "--target", target]);
  symlinkSync(target, codexTarget);
  symlinkSync(target, grokTarget);
  writeFileSync(acpxScript, `import { appendFileSync } from "node:fs";
appendFileSync(process.env.ACPX_TEST_LOG, process.env.LETTA_ACP_BRIDGE_SKILL_PATH + "\\n");
`);
  writeFileSync(acpx, `#!/bin/sh\nexec "$ACPX_TEST_NODE" "$ACPX_TEST_SCRIPT" "$@"\n`);
  execFileSync("chmod", ["+x", acpx]);

  for (const harnessTarget of [codexTarget, grokTarget]) {
    execFileSync(process.execPath, [join(harnessTarget, "scripts", "letta-message"), "hello"], {
      env: {
        ...process.env,
        XDG_CONFIG_HOME: configRoot,
        ACPX_BIN: acpx,
        ACPX_TEST_NODE: process.execPath,
        ACPX_TEST_SCRIPT: acpxScript,
        ACPX_TEST_LOG: log,
      },
    });
  }

  assert.deepEqual(
    readFileSync(log, "utf8").trim().split("\n"),
    [
      realpathSync(target), realpathSync(target),
      realpathSync(target), realpathSync(target),
    ],
  );
});

test("message command preserves clean stdout and forwards its profile", () => {
  const temp = mkdtempSync(join(tmpdir(), "letta-cli-message-"));
  const configRoot = join(temp, "config");
  const projectRoot = join(temp, "project");
  const logPath = join(temp, "acpx.jsonl");
  const acpx = join(temp, "acpx-mock");
  mkdirSync(projectRoot, { recursive: true });
  mkdirSync(join(configRoot, "letta-acp-bridge"), { recursive: true });
  writeFileSync(
    join(configRoot, "letta-acp-bridge", "config.json"),
    `${JSON.stringify({
      version: 1,
      defaultProfile: "johnny5",
      profiles: { johnny5: { agentId: "agent-johnny5" } },
    })}\n`,
  );
  writeFileSync(acpx, `#!/usr/bin/env node
import { appendFileSync } from "node:fs";
appendFileSync(process.env.ACPX_TEST_LOG, JSON.stringify(process.argv.slice(2)) + "\\n");
if (process.argv.includes("prompt")) process.stdout.write("PACKAGED_CLEAN\\n");
else process.stderr.write("[acpx] created session detail\\n");
`);
  execFileSync("chmod", ["+x", acpx]);

  const result = spawnSync(cli, [
    "message", "--profile", "johnny5", "Reply cleanly",
  ], {
    cwd: projectRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      XDG_CONFIG_HOME: configRoot,
      ACPX_BIN: acpx,
      ACPX_TEST_LOG: logPath,
    },
  });
  assert.equal(result.status, 0);
  assert.equal(result.stdout, "PACKAGED_CLEAN\n");
  assert.equal(result.stderr, "");
  const calls = readFileSync(logPath, "utf8").trim().split("\n").map(JSON.parse);
  assert.equal(calls.length, 2);
  assert.equal(calls[1].includes("quiet"), true);
  const sessionName = calls[0].at(-1);
  assert.match(sessionName, /^johnny5-[a-f0-9]{8}$/);
  assert.equal(calls[1][calls[1].indexOf("--session") + 1], sessionName);
});
