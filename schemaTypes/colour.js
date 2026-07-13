import { defineField, defineType } from "sanity";

export const colour = defineType({
  name: "colour",
  title: "Colour",
  type: "document",
  fields: [
    defineField({
      name: "title",
      title: "Colour Name",
      type: "string",
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "slug",
      title: "Slug",
      type: "slug",
      options: { source: "title" },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "hexCode",
      title: "Hex Code",
      type: "string",
      description: "Example: #800000",
      validation: (Rule) =>
        Rule.regex(/^#([0-9A-Fa-f]{3}){1,2}$/, {
          name: "hex colour",
          invert: false,
        }).warning("Use a valid hex colour such as #800000."),
    }),
    defineField({
      name: "active",
      title: "Active",
      type: "boolean",
      initialValue: true,
    }),
  ],
  preview: {
    select: {
      title: "title",
      subtitle: "hexCode",
    },
  },
});
