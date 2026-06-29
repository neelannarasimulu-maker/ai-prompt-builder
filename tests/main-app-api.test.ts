import { beforeEach, describe, expect, it, vi } from "vitest";

const connectBrowserWorkspace = vi.fn();
const browserWorkspaceAvailable = vi.fn();
const listBrowserRuntimeProjects = vi.fn();

vi.mock("../src/lib/prompt-builder/browser-workspace", () => ({
  browserWorkspaceAvailable,
  connectBrowserWorkspace,
  createBrowserProject: vi.fn(),
  getBrowserWorkspaceStatus: vi.fn(),
  listBrowserRuntimeProjects,
  loadBrowserRuntimeProject: vi.fn(),
  previewBrowserProjectScaffold: vi.fn(),
}));

describe("main-app storage routing", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    browserWorkspaceAvailable.mockReturnValue(false);
    connectBrowserWorkspace.mockResolvedValue({
      ok: true,
      localApiAvailable: false,
      contentRoot: "Browser connected: content",
      writable: true,
      version: "browser-fs-1",
      browserFsAvailable: true,
      workspaceKind: "browser",
    });
    listBrowserRuntimeProjects.mockResolvedValue({ ok: true, projects: [] });
    globalThis.fetch = vi.fn();
  });

  it("uses the browser folder picker for hosted-style storage values", async () => {
    browserWorkspaceAvailable.mockReturnValue(true);
    const { updateStorageRoot } = await import("../src/lib/prompt-builder/main-app-api");

    const status = await updateStorageRoot("", true);

    expect(connectBrowserWorkspace).toHaveBeenCalledWith(true);
    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(status.workspaceKind).toBe("browser");
  });

  it("keeps absolute filesystem paths on the local server API", async () => {
    const { updateStorageRoot } = await import("../src/lib/prompt-builder/main-app-api");
    const fetchMock = vi.mocked(globalThis.fetch);
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      ok: true,
      localApiAvailable: true,
      contentRoot: "C:\\Content",
      writable: true,
      version: "1.0",
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));

    const status = await updateStorageRoot("C:\\Content", false);

    expect(fetchMock).toHaveBeenCalledWith("/api/storage/settings", expect.objectContaining({
      method: "PUT",
    }));
    expect(connectBrowserWorkspace).not.toHaveBeenCalled();
    expect(status.contentRoot).toBe("C:\\Content");
  });

  it("treats an unconnected browser workspace as an empty hosted project list", async () => {
    browserWorkspaceAvailable.mockReturnValue(true);
    listBrowserRuntimeProjects.mockRejectedValue(new Error("Choose a local content folder first."));
    const { listRuntimeProjects } = await import("../src/lib/prompt-builder/main-app-api");

    const payload = await listRuntimeProjects();

    expect(payload).toEqual({ ok: true, projects: [] });
  });
});
