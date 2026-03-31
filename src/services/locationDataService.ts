import { getIndiaPincode, type IndiaPincode, type PostOffice } from 'india-pincode/browser';
import { getAllStates, getDistricts } from 'india-state-district';
import { buildAutosuggestions } from '../utils/autosuggest';

type LocalityCacheEntry = {
  name: string;
  pincode: string;
  officeType: string;
  division: string;
};

const DISTRICT_PAGE_LIMIT = 500;
const POSTAL_API_TIMEOUT_MS = 6500;

let pincodeClientPromise: Promise<IndiaPincode> | null = null;
let cachedStates: string[] | null = null;
let statesPromise: Promise<string[]> | null = null;
let stateCodeByName: Map<string, string> | null = null;
const districtCache = new Map<string, string[]>();
const districtPromiseCache = new Map<string, Promise<string[]>>();
const localityCache = new Map<string, LocalityCacheEntry[]>();
const localityPromiseCache = new Map<string, Promise<RealLocalityOption[]>>();
const localitySearchCache = new Map<string, RealLocalityOption[]>();
const localitySearchPromiseCache = new Map<string, Promise<RealLocalityOption[]>>();
const stateOfficeCache = new Map<string, PostOffice[]>();
const stateOfficePromiseCache = new Map<string, Promise<PostOffice[]>>();
const districtOfficePromiseCache = new Map<string, Promise<PostOffice[]>>();

const normalize = (value: string) => value.trim().toLowerCase();

const normalizeLoose = (value: string) =>
  value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const tokenAlias = (token: string): string => {
  const map: Record<string, string> = {
    purba: 'east',
    purbo: 'east',
    paschim: 'west',
    pashchim: 'west',
    uttar: 'north',
    dakshin: 'south',
    medinipur: 'medinipur',
    midnapore: 'medinipur',
  };

  return map[token] || token;
};

const normalizeDistrictTokens = (value: string): string[] =>
  normalizeLoose(value)
    .split(' ')
    .filter((token) => token.length > 1)
    .map(tokenAlias);

const levenshteinDistance = (a: string, b: string): number => {
  if (a === b) {
    return 0;
  }

  const rows = a.length + 1;
  const cols = b.length + 1;
  const matrix = Array.from({ length: rows }, () => new Array<number>(cols).fill(0));

  for (let i = 0; i < rows; i += 1) {
    matrix[i][0] = i;
  }

  for (let j = 0; j < cols; j += 1) {
    matrix[0][j] = j;
  }

  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[rows - 1][cols - 1];
};

const similarityRatio = (a: string, b: string): number => {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) {
    return 1;
  }

  const dist = levenshteinDistance(a, b);
  return 1 - dist / maxLen;
};

const toTitle = (value: string): string =>
  value
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');

const getDistrictAliasCandidates = (district: string): string[] => {
  const normalized = normalizeLoose(district);
  if (!normalized) {
    return [];
  }

  const directionMap: Array<{ from: RegExp; to: string }> = [
    { from: /\bpurba\b|\bpurbo\b/g, to: 'east' },
    { from: /\bpaschim\b|\bpashchim\b/g, to: 'west' },
    { from: /\buttar\b/g, to: 'north' },
    { from: /\bdakshin\b/g, to: 'south' },
  ];

  let directional = normalized;
  for (const entry of directionMap) {
    directional = directional.replace(entry.from, entry.to);
  }

  directional = directional.replace(/\bmidnapore\b/g, 'medinipur').replace(/\s+/g, ' ').trim();

  const candidates = new Set<string>([toTitle(district), toTitle(directional)]);
  const parts = directional.split(' ').filter(Boolean);
  const directionWord = parts.find((part) => ['east', 'west', 'north', 'south'].includes(part));

  if (directionWord) {
    const withoutDirection = parts.filter((part) => part !== directionWord).join(' ').trim();
    if (withoutDirection) {
      candidates.add(toTitle(`${withoutDirection} ${directionWord}`));
      candidates.add(toTitle(`${directionWord} ${withoutDirection}`));
    }
  }

  return [...candidates].filter(Boolean);
};

const toTitleCase = (value: string): string =>
  value
    .toLowerCase()
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const sortAlpha = (items: string[]) =>
  [...items].sort((a, b) => a.localeCompare(b, 'en-IN', { sensitivity: 'base' }));

const getPincodeClient = async (): Promise<IndiaPincode> => {
  if (!pincodeClientPromise) {
    pincodeClientPromise = getIndiaPincode();
  }

  return pincodeClientPromise;
};

export const prewarmLocalityDataset = async (): Promise<void> => {
  try {
    await getPincodeClient();
  } catch {
    // Ignore warmup failures and retry lazily when locality is requested.
  }
};

const resolvePincodeStateName = (state: string, availableStates: string[]): string => {
  const requested = normalizeLoose(state);
  const exact = availableStates.find((item) => normalizeLoose(item) === requested);
  if (exact) {
    return exact;
  }

  const aliasMap: Record<string, string[]> = {
    odisha: ['orissa'],
    uttarakhand: ['uttaranchal'],
  };

  const aliases = aliasMap[requested] || [];
  for (const alias of aliases) {
    const aliasMatch = availableStates.find((item) => normalizeLoose(item) === alias);
    if (aliasMatch) {
      return aliasMatch;
    }
  }

  const bySuggestion = buildAutosuggestions(state, availableStates, 1);
  if (bySuggestion.length > 0) {
    return bySuggestion[0];
  }

  return state;
};

const resolveDistrictName = (district: string, availableDistricts: string[]): string | null => {
  if (availableDistricts.length === 0) {
    return null;
  }

  const requested = normalizeLoose(district);
  const exact = availableDistricts.find((item) => normalizeLoose(item) === requested);
  if (exact) {
    return exact;
  }

  const suggested = buildAutosuggestions(district, availableDistricts, 1);
  if (suggested.length > 0) {
    return suggested[0];
  }

  const requestedTokens = new Set(normalizeDistrictTokens(district).filter((token) => token.length > 2));
  let best: { district: string; score: number } | null = null;

  for (const candidate of availableDistricts) {
    const normalized = normalizeLoose(candidate);
    const candidateTokens = new Set(normalizeDistrictTokens(candidate).filter((token) => token.length > 2));

    let score = 0;
    if (normalized.startsWith(requested) || requested.startsWith(normalized)) {
      score += 40;
    }
    if (normalized.includes(requested) || requested.includes(normalized)) {
      score += 30;
    }

    if (requestedTokens.size > 0 && candidateTokens.size > 0) {
      let overlap = 0;
      requestedTokens.forEach((token) => {
        if (candidateTokens.has(token)) {
          overlap += 1;
        }
      });

      score += Math.round((overlap / requestedTokens.size) * 50);
    }

    const nameSimilarity = similarityRatio(requested, normalized);
    if (nameSimilarity >= 0.7) {
      score += Math.round(nameSimilarity * 36);
    }

    if (!best || score > best.score) {
      best = { district: candidate, score };
    }
  }

  if (best && best.score >= 18) {
    return best.district;
  }

  const fallback = availableDistricts.find((item) => {
    const normalized = normalizeLoose(item);
    return normalized.includes(requested) || requested.includes(normalized);
  });

  return fallback || null;
};

const getStateOffices = async (state: string): Promise<PostOffice[]> => {
  const stateKey = normalize(state);
  const cached = stateOfficeCache.get(stateKey);
  if (cached) {
    return cached;
  }

  const inFlight = stateOfficePromiseCache.get(stateKey);
  if (inFlight) {
    return inFlight;
  }

  const loadPromise = (async () => {
    const client = await getPincodeClient();
    const availableStates = client.getAllStates();
    const resolvedStateName = resolvePincodeStateName(state, availableStates);
    const firstPage = client.getByState(resolvedStateName, { limit: DISTRICT_PAGE_LIMIT, page: 1 });

    if (!firstPage.success || !firstPage.data) {
      stateOfficeCache.set(stateKey, []);
      return [];
    }

    const offices: PostOffice[] = [...firstPage.data.data];
    for (let page = 2; page <= firstPage.data.totalPages; page += 1) {
      const nextPage = client.getByState(resolvedStateName, { limit: DISTRICT_PAGE_LIMIT, page });
      if (nextPage.success && nextPage.data) {
        offices.push(...nextPage.data.data);
      }
    }

    stateOfficeCache.set(stateKey, offices);
    return offices;
  })();

  stateOfficePromiseCache.set(stateKey, loadPromise);

  try {
    return await loadPromise;
  } finally {
    stateOfficePromiseCache.delete(stateKey);
  }
};

const getDistrictOffices = async (district: string): Promise<PostOffice[]> => {
  const districtKey = normalizeLoose(district);
  const inFlight = districtOfficePromiseCache.get(districtKey);
  if (inFlight) {
    return inFlight;
  }

  const loadPromise = (async () => {
    const client = await getPincodeClient();
    const firstPage = client.getByDistrict(district, { limit: DISTRICT_PAGE_LIMIT, page: 1 });

    if (!firstPage.success || !firstPage.data) {
      return [];
    }

    const offices: PostOffice[] = [...firstPage.data.data];
    for (let page = 2; page <= firstPage.data.totalPages; page += 1) {
      const nextPage = client.getByDistrict(district, { limit: DISTRICT_PAGE_LIMIT, page });
      if (nextPage.success && nextPage.data) {
        offices.push(...nextPage.data.data);
      }
    }

    return offices;
  })();

  districtOfficePromiseCache.set(districtKey, loadPromise);

  try {
    return await loadPromise;
  } finally {
    districtOfficePromiseCache.delete(districtKey);
  }
};

export type RealLocalityOption = {
  name: string;
  pincode: string;
  officeType: string;
  division: string;
};

type LocalityOffice = {
  area: string;
  pincode: string;
  officeType: string;
  division: string;
  delivery: boolean;
  state: string;
  district: string;
};

type PostalApiOffice = {
  Name?: string;
  Pincode?: string;
  BranchType?: string;
  Division?: string;
  DeliveryStatus?: string;
  State?: string;
  District?: string;
};

type PostalApiResponse = {
  Status?: string;
  PostOffice?: PostalApiOffice[] | null;
};

const trimCache = <T>(cache: Map<string, T>, maxSize: number) => {
  if (cache.size <= maxSize) {
    return;
  }

  const firstKey = cache.keys().next().value;
  if (firstKey) {
    cache.delete(firstKey);
  }
};

const toLocalityOptions = (offices: LocalityOffice[]): RealLocalityOption[] => {
  const byArea = new Map<string, LocalityCacheEntry & { priority: number }>();

  for (const office of offices) {
    const areaName = toTitleCase(office.area);
    const areaKey = normalize(areaName);
    if (!areaKey) {
      continue;
    }

    const priority = (office.delivery ? 2 : 0) + (office.officeType === 'HO' ? 2 : office.officeType === 'SO' ? 1 : 0);
    const current = byArea.get(areaKey);
    if (!current || priority > current.priority) {
      byArea.set(areaKey, {
        name: areaName,
        pincode: office.pincode,
        officeType: office.officeType,
        division: toTitleCase(office.division),
        priority,
      });
    }
  }

  return [...byArea.values()]
    .map(({ priority: _priority, ...entry }) => entry)
    .sort((a, b) => a.name.localeCompare(b.name, 'en-IN', { sensitivity: 'base' }));
};

const filterOfficesByRegion = (offices: LocalityOffice[], state: string, district: string): LocalityOffice[] => {
  const stateNorm = normalizeLoose(state);
  const districtNorm = normalizeLoose(district);

  const strict = offices.filter(
    (office) => normalizeLoose(office.state) === stateNorm && normalizeLoose(office.district) === districtNorm
  );
  if (strict.length > 0) {
    return strict;
  }

  const stateOnly = offices.filter((office) => normalizeLoose(office.state) === stateNorm);
  if (stateOnly.length > 0) {
    return stateOnly;
  }

  return offices;
};

const fetchPostalApiOffices = async (query: string, isPinQuery: boolean): Promise<LocalityOffice[]> => {
  const endpoint = isPinQuery
    ? `https://api.postalpincode.in/pincode/${encodeURIComponent(query)}`
    : `https://api.postalpincode.in/postoffice/${encodeURIComponent(query)}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, POSTAL_API_TIMEOUT_MS);

  try {
    const response = await fetch(endpoint, { signal: controller.signal });
    if (!response.ok) {
      return [];
    }

    const body = (await response.json()) as PostalApiResponse[];
    if (!Array.isArray(body)) {
      return [];
    }

    const raw = body.flatMap((item) => item.PostOffice || []);
    return raw
      .map((office): LocalityOffice | null => {
        const area = (office.Name || '').trim();
        const pincode = (office.Pincode || '').trim();
        if (!area || !pincode) {
          return null;
        }

        return {
          area,
          pincode,
          officeType: (office.BranchType || 'BO').trim(),
          division: (office.Division || '').trim(),
          delivery: (office.DeliveryStatus || '').trim().toLowerCase() === 'delivery',
          state: (office.State || '').trim(),
          district: (office.District || '').trim(),
        };
      })
      .filter((office): office is LocalityOffice => office !== null);
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
};

export const getRealIndianStates = async (): Promise<string[]> => {
  if (cachedStates) {
    return cachedStates;
  }

  if (statesPromise) {
    return statesPromise;
  }

  statesPromise = Promise.resolve().then(() => {
    const statesWithCodes = getAllStates();
    stateCodeByName = new Map(
      statesWithCodes.map((state) => [normalize(state.name), state.code])
    );

    const states = statesWithCodes.map((state) => toTitleCase(state.name));
    cachedStates = sortAlpha(Array.from(new Set(states)));
    return cachedStates;
  });

  try {
    return await statesPromise;
  } finally {
    statesPromise = null;
  }
};

export const getRealDistrictsByState = async (state: string): Promise<string[]> => {
  const key = normalize(state);
  if (!key) {
    return [];
  }

  const cached = districtCache.get(key);
  if (cached) {
    return cached;
  }

  const inFlight = districtPromiseCache.get(key);
  if (inFlight) {
    return inFlight;
  }

  const loadPromise = (async () => {
    if (!stateCodeByName) {
      await getRealIndianStates();
    }

    const stateCode = stateCodeByName?.get(key);
    if (!stateCode) {
      return [];
    }

    const districts = sortAlpha(Array.from(new Set(getDistricts(stateCode).map((item) => toTitleCase(item)))));
    districtCache.set(key, districts);
    return districts;
  })();

  districtPromiseCache.set(key, loadPromise);

  try {
    return await loadPromise;
  } finally {
    districtPromiseCache.delete(key);
  }
};

export const getRealLocalitiesByDistrict = async (
  state: string,
  district: string
): Promise<RealLocalityOption[]> => {
  const stateKey = normalize(state);
  const districtKey = normalize(district);

  if (!stateKey || !districtKey) {
    return [];
  }

  const cacheKey = `${stateKey}|${districtKey}`;
  const cached = localityCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const inFlight = localityPromiseCache.get(cacheKey);
  if (inFlight) {
    return inFlight;
  }

  const loadPromise = (async () => {
    let districtOffices = await getDistrictOffices(district);

    if (districtOffices.length === 0) {
      const aliasCandidates = getDistrictAliasCandidates(district);
      for (const alias of aliasCandidates) {
        const aliasOffices = await getDistrictOffices(alias);
        if (aliasOffices.length > 0) {
          districtOffices = aliasOffices;
          break;
        }
      }
    }

    // Prefer strict state filtering, but keep a fallback because datasets use different naming conventions.
    let offices = districtOffices.filter((office) => normalizeLoose(office.state) === normalizeLoose(state));
    if (offices.length === 0) {
      offices = districtOffices;
    }

    if (offices.length === 0) {
      const stateOffices = await getStateOffices(state);
      const availableDistricts = Array.from(new Set(stateOffices.map((office) => office.district)));
      const resolvedDistrict = resolveDistrictName(district, availableDistricts);

      if (resolvedDistrict) {
        offices = stateOffices.filter(
          (office) => normalizeLoose(office.district) === normalizeLoose(resolvedDistrict)
        );
      }

      if (offices.length === 0) {
        const client = await getPincodeClient();
        const searchResults = client.search(`${district} ${state}`, { limit: DISTRICT_PAGE_LIMIT, page: 1 });
        if (searchResults.success && searchResults.data) {
          offices = searchResults.data.data.filter(
            (office) => normalizeLoose(office.state) === normalizeLoose(state)
          );
        }
      }
    }

    if (offices.length === 0) {
      return [];
    }

    const strictStateOffices = offices.filter((office) => normalizeLoose(office.state) === normalizeLoose(state));
    const usableOffices = strictStateOffices.length > 0 ? strictStateOffices : offices;

    const localities = toLocalityOptions(usableOffices);

    localityCache.set(cacheKey, localities);
    return localities;
  })();

  localityPromiseCache.set(cacheKey, loadPromise);

  try {
    return await loadPromise;
  } finally {
    localityPromiseCache.delete(cacheKey);
  }
};

export const searchRealLocalitiesByDistrictQuery = async (
  state: string,
  district: string,
  query: string,
  resultLimit = 220
): Promise<RealLocalityOption[]> => {
  const stateKey = normalize(state);
  const districtKey = normalize(district);
  const trimmedQuery = query.trim();

  if (!stateKey || !districtKey || !trimmedQuery) {
    return [];
  }

  const isNumeric = /^\d+$/.test(trimmedQuery);
  if (isNumeric && trimmedQuery.length !== 6) {
    return [];
  }

  const textNorm = normalizeLoose(trimmedQuery);
  if (!isNumeric && textNorm.length < 3) {
    return [];
  }

  const cacheKey = `${stateKey}|${districtKey}|${normalizeLoose(trimmedQuery)}|${resultLimit}`;
  const cached = localitySearchCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const inFlight = localitySearchPromiseCache.get(cacheKey);
  if (inFlight) {
    return inFlight;
  }

  const loadPromise = (async () => {
    const offices = await fetchPostalApiOffices(trimmedQuery, isNumeric);

    let scopedOffices = filterOfficesByRegion(offices, state, district);

    if (isNumeric) {
      scopedOffices = scopedOffices.filter((office) => office.pincode === trimmedQuery);
    } else {
      scopedOffices = scopedOffices.filter((office) => {
        const areaMatch = normalizeLoose(office.area).includes(textNorm);
        const divisionMatch = normalizeLoose(office.division).includes(textNorm);
        return areaMatch || divisionMatch;
      });
    }

    if (scopedOffices.length === 0) {
      return [];
    }

    const localities = toLocalityOptions(scopedOffices).slice(0, resultLimit);
    localitySearchCache.set(cacheKey, localities);
    trimCache(localitySearchCache, 240);
    return localities;
  })();

  localitySearchPromiseCache.set(cacheKey, loadPromise);

  try {
    return await loadPromise;
  } finally {
    localitySearchPromiseCache.delete(cacheKey);
  }
};
