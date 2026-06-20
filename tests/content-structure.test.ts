import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  contentSetGeneratedPath,
  getNextVersionFolder,
  isIgnoredContentPath,
  parseContentSetPath,
} from "../src/lib/prompt-builder/content-set-paths";
import { migrateProjectStructure } from "../server/content-structure";

const temporaryFolders: string[] = [];

afterEach(() => {
  for (const folder of temporaryFolders.splice(0)) fs.rmSync(folder, { recursive: true, force: true });
});

describe("content-set structure", () => {
  it("discovers nested document, visual and LinkedIn sources", () => {
    expect(parseContentSetPath("documents/pharmacy-pack/01-proposal.md")).toMatchObject({ type: "documents", contentSet: "pharmacy-pack" });
    expect(parseContentSetPath("visuals/executive-deck/01-opening.md")).toMatchObject({ type: "visuals", contentSet: "executive-deck" });
    expect(parseContentSetPath("linkedin/launch-campaign/01-post.md")).toMatchObject({ type: "linkedin", contentSet: "launch-campaign" });
  });

  it("ignores generated, legacy, dependency and hidden paths", () => {
    for (const candidate of [
      "visuals/deck/_generated/v001/01.png",
      "generated-content/visuals/01.png",
      "node_modules/package/readme.md",
      "visuals/.system/hidden.md",
    ]) expect(isIgnoredContentPath(candidate)).toBe(true);
    expect(parseContentSetPath("visuals/deck/_generated/v001/source.md")).toBeUndefined();
  });

  it("returns monotonically increasing vNNN folders", () => {
    expect(getNextVersionFolder([])).toBe("v001");
    expect(getNextVersionFolder(["v001"])).toBe("v002");
    expect(getNextVersionFolder(["v001", "v002", "notes"])).toBe("v003");
  });

  it("migrates flat sources and generated files without rewriting or nesting outputs", () => {
    const project = fs.mkdtempSync(path.join(os.tmpdir(), "prompt-builder-migration-"));
    temporaryFolders.push(project);
    fs.mkdirSync(path.join(project, "visuals"), { recursive: true });
    fs.mkdirSync(path.join(project, "documents"), { recursive: true });
    fs.mkdirSync(path.join(project, "linkedin"), { recursive: true });
    fs.mkdirSync(path.join(project, "generated-content", "visuals", "Version 1.0"), { recursive: true });
    const source = "## Visible Text\nKeep this exactly.\n";
    fs.writeFileSync(path.join(project, "visuals", "01-opening.md"), source);
    fs.writeFileSync(path.join(project, "documents", "01-proposal.md"), "Document source\n");
    fs.writeFileSync(path.join(project, "linkedin", "01-post.md"), "LinkedIn source\n");
    fs.writeFileSync(path.join(project, "generated-content", "visuals", "Version 1.0", "01-opening.png"), "image");

    migrateProjectStructure(project);

    expect(fs.readFileSync(path.join(project, "visuals", "default-visual-set", "01-opening.md"), "utf8")).toBe(source);
    const output = path.join(project, contentSetGeneratedPath("visuals", "default-visual-set", "v001"), "01-opening.png");
    expect(fs.existsSync(output)).toBe(true);
    expect(path.relative(path.dirname(output), output).split(path.sep)).toHaveLength(1);
    expect(fs.existsSync(path.join(project, "generated-content"))).toBe(false);
  });
});
