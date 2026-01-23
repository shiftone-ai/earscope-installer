import { dirname, join } from "node:path";
import os from "node:os";

export interface RuntimeOptions {
  dryRun: boolean;
  assetsDir?: string;
}

let dryRunOverride: boolean | null = null;

function isTruthy(value: string | undefined): boolean {
  if (!value) {
    return false;
  }
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

export function parseRuntimeOptions(argv: string[], env: NodeJS.ProcessEnv = process.env): RuntimeOptions {
  const args = argv.slice(2);
  let dryRun = isTruthy(env.DRY_RUN);
  let assetsDir: string | undefined;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--dry-run" || arg === "--mock") {
      dryRun = true;
      continue;
    }

    if (arg === "--assets-dir" && args[i + 1]) {
      assetsDir = args[i + 1];
      i += 1;
      continue;
    }

    if (arg.startsWith("--assets-dir=")) {
      assetsDir = arg.slice("--assets-dir=".length);
    }
  }

  return { dryRun, assetsDir };
}

export function setDryRun(enabled: boolean): void {
  dryRunOverride = enabled;
}

export function clearDryRunOverride(): void {
  dryRunOverride = null;
}

export function isDryRun(env: NodeJS.ProcessEnv = process.env): boolean {
  if (dryRunOverride !== null) {
    return dryRunOverride;
  }
  return isTruthy(env.DRY_RUN);
}

export function resolveAssetsDir(execPath: string, options: RuntimeOptions, cwd: string = process.cwd()): string {
  if (options.assetsDir && options.assetsDir.trim().length > 0) {
    return options.assetsDir;
  }
  if (options.dryRun) {
    return cwd;
  }
  return dirname(execPath);
}

export function resolveInstallPaths(options: RuntimeOptions, tempDir: string = os.tmpdir()): { installDir: string; logFile: string } {
  if (options.dryRun) {
    const baseDir = join(tempDir, "earscope-installer-dry-run");
    const installDir = join(baseDir, "hes");
    return {
      installDir,
      logFile: join(baseDir, "install.log"),
    };
  }

  const installDir = "C:\\hes";
  return {
    installDir,
    logFile: `${installDir}\\install.log`,
  };
}
