/**
 * Version constants embedded at build time via --define flags.
 * @see build.ts for how these values are injected.
 */

// Declare build-time constants (replaced via --define)
declare const __BUILD_VERSION__: string | undefined;
declare const __BUILD_DATE__: string | undefined;

// Fallback values for development/test environments
const DEV_VERSION = "0.0.0-dev";
const DEV_BUILD_DATE = new Date().toISOString();

export const VERSION: string =
  typeof __BUILD_VERSION__ !== "undefined" ? __BUILD_VERSION__ : DEV_VERSION;

export const BUILD_DATE: string =
  typeof __BUILD_DATE__ !== "undefined" ? __BUILD_DATE__ : DEV_BUILD_DATE;
