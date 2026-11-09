import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { portraitHosts } from "../../scripts/portrait-hosts.mjs";

describe("portrait hosts", () => {
  it("data/portrait-hosts.json lists every host that serves a portrait (run scripts/portrait-hosts.mjs)", () => {
    const listed = JSON.parse(readFileSync("data/portrait-hosts.json", "utf8")) as string[];
    expect(listed).toEqual(portraitHosts());
  });
});
