import { defineArrayMember, defineField, defineType } from "sanity";

import { MultiImageUploadInput } from "../components/MultiImageUploadInput";
import {
  defaultCareInstructions,
  defaultShippingInfo,
} from "./productDefaults";

export const product = defineType({
  name: "product",
  title: "Product",
  type: "document",
  fields: [
    defineField({
      name: "productKey",
      title: "Product Import Key",
      type: "string",
      description:
        "Stable lowercase key used by imports to group SKU variants. Example: antique-gold-jhumka-pair. Do not change after import unless intentional.",
      validation: (Rule) =>
        Rule.required().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
          name: "product key",
          invert: false,
        }),
    }),
    defineField({
      name: "name",
      title: "Product Name",
      type: "string",
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "slug",
      title: "Slug",
      type: "slug",
      options: { source: "name" },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "category",
      title: "Category / Sub-category",
      type: "reference",
      to: [{ type: "category" }],
      description:
        "Select a parent category when there is no sub-category. Select the child category when the product belongs under one, for example Stud under Earrings.",
      validation: (Rule) => Rule.required(),
    }),
    // defineField({
    //   name: "collections",
    //   title: "Collections",
    //   type: "array",
    //   of: [
    //     defineArrayMember({
    //       type: "reference",
    //       to: [{ type: "collection" }],
    //     }),
    //   ],
    // }),
    defineField({
      name: "materials",
      title: "Materials",
      type: "array",
      of: [
        defineArrayMember({
          type: "reference",
          to: [{ type: "material" }],
        }),
      ],
    }),
    // defineField({
    //   name: "size",
    //   title: "Size",
    //   type: "string",
    //   description: "Optional product size text shown on the product detail page.",
    // }),
    // defineField({
    //   name: "images",
    //   title: "Product Images",
    //   type: "array",
    //   of: [
    //     defineArrayMember({
    //       type: "image",
    //       options: { hotspot: true },
    //     }),
    //   ],
    //   validation: (Rule) => Rule.min(1).warning("Add at least one product image when available."),
    //   components: {
    //     input: MultiImageUploadInput,
    //   },
    // }),
    defineField({
      name: "variants",
      title: "Sellable Variants",
      type: "array",
      of: [
        defineArrayMember({
          type: "object",
          name: "productVariant",
          title: "Variant",
          fields: [
            defineField({
              name: "sku",
              title: "SKU",
              type: "string",
              validation: (Rule) => Rule.required(),
            }),
            defineField({
              name: "colour",
              title: "Colour",
              type: "reference",
              to: [{ type: "colour" }],
            }),
            defineField({
              name: "size",
              title: "Size",
              type: "string",
              description: "Optional size for this SKU, for example Free size, 2.4, or Adjustable.",
            }),
            defineField({
              name: "price",
              title: "Price",
              type: "number",
              validation: (Rule) => Rule.required().min(0),
            }),
            defineField({
              name: "compareAtPrice",
              title: "Compare At Price",
              type: "number",
              validation: (Rule) => Rule.min(0),
            }),
            defineField({
              name: "inventoryCount",
              title: "Inventory Count",
              type: "number",
              initialValue: 1,
              validation: (Rule) => Rule.required().integer().min(0),
            }),
            defineField({
              name: "inStock",
              title: "In Stock",
              type: "boolean",
              initialValue: true,
            }),
            defineField({
              name: "images",
              title: "Variant Images",
              type: "array",
              of: [
                defineArrayMember({
                  type: "image",
                  options: { hotspot: true },
                }),
              ],
              components: {
                input: MultiImageUploadInput,
              },
            }),
          ],
          preview: {
            select: {
              sku: "sku",
              colour: "colour.title",
              price: "price",
              inventoryCount: "inventoryCount",
            },
            prepare({ sku, colour, price, inventoryCount }) {
              const stockLabel = inventoryCount > 0 ? `${inventoryCount} in stock` : "Sold out";
              return {
                title: colour ? `${sku} - ${colour}` : sku,
                subtitle: price ? `Rs. ${price} - ${stockLabel}` : stockLabel,
              };
            },
          },
        }),
      ],
      validation: (Rule) => Rule.required().min(1),
    }),
    defineField({
      name: "shortDescription",
      title: "Short Description",
      type: "text",
      rows: 3,
    }),
    defineField({
      name: "description",
      title: "Full Description",
      type: "text",
      rows: 6,
    }),
    defineField({
      name: "isFeatured",
      title: "Featured Product",
      type: "boolean",
      initialValue: false,
    }),
    defineField({
      name: "isNewArrival",
      title: "New Arrival",
      type: "boolean",
      initialValue: false,
    }),
    defineField({
      name: "careInstructions",
      title: "Care Instructions",
      type: "text",
      rows: 4,
      initialValue: defaultCareInstructions,
    }),
    defineField({
      name: "shippingInfo",
      title: "Shipping Info",
      type: "text",
      rows: 4,
      initialValue: defaultShippingInfo,
    }),
    defineField({
      name: "seoTitle",
      title: "SEO Title",
      type: "string",
      description: "Optional. Leave blank to use the product name automatically.",
      validation: (Rule) => Rule.max(60),
    }),
    defineField({
      name: "seoDescription",
      title: "SEO Description",
      type: "text",
      rows: 3,
      description: "Optional. Leave blank to use the product description automatically.",
      validation: (Rule) => Rule.max(160),
    }),
  ],
  preview: {
    select: {
      title: "name",
      variants: "variants",
      media: "images.0",
    },
    prepare({ title, variants = [], media }) {
      const variantCount = variants.length;
      const totalStock = variants.reduce((sum, variant) => sum + (variant.inventoryCount || 0), 0);
      const firstPrice = variants.find((variant) => typeof variant.price === "number")?.price;
      const stockLabel = totalStock > 0 ? `${totalStock} in stock` : "Sold out";
      const variantLabel = variantCount === 1 ? "1 variant" : `${variantCount} variants`;
      return {
        title,
        subtitle: firstPrice
          ? `From Rs. ${firstPrice} - ${variantLabel} - ${stockLabel}`
          : `${variantLabel} - ${stockLabel}`,
        media,
      };
    },
  },
});
