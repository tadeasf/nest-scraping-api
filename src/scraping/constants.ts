export interface RssSource {
  name: string;
  url: string;
}

export interface SiteConfig {
  selectors: string[];
  removeSelectors?: string[];
  delay?: number;
  userAgent?: string;
}

export const RSS_SOURCES: RssSource[] = [
  { name: 'idnes.cz', url: 'http://servis.idnes.cz/rss.asp' },
  { name: 'hn.cz-byznys', url: 'https://byznys.hn.cz/?m=rss' },
  { name: 'hn.cz-domaci', url: 'https://domaci.hn.cz/?m=rss' },
  { name: 'hn.cz-zahranicni', url: 'https://zahranicni.hn.cz/?m=rss' },
  { name: 'hn.cz-nazory', url: 'https://nazory.hn.cz/?m=rss' },
  { name: 'hn.cz-tech', url: 'https://tech.hn.cz/?m=rss' },
  {
    name: 'aktualne.cz',
    url: 'https://www.aktualne.cz/rss/?BBX_DEVICE=desktop&BBX_REAL_DEVICE=desktop',
  },
  { name: 'novinky.cz', url: 'https://www.novinky.cz/rss' },
  { name: 'blesk.cz', url: 'https://www.blesk.cz/rss' },
  { name: 'ct24.cz', url: 'https://ct24.ceskatelevize.cz/rss' },
  { name: 'ceskatelevize.cz', url: 'https://www.ceskatelevize.cz/rss/' },
  { name: 'e15.cz', url: 'https://www.e15.cz/rss' },
  { name: 'lidovky.cz', url: 'https://www.lidovky.cz/rss.aspx' },
  { name: 'sport.cz', url: 'https://www.sport.cz/rss' },
  { name: 'lupa.cz', url: 'https://www.lupa.cz/n/rss/' },
  { name: 'zive.cz', url: 'https://www.zive.cz/rss' },
  { name: 'super.cz', url: 'https://www.super.cz/rss' },
  { name: 'reflex.cz', url: 'https://www.reflex.cz/rss' },
  { name: 'forbes.cz', url: 'https://www.forbes.cz/rss' },
  { name: 'echo24.cz', url: 'https://echo24cz.webnode.cz/rss/all.xml' },
  { name: 'denik.cz', url: 'https://www.denik.cz/rss/zpravy.html' },
  // iROZHLAS sources
  { name: 'irozhlas.cz', url: 'https://www.irozhlas.cz/rss/irozhlas' },
  {
    name: 'irozhlas-domov',
    url: 'https://www.irozhlas.cz/rss/irozhlas/section/zpravy-domov',
  },
  {
    name: 'irozhlas-svet',
    url: 'https://www.irozhlas.cz/rss/irozhlas/section/zpravy-svet',
  },
  {
    name: 'irozhlas-veda-technologie',
    url: 'https://www.irozhlas.cz/rss/irozhlas/section/veda-technologie',
  },
  // České noviny sources
  {
    name: 'ceskenoviny-vse',
    url: 'https://www.ceskenoviny.cz/sluzby/rss/zpravy.php',
  },
  {
    name: 'ceskenoviny-cr',
    url: 'https://www.ceskenoviny.cz/sluzby/rss/cr.php',
  },
  {
    name: 'ceskenoviny-svet',
    url: 'https://www.ceskenoviny.cz/sluzby/rss/svet.php',
  },
];

// Configuration for different news sites for article content scraping
export const SITE_CONFIGS: Record<string, SiteConfig> = {
  'idnes.cz': {
    selectors: [
      '.article-content .text',
      '.article-content .perex',
      '.article-content p',
      '.text p',
      '.perex',
      '.article-content',
      '.text',
      'article .text',
      '.article-body',
      '.content',
      '.article p',
      'p',
    ],
    removeSelectors: [
      '.advertisement',
      '.social-share',
      '.comments',
      '.ad',
      '.banner',
    ],
    delay: 1000,
  },
  'hn.cz': {
    selectors: [
      '.article-content .text',
      '.article-content p',
      '.text p',
      '.perex',
    ],
    removeSelectors: ['.advertisement', '.social-share'],
    delay: 1000,
  },
  'aktualne.cz': {
    selectors: [
      '.article-content .text',
      '.article-content p',
      '.text p',
      '.perex',
    ],
    removeSelectors: ['.advertisement', '.social-share'],
    delay: 1000,
  },
  'novinky.cz': {
    selectors: [
      '.article-content .text',
      '.article-content p',
      '.text p',
      '.perex',
      '.article-content',
      '.text',
      'article .text',
      '.article-body',
      '.content',
      '.article p',
      'p',
    ],
    removeSelectors: ['.advertisement', '.social-share', '.ad', '.banner'],
    delay: 1000,
  },
  'blesk.cz': {
    selectors: [
      '.article-content .text',
      '.article-content p',
      '.text p',
      '.perex',
      '.article-content',
      '.text',
      'article .text',
      '.article-body',
      '.content',
      '.article p',
      'p',
    ],
    removeSelectors: ['.advertisement', '.social-share', '.ad', '.banner'],
    delay: 1000,
  },
  'ct24.cz': {
    selectors: [
      '.article-content .text',
      '.article-content p',
      '.text p',
      '.perex',
    ],
    removeSelectors: ['.advertisement', '.social-share'],
    delay: 1000,
  },
  'ceskatelevize.cz': {
    selectors: [
      '.article-content .text',
      '.article-content p',
      '.text p',
      '.perex',
    ],
    removeSelectors: ['.advertisement', '.social-share'],
    delay: 1000,
  },
  'e15.cz': {
    selectors: [
      '.article-content .text',
      '.article-content p',
      '.text p',
      '.perex',
    ],
    removeSelectors: ['.advertisement', '.social-share'],
    delay: 1000,
  },
  'lidovky.cz': {
    selectors: [
      '.article-content .text',
      '.article-content p',
      '.text p',
      '.perex',
    ],
    removeSelectors: ['.advertisement', '.social-share'],
    delay: 1000,
  },
  'sport.cz': {
    selectors: [
      '.article-content .text',
      '.article-content p',
      '.text p',
      '.perex',
      '.article-content',
      '.text',
      'article .text',
      '.article-body',
      '.content',
      '.article p',
      'p',
    ],
    removeSelectors: ['.advertisement', '.social-share', '.ad', '.banner'],
    delay: 1000,
  },
  'lupa.cz': {
    selectors: [
      '.article-content .text',
      '.article-content p',
      '.text p',
      '.perex',
    ],
    removeSelectors: ['.advertisement', '.social-share'],
    delay: 1000,
  },
  'zive.cz': {
    selectors: [
      '.article-content .text',
      '.article-content p',
      '.text p',
      '.perex',
    ],
    removeSelectors: ['.advertisement', '.social-share'],
    delay: 1000,
  },
  'super.cz': {
    selectors: [
      '.article-content .text',
      '.article-content p',
      '.text p',
      '.perex',
    ],
    removeSelectors: ['.advertisement', '.social-share'],
    delay: 1000,
  },
  'reflex.cz': {
    selectors: [
      '.article-content .text',
      '.article-content p',
      '.text p',
      '.perex',
    ],
    removeSelectors: ['.advertisement', '.social-share'],
    delay: 1000,
  },
  'forbes.cz': {
    selectors: [
      '.article-content .text',
      '.article-content p',
      '.text p',
      '.perex',
      '.article-content',
      '.text',
      'article .text',
      '.article-body',
      '.content',
      '.article p',
      'p',
    ],
    removeSelectors: ['.advertisement', '.social-share', '.ad', '.banner'],
    delay: 1000,
  },
  'echo24.cz': {
    selectors: [
      '.article-content .text',
      '.article-content p',
      '.text p',
      '.perex',
    ],
    removeSelectors: ['.advertisement', '.social-share'],
    delay: 1000,
  },
  'denik.cz': {
    selectors: [
      '.article-content .text',
      '.article-content p',
      '.text p',
      '.perex',
    ],
    removeSelectors: ['.advertisement', '.social-share'],
    delay: 1000,
  },
  'irozhlas.cz': {
    selectors: [
      '.article-content .text',
      '.article-content p',
      '.text p',
      '.perex',
    ],
    removeSelectors: ['.advertisement', '.social-share'],
    delay: 1000,
  },
  'ceskenoviny.cz': {
    selectors: [
      '.article-content .text',
      '.article-content p',
      '.text p',
      '.perex',
    ],
    removeSelectors: ['.advertisement', '.social-share'],
    delay: 1000,
  },
};

// Default site configuration for unknown sites
export const DEFAULT_SITE_CONFIG: SiteConfig = {
  selectors: [
    '.article-content .text',
    '.article-content p',
    '.text p',
    '.perex',
    '.article-content',
    '.text',
    'article .text',
    '.article-body',
    '.post-content',
    '.entry-content',
    '.content',
    '.article p',
    'main p',
    'article p',
    'p',
  ],
  removeSelectors: [
    '.advertisement',
    '.social-share',
    '.comments',
    '.ad',
    '.banner',
  ],
  delay: 1000,
};

// Paywall indicators for detecting paywalled content - VERY RESTRICTIVE
// Only detect real paywalls like hn.cz/ihned.cz
export const PAYWALL_INDICATORS = [
  'ihned.cz',
  'hn.cz',
  'předplatné ihned',
  'předplatné hn',
  'premium obsah ihned',
  'premium obsah hn',
  'přístup pouze pro předplatitele ihned',
  'přístup pouze pro předplatitele hn',
];

// Generic content selectors for fallback content extraction
export const GENERIC_CONTENT_SELECTORS = [
  'main',
  'article',
  '.main-content',
  '.content',
  '.article-body',
  '.post-content',
  '.entry-content',
  '.article-content',
  '.text',
  '.perex',
  '.article',
  '.post',
  '.entry',
];

// Known paywall sources that should be auto-skipped during scraping
// This saves time and resources by not attempting to scrape these sources
//
// Benefits:
// - Reduces unnecessary HTTP requests to known paywall sites
// - Improves scraping performance and reduces server load
// - Prevents wasting resources on content that cannot be accessed
// - Provides clear status tracking for skipped articles
//
// Current paywall sources:
// - echo24.cz: Complete paywall
// - hn.cz and all hn.cz-* variants: Complete paywall (ihned.cz)
export const KNOWN_PAYWALL_SOURCES = [
  'echo24.cz',
  'hn.cz',
  'hn.cz-byznys',
  'hn.cz-domaci',
  'hn.cz-zahranicni',
  'hn.cz-nazory',
  'hn.cz-tech',
];

// Helper function to get sources as a Record for validation
export const getSourcesRecord = (): Record<string, string> => {
  return RSS_SOURCES.reduce(
    (acc, source) => {
      acc[source.name] = source.url;
      return acc;
    },
    {} as Record<string, string>,
  );
};

// Helper function to get site configuration for a given source
export const getSiteConfig = (source: string): SiteConfig => {
  // Try exact match first
  if (SITE_CONFIGS[source]) {
    return SITE_CONFIGS[source];
  }

  // Try to match base domain inside the source name (e.g. 'hn.cz-byznys' -> 'hn.cz')
  const matchedKey = Object.keys(SITE_CONFIGS).find((key) =>
    source.includes(key),
  );

  if (matchedKey) {
    return SITE_CONFIGS[matchedKey];
  }

  // Fallback to default config
  return DEFAULT_SITE_CONFIG;
};
