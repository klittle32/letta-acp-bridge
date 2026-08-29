import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const readme = readFileSync(resolve(root, "README.md"), "utf8");
const skill = readFileSync(
  resolve(root, "skills", "communicating-with-letta", "SKILL.md"),
  "utf8",
);

test("README presents the first-use journey in order", () => {
  const steps = [
    "### 1. Install the bridge",
    "### 2. Install the harness skill",
    "### 3. Connect a persistent Letta agent",
    "### 4. Ask from a coding harness",
    "### 5. Continue the conversation",
  ];

  let previous = -1;
  for (const step of steps) {
    const position = readme.indexOf(step);
    assert.notEqual(position, -1, `missing onboarding step: ${step}`);
    assert.ok(position > previous, `onboarding step is out of order: ${step}`);
    previous = position;
  }
});

test("README explains skill placement as a conversation-routing choice", () => {
  assert.match(readme, /Skill placement is an intentional conversation-routing control\./);
  assert.match(readme, /one shared Letta conversation across harnesses/i);
  assert.match(readme, /separate conversations for each harness/i);
  assert.match(readme, /project-specific conversations/i);
  assert.match(readme, /absolute working directory, resolved profile, and real skill path/);
});

test("README explains how human-facing recipient names select profiles", () => {
  assert.match(readme, /profile name is the human-facing alias/i);
  assert.match(readme, /letta-acp-bridge profile list/);
  assert.match(readme, /case-insensitively\s+when exactly one configured profile matches/i);
  assert.match(readme, /--profile <configured-name>/);
  assert.match(readme, /generic requests[^.]*use the configured default/i);
  assert.match(readme, /missing or ambiguous/i);
});

test("skill routes named and generic Letta recipients without guessing", () => {
  assert.match(skill, /profile name as the human-facing alias/i);
  assert.match(skill, /letta-acp-bridge profile list/);
  assert.match(skill, /case-insensitively\s+when\s+exactly one configured profile matches/i);
  assert.match(skill, /--profile <configured-name>/);
  assert.match(skill, /generic request.*use the configured default/i);
  assert.match(skill, /missing or ambiguous/i);
  assert.match(skill, /Do not query Letta to rediscover the\s+agent/i);
});
