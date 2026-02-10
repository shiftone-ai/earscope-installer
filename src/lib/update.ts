/**
 * OTA Update Check Module
 * 
 * Provides functionality to check for updates from GitHub Releases.
 * This module only checks for updates - it does not download or install.
 */

import type { UpdateManifest, UpdateCheckResult } from "../types/index.js";
import { VERSION } from "./version.js";

const GITHUB_OWNER = "shiftone-ai";
const GITHUB_REPO = "earscope-installer";
const GITHUB_API_URL = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;
const UPDATE_CHECK_TIMEOUT_MS = 10_000;

/**
 * Parse a version string into numeric components.
 * Handles both "1.2.3" and "v1.2.3" formats.
 */
export function parseVersion(version: string): number[] {
  const normalized = version.replace(/^v/, "");
  return normalized.split(".").map((part) => {
    const num = parseInt(part, 10);
    return isNaN(num) ? 0 : num;
  });
}

/**
 * Compare two version strings.
 * @returns negative if a < b, positive if a > b, 0 if equal
 */
export function compareVersions(a: string, b: string): number {
  const partsA = parseVersion(a);
  const partsB = parseVersion(b);
  const maxLength = Math.max(partsA.length, partsB.length);

  for (let i = 0; i < maxLength; i++) {
    const numA = partsA[i] ?? 0;
    const numB = partsB[i] ?? 0;
    if (numA !== numB) {
      return numA - numB;
    }
  }
  return 0;
}

/**
 * Parse UpdateManifest from GitHub Release body.
 * The manifest is expected to be embedded as a JSON code block.
 */
export function parseManifestFromBody(body: string): UpdateManifest | null {
  // Look for JSON block in markdown: ```json ... ```
  const jsonBlockMatch = body.match(/```json\s*([\s\S]*?)```/);
  if (!jsonBlockMatch) {
    return null;
  }

  try {
    const manifest = JSON.parse(jsonBlockMatch[1].trim()) as UpdateManifest;
    // Validate required fields
    if (
      typeof manifest.version !== "string" ||
      typeof manifest.releaseDate !== "string" ||
      typeof manifest.releaseNotes !== "string" ||
      typeof manifest.downloadUrl !== "string"
    ) {
      return null;
    }
    return manifest;
  } catch {
    return null;
  }
}

/**
 * Create an UpdateManifest from GitHub Release metadata when JSON block is not available.
 */
export function createManifestFromRelease(release: GitHubRelease): UpdateManifest {
  return {
    version: release.tag_name.replace(/^v/, ""),
    releaseDate: release.published_at,
    releaseNotes: release.body || "No release notes available.",
    downloadUrl: release.html_url,
  };
}

interface GitHubRelease {
  tag_name: string;
  name: string;
  body: string;
  html_url: string;
  published_at: string;
}

/**
 * Fetch the latest release information from GitHub API.
 */
export async function fetchLatestRelease(): Promise<UpdateManifest | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), UPDATE_CHECK_TIMEOUT_MS);

  try {
    const response = await fetch(GITHUB_API_URL, {
      signal: controller.signal,
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": `earscope-installer/${VERSION}`,
      },
    });

    if (!response.ok) {
      return null;
    }

    const release = (await response.json()) as GitHubRelease;

    // Try to parse embedded JSON manifest first
    const manifest = parseManifestFromBody(release.body || "");
    if (manifest) {
      return manifest;
    }

    // Fallback to release metadata
    return createManifestFromRelease(release);
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Check for updates by comparing current version with latest release.
 */
export async function checkForUpdate(): Promise<UpdateCheckResult> {
  const currentVersion = VERSION;

  // In dry-run mode, skip network calls
  if (process.env.DRY_RUN === "1") {
    return {
      updateAvailable: false,
      currentVersion,
      latestVersion: currentVersion,
      manifest: null,
    };
  }

  try {
    const manifest = await fetchLatestRelease();

    if (!manifest) {
      return {
        updateAvailable: false,
        currentVersion,
        latestVersion: currentVersion,
        manifest: null,
        error: "Failed to fetch latest release information",
      };
    }

    const comparison = compareVersions(manifest.version, currentVersion);
    const updateAvailable = comparison > 0;

    return {
      updateAvailable,
      currentVersion,
      latestVersion: manifest.version,
      manifest: updateAvailable ? manifest : null,
    };
  } catch (err) {
    return {
      updateAvailable: false,
      currentVersion,
      latestVersion: currentVersion,
      manifest: null,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Format an update notification message for display.
 */
export function formatUpdateNotification(result: UpdateCheckResult): string {
  if (!result.updateAvailable || !result.manifest) {
    return "";
  }

  const lines = [
    "",
    "=".repeat(60),
    "  UPDATE AVAILABLE",
    "=".repeat(60),
    `  Current version: ${result.currentVersion}`,
    `  Latest version:  ${result.latestVersion}`,
    "",
    "  Release Notes:",
    ...result.manifest.releaseNotes.split("\n").map((line) => `    ${line}`),
    "",
    `  Download: ${result.manifest.downloadUrl}`,
    "=".repeat(60),
    "",
  ];

  return lines.join("\n");
}
