import { logger } from "./logger.js";
import { escapePowerShellString } from "./escape.js";
import { isDryRun } from "./runtime.js";

export async function isAdmin(): Promise<boolean> {
  const proc = Bun.spawn(["powershell", "-NoProfile", "-Command",
    "([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)"
  ], { stdout: "pipe", stderr: "pipe" });

  const output = await new Response(proc.stdout).text();
  await proc.exited;

  return output.trim().toLowerCase() === "true";
}

export async function requestElevation(exePath: string): Promise<void> {
  await logger.info("Requesting administrator privileges...");

  const safeExePath = escapePowerShellString(exePath);
  const script = `
    Start-Process -FilePath '${safeExePath}' -Verb RunAs -Wait
  `;

  const proc = Bun.spawn(["powershell", "-NoProfile", "-Command", script], {
    stdout: "inherit",
    stderr: "inherit",
  });

  await proc.exited;
  process.exit(0);
}

export async function ensureAdmin(exePath: string): Promise<void> {
  if (isDryRun()) {
    await logger.info("Dry run: skipping administrator elevation");
    return;
  }

  const admin = await isAdmin();

  if (!admin) {
    await logger.warn("Not running as administrator. Requesting elevation...");
    await requestElevation(exePath);
  } else {
    await logger.info("Running with administrator privileges.");
  }
}
