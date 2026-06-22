const MAX_SLUG = 40;

export interface ShopIdentity {
  namespace: string;
  crName: string;
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_SLUG)
    .replace(/-+$/g, '');
}

export function buildShopIdentity(id: string, name: string): ShopIdentity {
  const shortId = id.replace(/-/g, '').slice(0, 8);
  const slug = slugify(name);
  if (!slug) {
    const fallback = `shop-${shortId}`;
    return { namespace: fallback, crName: fallback };
  }
  return { namespace: `shop-${slug}-${shortId}`, crName: `${slug}-${shortId}` };
}
