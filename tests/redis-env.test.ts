import { describe, expect, it } from "vitest";
import { redisEnv } from "../src/lib/server/redis";

describe("redisEnv", () => {
  it("is null without credentials", () => expect(redisEnv({})).toBeNull());
  it("accepts Vercel Marketplace KV_REST_API_* names", () =>
    expect(redisEnv({ KV_REST_API_URL: "https://k", KV_REST_API_TOKEN: "t" })).toEqual({ url: "https://k", token: "t" }));
  it("prefers UPSTASH_* when both are set", () =>
    expect(redisEnv({ UPSTASH_REDIS_REST_URL: "https://u", UPSTASH_REDIS_REST_TOKEN: "u", KV_REST_API_URL: "https://k", KV_REST_API_TOKEN: "k" })).toEqual({ url: "https://u", token: "u" }));
  it("needs both url and token", () => expect(redisEnv({ KV_REST_API_URL: "https://k" })).toBeNull());
});
