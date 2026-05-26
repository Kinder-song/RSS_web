import Parser from 'rss-parser';

const parser = new Parser({
    customFields: {
        item: [
            ['media:content', 'mediaContent'],
            ['media:thumbnail', 'mediaThumbnail'],
            ['enclosure', 'enclosure'],
            ['media:group', 'mediaGroup']
        ]
    },
    timeout: 15000,
    headers: {
        'User-Agent': 'RSS Reader/1.0'
    }
});

export async function parseRSS(feedUrl) {
    const feed = await parser.parseURL(feedUrl);
    return feed.items.map(item => ({
        title: item.title || '无标题',
        url: item.link || item.guid || '',
        published_at: item.pubDate ? new Date(item.pubDate) : new Date(),
        cover_path: extractCover(item),
        content: item.content || item['content:encoded'] || item.summary || ''
    }));
}

function extractCover(item) {
    // 1. Check media:content
    if (item.mediaContent && item.mediaContent.$) {
        return item.mediaContent.$.url || null;
    }
    // 2. Check media:thumbnail
    if (item.mediaThumbnail && item.mediaThumbnail.$) {
        return item.mediaThumbnail.$.url || null;
    }
    // 3. Check enclosure for image type
    if (item.enclosure && item.enclosure.url &&
        item.enclosure.type && item.enclosure.type.startsWith('image')) {
        return item.enclosure.url;
    }
    // 4. Check media:group -> media:content
    if (item.mediaGroup && item.mediaGroup.mediaContent) {
        const mc = item.mediaGroup.mediaContent;
        if (Array.isArray(mc)) {
            for (const c of mc) {
                if (c.$ && c.$.url) return c.$.url;
            }
        } else if (mc.$ && mc.$.url) {
            return mc.$.url;
        }
    }
    // 5. Extract first meaningful image from content (broader pattern)
    const content = item.content || item['content:encoded'] || item.summary || '';
    // Match various img src patterns, skip tracking pixels and tiny images
    const imgMatches = [...content.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)];
    for (const match of imgMatches) {
        const src = match[1];
        if (src && !src.includes('pixel') && !src.includes('track') &&
            !src.includes('icon') && !src.includes('logo') &&
            !src.includes('placeholder')) {
            // Skip data URIs and tiny images
            if (src.startsWith('data:') || src.includes('/1x1.') || src.includes('/spacer.')) continue;
            return src;
        }
    }
    // 6. Extract og:image or twitter:image from content meta tags
    const ogMatch = content.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
                    content.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
    if (ogMatch && ogMatch[1]) return ogMatch[1];
    const twitterMatch = content.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i) ||
                        content.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i);
    if (twitterMatch && twitterMatch[1]) return twitterMatch[1];
    return null;
}

export async function fetchArticleCover(articleUrl) {
    try {
        const axios = (await import('axios')).default;
        const response = await axios.get(articleUrl, {
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            maxRedirects: 5,
            maxContentLength: 2 * 1024 * 1024
        });
        const html = response.data;
        // Try og:image first
        const ogMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
                        html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
        if (ogMatch && ogMatch[1]) return ogMatch[1];
        // Fallback: first large image in content
        const imgMatches = [...html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)];
        for (const match of imgMatches) {
            const src = match[1];
            if (src && !src.includes('pixel') && !src.includes('track') &&
                !src.includes('icon') && !src.includes('logo') &&
                !src.includes('placeholder') && !src.startsWith('data:')) {
                return src;
            }
        }
        return null;
    } catch {
        return null;
    }
}
