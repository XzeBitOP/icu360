#!/usr/bin/env node
/**
 * Weekly job (GitHub Action, Monday 00:30 IST): read view counters from Upstash Redis and write the
 * public, rounded-down numbers to content/views.json, plus the top topic of the week that just ended.
 * Exact numbers never leave Redis; the site only ever shows "New", "1K", "12K", "1.2M".
 *
 * Data source, first one available wins:
 *   1. Redis directly: UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
 *      (or KV_REST_API_URL + KV_REST_API_TOKEN, the names the Vercel Marketplace integration uses)
 *   2. VIEWS_SOURCE_URL: the live site's public GET /api/views-weekly, which returns the same
 *      rounded numbers. No secrets needed in GitHub for this path.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "content/views.json");
const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
const sourceUrl = process.env.VIEWS_SOURCE_URL;
if (!(url && token) && !sourceUrl) {
  console.log("update-views: no Redis credentials (UPSTASH_REDIS_REST_* or KV_REST_API_*) and no VIEWS_SOURCE_URL, nothing to do.");
  process.exit(0);
}

/** Same as src/lib/format.ts isoWeek (India time). */
function isoWeek(d) {
  const ist = new Date(d.getTime() + 330 * 60000);
  const t = new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

async function pipeline(cmds) {
  const res = await fetch(`${url.replace(/\/$/, "")}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(cmds),
  });
  if (!res.ok) throw new Error(`Upstash ${res.status}: ${await res.text()}`);
  return res.json();
}
const toRecord = (flat) => {
  const o = {};
  for (let i = 0; Array.isArray(flat) && i + 1 < flat.length; i += 2) o[String(flat[i])] = Number(flat[i + 1]);
  return o;
};
const floorK = (n) => Math.floor(n / 1000) * 1000;

const now = new Date();
let out;
let topKeyLabel = "none";
let counters = 0;
if (url && token) {
  const finished = isoWeek(new Date(now.getTime() - 7 * 864e5)); // the week that just ended
  const [allRes, weekRes] = await pipeline([
    ["ZRANGE", "views:all", 0, -1, "REV", "WITHSCORES"],
    ["ZRANGE", `views:week:${finished}`, 0, -1, "REV", "WITHSCORES"],
  ]);
  if (allRes.error) throw new Error(allRes.error);
  const all = toRecord(allRes.result);
  counters = Object.keys(all).length;
  const topKey = Object.entries(toRecord(weekRes.result)).find(([k, n]) => k.startsWith("topic:") && n > 0)?.[0];
  out = { updatedAt: now.toISOString(), week: finished, note: "", modules: {}, topics: {}, tools: {}, topTopic: null };
  for (const [key, n] of Object.entries(all)) {
    const v = floorK(n);
    if (!v) continue;
    const [kind, id] = [key.slice(0, key.indexOf(":")), key.slice(key.indexOf(":") + 1)];
    if (kind === "module") out.modules[id] = v;
    else if (kind === "topic") out.topics[id] = v;
    else if (kind === "tool") out.tools[id] = v;
  }
  if (topKey) {
    const [moduleId, topicId] = topKey.slice(6).split("/");
    out.topTopic = { moduleId, topicId, week: finished };
  }
} else {
  const res = await fetch(sourceUrl, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`update-views: ${sourceUrl} returned ${res.status}`);
  const data = await res.json();
  if (!data || data.configured === false) {
    console.log("update-views: the site reports no Redis connection, nothing to do.");
    process.exit(0);
  }
  const num = (o) => Object.fromEntries(Object.entries(o && typeof o === "object" ? o : {}).map(([k, v]) => [k, floorK(Number(v) || 0)]).filter(([, v]) => v > 0));
  out = { updatedAt: now.toISOString(), week: String(data.week), note: "", modules: num(data.modules), topics: num(data.topics), tools: num(data.tools), topTopic: null };
  counters = Object.keys(out.modules).length + Object.keys(out.topics).length + Object.keys(out.tools).length;
  const t = data.topTopic;
  if (t && typeof t.moduleId === "string" && typeof t.topicId === "string") out.topTopic = { moduleId: t.moduleId, topicId: t.topicId, week: String(t.week ?? data.week) };
}
out.note = "Generated weekly by scripts/update-views.mjs. Counts are rounded down to the nearest 1,000; under 1,000 shows as New.";
const finished = out.week;

const old = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : {};
if (out.topTopic) topKeyLabel = `${out.topTopic.moduleId}/${out.topTopic.topicId}`;
else out.topTopic = old.topTopic ?? null; // nothing read last week: keep the previous pick

// Avoid a commit when nothing visible changed.
const strip = (v) => JSON.stringify({ ...v, updatedAt: null });
if (strip(old) === strip(out)) {
  console.log("update-views: no visible change.");
  process.exit(0);
}
fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + "\n");
console.log(`update-views: week ${finished}, ${counters} counters, top topic ${topKeyLabel}`);
