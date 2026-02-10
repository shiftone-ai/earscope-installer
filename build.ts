import { exists, mkdir, cp, rm } from "node:fs/promises";
import { join } from "node:path";
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

  const targets = [
    { name: "installer", entry: "./src/installer.ts" },
    { name: "launcher", entry: "./src/launcher.ts" },
    { name: "uninstaller", entry: "./src/uninstaller.ts" },
  ];

  for (const { name, entry } of targets) {
    console.log(`Compiling ${name}.exe...`);
    const proc = Bun.spawn([
      "bun", "build", entry,
      "--compile", "--target=bun-windows-x64",
      `--define:__BUILD_VERSION__="${VERSION}"`,
      `--define:__BUILD_DATE__="${BUILD_DATE}"`,
      `--windows-icon=${ICON_PATH}`,
      "--outfile", join(DIST_DIR, `${name}.exe`),
    ], { stdout: "inherit", stderr: "inherit" });
    await proc.exited;
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
