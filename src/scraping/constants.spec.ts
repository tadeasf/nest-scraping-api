import { RSS_SOURCES, getSourcesRecord } from './constants';

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
  });
});
