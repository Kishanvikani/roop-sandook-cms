import fs from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";

import { createClient } from "@sanity/client";

import {
  generatedImportFile,
  generatedDir,
  loadEnv,
  projectRoot,
  readJsonFile,
  referenceKey,
  slugify,
  toReference,
  toSlugField,
  variantKey,
} from "./lib/import-utils.mjs";
import {
  buildSeoDescription,
  buildSeoTitle,
  defaultCareInstructions,
  defaultShippingInfo,
} from "./lib/product-defaults.mjs";

const apiVersion = "2025-02-19";
const missingCategoryTitle = "Missing";

function parseArgs() {
  const args = new Set(process.argv.slice(2));
  return {
    dryRun: args.has("--dry-run") || args.has("--dry"),
  };
}

async function readGeneratedFiles() {
  try {
    await fs.access(generatedImportFile);
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
    return [];
  }

  return [generatedImportFile];
}

function makeClient({ dryRun }) {
  loadEnv();

  const projectId = process.env.SANITY_STUDIO_PROJECT_ID;
  const dataset = process.env.SANITY_STUDIO_DATASET || "production";
  const token = process.env.SANITY_AUTH_TOKEN;

  if (!projectId) {
    throw new Error("SANITY_STUDIO_PROJECT_ID is required.");
  }

  if (!dryRun && !token) {
    throw new Error("SANITY_AUTH_TOKEN is required for writes.");
  }

  return createClient({
    projectId,
    dataset,
    token,
    apiVersion,
    useCdn: false,
  });
}

function compactObject(value) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined));
}

function createTaxonomyDoc(type, title, options = {}) {
  const slug = slugify(title);
  const base = {
    _id: `${type}-${slug}`,
    _type: type,
    title,
    slug: toSlugField(title),
    active: true,
  };

  if (type === "category") {
    base.displayOrder = 0;
    if (options.parentRef) {
      base.parentCategory = {
        _type: "reference",
        _ref: options.parentRef._ref,
      };
    }
  }

  return base;
}

async function getOrCreateTaxonomyRef(client, type, title, state, options = {}) {
  if (!title) {
    return undefined;
  }

  const slug = slugify(title);
  const cacheKey = `${type}:${slug}`;
  if (state.taxonomyCache.has(cacheKey)) {
    return state.taxonomyCache.get(cacheKey);
  }

  const existing = await client.fetch(
    `*[_type == $type && slug.current == $slug && !(_id match "*.*")][0]{_id}`,
    { type, slug },
  );

  const id = existing?._id || `${type}-${slug}`;
  if (!existing) {
    const doc = createTaxonomyDoc(type, title, options);
    state.summary.taxonomyCreates.push({ type, title, id: doc._id });

    if (!state.dryRun) {
      await client.createIfNotExists(doc);
    }
  }

  const ref = toReference(id, referenceKey(type, title));
  state.taxonomyCache.set(cacheKey, ref);
  return ref;
}

async function getOrCreateCategoryRef(client, product, state) {
  const categoryTitle = product.category || missingCategoryTitle;
  const parentRef = product.parentCategory
    ? await getOrCreateTaxonomyRef(client, "category", product.parentCategory, state)
    : undefined;

  return getOrCreateTaxonomyRef(client, "category", categoryTitle, state, {
    parentRef,
  });
}

async function imageFromUrl(client, imageUrl, state) {
  if (!imageUrl) {
    return undefined;
  }

  if (state.imageCache.has(imageUrl)) {
    return state.imageCache.get(imageUrl);
  }

  if (state.dryRun) {
    state.summary.imageUploads.push({ imageUrl, dryRun: true });
    const dryRef = {
      _key: `image-${slugify(imageUrl).slice(0, 40)}`,
      _type: "image",
      asset: {
        _type: "reference",
        _ref: `dry-image-${slugify(imageUrl).slice(0, 40)}`,
      },
    };
    state.imageCache.set(imageUrl, dryRef);
    return dryRef;
  }

  try {
    const response = await fetch(imageUrl);
    if (!response.ok || !response.body) {
      throw new Error(`HTTP ${response.status}`);
    }

    const pathname = new URL(imageUrl).pathname;
    const filename = path.basename(pathname) || "product-image.jpg";
    const asset = await client.assets.upload("image", Readable.fromWeb(response.body), {
      filename,
    });
    const image = {
      _key: `image-${asset._id.replace(/[^a-zA-Z0-9_-]/g, "-")}`,
      _type: "image",
      asset: {
        _type: "reference",
        _ref: asset._id,
      },
    };
    state.summary.imageUploads.push({ imageUrl, assetId: asset._id });
    state.imageCache.set(imageUrl, image);
    return image;
  } catch (error) {
    state.summary.imageFailures.push({ imageUrl, error: error.message });
    return undefined;
  }
}

async function imagesFromUrls(client, imageUrls = [], state) {
  const images = [];
  for (const imageUrl of imageUrls) {
    const image = await imageFromUrl(client, imageUrl, state);
    if (image) {
      images.push(image);
    }
  }
  return images;
}

async function loadExistingProducts(client, products) {
  const productKeys = products.map((product) => product.productKey).filter(Boolean);
  const slugs = products.map((product) => slugify(product.productKey)).filter(Boolean);
  const skus = products.flatMap((product) => product.variants.map((variant) => variant.sku));

  return client.fetch(
    `*[
      _type == "product" &&
      !(_id match "*.*") &&
      (
        productKey in $productKeys ||
        slug.current in $slugs ||
        count(variants[sku in $skus]) > 0
      )
    ]{
      _id,
      productKey,
      name,
      slug,
      variants[]{_key, sku, price, compareAtPrice, inventoryCount, inStock}
    }`,
    { productKeys, slugs, skus },
  );
}

function buildExistingIndexes(existingProducts) {
  const byProductKey = new Map();
  const bySlug = new Map();
  const bySku = new Map();

  for (const product of existingProducts) {
    if (product.productKey) {
      byProductKey.set(product.productKey, product);
    }
    if (product.slug?.current) {
      bySlug.set(product.slug.current, product);
    }
    for (const variant of product.variants || []) {
      if (variant.sku) {
        bySku.set(variant.sku, { product, variant });
      }
    }
  }

  return { byProductKey, bySlug, bySku };
}

async function buildVariant(client, variant, state) {
  const colour = await getOrCreateTaxonomyRef(client, "colour", variant.colour, state);
  const images = await imagesFromUrls(client, variant.imageUrls, state);

  return compactObject({
    _key: variantKey(variant.sku),
    _type: "productVariant",
    sku: variant.sku,
    colour,
    price: variant.price,
    compareAtPrice: variant.compareAtPrice,
    inventoryCount: variant.inventoryCount,
    inStock: variant.inventoryCount > 0,
    images: images.length > 0 ? images : undefined,
  });
}

async function buildNewProductDoc(client, product, state) {
  const category = await getOrCreateCategoryRef(client, product, state);
  const collections = (
    await Promise.all(
      (product.collections || []).map((title) =>
        getOrCreateTaxonomyRef(client, "collection", title, state),
      ),
    )
  ).filter(Boolean);
  const materials = (
    await Promise.all(
      (product.materials || []).map((title) =>
        getOrCreateTaxonomyRef(client, "material", title, state),
      ),
    )
  ).filter(Boolean);
  const images = await imagesFromUrls(client, product.imageUrls, state);
  const variants = [];

  for (const variant of product.variants) {
    variants.push(await buildVariant(client, variant, state));
  }

  return compactObject({
    _id: `product-${slugify(product.productKey)}`,
    _type: "product",
    productKey: product.productKey,
    name: product.productName,
    slug: toSlugField(product.productKey),
    category,
    collections: collections.length > 0 ? collections : undefined,
    materials: materials.length > 0 ? materials : undefined,
    size: product.size,
    images: images.length > 0 ? images : undefined,
    variants,
    shortDescription: product.shortDescription,
    description: product.description,
    isFeatured: product.isFeatured ?? false,
    isNewArrival: product.isNewArrival ?? false,
    careInstructions: product.careInstructions || defaultCareInstructions,
    shippingInfo: product.shippingInfo || defaultShippingInfo,
    seoTitle: product.seoTitle || buildSeoTitle(product.productName),
    seoDescription: product.seoDescription || buildSeoDescription(product),
  });
}

function updateExistingVariant(transaction, productId, existingVariant, incomingVariant, state) {
  const pathPrefix = `variants[_key=="${existingVariant._key}"]`;
  const setFields = {
    [`${pathPrefix}.price`]: incomingVariant.price,
    [`${pathPrefix}.inventoryCount`]: incomingVariant.inventoryCount,
    [`${pathPrefix}.inStock`]: incomingVariant.inventoryCount > 0,
  };
  const unsetFields = [];

  if (incomingVariant.compareAtPrice == null) {
    unsetFields.push(`${pathPrefix}.compareAtPrice`);
  } else {
    setFields[`${pathPrefix}.compareAtPrice`] = incomingVariant.compareAtPrice;
  }

  state.summary.variantUpdates.push({
    productId,
    sku: incomingVariant.sku,
    price: incomingVariant.price,
    compareAtPrice: incomingVariant.compareAtPrice,
    inventoryCount: incomingVariant.inventoryCount,
    inStock: incomingVariant.inventoryCount > 0,
  });

  if (!state.dryRun) {
    transaction.patch(productId, (patch) => {
      const next = patch.set(setFields);
      return unsetFields.length > 0 ? next.unset(unsetFields) : next;
    });
  }
}

async function addVariantToExistingProduct(client, transaction, productId, variant, state) {
  const newVariant = await buildVariant(client, variant, state);
  state.summary.variantCreates.push({ productId, sku: variant.sku });

  if (!state.dryRun) {
    transaction.patch(productId, (patch) => patch.setIfMissing({ variants: [] }).append("variants", [newVariant]));
  }
}

async function seedProduct(client, transaction, product, indexes, state) {
  const existingByKey = indexes.byProductKey.get(product.productKey);
  const existingBySlug = indexes.bySlug.get(slugify(product.productKey));
  const firstSkuMatch = product.variants
    .map((variant) => indexes.bySku.get(variant.sku))
    .find(Boolean);
  const existingProduct = existingByKey || existingBySlug || firstSkuMatch?.product;

  if (!existingProduct) {
    const doc = await buildNewProductDoc(client, product, state);
    state.summary.productCreates.push({ id: doc._id, productKey: product.productKey });

    if (!state.dryRun) {
      transaction.createIfNotExists(doc);
    }
    return;
  }

  if (!existingProduct.productKey && !state.dryRun) {
    transaction.patch(existingProduct._id, (patch) => patch.set({ productKey: product.productKey }));
  }

  for (const variant of product.variants) {
    const existingVariant = (existingProduct.variants || []).find((item) => item.sku === variant.sku);

    if (existingVariant) {
      updateExistingVariant(transaction, existingProduct._id, existingVariant, variant, state);
    } else {
      await addVariantToExistingProduct(client, transaction, existingProduct._id, variant, state);
    }
  }
}

function printSummary(summary, dryRun) {
  console.log(dryRun ? "Dry run complete. No Sanity writes were made." : "Seed complete.");
  console.log(`  product creates: ${summary.productCreates.length}`);
  console.log(`  variant creates: ${summary.variantCreates.length}`);
  console.log(`  variant updates: ${summary.variantUpdates.length}`);
  console.log(`  taxonomy creates: ${summary.taxonomyCreates.length}`);
  console.log(`  image uploads: ${summary.imageUploads.length}`);
  console.log(`  image failures: ${summary.imageFailures.length}`);
  console.log(`  skipped rows/files: ${summary.skipped.length}`);

  for (const item of summary.productCreates) {
    console.log(`  create product: ${item.productKey} (${item.id})`);
  }
  for (const item of summary.variantCreates) {
    console.log(`  create variant: ${item.sku} on ${item.productId}`);
  }
  for (const item of summary.variantUpdates) {
    console.log(`  update variant: ${item.sku} on ${item.productId}`);
  }
  for (const item of summary.taxonomyCreates) {
    console.log(`  create ${item.type}: ${item.title} (${item.id})`);
  }
  for (const item of summary.skipped) {
    console.warn(`  skipped: ${item}`);
  }
  for (const item of summary.imageFailures) {
    console.warn(`  image failed: ${item.imageUrl} - ${item.error}`);
  }
}

async function main() {
  const { dryRun } = parseArgs();
  const client = makeClient({ dryRun });
  const files = await readGeneratedFiles();

  if (files.length === 0) {
    console.log(`No generated JSON files found in ${path.relative(projectRoot, generatedDir)}.`);
    console.log("Run `yarn sheet:json` first.");
    return;
  }

  const summary = {
    productCreates: [],
    variantCreates: [],
    variantUpdates: [],
    taxonomyCreates: [],
    imageUploads: [],
    imageFailures: [],
    skipped: [],
  };
  const state = {
    dryRun,
    summary,
    taxonomyCache: new Map(),
    imageCache: new Map(),
  };

  const generated = await Promise.all(files.map(readJsonFile));
  const importErrors = generated.flatMap((file) =>
    (file.errors || []).map((error) => `${file.sourceFile}: ${error}`),
  );

  if (importErrors.length > 0) {
    for (const error of importErrors) {
      summary.skipped.push(error);
    }
    printSummary(summary, dryRun);
    process.exitCode = 1;
    return;
  }

  const products = generated.flatMap((file) => file.products || []);
  const existingProducts = await loadExistingProducts(client, products);
  const indexes = buildExistingIndexes(existingProducts);
  const transaction = client.transaction();

  for (const product of products) {
    await seedProduct(client, transaction, product, indexes, state);
  }

  if (!dryRun) {
    await transaction.commit();
  }

  printSummary(summary, dryRun);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
