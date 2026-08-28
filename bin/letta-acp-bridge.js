#!/usr/bin/env node

import { main } from "../src/cli.mjs";

try {
  await main();
} catch (error) {
  console.error(`letta-acp-bridge: ${error.message}`);
  process.exitCode = 2;
}
