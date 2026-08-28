#!/usr/bin/env node

import { addProfile } from "../src/profile.mjs";

try {
  await addProfile(process.argv.slice(2));
} catch (error) {
  console.error(`setup-letta-profile: ${error.message}`);
  process.exitCode = 2;
}
