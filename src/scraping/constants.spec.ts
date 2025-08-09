import {
  RSS_SOURCES,
  getSourcesRecord,
  KNOWN_PAYWALL_SOURCES,
  getSiteConfig,
  DEFAULT_SITE_CONFIG,
} from './constants';

describe('Constants', () => {
  describe('RSS_SOURCES', () => {
    it('should contain valid RSS sources', () => {
      expect(RSS_SOURCES).toBeDefined();
      expect(Array.isArray(RSS_SOURCES)).toBe(true);
      expect(RSS_SOURCES.length).toBeGreaterThan(0);
    });

    it('should have valid source structure', () => {
      RSS_SOURCES.forEach((source) => {
        expect(source).toHaveProperty('name');
        expect(source).toHaveProperty('url');
        expect(typeof source.name).toBe('string');
        expect(typeof source.url).toBe('string');
        expect(source.name.length).toBeGreaterThan(0);
        expect(source.url.length).toBeGreaterThan(0);
      });
    });

    it('should have unique source names', () => {
      const names = RSS_SOURCES.map((source) => source.name);
      const uniqueNames = new Set(names);
      expect(uniqueNames.size).toBe(names.length);
    });

    it('should have valid URLs', () => {
      RSS_SOURCES.forEach((source) => {
        expect(source.url).toMatch(/^https?:\/\//);
      });
    });
  });

  describe('getSourcesRecord', () => {
    it('should return a record with source names as keys and URLs as values', () => {
      const sourcesRecord = getSourcesRecord();

      expect(typeof sourcesRecord).toBe('object');
      expect(Object.keys(sourcesRecord)).toHaveLength(RSS_SOURCES.length);

      RSS_SOURCES.forEach((source) => {
        expect(sourcesRecord[source.name]).toBe(source.url);
      });
    });

    it('should not have duplicate keys', () => {
      const sourcesRecord = getSourcesRecord();
      const keys = Object.keys(sourcesRecord);
      const uniqueKeys = new Set(keys);
      expect(uniqueKeys.size).toBe(keys.length);
    });

    it('should return immutable record', () => {
      const sourcesRecord1 = getSourcesRecord();
      const sourcesRecord2 = getSourcesRecord();

      expect(sourcesRecord1).toEqual(sourcesRecord2);
      expect(sourcesRecord1).not.toBe(sourcesRecord2); // Different objects
    });

    it('should contain all expected source types', () => {
      const sourcesRecord = getSourcesRecord();

      // Check that all sources from RSS_SOURCES are present in the record
      RSS_SOURCES.forEach((source) => {
        expect(sourcesRecord[source.name]).toBeDefined();
        expect(typeof sourcesRecord[source.name]).toBe('string');
        expect(sourcesRecord[source.name]).toMatch(/^https?:\/\//);
        expect(sourcesRecord[source.name]).toBe(source.url);
      });

      // Check that the number of sources matches
      expect(Object.keys(sourcesRecord)).toHaveLength(RSS_SOURCES.length);
    });
  });

  describe('KNOWN_PAYWALL_SOURCES', () => {
    it('should contain known paywall sources', () => {
      expect(KNOWN_PAYWALL_SOURCES).toBeDefined();
      expect(Array.isArray(KNOWN_PAYWALL_SOURCES)).toBe(true);
      expect(KNOWN_PAYWALL_SOURCES.length).toBeGreaterThan(0);
    });

    it('should contain expected paywall sources', () => {
      expect(KNOWN_PAYWALL_SOURCES).toContain('echo24.cz');
      expect(KNOWN_PAYWALL_SOURCES).toContain('hn.cz');
      expect(KNOWN_PAYWALL_SOURCES).toContain('hn.cz-byznys');
      expect(KNOWN_PAYWALL_SOURCES).toContain('hn.cz-domaci');
      expect(KNOWN_PAYWALL_SOURCES).toContain('hn.cz-zahranicni');
      expect(KNOWN_PAYWALL_SOURCES).toContain('hn.cz-nazory');
      expect(KNOWN_PAYWALL_SOURCES).toContain('hn.cz-tech');
    });

    it('should have unique source names', () => {
      const uniqueSources = new Set(KNOWN_PAYWALL_SOURCES);
      expect(uniqueSources.size).toBe(KNOWN_PAYWALL_SOURCES.length);
    });

    it('should not contain non-paywall sources', () => {
      expect(KNOWN_PAYWALL_SOURCES).not.toContain('idnes.cz');
      expect(KNOWN_PAYWALL_SOURCES).not.toContain('aktualne.cz');
      expect(KNOWN_PAYWALL_SOURCES).not.toContain('novinky.cz');
    });
  });

  describe('getSiteConfig', () => {
    it('should return exact config for known source key', () => {
      const cfg = getSiteConfig('novinky.cz');
      expect(cfg).toBeDefined();
      expect(Array.isArray(cfg.selectors)).toBe(true);
    });

    it('should match base domain inside composite source names', () => {
      const cfg = getSiteConfig('hn.cz-byznys');
      // Known site config for base domain 'hn.cz' should be returned
      expect(cfg).toBeDefined();
      expect(Array.isArray(cfg.selectors)).toBe(true);
    });

    it('should fall back to default config for unknown source', () => {
      const cfg = getSiteConfig('unknown.example');
      expect(cfg).toEqual(DEFAULT_SITE_CONFIG);
    });
  });
});
