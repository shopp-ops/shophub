import { buildShopIdentity, slugify } from './shop-identity.util';

describe('slugify', () => {
  it('lowercases and replaces non-alphanumerics with single dashes', () => {
    expect(slugify('My Cool Shop!!')).toBe('my-cool-shop');
  });
  it('trims leading/trailing dashes', () => {
    expect(slugify('  --Shop--  ')).toBe('shop');
  });
  it('truncates to 40 chars without trailing dash', () => {
    const result = slugify('a'.repeat(50));
    expect(result).toHaveLength(40);
  });
  it('returns empty string for non-alphanumeric input', () => {
    expect(slugify('日本語')).toBe('');
  });
});

describe('buildShopIdentity', () => {
  const id = '7c9e6679-7425-40de-944b-e07fc1f90ae7';

  it('builds namespace and crName from slug and short id', () => {
    expect(buildShopIdentity(id, 'My Shop')).toEqual({
      namespace: 'shop-my-shop-7c9e6679',
      crName: 'my-shop-7c9e6679',
    });
  });
  it('falls back to shop-{shortId} when slug is empty', () => {
    expect(buildShopIdentity(id, '日本語')).toEqual({
      namespace: 'shop-7c9e6679',
      crName: 'shop-7c9e6679',
    });
  });
  it('keeps DNS-1123 length under 63 chars', () => {
    const { namespace } = buildShopIdentity(id, 'x'.repeat(80));
    expect(namespace.length).toBeLessThanOrEqual(63);
  });
});
