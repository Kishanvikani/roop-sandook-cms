import {
  CogIcon,
  HomeIcon,
  ImagesIcon,
  MasterDetailIcon,
  MasterDetailIcon as PaletteIcon,
  PackageIcon,
  TagsIcon,
} from "@sanity/icons";

const singleton = (S, type, title, icon) =>
  S.listItem()
    .title(title)
    .icon(icon)
    .child(S.document().schemaType(type).documentId(type).title(title));

const categoryList = (S, title, filter) =>
  S.documentList()
    .title(title)
    .schemaType("category")
    .filter(filter)
    .defaultOrdering([{ field: "displayOrder", direction: "asc" }, { field: "title", direction: "asc" }]);

const categoryGroup = (S) =>
  S.listItem()
    .title("Categories")
    .icon(TagsIcon)
    .child(
      S.list()
        .title("Categories")
        .items([
          S.listItem()
            .title("All Categories")
            .icon(TagsIcon)
            .child(categoryList(S, "All Categories", '_type == "category"')),
          S.listItem()
            .title("Parent Categories")
            .icon(TagsIcon)
            .child(categoryList(S, "Parent Categories", '_type == "category" && !defined(parentCategory)')),
          S.listItem()
            .title("Sub-categories")
            .icon(TagsIcon)
            .child(categoryList(S, "Sub-categories", '_type == "category" && defined(parentCategory)')),
        ]),
    );

export const structure = (S) =>
  S.list()
    .title("Roop Sandook CMS")
    .items([
      singleton(S, "siteSettings", "Website Settings", CogIcon),
      singleton(S, "homePage", "Homepage", HomeIcon),
      S.divider(),
      S.documentTypeListItem("product").title("Products").icon(PackageIcon),
      categoryGroup(S),
      S.documentTypeListItem("collection").title("Collections").icon(ImagesIcon),
      S.documentTypeListItem("colour").title("Colours").icon(PaletteIcon),
      S.documentTypeListItem("material").title("Materials").icon(MasterDetailIcon),
      S.divider(),
      ...S.documentTypeListItems().filter(
        (item) =>
          ![
            "siteSettings",
            "homePage",
            "product",
            "category",
            "collection",
            "colour",
            "material",
          ].includes(item.getId()),
      ),
    ]);
