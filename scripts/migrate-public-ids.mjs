import { createClient } from "@sanity/client";

import { loadEnv, slugify } from "./lib/import-utils.mjs";

const apiVersion = "2025-02-19";
const migratedTypes = ["category", "collection", "colour", "material", "product"];

function makeClient() {
  loadEnv();

  const projectId = process.env.SANITY_STUDIO_PROJECT_ID;
  const dataset = process.env.SANITY_STUDIO_DATASET || "production";
  const token = process.env.SANITY_AUTH_TOKEN;

  if (!projectId) {
    throw new Error("SANITY_STUDIO_PROJECT_ID is required.");
  }

  if (!token) {
    throw new Error("SANITY_AUTH_TOKEN is required.");
  }

  return createClient({
    projectId,
    dataset,
    token,
    apiVersion,
    useCdn: false,
  });
}

function publicIdFor(doc) {
  const slug = doc.slug?.current || slugify(doc.productKey || doc.title || doc.name || doc._id);
  return `${doc._type}-${slug}`;
}

function cleanDocument(doc, idMap) {
  const copy = rewriteReferences(doc, idMap);

  delete copy._createdAt;
  delete copy._updatedAt;
  delete copy._rev;

  copy._id = idMap.get(doc._id);
  return copy;
}

function rewriteReferences(value, idMap) {
  if (Array.isArray(value)) {
    return value.map((item) => rewriteReferences(item, idMap));
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  const next = { ...value };

  if (next._type === "reference" && idMap.has(next._ref)) {
    next._ref = idMap.get(next._ref);
  }

  for (const [key, item] of Object.entries(next)) {
    next[key] = rewriteReferences(item, idMap);
  }

  return next;
}

async function main() {
  const client = makeClient();
  const docs = await client.fetch(
    `*[
      _type in $types &&
      _id match "*.*" &&
      !(_id in path("drafts.**"))
    ] | order(_type asc, _createdAt asc)`,
    { types: migratedTypes },
  );

  if (docs.length === 0) {
    console.log("No dotted Sanity documents found to migrate.");
    return;
  }

  const idMap = new Map(docs.map((doc) => [doc._id, publicIdFor(doc)]));
  const transaction = client.transaction();

  for (const doc of docs) {
    transaction.createOrReplace(cleanDocument(doc, idMap));
  }

  await transaction.commit();

  console.log(`Migrated ${docs.length} documents to public-safe IDs.`);
  for (const doc of docs) {
    console.log(`  ${doc._id} -> ${idMap.get(doc._id)}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
