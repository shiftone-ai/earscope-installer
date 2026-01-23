export type TuiStepStatus = "pending" | "active" | "done" | "skipped" | "failed";

export interface TuiStep {
  id: string;
  label: string;
}

export interface TuiOptions {
  title?: string;
  enabled?: boolean;
  spinnerIntervalMs?: number;
}

type StepState = TuiStep & { status: TuiStepStatus; detail?: string };

const SPINNER_FRAMES = ["-", "\\", "|", "/"];

export class Tui {
  public readonly enabled: boolean;

  private title: string;
  private steps: StepState[];
  private useAnsi: boolean;
  private statusLine: string | null = null;
  private startTime: number | null = null;
  private spinnerIndex = 0;
  private spinnerTimer: ReturnType<typeof setInterval> | null = null;
  private cursorHidden = false;
  private finished = false;
  private activeStepId: string | null = null;
  private lastRendered = "";
  private spinnerIntervalMs: number;

  constructor(steps: TuiStep[], options: TuiOptions = {}) {
    const noTui = process.env.NO_TUI === "1" || process.env.NO_TUI === "true";
    const term = (process.env.TERM || "").toLowerCase();
    const enabled = options.enabled ?? (process.stdout.isTTY === true && !noTui && term !== "dumb");

    this.enabled = enabled;
    this.useAnsi = enabled;
    this.title = options.title ?? "Installer";
    this.steps = steps.map((step) => ({ ...step, status: "pending" }));
    this.spinnerIntervalMs = options.spinnerIntervalMs ?? 120;

    if (this.enabled) {
      process.on("exit", () => {
        this.showCursor();
      });
    }
  }

  start(): void {
    if (!this.enabled) {
      return;
    }

    this.startTime = Date.now();
    this.hideCursor();
    this.startSpinner();
    this.render(true);
  }

  setActive(id: string, detail?: string): void {
    if (!this.enabled) {
      return;
    }

    for (const step of this.steps) {
      if (step.status === "active" && step.id !== id) {
        step.status = "pending";
      }
    }

    this.activeStepId = id;
    this.updateStep(id, "active", detail);
    this.render();
  }

  complete(id: string, detail?: string): void {
    this.updateStep(id, "done", detail);
    if (this.activeStepId === id) {
      this.activeStepId = null;
    }
    this.render();
  }

  skip(id: string, detail?: string): void {
    this.updateStep(id, "skipped", detail);
    if (this.activeStepId === id) {
      this.activeStepId = null;
    }
    this.render();
  }

  fail(id: string, detail?: string): void {
    this.updateStep(id, "failed", detail);
    if (this.activeStepId === id) {
      this.activeStepId = null;
    }
    this.render();
  }

  failActive(detail?: string): void {
    if (this.activeStepId) {
      this.fail(this.activeStepId, detail);
    }
  }

  note(message: string): void {
    this.statusLine = message;
    this.render();
  }

  finish(success: boolean, message?: string): void {
    if (!this.enabled) {
      return;
    }

    this.finished = true;
    this.stopSpinner();

    const status = success ? "Completed" : "Failed";
    const line = message ? `${status}: ${message}` : `Status: ${status}`;
    this.statusLine = line;

    this.render(true);
    this.showCursor();
  }

  private updateStep(id: string, status: TuiStepStatus, detail?: string): void {
    const step = this.steps.find((item) => item.id === id);
    if (!step) {
      return;
    }

    step.status = status;
    if (detail) {
      step.detail = detail;
    }
  }

  private startSpinner(): void {
    if (!this.enabled || this.spinnerTimer) {
      return;
    }

    this.spinnerTimer = setInterval(() => {
      if (this.finished || !this.activeStepId) {
        return;
      }

      this.spinnerIndex = (this.spinnerIndex + 1) % SPINNER_FRAMES.length;
      this.render();
    }, this.spinnerIntervalMs);
  }

  private stopSpinner(): void {
    if (this.spinnerTimer) {
      clearInterval(this.spinnerTimer);
      this.spinnerTimer = null;
    }
  }

  private render(force = false): void {
    if (!this.enabled) {
      return;
    }

    const lines: string[] = [];
    lines.push(this.title);
    lines.push(this.formatProgressLine());
    lines.push("");

    this.steps.forEach((step, index) => {
      lines.push(this.formatStepLine(step, index));
    });

    if (this.statusLine) {
      lines.push("");
      lines.push(this.statusLine);
    }

    const output = lines.join("\n");
    if (!force && output === this.lastRendered) {
      return;
    }
    this.lastRendered = output;

    if (this.useAnsi) {
      // Move cursor to home position without clearing screen to avoid flickering
      process.stdout.write("\x1b[H");
    }
    // Write output and clear from cursor to end of screen (removes stale content)
    process.stdout.write(`${output}\n\x1b[J`);
  }

  private formatProgressLine(): string {
    const total = this.steps.length;
    const completed = this.steps.filter((step) => step.status === "done" || step.status === "skipped").length;
    const ratio = total === 0 ? 0 : completed / total;
    const barWidth = 24;
    const filled = Math.min(barWidth, Math.floor(barWidth * ratio));
    const bar = `${"=".repeat(filled)}${"-".repeat(barWidth - filled)}`;
    const percent = Math.floor(ratio * 100);
    const elapsed = this.formatDuration(Date.now() - (this.startTime ?? Date.now()));

    return `Progress: [${bar}] ${percent}% (${completed}/${total}) Elapsed: ${elapsed}`;
  }

  private formatStepLine(step: StepState, index: number): string {
    const icon = this.formatStatusIcon(step.status);
    const label = `${String(index + 1).padStart(2, "0")}. ${icon} ${step.label}`;
    return step.detail ? `${label} - ${step.detail}` : label;
  }

  private formatStatusIcon(status: TuiStepStatus): string {
    const spinner = SPINNER_FRAMES[this.spinnerIndex] || "-";
    switch (status) {
      case "done":
        return this.color("[OK]", "\x1b[32m");
      case "active":
        return this.color(`[${spinner}]`, "\x1b[36m");
      case "skipped":
        return this.color("[SKIP]", "\x1b[33m");
      case "failed":
        return this.color("[FAIL]", "\x1b[31m");
      default:
        return this.color("[..]", "\x1b[90m");
    }
  }

  private color(text: string, colorCode: string): string {
    if (!this.useAnsi) {
      return text;
    }
    return `${colorCode}${text}\x1b[0m`;
  }

  private formatDuration(ms: number): string {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) {
      return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    }
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  private hideCursor(): void {
    if (this.useAnsi && !this.cursorHidden) {
      process.stdout.write("\x1b[?25l");
      this.cursorHidden = true;
    }
  }

  private showCursor(): void {
    if (this.useAnsi && this.cursorHidden) {
      process.stdout.write("\x1b[?25h");
      this.cursorHidden = false;
    }
  }
}
