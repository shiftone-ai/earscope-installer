import { appendFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { LOG_LEVELS } from "../types/index.js";

let logFilePath: string | null = null;

export async function initLogger(logPath: string): Promise<void> {
  logFilePath = logPath;
  await mkdir(dirname(logPath), { recursive: true });
  const timestamp = new Date().toLocaleString();
  await appendFile(logPath, `===== EARSCOPE Installation Started at ${timestamp} =====\n`);
}

async function writeLog(level: string, message: string): Promise<void> {
  const timestamp = new Date().toISOString();
  const logLine = `[${timestamp}] [${level}] ${message}\n`;

  console.log(`[${level}] ${message}`);

  if (logFilePath) {
    await appendFile(logFilePath, logLine);
  }
}

export async function info(message: string): Promise<void> {
  await writeLog(LOG_LEVELS.INFO, message);
}

export async function warn(message: string): Promise<void> {
  await writeLog(LOG_LEVELS.WARN, message);
}

export async function error(message: string): Promise<void> {
  await writeLog(LOG_LEVELS.ERROR, message);
}

export const logger = { initLogger, info, warn, error };
