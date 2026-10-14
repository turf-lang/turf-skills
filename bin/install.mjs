#!/usr/bin/env node
// Installs the turflang skill into your coding agents.
//
//   npx turflang-skills                  interactive: pick agents, project/global, symlink/copy
//   npx turflang-skills -g -a claude-code -y   non-interactive
//   npx turflang-skills --github         install from github.com/turf-lang/turf-skills instead
//                                        of the copy bundled in this package
//   npx turflang-skills list|remove|update ...   forwarded to the skills CLI
//
// Every other flag is passed to `skills add` unchanged (see `npx turflang-skills --help`).
// The prompts and the agent list come from the skills CLI (https://github.com/vercel-labs/skills).

import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(here, "..");
const GITHUB_SOURCE = "turf-lang/turf-skills";

function skillsCli() {
  const pkgPath = require.resolve("skills/package.json");
  const pkg = require(pkgPath);
  const bin = typeof pkg.bin === "string" ? pkg.bin : pkg.bin.skills;
  return join(dirname(pkgPath), bin);
}

const FORWARDED = new Set(["list", "ls", "remove", "rm", "update", "upgrade", "find"]);

let args = process.argv.slice(2);
let cliArgs;

if (args[0] === "--help" || args[0] === "-h" || args[0] === "help") {
  console.log(`turflang-skills: install the TurfLang skill into your coding agents

Usage:
  npx turflang-skills [options]        install (interactive unless -y)
  npx turflang-skills list|remove|update [options]   manage installed skills

Install options (passed to \`skills add\`):
  -g, --global          install for your user instead of the current project
  -a, --agent <names>   agents to install to, e.g. claude-code cursor codex ('*' = all)
  -y, --yes             skip prompts
  --copy                copy files instead of symlinking
  --github              install from github.com/${GITHUB_SOURCE} (latest) instead of
                        the copy bundled with this package version

Same result without this package: npx skills@latest add ${GITHUB_SOURCE}`);
  process.exit(0);
}

if (args.length > 0 && FORWARDED.has(args[0])) {
  cliArgs = args;
} else {
  const fromGithub = args.includes("--github");
  args = args.filter((a) => a !== "--github");
  const source = fromGithub ? GITHUB_SOURCE : packageRoot;
  cliArgs = ["add", source, ...args];
}

const result = spawnSync(process.execPath, [skillsCli(), ...cliArgs], {
  stdio: "inherit",
  env: process.env,
});

if (result.error) {
  console.error(`turflang-skills: could not run the skills CLI: ${result.error.message}`);
  process.exit(1);
}
process.exit(result.status ?? 1);
