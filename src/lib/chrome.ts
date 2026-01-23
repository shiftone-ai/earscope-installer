import { logger } from "./logger.js";
import { isDryRun } from "./runtime.js";

export async function installChrome(): Promise<void> {
  if (isDryRun()) {
    await logger.info("Dry run: skipping Google Chrome installation");
    return;
  }

  await logger.info("Installing Google Chrome...");

  // Use PowerShell to call winget - PATH may not be updated in current Bun process
  const script = `
    $ErrorActionPreference = 'Stop'
    $wingetPath = "$env:LOCALAPPDATA\\Microsoft\\WindowsApps\\winget.exe"
    if (Test-Path $wingetPath) {
      & $wingetPath install --id Google.Chrome -e --accept-package-agreements --accept-source-agreements --silent
    } else {
      winget install --id Google.Chrome -e --accept-package-agreements --accept-source-agreements --silent
    }
  `;

  const proc = Bun.spawn(["powershell", "-NoProfile", "-Command", script], {
    stdout: "pipe",
    stderr: "pipe",
  });

  const output = await new Response(proc.stdout).text();
  const exitCode = await proc.exited;

  if (exitCode !== 0) {
    await logger.warn(`Chrome installation returned non-zero exit code (may already be installed): ${output}`);
  } else {
    await logger.info("Google Chrome installed successfully");
  }
}
