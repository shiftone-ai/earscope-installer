import { describe, expect, test } from "bun:test";
import {
  parseVersion,
  compareVersions,
  parseManifestFromBody,
  createManifestFromRelease,
  formatUpdateNotification,
} from "../src/lib/update.js";
import type { UpdateCheckResult, UpdateManifest } from "../src/types/index.js";

describe("parseVersion", () => {
  test("parses simple version", () => {
    expect(parseVersion("1.2.3")).toEqual([1, 2, 3]);
  });

  test("parses version with v prefix", () => {
    expect(parseVersion("v1.2.3")).toEqual([1, 2, 3]);
  });

  test("parses version with fewer components", () => {
    expect(parseVersion("1.0")).toEqual([1, 0]);
  });

  test("parses single number version", () => {
    expect(parseVersion("1")).toEqual([1]);
  });

  test("handles invalid parts as zero", () => {
    expect(parseVersion("1.x.3")).toEqual([1, 0, 3]);
  });
});

describe("compareVersions", () => {
  test("returns 0 for equal versions", () => {
    expect(compareVersions("1.0.0", "1.0.0")).toBe(0);
  });

  test("returns 0 for equal versions with v prefix", () => {
    expect(compareVersions("v1.0.0", "1.0.0")).toBe(0);
  });

  test("returns positive when a > b", () => {
    expect(compareVersions("1.1.0", "1.0.0")).toBeGreaterThan(0);
  });

  test("returns negative when a < b", () => {
    expect(compareVersions("1.0.0", "1.1.0")).toBeLessThan(0);
  });

  test("compares major version correctly", () => {
    expect(compareVersions("2.0.0", "1.9.9")).toBeGreaterThan(0);
  });

  test("compares minor version correctly", () => {
    expect(compareVersions("1.2.0", "1.1.9")).toBeGreaterThan(0);
  });

  test("compares patch version correctly", () => {
    expect(compareVersions("1.0.2", "1.0.1")).toBeGreaterThan(0);
  });

  test("handles different length versions", () => {
    expect(compareVersions("1.0.0", "1.0")).toBe(0);
    expect(compareVersions("1.0.1", "1.0")).toBeGreaterThan(0);
    expect(compareVersions("1.0", "1.0.1")).toBeLessThan(0);
  });
});

describe("parseManifestFromBody", () => {
  test("parses valid JSON block", () => {
    const body = `
# Release Notes

Some text here.

\`\`\`json
{
  "version": "1.1.0",
  "releaseDate": "2026-01-29T10:00:00Z",
  "releaseNotes": "- New feature\\n- Bug fix",
  "downloadUrl": "https://example.com/download"
}
\`\`\`
`;
    const manifest = parseManifestFromBody(body);
    expect(manifest).not.toBeNull();
    expect(manifest?.version).toBe("1.1.0");
    expect(manifest?.releaseDate).toBe("2026-01-29T10:00:00Z");
    expect(manifest?.releaseNotes).toBe("- New feature\n- Bug fix");
    expect(manifest?.downloadUrl).toBe("https://example.com/download");
  });

  test("returns null for body without JSON block", () => {
    const body = "# Release Notes\n\nNo JSON here.";
    expect(parseManifestFromBody(body)).toBeNull();
  });

  test("returns null for invalid JSON", () => {
    const body = "```json\n{ invalid json }\n```";
    expect(parseManifestFromBody(body)).toBeNull();
  });

  test("returns null for missing required fields", () => {
    const body = '```json\n{ "version": "1.0.0" }\n```';
    expect(parseManifestFromBody(body)).toBeNull();
  });

  test("includes optional fields when present", () => {
    const body = `
\`\`\`json
{
  "version": "1.1.0",
  "releaseDate": "2026-01-29T10:00:00Z",
  "releaseNotes": "Notes",
  "downloadUrl": "https://example.com/download",
  "minimumVersion": "1.0.0",
  "checksum": "abc123"
}
\`\`\`
`;
    const manifest = parseManifestFromBody(body);
    expect(manifest?.minimumVersion).toBe("1.0.0");
    expect(manifest?.checksum).toBe("abc123");
  });
});

describe("createManifestFromRelease", () => {
  test("creates manifest from GitHub release", () => {
    const release = {
      tag_name: "v1.2.0",
      name: "Release 1.2.0",
      body: "Some release notes",
      html_url: "https://github.com/test/repo/releases/tag/v1.2.0",
      published_at: "2026-01-29T10:00:00Z",
    };

    const manifest = createManifestFromRelease(release);
    expect(manifest.version).toBe("1.2.0");
    expect(manifest.releaseDate).toBe("2026-01-29T10:00:00Z");
    expect(manifest.releaseNotes).toBe("Some release notes");
    expect(manifest.downloadUrl).toBe("https://github.com/test/repo/releases/tag/v1.2.0");
  });

  test("handles empty body", () => {
    const release = {
      tag_name: "v1.0.0",
      name: "Release",
      body: "",
      html_url: "https://example.com",
      published_at: "2026-01-29T10:00:00Z",
    };

    const manifest = createManifestFromRelease(release);
    expect(manifest.releaseNotes).toBe("No release notes available.");
  });
});

describe("formatUpdateNotification", () => {
  test("returns empty string when no update available", () => {
    const result: UpdateCheckResult = {
      updateAvailable: false,
      currentVersion: "1.0.0",
      latestVersion: "1.0.0",
      manifest: null,
    };
    expect(formatUpdateNotification(result)).toBe("");
  });

  test("returns empty string when manifest is null", () => {
    const result: UpdateCheckResult = {
      updateAvailable: true,
      currentVersion: "1.0.0",
      latestVersion: "1.1.0",
      manifest: null,
    };
    expect(formatUpdateNotification(result)).toBe("");
  });

  test("formats notification with update info", () => {
    const manifest: UpdateManifest = {
      version: "1.1.0",
      releaseDate: "2026-01-29T10:00:00Z",
      releaseNotes: "- New feature\n- Bug fix",
      downloadUrl: "https://example.com/download",
    };
    const result: UpdateCheckResult = {
      updateAvailable: true,
      currentVersion: "1.0.0",
      latestVersion: "1.1.0",
      manifest,
    };

    const notification = formatUpdateNotification(result);
    expect(notification).toContain("UPDATE AVAILABLE");
    expect(notification).toContain("Current version: 1.0.0");
    expect(notification).toContain("Latest version:  1.1.0");
    expect(notification).toContain("- New feature");
    expect(notification).toContain("- Bug fix");
    expect(notification).toContain("https://example.com/download");
  });
});
