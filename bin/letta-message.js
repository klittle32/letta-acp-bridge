#!/usr/bin/env node

import { sendMessage } from "../src/message.mjs";

try {
  await sendMessage(process.argv.slice(2));
} catch (error) {
  console.error(`letta-message: ${error.message}`);
  process.exitCode = 2;
}
