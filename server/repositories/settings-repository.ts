import fs from "node:fs";
import path from "node:path";

export type AppSettings = { contentRoot: string };

export function readSettings(settingsPath: string): Partial<AppSettings> {
  try {
    return fs.existsSync(settingsPath)
      ? JSON.parse(fs.readFileSync(settingsPath, "utf8")) as Partial<AppSettings>
      : {};
  } catch {
    return {};
  }
}

export function findLegacySettings(appSettingsPath: string): { settings: Partial<AppSettings>; path?: string } {
  const settingsDirectory = path.dirname(appSettingsPath);
  if (!fs.existsSync(settingsDirectory)) return { settings: {} };
  for (const entry of fs.readdirSync(settingsDirectory)) {
    const candidatePath = path.join(settingsDirectory, entry);
    if (candidatePath === appSettingsPath || path.extname(candidatePath).toLowerCase() !== ".json") continue;
    try {
      const candidate = JSON.parse(fs.readFileSync(candidatePath, "utf8")) as Record<string, unknown>;
      if (typeof candidate.contentRoot === "string" && typeof candidate.token === "string") {
        return { settings: { contentRoot: candidate.contentRoot }, path: candidatePath };
      }
    } catch {
      // Ignore unrelated or invalid local JSON files.
    }
  }
  return { settings: {} };
}

export function writeSettings(settingsPath: string, settings: AppSettings): void {
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), "utf8");
}
