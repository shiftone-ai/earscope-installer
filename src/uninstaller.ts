import { rm } from "node:fs/promises";
import { join } from "node:path";
import { logger } from "./lib/logger.js";
import { ensureAdmin } from "./lib/admin.js";
import { unregisterStartup } from "./lib/startup.js";
import { isWindows } from "./lib/platform.js";
import { Tui } from "./lib/tui.js";
import { stopRunningProcesses } from "./lib/process.js";
import { escapePowerShellString } from "./lib/escape.js";
import {
  isDryRun,
  parseRuntimeOptions,
  resolveInstallPaths,
  setDryRun,
} from "./lib/runtime.js";

const TUI_STEPS = [
  { id: "check", label: "Check environment" },
  { id: "admin", label: "Ensure admin privileges" },
  { id: "stop", label: "Stop running processes" },
  { id: "registry", label: "Remove registry entry" },
  { id: "shortcuts", label: "Remove desktop shortcuts" },
  { id: "directory", label: "Remove installation directory" },
];

const PROCESSES_TO_STOP = ["ElectronViewer", "EARSCOPE_Viewer"];

const SHORTCUTS_TO_REMOVE = [
  "EARSCOPE Viewer",
  "EARSCOPE Recordings",
  "EARSCOPE Captures",
  "EARSCOPE Launcher",
  "YNC Neo",
];

async function waitForEnter(showPrompt = true): Promise<void> {
  if (showPrompt) {
    console.log("\nPress Enter to exit...");
  }

  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
  }
  process.stdin.resume();

  await new Promise<void>((resolve) => {
    const onData = (data: Buffer): void => {
      process.stdin.off("data", onData);
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(false);
      }
      process.stdin.pause();
      resolve();
    };
    process.stdin.on("data", onData);
  });
}

async function removeShortcut(name: string): Promise<boolean> {
  if (isDryRun()) {
    await logger.info(`Dry run: skipping shortcut removal for "${name}"`);
    return true;
  }

  const safeName = escapePowerShellString(name);

  const script = `
    $ErrorActionPreference = 'SilentlyContinue'
    $desktop = [Environment]::GetFolderPath('Desktop')
    $linkPath = Join-Path $desktop ('${safeName}' + '.lnk')
    if (Test-Path $linkPath) {
      Remove-Item $linkPath -Force
      Write-Host "Removed: $linkPath"
    }
  `;

  const proc = Bun.spawn(["powershell", "-NoProfile", "-Command", script], {
    stdout: "pipe",
    stderr: "pipe",
  });

  await proc.exited;
  await logger.info(`Removed shortcut: ${name}`);
  return true;
}

async function removeDirectory(dirPath: string): Promise<void> {
  if (isDryRun()) {
    await logger.info(`Dry run: skipping directory removal for "${dirPath}"`);
    return;
  }

  await rm(dirPath, { recursive: true, force: true });
  await logger.info(`Removed directory: ${dirPath}`);
}

async function main(): Promise<void> {
  const runtime = parseRuntimeOptions(process.argv);
  if (runtime.dryRun) {
    setDryRun(true);
  }
  const { installDir, logFile } = resolveInstallPaths(runtime);

  const tui = new Tui(TUI_STEPS, { title: "EARSCOPE Uninstaller" });
  if (tui.enabled) {
    logger.setConsoleEnabled(false);
    tui.start();
    if (runtime.dryRun) {
      tui.note("Dry run mode: no changes will be made.");
    }
  }

  try {
    // Step 1: Check environment
    tui.setActive("check", "Windows");
    if (!isWindows() && !runtime.dryRun) {
      tui.fail("check", "Windows only");
      if (tui.enabled) {
        tui.finish(false, "This uninstaller is only supported on Windows.");
        await waitForEnter(false);
      }
      console.error("This uninstaller is only supported on Windows.");
      process.exit(1);
    }
    tui.complete("check", runtime.dryRun ? "Dry run" : "OK");

    // Initialize logger
    await logger.initLogger(join(installDir, "uninstall.log"));
    await logger.info("EARSCOPE Uninstaller started");

    // Step 2: Ensure admin privileges
    tui.setActive("admin", "Elevate if prompted");
    await ensureAdmin(process.execPath);
    tui.complete("admin", "OK");

    // Step 3: Stop running processes
    tui.setActive("stop", "Checking processes");
    await logger.info("=== Stopping running processes ===");
    const stopped = await stopRunningProcesses(PROCESSES_TO_STOP);
    if (stopped.length > 0) {
      tui.complete("stop", `Stopped: ${stopped.join(", ")}`);
    } else {
      tui.complete("stop", "No processes running");
    }

    // Step 4: Remove registry entry
    tui.setActive("registry", "ElectronViewer");
    await logger.info("=== Removing registry entry ===");
    await unregisterStartup("ElectronViewer");
    tui.complete("registry", "OK");

    // Step 5: Remove desktop shortcuts
    tui.setActive("shortcuts");
    await logger.info("=== Removing desktop shortcuts ===");
    let removedCount = 0;
    for (const name of SHORTCUTS_TO_REMOVE) {
      await removeShortcut(name);
      removedCount += 1;
    }
    tui.complete("shortcuts", `${removedCount} shortcuts`);

    // Step 6: Remove installation directory
    tui.setActive("directory", installDir);
    await logger.info("=== Removing installation directory ===");
    await removeDirectory(installDir);
    tui.complete("directory", "OK");

    await logger.info("=== Uninstallation completed successfully ===");

    const successMessage = "Uninstallation complete. Press Enter to exit.";
    if (tui.enabled) {
      tui.finish(true, successMessage);
      await waitForEnter(false);
    } else {
      console.log("\n===== Uninstallation Complete =====");
      await waitForEnter(true);
    }
  } catch (error) {
    const errorMessage = error instanceof Error
      ? `${error.message}\n${error.stack || ""}`
      : String(error);
    await logger.error(`Uninstallation failed: ${errorMessage}`);

    if (tui.enabled) {
      tui.failActive("Error");
      tui.finish(false, `Press Enter to exit. Log file: ${logFile}`);
      console.error(`\nError: ${errorMessage}`);
      await waitForEnter(false);
    } else {
      console.error(`\nError: ${errorMessage}`);
      await waitForEnter(true);
    }

    process.exit(1);
  }
}

main();
