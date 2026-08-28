import { spawn } from "node:child_process";

export function run(command, args, { env, stdin, quiet = false } = {}) {
  return new Promise((resolve, reject) => {
    const stderr = [];
    let stderrBytes = 0;
    const child = spawn(command, args, {
      env,
      stdio: [
        stdin === undefined ? "ignore" : "pipe",
        quiet ? "ignore" : "inherit",
        quiet ? "pipe" : "inherit",
      ],
    });
    if (quiet) {
      child.stderr.on("data", (chunk) => {
        if (stderrBytes >= 64 * 1024) return;
        const remaining = 64 * 1024 - stderrBytes;
        const captured = chunk.subarray(0, remaining);
        stderr.push(captured);
        stderrBytes += captured.length;
      });
    }
    child.on("error", reject);
    child.on("close", (code, signal) => {
      if (code === 0) resolve();
      else {
        if (quiet && stderr.length) process.stderr.write(Buffer.concat(stderr));
        reject(new Error(`${command} exited with ${signal || code}`));
      }
    });
    if (stdin !== undefined) child.stdin.end(stdin);
  });
}
