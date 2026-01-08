export interface InstallConfig {
  installDir: string;
  logFile: string;
  assetsDir: string;
}

export interface ShortcutConfig {
  target: string;
  name: string;
  workingDir?: string;
}

export interface LogLevel {
  INFO: "INFO";
  WARN: "WARN";
  ERROR: "ERROR";
}

export const LOG_LEVELS: LogLevel = {
  INFO: "INFO",
  WARN: "WARN",
  ERROR: "ERROR",
};
