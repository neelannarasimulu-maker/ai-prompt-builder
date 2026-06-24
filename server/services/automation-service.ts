import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export function readJsonFile<T>(filename: string): Partial<T> {
  if (!fs.existsSync(filename)) return {};
  try {
    return JSON.parse(fs.readFileSync(filename, "utf8")) as Partial<T>;
  } catch {
    return {};
  }
}

export function resolveUserPath(input: string, projectRoot: string): string {
  if (input === "~") return os.homedir();
  if (input.startsWith("~/") || input.startsWith("~\\")) return path.join(os.homedir(), input.slice(2));
  return path.resolve(projectRoot, input);
}

export function nowIso(): string {
  return new Date().toISOString();
}
