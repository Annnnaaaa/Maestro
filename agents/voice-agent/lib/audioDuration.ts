import { execFileSync } from "child_process";
import fs from "fs";

export function getMp3DurationMs(path: string): number {
  try {
    const out = execFileSync(
      "ffprobe",
      [
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "default=noprint_wrappers=1:nokey=1",
        path,
      ],
      { encoding: "utf-8" },
    ).trim();
    const sec = parseFloat(out);
    if (!Number.isFinite(sec)) throw new Error("bad duration");
    return Math.round(sec * 1000);
  } catch {
    const stat = fs.statSync(path);
    const estMs = Math.max(2000, Math.round((stat.size / 16000) * 1000));
    return estMs;
  }
}
