const normalize = (value: string): string => value.trim().toLowerCase().replace(/\s+/g, ' ');

const MAX_SUGGESTION_POOL = 250;

export const buildAutosuggestions = (
  query: string,
  pool: string[],
  limit: number = 6
): string[] => {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) {
    return [];
  }

  const queryWords = normalizedQuery.split(' ');
  const seenNormalized = new Set<string>();
  const ranked: { item: string; score: number; length: number }[] = [];

  for (const rawItem of pool) {
    const item = rawItem.trim();
    if (!item) {
      continue;
    }

    const normalizedItem = normalize(item);
    if (seenNormalized.has(normalizedItem)) {
      continue;
    }
    seenNormalized.add(normalizedItem);

    if (seenNormalized.size > MAX_SUGGESTION_POOL) {
      break;
    }

    let score = 0;
    if (normalizedItem.startsWith(normalizedQuery)) {
      score = 5;
    } else if (normalizedItem.includes(normalizedQuery)) {
      score = 4;
    } else {
      const itemWords = normalizedItem.split(' ');
      const allWordsMatch = queryWords.every((word) =>
        itemWords.some((itemWord) => itemWord.startsWith(word) || itemWord.includes(word))
      );

      if (allWordsMatch) {
        score = 3;
      }
    }

    if (score > 0) {
      ranked.push({ item, score, length: item.length });
    }
  }

  ranked.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return a.length - b.length;
  });

  return ranked.slice(0, limit).map((entry) => entry.item);
};
