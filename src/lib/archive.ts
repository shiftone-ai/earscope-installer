import { logger } from "./logger.js";
import { mkdir } from "node:fs/promises";
import { escapePowerShellString } from "./escape.js";
import { isDryRun } from "./runtime.js";

export async function unzip(src: string, dest: string): Promise<void> {
  if (isDryRun()) {
    await logger.info(`Dry run: skipping extraction of ${src}`);
    return;
  }

  await logger.info(`Extracting ${src} to ${dest}...`);

  await mkdir(dest, { recursive: true });

  const safeSrc = escapePowerShellString(src);
  const safeDest = escapePowerShellString(dest);

  const script = `
    $ErrorActionPreference = 'Stop'
    Expand-Archive -Path '${safeSrc}' -DestinationPath '${safeDest}' -Force
  `;

  const proc = Bun.spawn(["powershell", "-NoProfile", "-Command", script], {
    stdout: "pipe",
    stderr: "pipe",
  });

  const exitCode = await proc.exited;

  if (exitCode !== 0) {
    const stderr = await new Response(proc.stderr).text();
    throw new Error(`Failed to extract ${src}: ${stderr}`);
  }

  await logger.info(`Extracted ${src} successfully`);
}
