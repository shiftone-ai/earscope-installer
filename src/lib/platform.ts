export function isWindows(): boolean {
  return process.platform === "win32";
}

export function isMac(): boolean {
  return process.platform === "darwin";
}

export function getHomeDir(): string {
  return process.env.HOME || process.env.USERPROFILE || "";
}

export function getDesktopDir(): string {
  if (isWindows()) {
    return `${getHomeDir()}\\Desktop`;
  }
  return `${getHomeDir()}/Desktop`;
}

export function getStartupDir(): string {
  if (isWindows()) {
    return `${process.env.APPDATA}\\Microsoft\\Windows\\Start Menu\\Programs\\Startup`;
  }
  throw new Error("Startup directory is only available on Windows");
}
