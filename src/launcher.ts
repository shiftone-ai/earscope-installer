import { exists } from "node:fs/promises";
import { dirname, join } from "node:path";
import { isWindows } from "./lib/platform.js";
import { VERSION } from "./lib/version.js";
import { checkForUpdate, formatUpdateNotification } from "./lib/update.js";

const INSTALL_DIR = "C:\\hes";
const YNC_EXE_PATH = "C:\\Program Files\\YNC_Neo\\YNC_Neo.exe";

async function main(): Promise<void> {
  console.log(`EARSCOPE Launcher v${VERSION}`);

  // Non-blocking update check
  checkForUpdate()
    .then((result) => {
      if (result.updateAvailable) {
        console.log(formatUpdateNotification(result));
      }
    })
    .catch(() => {
      // Silently continue on update check failure
    });

  if (!isWindows()) {
    console.error("This launcher is only supported on Windows.");
    process.exit(1);
  }

  const earscopeExe = join(INSTALL_DIR, "bin", "EARSCOPE_Viewer.exe");
  const electronExe = join(INSTALL_DIR, "ElectronViewer-win32-x64", "ElectronViewer.exe");

  let launched = 0;

  if (await exists(earscopeExe)) {
    console.log(`Launching EARSCOPE Viewer: ${earscopeExe}`);
    const proc = Bun.spawn([earscopeExe], {
      cwd: join(INSTALL_DIR, "bin"),
      detached: true,
      stdin: "ignore",
      stdout: "ignore",
      stderr: "ignore",
    });
    proc.unref();
    launched += 1;
  } else {
    console.error(`EARSCOPE Viewer not found: ${earscopeExe}`);
  }

  if (await exists(electronExe)) {
    console.log(`Launching ElectronViewer: ${electronExe}`);
    const proc = Bun.spawn([electronExe], {
      cwd: join(INSTALL_DIR, "ElectronViewer-win32-x64"),
      detached: true,
      stdin: "ignore",
      stdout: "ignore",
      stderr: "ignore",
    });
    proc.unref();
    launched += 1;
  } else {
    console.error(`ElectronViewer not found: ${electronExe}`);
  }

  if (await exists(YNC_EXE_PATH)) {
    console.log(`Launching YNC Neo: ${YNC_EXE_PATH}`);
    const proc = Bun.spawn([YNC_EXE_PATH], {
      cwd: dirname(YNC_EXE_PATH),
      detached: true,
      stdin: "ignore",
      stdout: "ignore",
      stderr: "ignore",
    });
    proc.unref();
    launched += 1;
  } else {
    console.log("YNC Neo not found, skipping...");
  }

  if (launched === 0) {
    console.error("No applications found to launch.");
    process.exit(1);
  }

  console.log("Applications launched successfully.");
}

main();
