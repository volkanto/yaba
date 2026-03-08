import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

export function runCli(args, env = {}) {
    return spawnSync(
        process.execPath,
        ["./bin/index.js", ...args],
        {
            cwd: repoRoot,
            env: { ...process.env, ...env },
            encoding: "utf8"
        }
    );
}
