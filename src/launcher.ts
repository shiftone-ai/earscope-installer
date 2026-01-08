import { exists } from "node:fs/promises";
import { dirname, join } from "node:path";
import { isWindows } from "./lib/platform.js";

const INSTALL_DIR = "C:\\hes";
const YNC_EXE_PATH = "C:\\Program Files\\YNC_Neo\\YNC_Neo.exe";

async function main(): Promise<void> {
  if (!isWindows()) {
    console.error("This launcher is only supported on Windows.");
    process.exit(1);
  }

  const earscopeExe = join(INSTALL_DIR, "bin", "EARSCOPE_Viewer.exe");
  const electronExe = join(INSTALL_DIR, "ElectronViewer-win32-x64", "ElectronViewer.exe");

  const processes: Array<Promise<void>> = [];

  if (await exists(earscopeExe)) {
    console.log(`Launching EARSCOPE Viewer: ${earscopeExe}`);
    const proc = Bun.spawn([earscopeExe], {
      cwd: join(INSTALL_DIR, "bin"),
      stdout: "ignore",
      stderr: "ignore",
    });
    processes.push(proc.exited.then(() => {}));
  } else {
    console.error(`EARSCOPE Viewer not found: ${earscopeExe}`);
  }

  if (await exists(electronExe)) {
    console.log(`Launching ElectronViewer: ${electronExe}`);
    const proc = Bun.spawn([electronExe], {
      cwd: join(INSTALL_DIR, "ElectronViewer-win32-x64"),
      stdout: "ignore",
      stderr: "ignore",
    });
    processes.push(proc.exited.then(() => {}));
  } else {
    console.error(`ElectronViewer not found: ${electronExe}`);
  }

  if (await exists(YNC_EXE_PATH)) {
    console.log(`Launching YNC Neo: ${YNC_EXE_PATH}`);
    const proc = Bun.spawn([YNC_EXE_PATH], {
      cwd: dirname(YNC_EXE_PATH),
      stdout: "ignore",
      stderr: "ignore",
    });
    processes.push(proc.exited.then(() => {}));
  } else {
    console.log("YNC Neo not found, skipping...");
  }

  if (processes.length === 0) {
    console.error("No applications found to launch.");
    process.exit(1);
  }

  console.log("Applications launched successfully.");
}

main();
