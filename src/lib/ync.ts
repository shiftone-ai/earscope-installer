import { exists } from "node:fs/promises";
import { join } from "node:path";
import { logger } from "./logger.js";
import { escapePowerShellString } from "./escape.js";
import { isDryRun } from "./runtime.js";

export async function hasYncAssets(assetsDir: string): Promise<boolean> {
  const yncDir = join(assetsDir, "ync");
  return exists(yncDir);
}

export async function findYncInstaller(assetsDir: string): Promise<string | null> {
  const yncDir = join(assetsDir, "ync");

  if (!(await exists(yncDir))) {
    return null;
  }

  const safeYncDir = escapePowerShellString(yncDir);
  const proc = Bun.spawn(["powershell", "-NoProfile", "-Command",
    `Get-ChildItem -Path '${safeYncDir}' -Filter 'YNCneo*.exe' | Select-Object -First 1 -ExpandProperty FullName`
  ], { stdout: "pipe", stderr: "pipe" });

  const output = await new Response(proc.stdout).text();
  await proc.exited;

  const installerPath = output.trim();
  return installerPath || null;
}

const YNC_INSTALL_PATH = "C:\\Program Files\\YNC_Neo\\YNC_Neo.exe";

export async function isYncInstalled(): Promise<boolean> {
  return exists(YNC_INSTALL_PATH);
}

export async function installYnc(assetsDir: string): Promise<void> {
  if (isDryRun()) {
    await logger.info("Dry run: skipping YNCneo installation");
    return;
  }

  if (await isYncInstalled()) {
    await logger.info("YNCneo is already installed, skipping...");
    return;
  }

  const installerPath = await findYncInstaller(assetsDir);

  if (!installerPath) {
    await logger.info("YNCneo installer not found, skipping...");
    return;
  }

  await logger.info(`Launching YNCneo installer: ${installerPath}`);

  const proc = Bun.spawn(["cmd", "/c", "start", "/wait", "", installerPath], {
    stdout: "inherit",
    stderr: "inherit",
  });

  const exitCode = await proc.exited;

  if (exitCode !== 0) {
    await logger.warn(`YNCneo installer exited with code ${exitCode}`);
  } else {
    await logger.info("YNCneo installation completed");
  }
}
