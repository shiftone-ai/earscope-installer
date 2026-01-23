import { describe, expect, test, afterEach } from "bun:test";
import { join } from "node:path";
import {
  clearDryRunOverride,
  isDryRun,
  parseRuntimeOptions,
  resolveAssetsDir,
  resolveInstallPaths,
  setDryRun,
} from "../src/lib/runtime.js";

describe("runtime options", () => {
  afterEach(() => {
    clearDryRunOverride();
  });

  test("parses dry-run from env", () => {
    const result = parseRuntimeOptions(["node", "installer"], { DRY_RUN: "1" });
    expect(result.dryRun).toBe(true);
  });

  test("parses dry-run from args", () => {
    const result = parseRuntimeOptions(["node", "installer", "--dry-run"], {});
    expect(result.dryRun).toBe(true);
  });

  test("parses mock flag as dry-run", () => {
    const result = parseRuntimeOptions(["node", "installer", "--mock"], {});
    expect(result.dryRun).toBe(true);
  });

  test("parses assets dir flag", () => {
    const result = parseRuntimeOptions(["node", "installer", "--assets-dir", "/opt/assets"], {});
    expect(result.assetsDir).toBe("/opt/assets");
  });

  test("parses assets dir equals syntax", () => {
    const result = parseRuntimeOptions(["node", "installer", "--assets-dir=/opt/assets"], {});
    expect(result.assetsDir).toBe("/opt/assets");
  });

  test("dry-run override takes precedence", () => {
    setDryRun(false);
    expect(isDryRun({ DRY_RUN: "true" })).toBe(false);
  });
});

describe("path resolution", () => {
  test("resolveInstallPaths uses temp in dry-run", () => {
    const paths = resolveInstallPaths({ dryRun: true }, "/tmp");
    expect(paths.installDir).toBe(join("/tmp", "earscope-installer-dry-run", "hes"));
    expect(paths.logFile).toBe(join("/tmp", "earscope-installer-dry-run", "install.log"));
  });

  test("resolveInstallPaths uses Windows path in normal mode", () => {
    const paths = resolveInstallPaths({ dryRun: false }, "/tmp");
    expect(paths.installDir).toBe("C:\\hes");
    expect(paths.logFile).toBe("C:\\hes\\install.log");
  });

  test("resolveAssetsDir respects override", () => {
    const assets = resolveAssetsDir("/bin/installer", { dryRun: false, assetsDir: "/opt/assets" }, "/cwd");
    expect(assets).toBe("/opt/assets");
  });

  test("resolveAssetsDir uses cwd in dry-run when no override", () => {
    const assets = resolveAssetsDir("/bin/installer", { dryRun: true }, "/cwd");
    expect(assets).toBe("/cwd");
  });
});
