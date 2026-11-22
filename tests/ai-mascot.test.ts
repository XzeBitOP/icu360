import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AiMascot } from "../src/components/client/AiMascot";

describe("AI mascot", () => {
  it("is a white ball with two dark pill eyes and an 'Ask AI' label", () => {
    const html = renderToStaticMarkup(createElement(AiMascot, { size: 40 }));
    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="Ask AI"');
    expect(html.match(/class="ai-mascot-eye"/g)).toHaveLength(2);
    expect(html).toContain('fill="#1a1a1a"');
    expect(html).toContain("<circle");
  });
  it("can be decorative and marks the streaming state", () => {
    const html = renderToStaticMarkup(createElement(AiMascot, { label: null, active: true }));
    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toContain("aria-label");
    expect(html).toContain("is-active");
  });
  it("blink and bob are disabled under prefers-reduced-motion", () => {
    const css = readFileSync("src/app/globals.css", "utf8");
    expect(css).toMatch(/@keyframes ai-blink/);
    expect(css).toMatch(/@keyframes ai-bob/);
    expect(css).toMatch(/prefers-reduced-motion: reduce\) \{ \.ai-mascot \.ai-mascot-eye, \.ai-mascot\.is-active \.ai-mascot-body \{ animation: none; \}/);
  });
});
