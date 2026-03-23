import ora from "ora";

const spinner = ora();
let outputFormat = 'human';

export { spinner };

export function setOutputFormat(format = 'human') {
    outputFormat = format;
    spinner.isSilent = outputFormat === 'json';
}

export function getOutputFormat() {
    return outputFormat;
}
