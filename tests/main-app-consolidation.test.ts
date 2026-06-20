import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function sourceFiles(directory: string): string[] {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = path.join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(absolutePath) : [absolutePath];
  });
}

describe("single-process local app", () => {
  it("starts one strict-port Vite process", () => {
    const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
    expect(packageJson.scripts.dev).toBe("vite --host 0.0.0.0 --port 5177 --strictPort");
  });

  it("keeps legacy service connection concepts out of the active application", () => {
    const files = [
      path.join(root, "package.json"),
      path.join(root, "README.md"),
      path.join(root, "vite.config.ts"),
      ...sourceFiles(path.join(root, "src")),
      ...sourceFiles(path.join(root, "server")),
    ];
    const forbidden = [
      "comp" + "anion",
      "43" + "17",
      "VITE_LOCAL_" + "COMPANION_URL",
      "pairing" + " token",
    ];

    for (const filename of files) {
      const source = fs.readFileSync(filename, "utf8").toLowerCase();
      for (const phrase of forbidden) expect(source, `${filename} contains ${phrase}`).not.toContain(phrase.toLowerCase());
    }
  });

  it("exposes storage settings through same-origin main-app routes", () => {
    const source = fs.readFileSync(path.join(root, "vite.config.ts"), "utf8");
    expect(source).toContain('"/api/storage/status"');
    expect(source).toContain('"/api/storage/settings"');
  });
});
