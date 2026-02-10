import { exists, mkdir, cp, rm } from "node:fs/promises";
import { join } from "node:path";
import { rcedit } from "rcedit";
import pkg from "./package.json" with { type: "json" };

const DIST_DIR = "./dist";
const SRC_DIR = ".";

// Version embedding for OTA update check
const VERSION = pkg.version;
const BUILD_DATE = new Date().toISOString();

async function build(): Promise<void> {
  console.log("Building EARSCOPE Installer...\n");

  await rm(DIST_DIR, { recursive: true, force: true });
  await mkdir(DIST_DIR, { recursive: true });

  const ICON_PATH = "./EARSCOPE_Launcher_Icon.ico";

  console.log("Compiling installer.exe...");
  const installerProc = Bun.spawn([
    "bun", "build", "./src/installer.ts",
    "--compile", "--target=bun-windows-x64",
    `--define:__BUILD_VERSION__="${VERSION}"`,
    `--define:__BUILD_DATE__="${BUILD_DATE}"`,
    "--outfile", join(DIST_DIR, "installer.exe")
  ], { stdout: "inherit", stderr: "inherit" });
  await installerProc.exited;

  console.log("Compiling launcher.exe...");
  const launcherProc = Bun.spawn([
    "bun", "build", "./src/launcher.ts",
    "--compile", "--target=bun-windows-x64",
    `--define:__BUILD_VERSION__="${VERSION}"`,
    `--define:__BUILD_DATE__="${BUILD_DATE}"`,
    "--outfile", join(DIST_DIR, "launcher.exe")
  ], { stdout: "inherit", stderr: "inherit" });
  await launcherProc.exited;

  console.log("Compiling uninstaller.exe...");
  const uninstallerProc = Bun.spawn([
    "bun", "build", "./src/uninstaller.ts",
    "--compile", "--target=bun-windows-x64",
    `--define:__BUILD_VERSION__="${VERSION}"`,
    `--define:__BUILD_DATE__="${BUILD_DATE}"`,
    "--outfile", join(DIST_DIR, "uninstaller.exe")
  ], { stdout: "inherit", stderr: "inherit" });
  await uninstallerProc.exited;

  console.log("\nSetting exe icons with rcedit...");
  const exeFiles = ["installer.exe", "launcher.exe", "uninstaller.exe"];
  try {
    for (const exe of exeFiles) {
      const exePath = join(DIST_DIR, exe);
      await rcedit(exePath, { icon: ICON_PATH });
      console.log(`  Set icon for ${exe}`);
    }
  } catch (err) {
    console.log("  Skipped: rcedit requires Wine on non-Windows platforms");
    console.log("  Icons will be set when building on Windows");
  }

  console.log("\nCopying assets...");

  const win32x64Dir = join(SRC_DIR, "win32-x64");
  if (await exists(win32x64Dir)) {
    await mkdir(join(DIST_DIR, "win32-x64"), { recursive: true });

    const binZip = join(win32x64Dir, "bin.zip");
    if (await exists(binZip)) {
      await cp(binZip, join(DIST_DIR, "win32-x64", "bin.zip"));
      console.log("  Copied bin.zip");
    }

    const electronZip = join(win32x64Dir, "ElectronViewer-win32-x64.zip");
    if (await exists(electronZip)) {
      await cp(electronZip, join(DIST_DIR, "win32-x64", "ElectronViewer-win32-x64.zip"));
      console.log("  Copied ElectronViewer-win32-x64.zip");
    }
  }

  const yncDir = join(SRC_DIR, "ync");
  if (await exists(yncDir)) {
    await cp(yncDir, join(DIST_DIR, "ync"), { recursive: true });
    console.log("  Copied ync/ (YNCneo installer)");
  } else {
    console.log("  ync/ not found, building without YNCneo");
  }

  const readmePath = join(SRC_DIR, "README.md");
  if (await exists(readmePath)) {
    await cp(readmePath, join(DIST_DIR, "README.md"));
    console.log("  Copied README.md");
  }

  console.log("\n===== Build completed =====");
  console.log(`Output directory: ${DIST_DIR}`);
  console.log("\nContents:");
  console.log("  - installer.exe");
  console.log("  - launcher.exe");
  console.log("  - uninstaller.exe");
  console.log("  - win32-x64/bin.zip");
  console.log("  - win32-x64/ElectronViewer-win32-x64.zip");
  if (await exists(join(DIST_DIR, "ync"))) {
    console.log("  - ync/ (YNCneo)");
  }
  if (await exists(join(DIST_DIR, "README.md"))) {
    console.log("  - README.md");
  }

  console.log("\nTo create distribution zip:");
  console.log("  cd dist && zip -r ../earscope-installer.zip .");
}

build().catch((err) => {
  console.error("Build failed:", err);
  process.exit(1);
});
