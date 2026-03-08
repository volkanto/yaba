import { exitCodes } from "../utils/exit-codes.js";
import { printConfigValidateSummary, printJson } from "../services/command-output.js";
import { resolveConfigFilePath } from "../services/runtime-config-service.js";
import { validateRuntimeConfigSchema } from "../services/config-validation-service.js";
import { SUPPORTED_NOTIFICATION_PROVIDERS } from "../notifications/publisher.js";

export function runConfigValidateCommand(options, runtimeConfig, isJsonOutput) {
    const issues = validateRuntimeConfigSchema(
        runtimeConfig,
        SUPPORTED_NOTIFICATION_PROVIDERS
    );
    const result = {
        command: "config.validate",
        status: issues.length === 0 ? "success" : "failure",
        valid: issues.length === 0,
        path: resolveConfigFilePath(options.configPath),
        sources: runtimeConfig?._meta?.sources || [],
        issues: issues
    };

    if (isJsonOutput) {
        printJson({
            ...result,
            exitCode: result.valid ? exitCodes.SUCCESS : exitCodes.VALIDATION
        });
    } else {
        printConfigValidateSummary(result);
    }

    return result.valid ? exitCodes.SUCCESS : exitCodes.VALIDATION;
}
