import { visionTool } from "@sanity/vision";
import { defineConfig } from "sanity";
import { structureTool } from "sanity/structure";

import { schemaTypes } from "./schemaTypes";
import { structure } from "./structure";
import { safeDeleteTool } from "./tools/SafeDeleteTool";

export default defineConfig({
  name: "roop-sandook-cms",
  title: "Roop Sandook CMS",
  projectId: process.env.SANITY_STUDIO_PROJECT_ID,
  dataset: process.env.SANITY_STUDIO_DATASET || "production",
  plugins: [
    structureTool({
      structure,
    }),
    visionTool(),
  ],
  schema: {
    types: schemaTypes,
  },
  tools: (prev) => [...prev, safeDeleteTool],
});
