import { format as formatDate } from 'date-fns';

function isPlainObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value) {
    return typeof value === 'string' && value.trim().length !== 0;
}

function firstDefined(...values) {
    for (const value of values) {
        if (value !== undefined && value !== null) {
            return value;
        }
    }
    return undefined;
}

function resolveBoolean(primaryValue, secondaryValue, defaultValue) {
    if (typeof primaryValue === 'boolean') {
        return primaryValue;
    }

    if (typeof secondaryValue === 'boolean') {
        return secondaryValue;
    }

    return defaultValue;
}

function deepMerge(target, source) {
    for (const [key, sourceValue] of Object.entries(source)) {
        if (isPlainObject(sourceValue)) {
            if (!isPlainObject(target[key])) {
                target[key] = {};
            }
            deepMerge(target[key], sourceValue);
        } else {
            target[key] = sourceValue;
        }
    }
}

function resolveOutputFormatCandidate(format) {
    return `${format || ""}`.trim().toLowerCase() === "json" ? "json" : "human";
}

function resolveOutputFormatFromSources(optionFormat, envFormat, configFormat) {
    return resolveOutputFormatCandidate(
        firstDefined(optionFormat, envFormat, configFormat, "human")
    );
}

function renderConfigPattern(pattern, now = new Date()) {
    if (!isNonEmptyString(pattern)) {
        return undefined;
    }

    return pattern
        .replaceAll('{yyyyMMdd}', formatDate(now, 'yyyyMMdd'))
        .replaceAll('{yyyy-MM-dd}', formatDate(now, 'yyyy-MM-dd'));
}

export {
    deepMerge,
    firstDefined,
    isNonEmptyString,
    isPlainObject,
    renderConfigPattern,
    resolveBoolean,
    resolveOutputFormatCandidate,
    resolveOutputFormatFromSources
};
