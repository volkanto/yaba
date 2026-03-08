import fs from "fs";
import path from "path";
import { exitCodes } from "../utils/exit-codes.js";
import { createError } from "../utils/errors.js";
import { printConfigInitSummary, printJson } from "../services/command-output.js";
import { buildDefaultConfigTemplate, resolveConfigFilePath } from "../services/runtime-config-service.js";

export function runConfigInitCommand(options, isJsonOutput) {
    const configPath = resolveConfigFilePath(options.configPath);
    const configDir = path.dirname(configPath);
    const alreadyExists = fs.existsSync(configPath);

    if (alreadyExists && options.force !== true) {
        throw createError(`Config file already exists at '${configPath}'. Use '--force' to overwrite it.`, exitCodes.VALIDATION);
    }

    const configTemplate = buildDefaultConfigTemplate();
    if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
    }
    fs.writeFileSync(configPath, `${JSON.stringify(configTemplate, null, 2)}\n`, "utf8");

    const overwritten = alreadyExists && options.force === true;
    if (isJsonOutput) {
        printJson({
            command: "config.init",
            status: "success",
            path: configPath,
            overwritten: overwritten
        });
    } else {
        printConfigInitSummary(configPath, overwritten);
    }

    return exitCodes.SUCCESS;
}
