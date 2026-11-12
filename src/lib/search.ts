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

interface IndexedProduct {
  product: Product;
  code: string;
  description: string;
  alternativeCode: string;
}

const searchIndexCache = new WeakMap<Product[], IndexedProduct[]>();
const codeCollator = new Intl.Collator('it', { numeric: true, sensitivity: 'base' });

function getSearchIndex(products: Product[]): IndexedProduct[] {
  const cached = searchIndexCache.get(products);
  if (cached) return cached;

  const index = products.map(product => ({
    product,
    code: normalizeSearchString(product.code),
    description: normalizeSearchString(product.description),
    alternativeCode: normalizeSearchString(product.alternative_code || ''),
  }));
  searchIndexCache.set(products, index);
  return index;
}

export function searchProducts(products: Product[], query: string, limit = 50): Product[] {
  const cleanQuery = normalizeSearchString(query);
  if (!cleanQuery) return products.slice(0, limit);

  const queryTokens = cleanQuery.split(' ').filter(Boolean);
  const index = getSearchIndex(products);
  const best: Array<{ entry: IndexedProduct; score: number }> = [];

  // Keep only the best matches while scanning. Avoid sorting thousands of
  // matches on broad queries; the catalog strings are normalized only once
  // for each products array, not again on every key press.
  for (const entry of index) {
    const { code, description, alternativeCode } = entry;
    let score = 0;

    if (code === cleanQuery) score = 1000;
    else if (code.startsWith(cleanQuery)) score = 500;
    else if (alternativeCode === cleanQuery) score = 400;
    else if (alternativeCode.startsWith(cleanQuery)) score = 300;
    else {
      const allTokensMatch = queryTokens.every(token =>
        code.includes(token) || description.includes(token) || alternativeCode.includes(token)
      );
      if (!allTokensMatch) continue;

      score = 100;
      if (code.includes(cleanQuery)) score += 80;
      if (alternativeCode.includes(cleanQuery)) score += 50;
      if (description.startsWith(cleanQuery)) score += 40;
      else if (description.includes(cleanQuery)) score += 20;
    }

    const candidate = { entry, score };
    let insertAt = best.length;
    while (insertAt > 0) {
      const previous = best[insertAt - 1];
      const comesBefore =
        score > previous.score ||
        (score === previous.score &&
          codeCollator.compare(entry.product.code, previous.entry.product.code) < 0);
      if (!comesBefore) break;
      insertAt--;
    }

    if (insertAt < limit) {
      best.splice(insertAt, 0, candidate);
      if (best.length > limit) best.pop();
    } else if (best.length < limit) {
      best.push(candidate);
    }
  }

  return best.map(match => match.entry.product);
}
