#!/usr/bin/env node

import kleur from "kleur";
import { checkUpdate } from "./utils/tool.js";
import * as flow from "./utils/flow.js";
import { options, isSupportedReleaseCommand } from "./utils/command.js";
import { exitCodes } from "./utils/exit-codes.js";
import { createError, normalizeError } from "./utils/errors.js";
import { resolveOutputFormatFromSources } from "./utils/runtime-config.js";
import { runReleaseCommand } from "./commands/release-command.js";
import { runDoctorCommand } from "./commands/doctor-command.js";
import { runConfigInitCommand } from "./commands/config-init-command.js";
import {
    createOutputController,
    printDeprecationWarnings
} from "./services/command-output.js";
import { loadRuntimeConfig } from "./services/runtime-config-service.js";

const output = createOutputController(options.outputFormat);

runYaba().then(exitCode => process.exit(exitCode));

async function runYaba() {
    try {
        syncFlowOutputFormat();
        validateCommandSupport();

        if (isConfigInitCommand(options)) {
            return runConfigInitCommand(options, output.isJson());
        }

        const runtimeConfig = loadRuntimeConfig(options);
        output.setFormat(resolveOutputFormat(runtimeConfig));
        syncFlowOutputFormat();

        if (!output.isJson()) {
            printDeprecationWarnings(options.deprecationWarnings);
        }

        if (isDoctorCommand(options)) {
            return await runDoctorCommand(options, runtimeConfig, output.isJson());
        }

        if (!output.isJson()) {
            await checkUpdate();
        }

        flow.checkRequiredEnvVariables();
        return await runReleaseCommand(options, runtimeConfig, output.isJson());
    } catch (error) {
        const normalizedError = normalizeError(error);
        if (output.isJson()) {
            console.error(JSON.stringify({
                status: "error",
                exitCode: normalizedError.exitCode,
                message: normalizedError.message
            }));
        } else {
            console.error(kleur.red(normalizedError.message));
        }
        return normalizedError.exitCode;
    }
}

function validateCommandSupport() {
    if (isSupportedReleaseCommand(options)) {
        return;
    }

    throw createError(
        "Unsupported command. Use 'yaba release create --help', 'yaba release preview --help', 'yaba doctor --help', or 'yaba config init --help' for usage details.",
        exitCodes.VALIDATION
    );
}

function resolveOutputFormat(runtimeConfig) {
    return resolveOutputFormatFromSources(
        options.outputFormat,
        process.env.YABA_OUTPUT_FORMAT,
        runtimeConfig?.output?.format
    );
}

function syncFlowOutputFormat() {
    flow.setOutputFormat(output.getFormat());
}

function isDoctorCommand(parsedOptions) {
    return parsedOptions.commandName === "doctor";
}

function isConfigInitCommand(parsedOptions) {
    return parsedOptions.commandName === "config.init";
}
