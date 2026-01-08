import { logger } from "./logger.js";
import { escapePowerShellString } from "./escape.js";

export async function registerStartup(exePath: string, name: string): Promise<void> {
  await logger.info(`Registering ${name} to Windows startup...`);

  const safeExePath = escapePowerShellString(exePath);
  const safeName = escapePowerShellString(name);

  const script = `
    $ErrorActionPreference = 'Stop'
    try {
      $regPath = 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run'
      Set-ItemProperty -Path $regPath -Name '${safeName}' -Value '"${safeExePath}"'
      Write-Host "Registered to startup: ${safeName}"
    } catch {
      Write-Host "Failed to register to startup: ${safeName}"
      exit 1
    }
  `;

  const proc = Bun.spawn(["powershell", "-NoProfile", "-Command", script], {
    stdout: "pipe",
    stderr: "pipe",
  });

  const output = await new Response(proc.stdout).text();
  const exitCode = await proc.exited;

  if (exitCode === 0) {
    await logger.info(`Registered to startup: ${name}`);
  } else {
    await logger.warn(`Failed to register to startup: ${name} - ${output}`);
  }
}

export async function unregisterStartup(name: string): Promise<void> {
  await logger.info(`Removing ${name} from Windows startup...`);

  const safeName = escapePowerShellString(name);

  const script = `
    $regPath = 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run'
    Remove-ItemProperty -Path $regPath -Name '${safeName}' -ErrorAction SilentlyContinue
  `;

  const proc = Bun.spawn(["powershell", "-NoProfile", "-Command", script], {
    stdout: "pipe",
    stderr: "pipe",
  });

  await proc.exited;
  await logger.info(`Removed from startup: ${name}`);
}
