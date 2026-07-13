import { createClient } from "@sanity/client";

import { loadEnv } from "./lib/import-utils.mjs";

const apiVersion = "2025-02-19";
const defaultTypes = ["product", "category", "collection", "colour", "material"];
const cleanupRefs = {
  homePage: ["featuredProducts", "featuredCategories", "featuredCollections"],
};

function parseArgs() {
  const args = new Set(process.argv.slice(2));
  const typesArg = process.argv
    .slice(2)
    .find((arg) => arg.startsWith("--types="));

  return {
    confirm: args.has("--confirm"),
    includeDrafts: args.has("--include-drafts"),
    types: typesArg
      ? typesArg
          .replace("--types=", "")
          .split(",")
          .map((type) => type.trim())
          .filter(Boolean)
      : defaultTypes,
  };
}

function makeClient({ confirm }) {
  loadEnv();

  const projectId = process.env.SANITY_STUDIO_PROJECT_ID;
  const dataset = process.env.SANITY_STUDIO_DATASET || "production";
  const token = process.env.SANITY_AUTH_TOKEN;

  if (!projectId) {
    throw new Error("SANITY_STUDIO_PROJECT_ID is required.");
  }

  if (confirm && !token) {
    throw new Error("SANITY_AUTH_TOKEN is required when using --confirm.");
  }

  return createClient({
    projectId,
    dataset,
    token,
    apiVersion,
    useCdn: false,
  });
}

function draftFilter(includeDrafts) {
  return includeDrafts ? "" : ' && !(_id in path("drafts.**"))';
}

async function fetchCounts(client, types, includeDrafts) {
  return client.fetch(
    `{
      "byType": *[_type in $types${draftFilter(includeDrafts)}]{
        _type
      },
      "categories": *[_type == "category"${draftFilter(includeDrafts)}]{
        _id,
        title,
        "parentId": parentCategory._ref
      }
    }`,
    { types },
  );
}

function countByType(docs) {
  return docs.reduce((counts, doc) => {
    counts[doc._type] = (counts[doc._type] || 0) + 1;
    return counts;
  }, {});
}

async function clearKnownReferences(client) {
  const transaction = client.transaction();
  let patchCount = 0;

  for (const [type, fields] of Object.entries(cleanupRefs)) {
    const docs = await client.fetch(`*[_type == $type && !(_id in path("drafts.**"))]._id`, {
      type,
    });

    for (const id of docs) {
      transaction.patch(id, (patch) => patch.unset(fields));
      patchCount += 1;
    }
  }

  if (patchCount > 0) {
    await transaction.commit();
  }

  return patchCount;
}

async function deleteType(client, type, includeDrafts) {
  const result = await client.delete({
    query: `*[_type == $type${draftFilter(includeDrafts)}]`,
    params: { type },
  });

  return result;
}

async function deleteCategories(client, includeDrafts) {
  await client.delete({
    query: `*[_type == "category" && defined(parentCategory)${draftFilter(includeDrafts)}]`,
  });

  return client.delete({
    query: `*[_type == "category"${draftFilter(includeDrafts)}]`,
  });
}

async function main() {
  const options = parseArgs();
  const client = makeClient(options);
  const { byType, categories } = await fetchCounts(
    client,
    options.types,
    options.includeDrafts,
  );
  const counts = countByType(byType);
  const total = byType.length;

  console.log(options.confirm ? "Cleaning Sanity catalogue data." : "Dry run only. No Sanity writes were made.");
  console.log(`Types: ${options.types.join(", ")}`);
  console.log(`Drafts: ${options.includeDrafts ? "included" : "excluded"}`);
  console.log(`Total matching documents: ${total}`);

  for (const type of options.types) {
    console.log(`  ${type}: ${counts[type] || 0}`);
  }

  if (categories.length > 0) {
    const childCount = categories.filter((category) => category.parentId).length;
    console.log(`  category children: ${childCount}`);
  }

  if (!options.confirm) {
    console.log("");
    console.log("Run `yarn clean:catalogue --confirm` to delete these documents.");
    console.log("Use `--include-drafts` if you also want to delete draft catalogue documents.");
    return;
  }

  const patchedDocs = await clearKnownReferences(client);
  if (patchedDocs > 0) {
    console.log(`Cleared catalogue references from ${patchedDocs} homepage document(s).`);
  }

  for (const type of options.types) {
    if (type === "category") {
      await deleteCategories(client, options.includeDrafts);
    } else {
      await deleteType(client, type, options.includeDrafts);
    }
  }

  console.log("Catalogue clean complete.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
