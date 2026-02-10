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


/**
 * Manifest format for update information.
 * Expected to be embedded as JSON block in GitHub Release body.
 */
export interface UpdateManifest {
  version: string;
  releaseDate: string;
  releaseNotes: string;
  downloadUrl: string;
  minimumVersion?: string;
  checksum?: string;
}

/**
 * Result of an update check operation.
 */
export interface UpdateCheckResult {
  updateAvailable: boolean;
  currentVersion: string;
  latestVersion: string;
  manifest: UpdateManifest | null;
  error?: string;
}
