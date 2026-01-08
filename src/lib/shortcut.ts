import { exists } from "node:fs/promises";
import { dirname } from "node:path";
import { logger } from "./logger.js";
import { escapePowerShellString } from "./escape.js";

interface ShortcutOptions {
  workingDir?: string;
  isFolder?: boolean;
}

export async function createShortcut(
  target: string,
  name: string,
  options: ShortcutOptions = {}
): Promise<void> {
  if (!(await exists(target))) {
    await logger.warn(`Target not found for shortcut "${name}": ${target}`);
    return;
  }

  const safeTarget = escapePowerShellString(target);
  const safeName = escapePowerShellString(name);
  const workingDirPart = options.isFolder
    ? ""
    : `$shortcut.WorkingDirectory = '${escapePowerShellString(options.workingDir || dirname(target))}'`;

  const script = `
    $ErrorActionPreference = 'Stop'
    try {
      $target = '${safeTarget}'
      $name = '${safeName}'
      $desktop = [Environment]::GetFolderPath('Desktop')
      $linkPath = Join-Path $desktop ($name + '.lnk')
      $WshShell = New-Object -ComObject WScript.Shell
      $shortcut = $WshShell.CreateShortcut($linkPath)
      $shortcut.TargetPath = $target
      ${workingDirPart}
      $shortcut.Save()
      Write-Host "Shortcut created: $name"
    } catch {
      Write-Host "Failed to create shortcut: $name"
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
    await logger.info(`Shortcut created: ${name}`);
  } else {
    await logger.warn(`Failed to create shortcut: ${name} - ${output}`);
  }
}

export async function createFolderShortcut(folderPath: string, name: string): Promise<void> {
  return createShortcut(folderPath, name, { isFolder: true });
}
