import { defineArrayMember, defineField, defineType } from "sanity";

export const homePage = defineType({
  name: "homePage",
  title: "Homepage",
  type: "document",
  fields: [
    defineField({
      name: "heroTitle",
      title: "Hero Title",
      type: "string",
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "heroSubtitle",
      title: "Hero Subtitle",
      type: "text",
      rows: 3,
    }),
    defineField({
      name: "heroImage",
      title: "Hero Image",
      type: "image",
      options: { hotspot: true },
    }),
    defineField({
      name: "heroButtonText",
      title: "Hero Button Text",
      type: "string",
    }),
    defineField({
      name: "heroButtonLink",
      title: "Hero Button Link",
      type: "string",
    }),
    defineField({
      name: "featuredCategories",
      title: "Featured Categories",
      type: "array",
      of: [
        defineArrayMember({
          type: "reference",
          to: [{ type: "category" }],
        }),
      ],
    }),
    defineField({
      name: "featuredProducts",
      title: "Featured Products",
      type: "array",
      of: [
        defineArrayMember({
          type: "reference",
          to: [{ type: "product" }],
        }),
      ],
    }),
    defineField({
      name: "featuredCollections",
      title: "Featured Collections",
      type: "array",
      of: [
        defineArrayMember({
          type: "reference",
          to: [{ type: "collection" }],
        }),
      ],
    }),
    defineField({
      name: "seoTitle",
      title: "SEO Title",
      type: "string",
      validation: (Rule) => Rule.max(60),
    }),
    defineField({
      name: "seoDescription",
      title: "SEO Description",
      type: "text",
      rows: 3,
      validation: (Rule) => Rule.max(160),
    }),
  ],
  preview: {
    select: {
      title: "heroTitle",
      media: "heroImage",
    },
  },
});
