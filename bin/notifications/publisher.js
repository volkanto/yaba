import { createError } from "../utils/errors.js";
import { exitCodes } from "../utils/exit-codes.js";
import { slackProvider } from "./providers/slack-provider.js";

const defaultProviderRegistry = {
    slack: slackProvider
};

export async function publishReleaseNotifications(payload, providerRegistry = defaultProviderRegistry) {
    if (payload.publish !== true) {
        return {
            published: false,
            providers: []
        };
    }

    const providerNames = resolveProviderNames(payload.providerNames);
    for (const providerName of providerNames) {
        const provider = providerRegistry[providerName];
        if (!provider || typeof provider.publish !== "function") {
            throw createError(
                `Unsupported notification provider '${providerName}'.`,
                exitCodes.VALIDATION
            );
        }

        await provider.publish(payload.context);
    }

    return {
        published: true,
        providers: providerNames
    };
}

export function resolveProviderNames(providerNames) {
    if (!Array.isArray(providerNames)) {
        return ["slack"];
    }

    const normalized = providerNames
        .map(item => (typeof item === "string" ? item.trim().toLowerCase() : ""))
        .filter(Boolean);

    if (normalized.length === 0) {
        return ["slack"];
    }

    return [...new Set(normalized)];
}
