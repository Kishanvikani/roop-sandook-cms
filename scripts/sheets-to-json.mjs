import fs from "node:fs/promises";
import path from "node:path";

import { parse } from "csv-parse/sync";

import {
  cleanString,
  generatedDir,
  importCsvFile,
  parseBoolean,
  parseInventory,
  parseMoney,
  requiredColumns,
  splitList,
  slugify,
  writeJsonFile,
} from "./lib/import-utils.mjs";
import {
  buildSeoDescription,
  buildSeoTitle,
  defaultCareInstructions,
  defaultShippingInfo,
} from "./lib/product-defaults.mjs";

const productFields = [
  "shortDescription",
  "description",
  "careInstructions",
  "shippingInfo",
  "seoTitle",
  "seoDescription",
];

const productTypeDescriptions = new Map([
  ["earring>stud", "Elegant traditional studs for special occasions."],
  ["earring>jhumka", "Classic traditional jhumkas with timeless charm."],
  ["earring>dangler", "Graceful traditional danglers for festive elegance."],
  ["ring", "Traditional rings with delicate craftsmanship."],
  ["pendant-set", "Traditional pendant sets for ethnic elegance."],
  ["nose-ring", "Traditional nose rings for graceful charm."],
  ["necklace", "Traditional necklaces with timeless elegance."],
  ["bangles", "Traditional bangles crafted for timeless ethnic elegance."],
  ["kada", "Traditional kadas with regal craftsmanship and classic appeal."],
  ["hair-accessories", "Traditional hair accessories to complete your festive look."],
  ["earring>ear-cuffs", "Traditional ear cuffs for a bold ethnic statement."],
  ["earring>ear-chains", "Traditional ear chains with graceful heritage charm."],
]);

function setFirstValue(target, fieldName, value) {
  if (target[fieldName] == null && value != null && value !== "") {
    target[fieldName] = value;
  }
}

function mergeUnique(target, fieldName, values) {
  const existing = new Set(target[fieldName] || []);
  for (const value of values) {
    existing.add(value);
  }
  target[fieldName] = Array.from(existing);
}

function parseCategory(row, context) {
  const category = cleanString(row.category);
  const subCategory = cleanString(row.subCategory);

  if (category?.includes(">")) {
    context.errors.push('category must not contain ">"; use the subCategory column instead.');
  }

  if (subCategory?.includes(">")) {
    context.errors.push('subCategory must not contain ">"; enter only the child category name.');
  }

  if (!category) {
    return {};
  }

  if (!subCategory) {
    return { category };
  }

  return {
    parentCategory: category,
    category: subCategory,
  };
}

function parseOptionalBoolean(value, fieldName, context) {
  const cleaned = cleanString(value);
  if (!cleaned) {
    return undefined;
  }

  const parsed = parseBoolean(cleaned);
  if (parsed == null) {
    context.errors.push(`${fieldName} must be true/false, yes/no, y/n, or 1/0.`);
  }

  return parsed;
}

function isValidUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function isBlankRow(row) {
  return Object.values(row).every((value) => cleanString(value) == null);
}

function normalizeRow(row, index) {
  const context = {
    rowNumber: index + 2,
    errors: [],
  };

  const productName = cleanString(row.productName);
  const productKey = cleanString(row.productKey) || slugify(productName);
  const sku = cleanString(row.sku);
  const price = parseMoney(row.price, "price", context);
  const compareAtPrice = parseMoney(row.compareAtPrice, "compareAtPrice", context);
  const inventoryCount = parseInventory(row.inventoryCount, context);
  const colour = cleanString(row.colour);
  const category = parseCategory(row, context);
  const collections = splitList(row.collections);
  const materials = splitList(row.materials);
  const imageUrls = splitList(row.imageUrls);
  const size = cleanString(row.size);

  if (!productKey) {
    context.errors.push("productKey is required.");
  }

  if (!productName) {
    context.errors.push("productName is required.");
  }

  if (!sku) {
    context.errors.push("sku is required.");
  }

  if (price == null) {
    context.errors.push("price is required.");
  }

  if (!category.category) {
    context.errors.push("category is required.");
  }

  if (productKey && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(productKey)) {
    context.errors.push(
      'productKey must use lowercase letters, numbers, and hyphens only, for example "antique-gold-jhumka-pair".',
    );
  }

  if (productKey && slugify(productKey) !== productKey) {
    context.errors.push(`productKey should already be slug-safe. Suggested value: "${slugify(productKey)}".`);
  }

  if (compareAtPrice != null && price != null && compareAtPrice < price) {
    context.errors.push("compareAtPrice should be greater than or equal to price.");
  }

  for (const imageUrl of imageUrls) {
    if (!isValidUrl(imageUrl)) {
      context.errors.push(`imageUrls contains an invalid URL: ${imageUrl}`);
    }
  }

  const product = {
    productKey,
    productName,
    slug: slugify(productKey),
    ...category,
    collections,
    materials,
    size,
    imageUrls,
  };

  for (const fieldName of productFields) {
    product[fieldName] = cleanString(row[fieldName]);
  }

  const isFeatured = parseOptionalBoolean(row.isFeatured, "isFeatured", context);
  const isNewArrival = parseOptionalBoolean(row.isNewArrival, "isNewArrival", context);
  if (isFeatured != null) {
    product.isFeatured = isFeatured;
  }
  if (isNewArrival != null) {
    product.isNewArrival = isNewArrival;
  }

  return {
    context,
    product,
    variant: {
      sku,
      colour,
      size,
      price,
      compareAtPrice,
      inventoryCount,
      inStock: inventoryCount > 0,
      imageUrls,
    },
  };
}

function applyProductDefaults(product) {
  const productTypeDescription = getProductTypeDescription(product);
  const shortDescription = product.shortDescription || productTypeDescription;
  const seoDescription =
    product.seoDescription || productTypeDescription || buildSeoDescription({
      ...product,
      shortDescription,
    });

  return {
    ...product,
    shortDescription,
    careInstructions: product.careInstructions || defaultCareInstructions,
    shippingInfo: product.shippingInfo || defaultShippingInfo,
    seoTitle: product.seoTitle || buildSeoTitle(product.productName),
    seoDescription,
    isFeatured: product.isFeatured ?? false,
    isNewArrival: product.isNewArrival ?? false,
  };
}

function getProductTypeDescription(product) {
  const categoryKey = normalizeProductTypeKey(product.category);
  const parentCategoryKey = normalizeProductTypeKey(product.parentCategory);
  const nestedKey = parentCategoryKey && categoryKey
    ? `${parentCategoryKey}>${categoryKey}`
    : "";

  return productTypeDescriptions.get(nestedKey) ||
    productTypeDescriptions.get(categoryKey);
}

function normalizeProductTypeKey(value) {
  const key = slugify(value);

  return key === "earrings" ? "earring" : key;
}

async function convertFile(filePath) {
  const source = await fs.readFile(filePath, "utf8");
  const records = parse(source, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
  });

  const headers = records.length > 0 ? Object.keys(records[0]) : [];
  const missingColumns = requiredColumns.filter((column) => !headers.includes(column));
  const errors = missingColumns.map((column) => `Missing required column: ${column}`);
  const warnings = [];
  const productsByKey = new Map();
  const productKeysByName = new Map();
  const productNamesByKey = new Map();
  const rowNumbersBySku = new Map();

  if (missingColumns.length === 0) {
    records.filter((row) => !isBlankRow(row)).forEach((row, index) => {
      const { context, product, variant } = normalizeRow(row, index);

      if (context.errors.length > 0) {
        errors.push(
          ...context.errors.map((message) => `Row ${context.rowNumber}: ${message}`),
        );
        return;
      }

      const productNameKey = product.productName.toLowerCase();
      const namesForKey = productNamesByKey.get(product.productKey) || new Set();
      namesForKey.add(product.productName);
      productNamesByKey.set(product.productKey, namesForKey);

      const keysForName = productKeysByName.get(productNameKey) || new Set();
      keysForName.add(product.productKey);
      productKeysByName.set(productNameKey, keysForName);

      if (rowNumbersBySku.has(variant.sku)) {
        errors.push(
          `Row ${context.rowNumber}: duplicate sku "${variant.sku}" also appears on row ${rowNumbersBySku.get(variant.sku)}.`,
        );
        return;
      }
      rowNumbersBySku.set(variant.sku, context.rowNumber);

      const existing = productsByKey.get(product.productKey) || {
        ...product,
        variants: [],
      };

      if (existing.productName !== product.productName) {
        errors.push(
          `Row ${context.rowNumber}: productName differs for productKey "${product.productKey}". Keeping "${existing.productName}".`,
        );
        return;
      }

      if (!existing.category && product.category) {
        existing.category = product.category;
      }

      mergeUnique(existing, "collections", product.collections);
      mergeUnique(existing, "materials", product.materials);
      mergeUnique(existing, "imageUrls", product.imageUrls);

      for (const fieldName of productFields) {
        setFirstValue(existing, fieldName, product[fieldName]);
      }
      setFirstValue(existing, "isFeatured", product.isFeatured);
      setFirstValue(existing, "isNewArrival", product.isNewArrival);

      if (existing.variants.some((item) => item.sku === variant.sku)) {
        errors.push(
          `Row ${context.rowNumber}: duplicate sku "${variant.sku}" in this CSV. Keeping the first row.`,
        );
      } else {
        existing.variants.push(variant);
      }

      productsByKey.set(product.productKey, existing);
    });

    for (const [productName, keys] of productKeysByName.entries()) {
      if (keys.size > 1) {
        errors.push(
          `Same product name "${productName}" appears with multiple product keys: ${Array.from(keys).join(", ")}.`,
        );
      }
    }

    for (const [productKey, names] of productNamesByKey.entries()) {
      if (names.size > 1) {
        errors.push(
          `Same product key "${productKey}" appears with multiple product names: ${Array.from(names).join(", ")}.`,
        );
      }
    }
  }

  const output = {
    sourceFile: path.basename(filePath),
    generatedAt: new Date().toISOString(),
    products: Array.from(productsByKey.values()).map(applyProductDefaults),
    warnings,
    errors,
  };

  const outputFile = path.join(
    generatedDir,
    `${path.basename(filePath, path.extname(filePath))}.json`,
  );

  await writeJsonFile(outputFile, output);
  return { outputFile, output };
}

async function main() {
  try {
    await fs.access(importCsvFile);
  } catch {
    console.error(`Missing import file: ${importCsvFile}`);
    console.error('Create or update "google-sheet\\product-import.csv", then run Step 1 again.');
    process.exitCode = 1;
    return;
  }

  const { outputFile, output } = await convertFile(importCsvFile);
  console.log(`Converted ${path.basename(importCsvFile)} -> ${path.relative(generatedDir, outputFile)}`);
  console.log(`  products: ${output.products.length}`);
  console.log(`  warnings: ${output.warnings.length}`);
  console.log(`  errors: ${output.errors.length}`);

  for (const warning of output.warnings) {
    console.warn(`  warning: ${warning}`);
  }

  for (const error of output.errors) {
    console.error(`  error: ${error}`);
  }

  if (output.errors.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
