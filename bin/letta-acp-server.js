#!/usr/bin/env node

import { runServer } from "../src/server.mjs";

try {
  runServer();
} catch (error) {
  console.error(`letta-acp-server: ${error.message}`);
  process.exitCode = 2;
}
