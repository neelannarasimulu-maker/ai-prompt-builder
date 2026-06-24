import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";

const defaultMaxJsonBodyBytes = 25 * 1024 * 1024;

export function ensureDirectory(directoryPath: string): void {
  if (!fs.existsSync(directoryPath)) fs.mkdirSync(directoryPath, { recursive: true });
}

export function isInsideRoot(rootPath: string, candidatePath: string): boolean {
  const relative = path.relative(rootPath, candidatePath);
  return Boolean(relative) && !relative.startsWith("..") && !path.isAbsolute(relative);
}

export function readRequestBody(req: import("node:http").IncomingMessage, maxBytes = defaultMaxJsonBodyBytes): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk: Buffer) => {
      body += chunk.toString();
      if (Buffer.byteLength(body, "utf8") > maxBytes) {
        reject(new Error(`Request body exceeds ${Math.round(maxBytes / 1024 / 1024)} MB limit.`));
        req.destroy();
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

export function sendJson(res: import("node:http").ServerResponse, status: number, payload: unknown): void {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload, null, 2));
}

export function copyFileToClipboard(filePath: string): Promise<void> {
  if (process.platform !== "win32") throw new Error("Copying files to the clipboard is currently supported on Windows only.");
  return new Promise((resolve, reject) => {
    execFile(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-Command", "& { param([string]$filePath) Set-Clipboard -LiteralPath $filePath }", filePath],
      { windowsHide: true },
      (error, _stdout, stderr) => {
        if (error) {
          reject(new Error(stderr.trim() || error.message));
          return;
        }
        resolve();
      }
    );
  });
}

export function slugSegment(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9-_]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 90);
}

export function safeFilename(value: string): string {
  const parsed = path.parse(value);
  const name = slugSegment(parsed.name || "generated-content");
  const ext = parsed.ext.toLowerCase().replace(/[^.a-z0-9]/g, "");
  return `${name}${ext || ".bin"}`;
}

export function stripDuplicateExtensions(filename: string): string {
  const parts = filename.split(".");
  if (parts.length < 3) return filename;
  while (parts.length > 2 && parts[parts.length - 1].toLowerCase() === parts[parts.length - 2].toLowerCase()) parts.pop();
  return parts.join(".");
}

export function uniqueAvailablePath(directoryPath: string, filename: string): string {
  const parsed = path.parse(filename);
  let candidate = path.join(directoryPath, filename);
  let counter = 2;
  while (fs.existsSync(candidate)) {
    candidate = path.join(directoryPath, `${parsed.name}-${counter}${parsed.ext}`);
    counter += 1;
  }
  return candidate;
}

export function walkFiles(directoryPath: string): string[] {
  if (!fs.existsSync(directoryPath)) return [];
  const files: string[] = [];
  for (const entry of fs.readdirSync(directoryPath, { withFileTypes: true })) {
    const fullPath = path.join(directoryPath, entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) files.push(...walkFiles(fullPath));
    else if (!entry.name.startsWith(".")) files.push(fullPath);
  }
  return files;
}

export function removeEmptyDirectoryTree(directoryPath: string): void {
  if (!fs.existsSync(directoryPath) || fs.lstatSync(directoryPath).isSymbolicLink()) return;
  for (const entry of fs.readdirSync(directoryPath, { withFileTypes: true })) {
    if (entry.isDirectory() && !entry.isSymbolicLink()) removeEmptyDirectoryTree(path.join(directoryPath, entry.name));
  }
  if (fs.readdirSync(directoryPath).length === 0) fs.rmdirSync(directoryPath);
}

export function getFileType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  if ([".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg"].includes(ext)) return "image";
  if (ext === ".pdf") return "pdf";
  if ([".docx", ".doc"].includes(ext)) return "document";
  if ([".pptx", ".ppt"].includes(ext)) return "presentation";
  if ([".md", ".txt", ".json", ".csv"].includes(ext)) return "text";
  return "other";
}

export function getImageMimeType(filename: string): "image/png" | "image/jpeg" | undefined {
  const ext = path.extname(filename).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  return undefined;
}

function getPngDimensions(buffer: Buffer): { width: number; height: number } | undefined {
  if (buffer.length < 24 || buffer.toString("ascii", 1, 4) !== "PNG") return undefined;
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function getJpegDimensions(buffer: Buffer): { width: number; height: number } | undefined {
  let offset = 2;
  while (offset < buffer.length) {
    if (buffer[offset] !== 0xff) return undefined;
    const marker = buffer[offset + 1];
    const length = buffer.readUInt16BE(offset + 2);
    if (marker >= 0xc0 && marker <= 0xc3) {
      return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
    }
    offset += 2 + length;
  }
  return undefined;
}

export function getImageDimensions(filename: string, buffer: Buffer): { width: number; height: number } {
  const dimensions = path.extname(filename).toLowerCase() === ".png"
    ? getPngDimensions(buffer)
    : getJpegDimensions(buffer);
  return dimensions || { width: 16, height: 9 };
}

export function getStringQueryParam(url: URL, name: string): string {
  return url.searchParams.get(name) || "";
}
