import { exists, mkdir, cp } from "node:fs/promises";
import { join } from "node:path";
import { logger } from "./lib/logger.js";
import { ensureAdmin } from "./lib/admin.js";
import { setupWinget } from "./lib/winget.js";
import { installChrome } from "./lib/chrome.js";
import { unzip } from "./lib/archive.js";
import { hasYncAssets, installYnc } from "./lib/ync.js";
import { createShortcut, createFolderShortcut } from "./lib/shortcut.js";
import { registerStartup } from "./lib/startup.js";
import { isWindows } from "./lib/platform.js";
import { Tui } from "./lib/tui.js";
import { stopRunningProcesses } from "./lib/process.js";
import {
  isDryRun,
  parseRuntimeOptions,
  resolveAssetsDir,
  resolveInstallPaths,
  setDryRun,
} from "./lib/runtime.js";

const PROCESSES_TO_STOP = ["ElectronViewer", "EARSCOPE_Viewer"];

const TUI_STEPS = [
  { id: "check", label: "Check environment" },
  { id: "prepare", label: "Prepare installer" },
  { id: "admin", label: "Ensure admin privileges" },
  { id: "stop", label: "Stop running processes" },
  { id: "winget", label: "Install winget" },
  { id: "chrome", label: "Install Google Chrome" },
  { id: "ync", label: "Install YNCneo (optional)" },
  { id: "extract", label: "Extract assets" },
  { id: "launcher", label: "Copy launcher.exe" },
  { id: "uninstaller", label: "Copy uninstaller.exe" },
  { id: "shortcuts", label: "Create shortcuts" },
  { id: "startup", label: "Register startup" },
];

async function waitForEnter(showPrompt = true): Promise<void> {
  if (showPrompt) {
    console.log("\nPress Enter to exit...");
  }

  // Setup stdin for reading
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
  }
  process.stdin.resume();

  await new Promise<void>((resolve) => {
    const onData = (data: Buffer): void => {
      // Accept any key press to exit
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

async function main(): Promise<void> {
  const runtime = parseRuntimeOptions(process.argv);
  if (runtime.dryRun) {
    setDryRun(true);
  }
  const { installDir, logFile } = resolveInstallPaths(runtime);
  const assetsDir = resolveAssetsDir(process.execPath, runtime);

  const tui = new Tui(TUI_STEPS, { title: "EARSCOPE Installer" });
  if (tui.enabled) {
    logger.setConsoleEnabled(false);
    tui.start();
    if (runtime.dryRun) {
      tui.note("Dry run mode: no changes will be made.");
    }
  }

  try {
    tui.setActive("check", "Windows");
    if (!isWindows() && !runtime.dryRun) {
      tui.fail("check", "Windows only");
      if (tui.enabled) {
        tui.finish(false, "This installer is only supported on Windows.");
        await waitForEnter(false);
      }
      console.error("This installer is only supported on Windows.");
      process.exit(1);
    }
    tui.complete("check", runtime.dryRun ? "Dry run" : "OK");

    tui.setActive("prepare");
    await mkdir(installDir, { recursive: true });
    await logger.initLogger(logFile);
    await logger.info("EARSCOPE Installer started");
    tui.complete("prepare");

    tui.setActive("admin", "Elevate if prompted");
    await ensureAdmin(process.execPath);
    tui.complete("admin", "OK");

    tui.setActive("stop", "Checking processes");
    await logger.info("=== Stopping running processes ===");
    const stopped = await stopRunningProcesses(PROCESSES_TO_STOP);
    if (stopped.length > 0) {
      tui.complete("stop", `Stopped: ${stopped.join(", ")}`);
    } else {
      tui.complete("stop", "No processes running");
    }

    tui.setActive("winget");
    await logger.info("=== Installing winget ===");
    await setupWinget();
    tui.complete("winget");

    tui.setActive("chrome");
    await logger.info("=== Installing Google Chrome ===");
    await installChrome();
    tui.complete("chrome");

    tui.setActive("ync");
    if (await hasYncAssets(assetsDir)) {
      await logger.info("=== Installing YNCneo ===");
      await installYnc(assetsDir);
      tui.complete("ync");
    } else {
      await logger.info("YNCneo assets not found, skipping YNCneo installation");
      tui.skip("ync", "Assets not found");
    }

    tui.setActive("extract");
    await logger.info("=== Extracting assets ===");

    const binZipPath = join(assetsDir, "win32-x64", "bin.zip");
    const electronZipPath = join(assetsDir, "win32-x64", "ElectronViewer-win32-x64.zip");
    const extracted: string[] = [];

    // Note: Both zips contain their folder inside (bin/, ElectronViewer-win32-x64/)
    // so we extract directly to installDir
    if (await exists(binZipPath)) {
      await unzip(binZipPath, installDir);
      const expectedExe = join(installDir, "bin", "EARSCOPE_Viewer.exe");
      if (!isDryRun() && !(await exists(expectedExe))) {
        throw new Error(`EARSCOPE_Viewer.exe not found after extraction: ${expectedExe}`);
      }
      extracted.push("bin.zip");
    } else {
      await logger.warn(`bin.zip not found: ${binZipPath}`);
    }

    if (await exists(electronZipPath)) {
      await unzip(electronZipPath, installDir);
      const expectedExe = join(installDir, "ElectronViewer-win32-x64", "ElectronViewer.exe");
      if (!isDryRun() && !(await exists(expectedExe))) {
        throw new Error(`ElectronViewer.exe not found after extraction: ${expectedExe}`);
      }
      extracted.push("ElectronViewer");
    } else {
      await logger.warn(`ElectronViewer zip not found: ${electronZipPath}`);
    }

    if (extracted.length === 0) {
      tui.skip("extract", "No archives found");
    } else {
      tui.complete("extract", extracted.join(", "));
    }

    tui.setActive("launcher");
    await logger.info("=== Copying launcher.exe ===");
    const srcLauncherExe = join(assetsDir, "launcher.exe");
    const destLauncherExe = join(installDir, "launcher.exe");
    if (await exists(srcLauncherExe)) {
      await cp(srcLauncherExe, destLauncherExe);
      await logger.info("Copied launcher.exe to installation directory");
      tui.complete("launcher");
    } else {
      await logger.warn(`launcher.exe not found: ${srcLauncherExe}`);
      tui.skip("launcher", "Not found");
    }

    tui.setActive("uninstaller");
    await logger.info("=== Copying uninstaller.exe ===");
    const srcUninstallerExe = join(assetsDir, "uninstaller.exe");
    const destUninstallerExe = join(installDir, "uninstaller.exe");
    if (await exists(srcUninstallerExe)) {
      await cp(srcUninstallerExe, destUninstallerExe);
      await logger.info("Copied uninstaller.exe to installation directory");
      tui.complete("uninstaller");
    } else {
      await logger.warn(`uninstaller.exe not found: ${srcUninstallerExe}`);
      tui.skip("uninstaller", "Not found");
    }

    tui.setActive("shortcuts");
    await logger.info("=== Creating desktop shortcuts ===");

    let shortcutCount = 0;
    const earscopeExe = join(installDir, "bin", "EARSCOPE_Viewer.exe");
    await createShortcut(earscopeExe, "EARSCOPE Viewer");
    shortcutCount += 1;

    const recordingsDir = join(installDir, "bin", "data", "recordings");
    await mkdir(recordingsDir, { recursive: true });
    await createFolderShortcut(recordingsDir, "EARSCOPE Recordings");
    shortcutCount += 1;

    const capturesDir = join(installDir, "bin", "data", "captures");
    await mkdir(capturesDir, { recursive: true });
    await createFolderShortcut(capturesDir, "EARSCOPE Captures");
    shortcutCount += 1;

    if (await exists(destLauncherExe)) {
      await createShortcut(destLauncherExe, "EARSCOPE Launcher");
      shortcutCount += 1;
    }

    const yncExe = "C:\\Program Files\\YNC_Neo\\YNC_Neo.exe";
    if (await exists(yncExe)) {
      await createShortcut(yncExe, "YNC Neo");
      shortcutCount += 1;
    }
    tui.complete("shortcuts", `${shortcutCount} shortcuts`);

    tui.setActive("startup");
    await logger.info("=== Registering ElectronViewer to startup ===");
    const electronExe = join(installDir, "ElectronViewer-win32-x64", "ElectronViewer.exe");
    if (await exists(electronExe)) {
      await registerStartup(electronExe, "ElectronViewer");
      tui.complete("startup");
    } else {
      await logger.warn(`ElectronViewer.exe not found: ${electronExe}`);
      tui.skip("startup", "ElectronViewer.exe not found");
    }

    await logger.info("=== Installation completed successfully ===");
    await logger.info(`Log file: ${logFile}`);

    const successMessage = `Press Enter to exit. Log file: ${logFile}`;
    if (tui.enabled) {
      tui.finish(true, successMessage);
      await waitForEnter(false);
    } else {
      console.log("\n===== Installation Complete =====");
      console.log(`Log file: ${logFile}`);
      await waitForEnter(true);
    }
  } catch (error) {
    const errorMessage = error instanceof Error
      ? `${error.message}\n${error.stack || ""}`
      : String(error);
    await logger.error(`Installation failed: ${errorMessage}`);

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
