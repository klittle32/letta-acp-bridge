#!/usr/bin/env node

import { main } from "../src/cli.mjs";

try {
  const result = await main();
  if (result?.exitAfterMessage) process.exit(0);
} catch (error) {
  console.error(`letta-acp-bridge: ${error.message}`);
  process.exitCode = 2;
}
