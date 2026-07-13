# Roop Sandook CMS

Sanity Studio for managing Roop Sandook website content.

## Setup

1. Use the Sanity project `ks7qdg92` with dataset `production`.
2. Copy `.env.example` to `.env.local`.
3. Add:

```txt
SANITY_STUDIO_PROJECT_ID=ks7qdg92
SANITY_STUDIO_DATASET=production
```

4. Install dependencies:

```bash
corepack yarn install
```

5. Start Studio:

```bash
corepack yarn dev
```

On Windows, double-click `run-studio-in-chrome.cmd` to start the local Studio
server and open it in Chrome at `http://localhost:3333`.

The project was created from Sanity's clean template reference, but this Studio
is intentionally JavaScript-only and lives in `roop-sandook-cms`.

## Vercel Deployment

Vercel should use:

```txt
Install Command: corepack yarn install --frozen-lockfile
Build Command: corepack yarn build
Output Directory: dist
```

Set these environment variables in Vercel:

```txt
SANITY_STUDIO_PROJECT_ID=ks7qdg92
SANITY_STUDIO_DATASET=production
```

Do not add `SANITY_AUTH_TOKEN` to Vercel unless you intentionally run write/import
scripts from CI. Keep write tokens local and out of Git.

## Schema Order

1. Website Settings
2. Categories
3. Collections
4. Colours
5. Materials
6. Products
7. Homepage
8. Pages
9. Blog Posts

## Product Sheet Import

Drop CSV files into `google-sheet/`, then convert them to normalized JSON:

```bash
corepack yarn sheet:json
```

The converter writes JSON files to `google-sheet/generated/`.

Required CSV columns:

```txt
productName,sku,price,category
```

Optional CSV columns:

```txt
productKey,subCategory,inventoryCount,collections,materials,colour,size,imageUrls,compareAtPrice,shortDescription,description,isFeatured,isNewArrival,careInstructions,shippingInfo,seoTitle,seoDescription
```

Rules:

- `productKey` groups multiple SKUs into one frontend product. Leave it blank to generate it from `productName`.
- `sku` identifies one sellable variant.
- `category` is the main category. Use `subCategory` for child categories like `Stud` under `Earrings`.
- Do not enter category paths like `Earrings > Stud`.
- Blank `inventoryCount` defaults to `1`.
- `collections`, `materials`, and `imageUrls` can contain multiple values separated by commas, semicolons, or pipes.
- Blank optional taxonomy fields stay blank.
- Present but missing taxonomy values are auto-created with generated slugs and `active: true`.
- Blank `shortDescription` and `seoDescription` use product type defaults when available.

Preview Sanity changes without writing:

```bash
corepack yarn seed:products:dry
```

Write changes to Sanity:

```bash
corepack yarn seed:products
```

`seed:products` requires `SANITY_AUTH_TOKEN` in `.env.local`. Existing variants are matched by `sku` and only stock/price fields are updated.

For a simple Windows workflow, use the numbered scripts inside `google-sheet/`:

1. Double-click `1-convert-csv-to-json.cmd`.
2. Check the generated JSON in `google-sheet/generated/`.
3. Double-click `2-preview-sanity-import.cmd` and review the preview.
4. Double-click `3-push-to-sanity-production.cmd`, then type `PUSH` when asked.
