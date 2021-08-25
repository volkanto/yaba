module.exports = {
    /**
     * checks if the given string is blank or not.
     *
     * @param str the given string
     * @returns {boolean|boolean} true if the given string is blank, otherwise returns true
     */
    isBlank: function (str) {
        return (str == "undefined" || !str || /^\s*$/.test(str));
    },

    /**
     * replaces the placeholders which are in the {@code given} string with the given {@code dict}.
     *
     * @param given the given string that will be formatted with the given {@code dict}
     * @param dict the dictionary that will replace placeholders in {@code given} sting
     * @returns {*}
     */
    format: function (given, dict) {
        return given.replace(/{(\w+)}/g, function (match, key) {
            return typeof dict[key] !== 'undefined' ? dict[key] : match;
        });
    }
}
