const appConstants = Object.freeze({
    UPDATE_COMMAND: 'npm update -g yaba-release-cli',
    RELEASE_DATE_FORMAT: 'yyyy-MM-dd',
    TAG_DATE_FORMAT: 'yyyyMMdd',
    SLACK_POST_TEMPLATE: '../assets/slack-post-template.json',
    UPDATE_MESSAGE_TEMPLATE: '../assets/yaba-update-message-template.txt',
    CHANGELOG_TEMPLATE: '../assets/changelog-template.md'
});

const defaultBoxOptions = {
    padding: 1,
    align: 'center',
    borderColor: 'yellow',
    borderStyle: 'round'
};

export { appConstants, defaultBoxOptions };
