import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
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

test("installed skill is a thin wrapper that reports its canonical target scope", () => {
  const temp = mkdtempSync(join(tmpdir(), "letta-cli-wrapper-"));
  const target = join(temp, "installed-skill");
  const bin = join(temp, "bin");
  const log = join(temp, "wrapper.json");
  mkdirSync(bin, { recursive: true });
  run(["skill", "install", "--target", target]);
  const fakeCli = join(bin, "letta-acp-bridge");
  writeFileSync(fakeCli, `#!/usr/bin/env node
import { writeFileSync } from "node:fs";
writeFileSync(process.env.WRAPPER_LOG, JSON.stringify({
  args: process.argv.slice(2),
  skillPath: process.env.LETTA_ACP_BRIDGE_SKILL_PATH,
}));
`);
  execFileSync("chmod", ["+x", fakeCli]);

  execFileSync(join(target, "scripts", "letta-message"), [
    "--profile", "johnny5", "hello",
  ], {
    env: {
      ...process.env,
      PATH: `${bin}:${process.env.PATH}`,
      WRAPPER_LOG: log,
    },
  });
  assert.deepEqual(JSON.parse(readFileSync(log, "utf8")), {
    args: ["message", "--profile", "johnny5", "hello"],
    skillPath: realpathSync(target),
  });
});

test("symlinked harness installs report one shared canonical skill scope", () => {
  const temp = mkdtempSync(join(tmpdir(), "letta-cli-shared-skill-"));
  const target = join(temp, "canonical-skill");
  const codexTarget = join(temp, "codex", "communicating-with-letta");
  const grokTarget = join(temp, "grok", "communicating-with-letta");
  const bin = join(temp, "bin");
  const log = join(temp, "wrapper.jsonl");
  mkdirSync(bin, { recursive: true });
  mkdirSync(join(temp, "codex"), { recursive: true });
  mkdirSync(join(temp, "grok"), { recursive: true });
  run(["skill", "install", "--target", target]);
  symlinkSync(target, codexTarget);
  symlinkSync(target, grokTarget);
  const fakeCli = join(bin, "letta-acp-bridge");
  writeFileSync(fakeCli, `#!/usr/bin/env node
import { appendFileSync } from "node:fs";
appendFileSync(process.env.WRAPPER_LOG, process.env.LETTA_ACP_BRIDGE_SKILL_PATH + "\\n");
`);
  execFileSync("chmod", ["+x", fakeCli]);

  for (const harnessTarget of [codexTarget, grokTarget]) {
    execFileSync(join(harnessTarget, "scripts", "letta-message"), ["hello"], {
      env: {
        ...process.env,
        PATH: `${bin}:${process.env.PATH}`,
        WRAPPER_LOG: log,
      },
    });
  }

  assert.deepEqual(
    readFileSync(log, "utf8").trim().split("\n"),
    [realpathSync(target), realpathSync(target)],
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
