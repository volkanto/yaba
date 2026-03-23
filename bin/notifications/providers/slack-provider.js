import { publish } from "../../utils/slack.js";

export const slackProvider = {
    name: "slack",
    async publish(context) {
        await publish(
            true,
            context.repo,
            context.changelog,
            context.releaseUrl,
            context.releaseName,
            context.compareUrl
        );
    }
};
