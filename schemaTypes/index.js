import { blogPost } from "./blogPost";
import { category } from "./category";
import { collection } from "./collection";
import { colour } from "./colour";
import { homePage } from "./homePage";
import { material } from "./material";
import { page } from "./page";
import { product } from "./product";
import { siteSettings } from "./siteSettings";

export const schemaTypes = [
  siteSettings,
  category,
  collection,
  colour,
  material,
  product,
  homePage,
  page,
  blogPost,
];
