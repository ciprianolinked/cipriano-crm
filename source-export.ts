import { lstat, readFile, readdir, realpath } from "node:fs/promises";
import { extname, join, sep } from "node:path";
import { createHash } from "node:crypto";
import { deflateRawSync } from "node:zlib";

export const PROJECT_FOLDER = "cipriano-propostas";
export const PROJECT_ZIP_NAME = `${PROJECT_FOLDER}-github-desktop.zip`;
const BROWSER_UPLOAD_BATCH_SIZE = 80;

const ROOT_FILES = [
  ".gitignore", ".env.example", "README.md", "package.json", "package-lock.json",
  "next-env.d.ts", "next.config.ts", "tsconfig.json", "postcss.config.mjs",
  "eslint.config.mjs", "drizzle.config.ts",
];
const SOURCE_DIRS = ["src", "public", "drizzle"];
const ALLOWED_EXTENSIONS = new Set([".ts", ".tsx", ".css", ".svg", ".sql", ".json", ".mjs", ".md", ".txt", ".png", ".jpg", ".jpeg", ".webp", ".ico"]);
const BLOCKED_SEGMENTS = new Set(["node_modules", ".next", ".git", ".vercel", ".turbo", "coverage", "dist", "out", "downloads", "test-results", "playwright-report"]);
const MAX_FILE_BYTES = 3 * 1024 * 1024;
const MAX_TOTAL_BYTES = 20 * 1024 * 1024;
const MAX_FILES = 1000;

type SourceFile = { path: string; content: Buffer };
export type BrowserUploadBatchInfo = {
  part: number;
  total: number;
  filename: string;
  fileCount: number;
  sourceBytes: number;
  firstPath: string;
  lastPath: string;
};
export type SourceExportInfo = {
  filename: string;
  folder: string;
  fileCount: number;
  sourceBytes: number;
  files: { path: string; bytes: number }[];
  browserBatches: BrowserUploadBatchInfo[];
  excluded: string[];
  includesDatabaseRecords: false;
  includesEnvironmentSecrets: false;
};

function allowed(relativePath: string): boolean {
  const parts = relativePath.split("/");
  const name = parts[parts.length - 1];
  if (parts.some((part) => BLOCKED_SEGMENTS.has(part))) return false;
  if (name.startsWith(".env") && name !== ".env.example") return false;
  if (name.endsWith(".tsbuildinfo") || name.endsWith(".map") || name.endsWith(".log")) return false;
  if (ROOT_FILES.includes(relativePath)) return true;
  if (!SOURCE_DIRS.includes(parts[0])) return false;
  if (parts[0] === "drizzle") return [".sql", ".json"].includes(extname(name));
  if (parts[0] === "public") return [".svg", ".sql", ".png", ".jpg", ".jpeg", ".webp", ".ico", ".txt"].includes(extname(name));
  return ALLOWED_EXTENSIONS.has(extname(name));
}

async function collectSourceFiles(): Promise<SourceFile[]> {
  const root = await realpath(process.cwd());
  const files: SourceFile[] = [];
  let totalBytes = 0;
  async function add(relativePath: string) {
    if (!allowed(relativePath)) return;
    const absolute = join(root, ...relativePath.split("/"));
    const stat = await lstat(absolute);
    if (!stat.isFile() || stat.isSymbolicLink()) return;
    const resolved = await realpath(absolute);
    if (!resolved.startsWith(root + sep)) return;
    if (stat.size > MAX_FILE_BYTES) throw new Error("SOURCE_FILE_TOO_LARGE");
    totalBytes += stat.size;
    if (totalBytes > MAX_TOTAL_BYTES || files.length >= MAX_FILES) throw new Error("SOURCE_EXPORT_TOO_LARGE");
    files.push({ path: `${PROJECT_FOLDER}/${relativePath}`, content: await readFile(resolved) });
  }
  async function walk(directory: string) {
    let entries;
    try { entries = await readdir(join(root, directory), { withFileTypes: true }); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return; throw error; }
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const relativePath = `${directory}/${entry.name}`;
      if (entry.isSymbolicLink() || BLOCKED_SEGMENTS.has(entry.name)) continue;
      if (entry.isDirectory()) await walk(relativePath);
      else if (entry.isFile()) await add(relativePath);
    }
  }
  for (const file of ROOT_FILES) {
    try { await add(file); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  }
  for (const directory of SOURCE_DIRS) await walk(directory);
  const required = ["package.json", "package-lock.json", "src/app/layout.tsx", "next.config.ts"];
  if (required.some((path) => !files.some((file) => file.path === `${PROJECT_FOLDER}/${path}`))) throw new Error("SOURCE_EXPORT_INCOMPLETE");
  return files.sort((a, b) => a.path.localeCompare(b.path));
}

function manifest(files: SourceFile[], batch?: { part: number; total: number }): string {
  return [
    "CIPRIANO TECH & SECURITY — ARQUIVOS DO PROJETO",
    batch ? `LOTE ${batch.part} DE ${batch.total}: parte para upload pelo navegador do GitHub.` : "PACOTE COMPLETO: usar GitHub Desktop ou Git.",
    "Somente código, configurações, migrations e assets públicos.",
    "Sem node_modules, .next, .env real, chaves privadas ou registros do banco.",
    batch ? "Extraia o ZIP e envie os arquivos mantendo os caminhos de pastas. Faça um commit por lote, no mesmo repositório. Conecte a Vercel depois de enviar TODOS os lotes." : "Extraia o ZIP e publique a pasta com GitHub Desktop ou Git. Não envie o ZIP sozinho como código.",
    "",
    ...files.map((file) => `${file.path.slice(PROJECT_FOLDER.length + 1)} | ${file.content.length} bytes | SHA256 ${createHash("sha256").update(file.content).digest("hex")}`),
  ].join("\n") + "\n";
}

function splitBatches(files: SourceFile[]) {
  const total = Math.max(1, Math.ceil(files.length / BROWSER_UPLOAD_BATCH_SIZE));
  return Array.from({ length: total }, (_, index) => ({ part: index + 1, total, files: files.slice(index * BROWSER_UPLOAD_BATCH_SIZE, (index + 1) * BROWSER_UPLOAD_BATCH_SIZE) }));
}
function batchDetails(part: number, total: number, files: SourceFile[]): BrowserUploadBatchInfo {
  return {
    part, total,
    filename: `${PROJECT_FOLDER}-github-lote-${String(part).padStart(2, "0")}-de-${String(total).padStart(2, "0")}.zip`,
    fileCount: files.length + 1,
    sourceBytes: files.reduce((sum, file) => sum + file.content.length, 0),
    firstPath: files[0]?.path.slice(PROJECT_FOLDER.length + 1) ?? "",
    lastPath: files[files.length - 1]?.path.slice(PROJECT_FOLDER.length + 1) ?? "",
  };
}

export async function getSourceExportInfo(): Promise<SourceExportInfo> {
  const files = await collectSourceFiles();
  const batches = splitBatches(files).map((batch) => {
    const content = manifest(batch.files, batch);
    return batchDetails(batch.part, batch.total, batch.files);
  });
  const fullManifest = manifest(files);
  return {
    filename: PROJECT_ZIP_NAME,
    folder: PROJECT_FOLDER,
    fileCount: files.length + 1,
    sourceBytes: files.reduce((sum, file) => sum + file.content.length, 0),
    files: [...files.map((file) => ({ path: file.path.slice(PROJECT_FOLDER.length + 1), bytes: file.content.length })), { path: "ARQUIVOS-INCLUIDOS.txt", bytes: Buffer.byteLength(fullManifest) }].sort((a, b) => a.path.localeCompare(b.path)),
    browserBatches: batches,
    excluded: ["node_modules/", ".next/", ".git/", ".vercel/", ".env e credenciais locais", "logs, caches e arquivos ZIP", "registros de clientes, propostas e contratos"],
    includesDatabaseRecords: false,
    includesEnvironmentSecrets: false,
  };
}

const CRC_TABLE = Uint32Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  return crc >>> 0;
});
function crc32(content: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of content) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/** ZIP UTF-8/Deflate archive using built-in Node APIs only. */
function zipFiles(files: SourceFile[]): Buffer {
  const localRecords: Buffer[] = [];
  const directoryRecords: Buffer[] = [];
  let offset = 0;
  const time = 12 << 11;
  const date = ((2024 - 1980) << 9) | (1 << 5) | 1;
  for (const file of files) {
    const name = Buffer.from(file.path, "utf8");
    const compressed = deflateRawSync(file.content, { level: 9 });
    const checksum = crc32(file.content);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6); local.writeUInt16LE(8, 8);
    local.writeUInt16LE(time, 10); local.writeUInt16LE(date, 12); local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(compressed.length, 18); local.writeUInt32LE(file.content.length, 22); local.writeUInt16LE(name.length, 26);
    localRecords.push(local, name, compressed);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8); central.writeUInt16LE(8, 10); central.writeUInt16LE(time, 12); central.writeUInt16LE(date, 14);
    central.writeUInt32LE(checksum, 16); central.writeUInt32LE(compressed.length, 20); central.writeUInt32LE(file.content.length, 24);
    central.writeUInt16LE(name.length, 28); central.writeUInt32LE((0o100644 << 16) >>> 0, 38); central.writeUInt32LE(offset, 42);
    directoryRecords.push(central, name);
    offset += local.length + name.length + compressed.length;
  }
  const directory = Buffer.concat(directoryRecords);
  const footer = Buffer.alloc(22);
  footer.writeUInt32LE(0x06054b50, 0); footer.writeUInt16LE(files.length, 8); footer.writeUInt16LE(files.length, 10);
  footer.writeUInt32LE(directory.length, 12); footer.writeUInt32LE(offset, 16);
  return Buffer.concat([...localRecords, directory, footer]);
}

export async function createSourceExport(): Promise<{ buffer: Buffer; info: SourceExportInfo }> {
  const files = await collectSourceFiles();
  files.push({ path: `${PROJECT_FOLDER}/ARQUIVOS-INCLUIDOS.txt`, content: Buffer.from(manifest(files), "utf8") });
  files.sort((a, b) => a.path.localeCompare(b.path));
  return { buffer: zipFiles(files), info: await getSourceExportInfo() };
}

export async function createSourceExportBatch(part: number): Promise<{ buffer: Buffer; batch: BrowserUploadBatchInfo }> {
  const allFiles = await collectSourceFiles();
  const batches = splitBatches(allFiles);
  if (!Number.isInteger(part) || part < 1 || part > batches.length) throw new Error("SOURCE_EXPORT_BATCH_NOT_FOUND");
  const batch = batches[part - 1];
  const manifestName = `ARQUIVOS-LOTE-${String(batch.part).padStart(2, "0")}.txt`;
  const manifestContent = Buffer.from(manifest(batch.files, batch), "utf8");
  const files = [...batch.files, { path: `${PROJECT_FOLDER}/${manifestName}`, content: manifestContent }].sort((a, b) => a.path.localeCompare(b.path));
  return { buffer: zipFiles(files), batch: batchDetails(batch.part, batch.total, batch.files) };
}
