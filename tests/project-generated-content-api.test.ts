import { beforeEach, describe, expect, it, vi } from "vitest";

const mainAppFetch = vi.fn();
const mainAppAssetUrl = vi.fn((path: string) => path);
const listBrowserGeneratedContent = vi.fn();
const getBrowserGeneratedContentFolder = vi.fn();

vi.mock("../src/lib/prompt-builder/main-app-api", () => ({
  mainAppFetch,
  mainAppAssetUrl,
}));

vi.mock("../src/lib/prompt-builder/browser-workspace", () => ({
  saveBrowserContentSourceFile: vi.fn(),
  listBrowserGeneratedContent,
  getBrowserGeneratedContentFolder,
}));

describe("project generated content api", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("falls back to browser-generated content when hosted routes return html", async () => {
    mainAppFetch.mockResolvedValue(new Response("<!doctype html><title>The page could not be found</title>", {
      status: 200,
      headers: { "Content-Type": "text/html" },
    }));
    listBrowserGeneratedContent.mockResolvedValue({
      generatedContentRoot: "Browser connected: content/projects/demo",
      files: [{
        id: "content/projects/demo/visuals/default-visual-set/_generated/v001/01-demo.png",
        routePath: "content/projects/demo/visuals/default-visual-set/_generated/v001/01-demo.png",
        projectRelativePath: "visuals/default-visual-set/_generated/v001/01-demo.png",
        filename: "01-demo.png",
        displayName: "01 demo",
        relativePath: "content/projects/demo/visuals/default-visual-set/_generated/v001/01-demo.png",
        generatedRelativePath: "visuals/default-visual-set/_generated/v001/01-demo.png",
        category: "visuals",
        contentSet: "default-visual-set",
        versionLabel: "v001",
        fileUrl: "blob:demo",
        fileType: "image",
        sizeBytes: 1234,
        modifiedAt: "2026-06-29T10:00:00.000Z",
      }],
    });

    const { listProjectGeneratedContent } = await import("../src/lib/prompt-builder/project-generated-content-api");
    const result = await listProjectGeneratedContent({
      projectFolder: "content/projects/demo",
      category: "visuals",
      contentSet: "default-visual-set",
    });

    expect(listBrowserGeneratedContent).toHaveBeenCalledWith({
      projectFolder: "content/projects/demo",
      category: "visuals",
      contentSet: "default-visual-set",
    });
    expect(result.files[0]?.fileUrl).toBe("blob:demo");
  });

  it("falls back to browser target-folder resolution when hosted routes return html", async () => {
    mainAppFetch.mockResolvedValue(new Response("<!doctype html>", {
      status: 200,
      headers: { "Content-Type": "text/html" },
    }));
    getBrowserGeneratedContentFolder.mockResolvedValue({
      folder: "Browser connected: content/projects/demo/visuals/default-visual-set/_generated",
      generatedContentRoot: "Browser connected: content/projects/demo/visuals/default-visual-set/_generated",
    });

    const { getProjectGeneratedContentFolder } = await import("../src/lib/prompt-builder/project-generated-content-api");
    const result = await getProjectGeneratedContentFolder({
      projectFolder: "content/projects/demo",
      category: "visuals",
      contentSet: "default-visual-set",
    });

    expect(getBrowserGeneratedContentFolder).toHaveBeenCalledWith({
      projectFolder: "content/projects/demo",
      category: "visuals",
      contentSet: "default-visual-set",
    });
    expect(result.folder).toContain("_generated");
  });
});
