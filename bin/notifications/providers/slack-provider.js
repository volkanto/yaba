import * as flow from "../../utils/flow.js";

export const slackProvider = {
    name: "slack",
    async publish(context) {
        await flow.publishToSlack(
            true,
            context.repo,
            context.changelog,
            context.releaseUrl,
            context.releaseName
        );
    }
};
