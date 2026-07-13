# Roop Sandook Product Import Guide

Use this guide when adding or updating products from the spreadsheet CSV.

## The File To Update

Only update this file:

```txt
roop-sandook-cms/google-sheet/product-import.csv
```

Do not create extra CSV files in the `google-sheet` folder. The import scripts now read only `product-import.csv`.

## The 3 Steps

Open the `roop-sandook-cms/google-sheet` folder and run these files in order:

1. `1-convert-csv-to-json.cmd`
   - Checks `product-import.csv`.
   - Stops if required data is missing or wrong.
   - Creates `generated/product-import.json`.

2. `2-preview-sanity-import.cmd`
   - Shows what will be created or updated in Sanity.
   - Does not write anything.

3. `3-push-to-sanity-production.cmd`
   - Writes to Sanity production.
   - Only run this after Step 2 looks correct.
   - Type `PUSH` when asked.

## CSV Columns

Required columns:

| Column | What to enter |
|---|---|
| `productName` | Product display name |
| `sku` | Unique SKU for this variant |
| `price` | Selling price, numbers only |
| `category` | Main category, like `Necklace` or `Earrings` |

Optional columns:

| Column | What to enter |
|---|---|
| `productKey` | Optional stable lowercase product key, like `antique-gold-jhumka-pair`. Leave blank to generate it from `productName` |
| `compareAtPrice` | Original/MRP price, numbers only |
| `inventoryCount` | Stock quantity, whole number. Leave blank to use `1` |
| `subCategory` | Child category, like `Jhumka` or `Stud`. Leave blank when not present |
| `collections` | Separate multiple values with `;`, like `Festive Edit; Wedding Guest` |
| `materials` | Separate multiple values with `;`, like `Kundan; Pearl` |
| `colour` | Colour name, like `Gold`, `Pearl`, `Green` |
| `size` | Size for this SKU row, like `Free size`, `2.4`, or `Adjustable` |
| `imageUrls` | Public image URLs separated with `;` |
| `shortDescription` | Short product summary |
| `description` | Full product description |
| `careInstructions` | Leave blank to use the default care text |
| `shippingInfo` | Leave blank to use the default delivery text |
| `isFeatured` | Leave blank for no, or use `true` / `yes` |
| `isNewArrival` | Leave blank for no, or use `true` / `yes` |
| `seoTitle` | Leave blank to use product name |
| `seoDescription` | Leave blank to use product description |

## Defaults

If these columns are blank, the import fills them automatically:

| Column | Default |
|---|---|
| `isFeatured` | `false` |
| `isNewArrival` | `false` |
| `inventoryCount` | `1` |
| `shippingInfo` | `Once placed, your order will be delivered within 7-10 days.` |
| `seoTitle` | Product name |
| `shortDescription` | Product type default when available |
| `seoDescription` | Product type default, then short description, then full description, then a simple product line |

Product type description defaults:

| Category | Sub-category | Default |
|---|---|---|
| `Earring` / `Earrings` | `Stud` | `Elegant traditional studs for special occasions.` |
| `Earring` / `Earrings` | `Jhumka` | `Classic traditional jhumkas with timeless charm.` |
| `Earring` / `Earrings` | `Dangler` | `Graceful traditional danglers for festive elegance.` |
| `Ring` |  | `Traditional rings with delicate craftsmanship.` |
| `Pendant Set` |  | `Traditional pendant sets for ethnic elegance.` |
| `Nose Ring` |  | `Traditional nose rings for graceful charm.` |
| `Necklace` |  | `Traditional necklaces with timeless elegance.` |

Default care instructions:

```txt
A Little Care Goes a Long Way ✨

Keep your jewellery away from water and perfume, and store it in a plastic pouch after use.

With a little love and care, your jewellery will stay beautiful and can be worn for a long time
```

## Single Variant Example

```csv
productKey,productName,sku,price,compareAtPrice,inventoryCount,category,subCategory,collections,materials,colour,size,imageUrls,shortDescription,description,careInstructions,shippingInfo,isFeatured,isNewArrival,seoTitle,seoDescription
antique-gold-jhumka-pair,Antique Gold Jhumka Pair,RS-EAR-JHU-001-GOLD,899,1199,8,Earrings,Jhumka,Festive Edit; Wedding Guest,Antique Finish; Gold Plated,Gold,Free size,,Classic antique gold jhumka pair,Lightweight festive earrings for sarees and kurtas,,,,,,
```

## Multiple Variant Example

Use the same `productKey` and `productName`, but a different `sku` for each variant:

```csv
productKey,productName,sku,price,compareAtPrice,inventoryCount,category,subCategory,collections,materials,colour,size,imageUrls,shortDescription,description,careInstructions,shippingInfo,isFeatured,isNewArrival,seoTitle,seoDescription
kundan-jhumka,Kundan Jhumka,RS-EAR-JHU-010-GOLD,899,1199,8,Earrings,Jhumka,Festive Edit,Kundan; Gold Plated,Gold,Free size,,Classic kundan jhumka,Traditional jhumka for festive looks,,,,,,
kundan-jhumka,Kundan Jhumka,RS-EAR-JHU-010-PEARL,949,1299,5,Earrings,Jhumka,Festive Edit,Kundan; Pearl,Pearl,Adjustable,,Classic kundan jhumka,Traditional jhumka for festive looks,,,,,,
```

## Things To Check Before Step 3

- `productKey` uses only lowercase letters, numbers, and hyphens.
- If `productKey` is blank, it is generated from `productName`.
- All variants of the same product use the same `productKey`.
- Every row has a unique `sku`.
- `category` is filled.
- `subCategory` is filled only when a child category exists.
- Do not enter category paths like `Earrings > Stud`; use separate `category` and `subCategory` columns.
- `price` and `compareAtPrice` are numbers only.
- `compareAtPrice` is not lower than `price`.
- `inventoryCount` is blank or a whole number.
- `isFeatured` and `isNewArrival` are blank, `true`, `false`, `yes`, or `no`.
- Image URLs start with `http://` or `https://`.

## Common Errors

| Error | How to fix |
|---|---|
| Same product name appears with multiple product keys | Check spelling of `productKey`; all variants of one product need the same key |
| Same product key appears with multiple product names | Check spelling of `productName`; one key should belong to one product |
| Duplicate SKU | Make every variant SKU unique |
| Missing category | Fill the `category` column |
| Category contains `>` | Split it into `category` and `subCategory` |
| Invalid productKey | Use lowercase words with hyphens only |
| compareAtPrice should be greater than or equal to price | Correct the MRP/original price |

## Deleting Products Or Categories

Use the `Safe Delete` tool inside Sanity Studio.

- Products can be selected and deleted after typing `DELETE`.
- Categories, collections, colours, and materials cannot be deleted if products still use them.
- This prevents accidental broken product filters.
