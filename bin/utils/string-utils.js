export function isBlank(str) {
    return (str == "undefined" || !str || /^\s*$/.test(str));
}
export function format(given, dict) {
    return given.replace(/{(\w+)}/g, function (match, key) {
        return typeof dict[key] !== 'undefined' ? dict[key] : match;
    });
}
