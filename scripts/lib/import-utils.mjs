import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const projectRoot = path.resolve(__dirname, "..", "..");
export const sheetDir = path.join(projectRoot, "google-sheet");
export const generatedDir = path.join(sheetDir, "generated");
export const importCsvFile = path.join(sheetDir, "product-import.csv");
export const generatedImportFile = path.join(generatedDir, "product-import.json");

export const requiredColumns = ["productName", "sku", "price", "category"];

export function loadEnv() {
  dotenv.config({ path: path.join(projectRoot, ".env.local"), override: false, quiet: true });
  dotenv.config({ path: path.join(projectRoot, ".env"), override: false, quiet: true });
}

export function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function variantKey(sku) {
  return `variant-${slugify(sku) || "sku"}`;
}

export function referenceKey(type, title) {
  return `${type}-${slugify(title) || "ref"}`;
}

export function splitList(value) {
  if (value == null || String(value).trim() === "") {
    return [];
  }

  return String(value)
    .split(/[;,|]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function cleanString(value) {
  const cleaned = String(value ?? "").trim();
  return cleaned || undefined;
}

export function parseMoney(value, fieldName, context) {
  const cleaned = cleanString(value);
  if (!cleaned) {
    return undefined;
  }

  const parsed = Number(cleaned.replace(/,/g, ""));
  if (!Number.isFinite(parsed) || parsed < 0) {
    context.errors.push(`${fieldName} must be a non-negative number.`);
    return undefined;
  }

  return parsed;
}

export function parseInventory(value, context) {
  const cleaned = cleanString(value);
  if (!cleaned) {
    return 1;
  }

  const parsed = Number(cleaned.replace(/,/g, ""));
  if (!Number.isInteger(parsed) || parsed < 0) {
    context.errors.push("inventoryCount must be a non-negative integer.");
    return undefined;
  }

  return parsed;
}

export function parseBoolean(value) {
  const cleaned = cleanString(value);
  if (!cleaned) {
    return undefined;
  }

  if (/^(true|yes|y|1)$/i.test(cleaned)) {
    return true;
  }

  if (/^(false|no|n|0)$/i.test(cleaned)) {
    return false;
  }

  return undefined;
}

export function toSlugField(title) {
  return { _type: "slug", current: slugify(title) };
}

export function toReference(id, key) {
  return {
    _key: key,
    _type: "reference",
    _ref: id,
  };
}

export async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

export async function readJsonFile(filePath) {
  const source = await fs.readFile(filePath, "utf8");
  return JSON.parse(source);
}

export async function writeJsonFile(filePath, value) {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
