import { exists, mkdir, cp } from "node:fs/promises";
import { dirname, join } from "node:path";
import { logger } from "./lib/logger.js";
import { ensureAdmin } from "./lib/admin.js";
import { setupWinget } from "./lib/winget.js";
import { installChrome } from "./lib/chrome.js";
import { unzip } from "./lib/archive.js";
import { hasYncAssets, installYnc } from "./lib/ync.js";
import { createShortcut, createFolderShortcut } from "./lib/shortcut.js";
import { registerStartup } from "./lib/startup.js";
import { isWindows } from "./lib/platform.js";

const INSTALL_DIR = "C:\\hes";
const LOG_FILE = `${INSTALL_DIR}\\install.log`;

async function getAssetsDir(): Promise<string> {
  return dirname(process.execPath);
}

async function waitForEnter(): Promise<void> {
  console.log("\nPress Enter to exit...");
  await new Promise<void>((resolve) => {
    process.stdin.once("data", () => resolve());
  });
}

async function main(): Promise<void> {
  try {
    if (!isWindows()) {
      console.error("This installer is only supported on Windows.");
      process.exit(1);
    }

    await mkdir(INSTALL_DIR, { recursive: true });
    await logger.initLogger(LOG_FILE);
    await logger.info("EARSCOPE Installer started");

    await ensureAdmin(process.execPath);

    await logger.info("=== Installing winget ===");
    await setupWinget();

    await logger.info("=== Installing Google Chrome ===");
    await installChrome();

    const assetsDir = await getAssetsDir();

    if (await hasYncAssets(assetsDir)) {
      await logger.info("=== Installing YNCneo ===");
      await installYnc(assetsDir);
    } else {
      await logger.info("YNCneo assets not found, skipping YNCneo installation");
    }

    await logger.info("=== Extracting assets ===");

    const binZipPath = join(assetsDir, "win32-x64", "bin.zip");
    const electronZipPath = join(assetsDir, "win32-x64", "ElectronViewer-win32-x64.zip");

    // Note: Both zips contain their folder inside (bin/, ElectronViewer-win32-x64/)
    // so we extract directly to INSTALL_DIR
    if (await exists(binZipPath)) {
      await unzip(binZipPath, INSTALL_DIR);
      const expectedExe = join(INSTALL_DIR, "bin", "EARSCOPE_Viewer.exe");
      if (!(await exists(expectedExe))) {
        throw new Error(`EARSCOPE_Viewer.exe not found after extraction: ${expectedExe}`);
      }
    } else {
      await logger.warn(`bin.zip not found: ${binZipPath}`);
    }

    if (await exists(electronZipPath)) {
      await unzip(electronZipPath, INSTALL_DIR);
      const expectedExe = join(INSTALL_DIR, "ElectronViewer-win32-x64", "ElectronViewer.exe");
      if (!(await exists(expectedExe))) {
        throw new Error(`ElectronViewer.exe not found after extraction: ${expectedExe}`);
      }
    } else {
      await logger.warn(`ElectronViewer zip not found: ${electronZipPath}`);
    }

    await logger.info("=== Copying launcher.exe ===");
    const srcLauncherExe = join(assetsDir, "launcher.exe");
    const destLauncherExe = join(INSTALL_DIR, "launcher.exe");
    if (await exists(srcLauncherExe)) {
      await cp(srcLauncherExe, destLauncherExe);
      await logger.info("Copied launcher.exe to installation directory");
    } else {
      await logger.warn(`launcher.exe not found: ${srcLauncherExe}`);
    }

    await logger.info("=== Creating desktop shortcuts ===");

    const earscopeExe = join(INSTALL_DIR, "bin", "EARSCOPE_Viewer.exe");
    await createShortcut(earscopeExe, "EARSCOPE Viewer");

    const recordingsDir = join(INSTALL_DIR, "bin", "data", "recordings");
    await mkdir(recordingsDir, { recursive: true });
    await createFolderShortcut(recordingsDir, "EARSCOPE Recordings");

    if (await exists(destLauncherExe)) {
      await createShortcut(destLauncherExe, "EARSCOPE Launcher");
    }

    const yncExe = "C:\\Program Files\\YNC_Neo\\YNC_Neo.exe";
    if (await exists(yncExe)) {
      await createShortcut(yncExe, "YNC Neo");
    }

    await logger.info("=== Registering ElectronViewer to startup ===");
    const electronExe = join(INSTALL_DIR, "ElectronViewer-win32-x64", "ElectronViewer.exe");
    if (await exists(electronExe)) {
      await registerStartup(electronExe, "ElectronViewer");
    } else {
      await logger.warn(`ElectronViewer.exe not found: ${electronExe}`);
    }

    await logger.info("=== Installation completed successfully ===");
    await logger.info(`Log file: ${LOG_FILE}`);

    console.log("\n===== Installation Complete =====");
    console.log(`Log file: ${LOG_FILE}`);
    await waitForEnter();
  } catch (error) {
    const errorMessage = error instanceof Error
      ? `${error.message}\n${error.stack || ""}`
      : String(error);
    await logger.error(`Installation failed: ${errorMessage}`);
    console.error(`\nError: ${errorMessage}`);
    await waitForEnter();
    process.exit(1);
  }
}

main();
