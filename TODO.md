# TODO: Czech News Portals Scraper Enhancement

## Current Status
✅ **Currently Scraping:**
- idnes.cz - Working
- hn.cz (5 sections) - Working (byznys, domaci, zahranicni, nazory, tech)
- aktualne.cz - Working
- novinky.cz - Working
- blesk.cz - Working

## Missing Major Czech News Portals

### 🏛️ **Major News Portals**
- [ ] **ct24.cz** - Czech Television 24 (public broadcaster)
- [ ] **ceskatelevize.cz** - Czech Television main site
- [ ] **ceskyden.cz** - Czech Day
- [ ] **denik.cz** - Deník (regional newspapers)
- [ ] **lidovky.cz** - Lidové noviny
- [ ] **mfdnes.cz** - Mladá fronta DNES
- [ ] **právo.cz** - Právo
- [ ] **euro.cz** - Euro (business weekly)
- [ ] **respekt.cz** - Respekt (weekly magazine)
- [ ] **tyden.cz** - Týden (weekly magazine)

### 📰 **Regional News Portals**
- [ ] **brnensky.denik.cz** - Brno regional news
- [ ] **ostravsky.denik.cz** - Ostrava regional news
- [ ] **plzensky.denik.cz** - Plzeň regional news
- [ ] **liberecky.denik.cz** - Liberec regional news
- [ ] **karlovarsky.denik.cz** - Karlovy Vary regional news
- [ ] **ustecky.denik.cz** - Ústí nad Labem regional news
- [ ] **pardubicky.denik.cz** - Pardubice regional news
- [ ] **jihocesky.denik.cz** - South Bohemia regional news
- [ ] **kralovehradecky.denik.cz** - Hradec Králové regional news
- [ ] **zlinsky.denik.cz** - Zlín regional news

### 💼 **Business & Economy**
- [ ] **ihned.cz** - Hospodářské noviny (already covered via hn.cz)
- [ ] **e15.cz** - E15 (business daily)
- [ ] **profit.cz** - Profit (business magazine)
- [ ] **forbes.cz** - Forbes Czech Republic
- [ ] **ekonom.cz** - Ekonom (business weekly)

### 🏃 **Sports**
- [ ] **isport.blesk.cz** - iSport (already part of Blesk)
- [ ] **sport.cz** - Sport.cz
- [ ] **fotbal.cz** - Czech Football Association
- [ ] **hokej.cz** - Czech Ice Hockey Association

### 🎭 **Entertainment & Lifestyle**
- [ ] **super.cz** - Super (celebrity news)
- [ ] **ahaonline.cz** - Aha! (celebrity news)
- [ ] **reflex.cz** - Reflex (weekly magazine)
- [ ] **instinkt.cz** - Instinkt (men's magazine)
- [ ] **zena.cz** - Žena.cz (women's portal)

### 🔬 **Technology & Science**
- [ ] **lupa.cz** - Lupa.cz (technology news)
- [ ] **zive.cz** - Živě.cz (technology reviews)
- [ ] **mobilmania.cz** - MobilMania (mobile tech)
- [ ] **svethardware.cz** - Svět hardware (PC hardware)

### 🏥 **Health & Medicine**
- [ ] **idnes.cz/zdravi** - iDNES Health section
- [ ] **novinky.cz/zdravi** - Novinky Health section

### 🏠 **Real Estate**
- [ ] **sreality.cz** - Sreality (real estate portal)
- [ ] **bezrealitky.cz** - Bezrealitky (real estate)
- [ ] **reality.idnes.cz** - iDNES Reality

## Implementation Priority

### High Priority (Major Traffic)
1. **ct24.cz** - Public broadcaster, high credibility
2. **denik.cz** - Regional news network
3. **mfdnes.cz** - Major daily newspaper
4. **lidovky.cz** - Major daily newspaper

### Medium Priority (Specialized Content)
1. **e15.cz** - Business news
2. **respekt.cz** - Investigative journalism
3. **sport.cz** - Sports news
4. **lupa.cz** - Technology news

### Low Priority (Entertainment)
1. **super.cz** - Celebrity news
2. **ahaonline.cz** - Celebrity news
3. **reflex.cz** - Weekly magazine

## Technical Notes

### RSS Feed Discovery
- Most Czech news sites use standard RSS feed patterns:
  - `/rss` or `/feed` for main feeds
  - `/rss/kategorie/[category]` for category-specific feeds
  - `/export-rss` for custom feeds

### Content Enhancement Opportunities
- **Images**: Most RSS feeds include image URLs
- **Authors**: Many sites provide author information
- **Categories**: Most sites categorize articles
- **Publication Dates**: Standard in RSS feeds
- **Content Snippets**: Available in description fields

### Anti-Scraping Considerations
- Some sites may have rate limiting
- Consider implementing delays between requests
- Monitor for changes in RSS feed structure
- Some sites may require user agents

## Next Steps

1. **Research RSS feeds** for each missing portal
2. **Test feed availability** and content quality
3. **Implement new sources** in scraping service
4. **Add source-specific parsing** for unique content structures
5. **Monitor scraping success rates** and adjust as needed
6. **Consider implementing** category-based filtering
7. **Add source metadata** (credibility score, content type, etc.)

## Database Schema Updates Needed

Consider adding these fields to the Article entity:
- `category` - Article category/topic
- `credibility_score` - Source credibility rating
- `content_type` - News, opinion, analysis, etc.
- `language` - Language of the article (cs/en)
- `word_count` - Article length
- `tags` - Article tags/keywords

## Monitoring & Analytics

- Track scraping success rates per source
- Monitor content quality and completeness
- Analyze most popular sources and categories
- Track article freshness and update frequency
- Monitor for RSS feed changes or outages 