import { Product } from '../types';

export function normalizeSearchString(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics / accents
    .replace(/\s+/g, ' '); // Collapse whitespace
}

export function searchProducts(products: Product[], query: string, limit = 50): Product[] {
  const cleanQuery = normalizeSearchString(query);
  if (!cleanQuery) {
    return products.slice(0, limit);
  }

  const queryTokens = cleanQuery.split(' ').filter(Boolean);

  // Score each product for best relevance
  const scored: { product: Product; score: number }[] = [];

  for (const product of products) {
    const normCode = normalizeSearchString(product.code);
    const normDesc = normalizeSearchString(product.description);
    const normAlt = normalizeSearchString(product.alternative_code || '');

    // Check if query matches code directly (highest priority)
    if (normCode === cleanQuery) {
      scored.push({ product, score: 1000 });
      continue;
    }

    if (normCode.startsWith(cleanQuery)) {
      scored.push({ product, score: 500 });
      continue;
    }

    if (normAlt === cleanQuery) {
      scored.push({ product, score: 400 });
      continue;
    }

    if (normAlt.startsWith(cleanQuery)) {
      scored.push({ product, score: 300 });
      continue;
    }

    // Check if all tokens match anywhere across code, description, or alt_code
    const allTokensMatch = queryTokens.every(token => {
      return (
        normCode.includes(token) ||
        normDesc.includes(token) ||
        normAlt.includes(token)
      );
    });

    if (allTokensMatch) {
      // Calculate relevance score
      let score = 100;
      if (normCode.includes(cleanQuery)) score += 80;
      if (normAlt.includes(cleanQuery)) score += 50;
      if (normDesc.startsWith(cleanQuery)) score += 40;
      else if (normDesc.includes(cleanQuery)) score += 20;

      scored.push({ product, score });
    }
  }

  // Sort by highest score first, then alphabetically by code
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.product.code.localeCompare(b.product.code, undefined, { numeric: true });
  });

  return scored.slice(0, limit).map(item => item.product);
}
