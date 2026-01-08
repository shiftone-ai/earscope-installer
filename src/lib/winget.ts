import { logger } from "./logger.js";
import { escapePowerShellString } from "./escape.js";

const WINGET_DOWNLOAD_URL = "https://github.com/microsoft/winget-cli/releases/latest/download/Microsoft.DesktopAppInstaller_8wekyb3d8bbwe.msixbundle";

export async function installWinget(): Promise<void> {
  await logger.info("Installing winget...");

  const tempDir = process.env.TEMP || process.env.TMP || "C:\\Temp";
  const tempPath = `${tempDir}\\winget_installer.msixbundle`;
  const safeTempPath = escapePowerShellString(tempPath);

  const script = `
    $ErrorActionPreference = 'Stop'
    $ProgressPreference = 'SilentlyContinue'
    try {
      Write-Host 'Downloading winget...'
      Invoke-WebRequest -Uri '${WINGET_DOWNLOAD_URL}' -OutFile '${safeTempPath}'
      Write-Host 'Installing winget...'
      Add-AppxPackage -Path '${safeTempPath}' -ForceApplicationShutdown -ForceUpdateFromAnyVersion 2>$null
      Remove-Item '${safeTempPath}' -ErrorAction SilentlyContinue
      Write-Host 'winget installed successfully'
    } catch {
      Write-Host ('Error: ' + $_.Exception.Message)
      exit 1
    }
  `;

  const proc = Bun.spawn(["powershell", "-NoProfile", "-Command", script], {
    stdout: "pipe",
    stderr: "pipe",
  });

  const output = await new Response(proc.stdout).text();
  const exitCode = await proc.exited;

  if (exitCode !== 0) {
    const stderr = await new Response(proc.stderr).text();
    throw new Error(`winget installation failed: ${stderr || output}`);
  }

  await logger.info("winget installed successfully");
}

export async function initializeWinget(): Promise<void> {
  await logger.info("Initializing winget...");

  // Use full path to winget - PATH may not be updated in current process
  const script = `
    $wingetPath = "$env:LOCALAPPDATA\\Microsoft\\WindowsApps\\winget.exe"
    if (!(Test-Path $wingetPath)) { $wingetPath = "winget" }

    & $wingetPath upgrade --id Microsoft.DesktopAppInstaller -s msstore -e 2>$null
    & $wingetPath source reset 2>$null
    & $wingetPath source update 2>$null
  `;

  const proc = Bun.spawn(["powershell", "-NoProfile", "-Command", script], {
    stdout: "pipe",
    stderr: "pipe",
  });

  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    await logger.warn("winget initialization returned non-zero exit code (may be normal)");
  }

  await logger.info("winget initialized");
}

export async function setupWinget(): Promise<void> {
  await installWinget();
  await initializeWinget();
}
