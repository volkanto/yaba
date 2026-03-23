import test from "node:test";
import assert from "node:assert/strict";
import { publishWithRetry } from "../bin/utils/slack.js";

test("publishWithRetry retries transient failures and succeeds", async () => {
    let attempts = 0;
    const delays = [];

    await publishWithRetry("https://hooks.slack.test/abc", { text: "hello" }, {
        maxAttempts: 3,
        baseDelayMs: 10,
        postFn: async () => {
            attempts += 1;
            if (attempts < 3) {
                const error = new Error("transient network error");
                error.code = "ETIMEDOUT";
                throw error;
            }
        },
        sleepFn: async delay => {
            delays.push(delay);
        }
    });

    assert.equal(attempts, 3);
    assert.deepEqual(delays, [10, 20]);
});

test("publishWithRetry does not retry non-retriable failures", async () => {
    let attempts = 0;
    const delays = [];

    await assert.rejects(
        async () => {
            await publishWithRetry("https://hooks.slack.test/abc", { text: "hello" }, {
                maxAttempts: 3,
                baseDelayMs: 10,
                postFn: async () => {
                    attempts += 1;
                    const error = new Error("bad request");
                    error.response = { status: 400 };
                    throw error;
                },
                sleepFn: async delay => {
                    delays.push(delay);
                }
            });
        },
        /bad request/
    );

    assert.equal(attempts, 1);
    assert.deepEqual(delays, []);
});

test("publishWithRetry stops after max attempts", async () => {
    let attempts = 0;
    const delays = [];

    await assert.rejects(
        async () => {
            await publishWithRetry("https://hooks.slack.test/abc", { text: "hello" }, {
                maxAttempts: 3,
                baseDelayMs: 5,
                postFn: async () => {
                    attempts += 1;
                    const error = new Error("service unavailable");
                    error.response = { status: 503 };
                    throw error;
                },
                sleepFn: async delay => {
                    delays.push(delay);
                }
            });
        },
        /service unavailable/
    );

    assert.equal(attempts, 3);
    assert.deepEqual(delays, [5, 10]);
});

