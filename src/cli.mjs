import { sendMessage } from "./message.mjs";
import { addProfile, listProfiles } from "./profile.mjs";
import { bundledSkillPath, installSkill } from "./skill.mjs";

const HELP = `Usage: letta-acp-bridge <command>\n\nCommands:\n  profile add [options]         Create or replace a user or project profile\n  profile list [--cwd <path>]  List resolved user and project profiles\n  message [options] <message>  Send a message to a configured Letta agent\n  skill path                   Print the bundled skill directory\n  skill install --target PATH  Copy the bundled skill to an explicit target\n`;

export async function main(argv = process.argv.slice(2), io = process) {
  if (!argv.length || argv[0] === "--help" || argv[0] === "help") {
    io.stdout.write(HELP);
    return;
  }
  const [group, action, ...rest] = argv;
  if (group === "message") return sendMessage(argv.slice(1), io);
  if (group === "profile" && action === "add") return addProfile(rest, io);
  if (group === "profile" && action === "list") return listProfiles(rest, io);
  if (group === "skill" && action === "path" && rest.length === 0) {
    io.stdout.write(`${bundledSkillPath()}\n`);
    return;
  }
  if (group === "skill" && action === "install") return installSkill(rest, io);
  throw new Error(`Unknown command: ${argv.join(" ")}\n\n${HELP.trimEnd()}`);
}
