export const defaultCareInstructions = `A Little Care Goes a Long Way ✨

Keep your jewellery away from water and perfume, and store it in a plastic pouch after use.

With a little love and care, your jewellery will stay beautiful and can be worn for a long time`;

export const defaultShippingInfo = "Once placed, your order will be delivered within 7-10 days.";

export function buildSeoTitle(productName) {
  return productName || "Roop Sandook Jewellery";
}

export function buildSeoDescription(product) {
  const description =
    product?.shortDescription ||
    product?.description ||
    `${product?.productName || product?.name || "Traditional jewellery"} from Roop Sandook.`;

  return description.length > 160 ? `${description.slice(0, 157).trim()}...` : description;
}
