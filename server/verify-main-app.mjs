import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const root = path.resolve(new URL("..", import.meta.url).pathname.replace(/^\/(.:)/, "$1"));
const temporaryContentRoot = fs.mkdtempSync(path.join(os.tmpdir(), "prompt-builder-content-"));
const settingsPath = path.join(root, ".local", "app-settings.json");
const savedSettings = fs.existsSync(settingsPath) ? fs.readFileSync(settingsPath) : null;
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const app = spawn(
  process.platform === "win32" ? process.env.ComSpec || "cmd.exe" : npmCommand,
  process.platform === "win32" ? ["/d", "/s", "/c", "npm run dev"] : ["run", "dev"],
  {
  cwd: root,
  env: { ...process.env, PROMPT_BUILDER_CONTENT_ROOT: temporaryContentRoot },
  stdio: "ignore",
  }
);

async function request(route, init = {}) {
  const response = await fetch(`http://127.0.0.1:5177${route}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init.headers },
  });
  const payload = await response.json();
  return { response, payload };
}

async function waitForServer() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const result = await request("/api/storage/status");
      if (result.response.ok) return;
    } catch {
      // The local app is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error("The local main app did not start on port 5177.");
}

try {
  await waitForServer();
  const settings = await request("/api/storage/settings", {
    method: "PUT",
    body: JSON.stringify({ contentRoot: temporaryContentRoot, initialize: true }),
  });
  if (!settings.response.ok || !settings.payload.writable) throw new Error(settings.payload.error || "Storage is not writable.");

  const input = {
    brandId: "supplysync360",
    brandName: "SupplySync360",
    projectName: "API Verification",
    projectSlug: "api-verification",
    workflow: "mixed",
    audience: "Executive reviewers",
    purpose: "Verify atomic project creation.",
    tone: "Professional and concise.",
    headerText: "SupplySync360 | API Verification",
    footerText: "SupplySync360 | Confidential",
    logoAsset: "content/brands/supplysync360/assets/supplysync360-logo-white.png",
    enabledOptionalFiles: [],
  };

  const created = await request("/api/projects", { method: "POST", body: JSON.stringify(input) });
  if (created.response.status !== 201) throw new Error(created.payload.error || "Project was not created.");

  const projectRoot = path.join(temporaryContentRoot, "projects", "supplysync360", "api-verification");
  const required = [
    "project.md",
    "visual-rules.md",
    "document-rules.md",
    "documents/default-document-pack/pack.md",
    "visuals/default-visual-set/set.md",
    "linkedin/default-campaign/campaign.md",
  ];
  for (const filename of required) {
    if (!fs.existsSync(path.join(projectRoot, filename))) throw new Error(`Missing ${filename}`);
  }

  const generatedFolders = [
    "documents/default-document-pack/_generated",
    "visuals/default-visual-set/_generated",
    "linkedin/default-campaign/_generated",
  ];
  for (const folder of generatedFolders) {
    if (!fs.existsSync(path.join(projectRoot, folder))) throw new Error(`Missing ${folder}`);
  }
  if (fs.existsSync(path.join(projectRoot, "generated-content"))) throw new Error("Legacy generated-content folder was created.");

  console.log("Main app storage and project API verification passed.");
} finally {
  app.kill();
  if (savedSettings) {
    fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
    fs.writeFileSync(settingsPath, savedSettings);
  } else {
    fs.rmSync(settingsPath, { force: true });
  }
  fs.rmSync(temporaryContentRoot, { recursive: true, force: true });
}
