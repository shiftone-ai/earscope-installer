import { logger } from "./logger.js";
import { escapePowerShellString } from "./escape.js";
import { isDryRun } from "./runtime.js";

/**
 * Check if a process with the given name is running.
 * @param processName - Process name without .exe extension
 * @returns true if the process is running
 */
export async function isProcessRunning(processName: string): Promise<boolean> {
  if (isDryRun()) {
    await logger.info(`Dry run: checking if ${processName} is running (assumed false)`);
    return false;
  }

  const safeProcessName = escapePowerShellString(processName);

  const script = `
    $proc = Get-Process -Name '${safeProcessName}' -ErrorAction SilentlyContinue
    if ($proc) { Write-Host 'true' } else { Write-Host 'false' }
  `;

  const proc = Bun.spawn(["powershell", "-NoProfile", "-Command", script], {
    stdout: "pipe",
    stderr: "pipe",
  });

  const output = await new Response(proc.stdout).text();
  await proc.exited;

  return output.trim().toLowerCase() === "true";
}

/**
 * Kill a process with the given name.
 * @param processName - Process name without .exe extension
 * @returns true if the process was killed or wasn't running
 */
export async function killProcess(processName: string): Promise<boolean> {
  if (isDryRun()) {
    await logger.info(`Dry run: skipping kill of ${processName}`);
    return true;
  }

  const safeProcessName = escapePowerShellString(processName);

  const script = `
    $ErrorActionPreference = 'SilentlyContinue'
    Stop-Process -Name '${safeProcessName}' -Force -ErrorAction SilentlyContinue
    # Wait a moment for process to fully terminate
    Start-Sleep -Milliseconds 500
  `;

  const proc = Bun.spawn(["powershell", "-NoProfile", "-Command", script], {
    stdout: "pipe",
    stderr: "pipe",
  });

  await proc.exited;
  await logger.info(`Stopped process: ${processName}`);
  return true;
}

/**
 * Stop multiple processes by name.
 * @param processNames - Array of process names without .exe extension
 * @returns Array of process names that were running and stopped
 */
export async function stopRunningProcesses(processNames: string[]): Promise<string[]> {
  const stopped: string[] = [];

  for (const name of processNames) {
    const running = await isProcessRunning(name);
    if (running) {
      await logger.info(`Process ${name} is running, stopping...`);
      await killProcess(name);
      stopped.push(name);
    }
  }

  return stopped;
}
