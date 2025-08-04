export interface RssSource {
    name: string;
    url: string;
}

export const RSS_SOURCES: RssSource[] = [
    { name: 'idnes.cz', url: 'http://servis.idnes.cz/rss.asp' },
    { name: 'hn.cz-byznys', url: 'https://byznys.hn.cz/?m=rss' },
    { name: 'hn.cz-domaci', url: 'https://domaci.hn.cz/?m=rss' },
    { name: 'hn.cz-zahranicni', url: 'https://zahranicni.hn.cz/?m=rss' },
    { name: 'hn.cz-nazory', url: 'https://nazory.hn.cz/?m=rss' },
    { name: 'hn.cz-tech', url: 'https://tech.hn.cz/?m=rss' },
    { name: 'aktualne.cz', url: 'https://www.aktualne.cz/rss/?BBX_DEVICE=desktop&BBX_REAL_DEVICE=desktop' },
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
    { name: 'irozhlas-domov', url: 'https://www.irozhlas.cz/rss/irozhlas/section/zpravy-domov' },
    { name: 'irozhlas-svet', url: 'https://www.irozhlas.cz/rss/irozhlas/section/zpravy-svet' },
    { name: 'irozhlas-veda-technologie', url: 'https://www.irozhlas.cz/rss/irozhlas/section/veda-technologie' },
    // České noviny sources
    { name: 'ceskenoviny-vse', url: 'https://www.ceskenoviny.cz/sluzby/rss/zpravy.php' },
    { name: 'ceskenoviny-cr', url: 'https://www.ceskenoviny.cz/sluzby/rss/cr.php' },
    { name: 'ceskenoviny-svet', url: 'https://www.ceskenoviny.cz/sluzby/rss/svet.php' },
];

// Helper function to get sources as a Record for validation
export const getSourcesRecord = (): Record<string, string> => {
    return RSS_SOURCES.reduce((acc, source) => {
        acc[source.name] = source.url;
        return acc;
    }, {} as Record<string, string>);
}; 