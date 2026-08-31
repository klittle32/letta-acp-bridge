#!/usr/bin/env node

import { sendMessage } from "../src/message.mjs";

try {
  const result = await sendMessage(process.argv.slice(2));
  if (result?.exitAfterMessage) process.exit(0);
} catch (error) {
  console.error(`letta-message: ${error.message}`);
  process.exitCode = 2;
}
