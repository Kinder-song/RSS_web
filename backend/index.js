import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cron from 'node-cron';
import rateLimit from 'express-rate-limit';
import net from 'net';
import pool from './db.js';
import { parseRSS } from './rss.js';
import { generateSummary } from './ai.js';
import { fetchAndStoreArticles } from './services/fetchService.js';
import { getArticleById } from './services/articleService.js';
import { requireAuth } from './middleware/auth.js';
import { logger } from './middleware/logger.js';
import { cache, cacheClear } from './middleware/cache.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 55300;

// CORS — restrict to configured origin
const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:55300';
app.use(cors({
    origin: corsOrigin,
    optionsSuccessStatus: 200
}));
app.use(express.json());
app.use(express.static('../frontend'));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { error: 'Too many requests, please try again later.' }
});
app.use('/api/', limiter);

// Auth middleware for mutating endpoints
app.use('/api/', (req, res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    return requireAuth(req, res, next);
});

// Helprs
function escapeHtml(text) {
    if (!text) return '';
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function sanitizeError(err) {
    logger.error('Request error', err);
    return 'An internal error occurred';
}

// Validate URL is safe for server-side fetching (SSRF protection)
function isSafeUrl(url) {
    try {
        const parsed = new URL(url);
        if (!['http:', 'https:'].includes(parsed.protocol)) return false;

        const hostname = parsed.hostname.toLowerCase();

        // Check if hostname is an IP address
        const ipType = net.isIP(hostname);
        if (ipType) {
            // IPv4 loopback: 127.x.x.x
            if (ipType === 4 && hostname.startsWith('127.')) return false;
            // IPv6 loopback: ::1, ::ffff:x.x.x.x
            if (ipType === 6 && (hostname === '::1' || hostname.startsWith('::ffff:'))) return false;
            // IPv6 private: fc00:, fd00:, fe80:
            if (ipType === 6 && (hostname.startsWith('fc00:') || hostname.startsWith('fd00:') || hostname.startsWith('fe80:'))) return false;
            // Block 0.0.0.0
            if (hostname === '0.0.0.0') return false;
            return true;
        }

        // Block private hostnames
        if (hostname === 'localhost' || hostname === '[::1]') return false;

        // Block private IP ranges (IPv4) - with explicit parentheses
        if (hostname.startsWith('10.') ||
            (hostname.startsWith('172.') && parseInt(hostname.split('.')[1]) >= 16 && parseInt(hostname.split('.')[1]) <= 31) ||
            hostname.startsWith('192.168.') ||
            hostname.startsWith('169.254.')) {
            return false;
        }

        return true;
    } catch {
        return false;
    }
}

// ─── Health Check ───────────────────────────────────────────────────────────

app.get('/api/health', async (req, res) => {
    try {
        await pool.query('SELECT 1');
        res.json({ status: 'ok', timestamp: new Date().toISOString() });
    } catch {
        res.status(503).json({ status: 'error' });
    }
});

// ─── Sources ────────────────────────────────────────────────────────────────

app.get('/api/sources', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM rss_sources ORDER BY created_at DESC');
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: sanitizeError(error) });
    }
});

app.post('/api/sources', async (req, res) => {
    try {
        const { name, url, language = 'zh' } = req.body;
        if (!name || !url) {
            return res.status(400).json({ error: 'Missing name or url' });
        }
        const [existingUrl] = await pool.query('SELECT id FROM rss_sources WHERE url = ?', [url]);
        if (existingUrl.length > 0) {
            return res.status(409).json({ error: 'URL already exists' });
        }
        const [existingName] = await pool.query('SELECT id FROM rss_sources WHERE name = ?', [name]);
        if (existingName.length > 0) {
            return res.status(409).json({ error: 'Source name already exists' });
        }
        try {
            await parseRSS(url);
        } catch (e) {
            return res.status(400).json({ valid: false, error: 'Invalid RSS feed URL' });
        }
        const [result] = await pool.query(
            'INSERT INTO rss_sources (name, url, language) VALUES (?, ?, ?)',
            [name, url, language]
        );
        const [newSource] = await pool.query('SELECT * FROM rss_sources WHERE id = ?', [result.insertId]);
        res.status(201).json(newSource[0]);
    } catch (error) {
        res.status(500).json({ error: sanitizeError(error) });
    }
});

app.delete('/api/sources/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query('DELETE FROM rss_sources WHERE id = ?', [id]);
        cacheClear('articles');
        res.json({ message: 'Source deleted' });
    } catch (error) {
        res.status(500).json({ error: sanitizeError(error) });
    }
});

app.get('/api/sources/:id/validate', async (req, res) => {
    try {
        const { id } = req.params;
        const [rssSources] = await pool.query('SELECT url FROM rss_sources WHERE id = ?', [id]);
        if (rssSources.length === 0) {
            return res.status(404).json({ error: 'Source not found' });
        }
        await parseRSS(rssSources[0].url);
        res.json({ valid: true });
    } catch {
        res.status(400).json({ valid: false, error: 'RSS feed validation failed' });
    }
});

app.post('/api/sources/:id/fetch', async (req, res) => {
    try {
        const { id } = req.params;
        const [rssSources] = await pool.query('SELECT * FROM rss_sources WHERE id = ?', [id]);
        if (rssSources.length === 0) {
            return res.status(404).json({ error: 'Source not found' });
        }
        const source = rssSources[0];
        const newCount = await fetchAndStoreArticles(id, source.url);
        cacheClear('articles');
        res.json({ message: `Fetched ${newCount} new articles`, source });
    } catch (error) {
        res.status(500).json({ error: sanitizeError(error) });
    }
});

app.post('/api/sources/fetch-all', async (req, res) => {
    try {
        const [rssSources] = await pool.query('SELECT id, url FROM rss_sources');
        let totalArticles = 0;
        for (const source of rssSources) {
            try {
                totalArticles += await fetchAndStoreArticles(source.id, source.url);
            } catch (e) {
                logger.error(`Error fetching source ${source.id}`, e);
            }
        }
        cacheClear('articles');
        res.json({ message: `Fetched ${totalArticles} new articles from ${rssSources.length} sources` });
    } catch (error) {
        res.status(500).json({ error: sanitizeError(error) });
    }
});

// ─── Articles ───────────────────────────────────────────────────────────────

app.get('/api/articles', async (req, res) => {
    try {
        const { page = 1, limit = 20, source_id, keyword } = req.query;
        const pageNum = Number(page);
        const limitNum = Number(limit);
        const offset = (pageNum - 1) * limitNum;

        // Use cache for common queries with a short TTL
        const cacheKey = `articles:${source_id || 'all'}:${keyword || ''}:${pageNum}:${limitNum}`;
        const result = await cache(cacheKey, 15000, async () => {
            const conditions = [];
            const params = [];

            if (source_id) {
                conditions.push('a.source_id = ?');
                params.push(source_id);
            }
            if (keyword) {
                conditions.push('(a.title LIKE ? OR a.summary LIKE ? OR a.content LIKE ?)');
                const kw = `%${keyword}%`;
                params.push(kw, kw, kw);
            }

            const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

            const countQuery = `SELECT COUNT(*) as total FROM articles a ${whereClause}`;
            const dataQuery = `SELECT a.*, s.name as source_name FROM articles a LEFT JOIN rss_sources s ON a.source_id = s.id ${whereClause} ORDER BY a.published_at DESC LIMIT ? OFFSET ?`;

            const [countResult] = await pool.query(countQuery, params);
            const total = countResult[0].total;

            const [articles] = await pool.query(dataQuery, [...params, limitNum, offset]);

            return { articles, total, page: pageNum, limit: limitNum };
        });

        res.json(result);
    } catch (error) {
        res.status(500).json({ error: sanitizeError(error) });
    }
});

app.get('/api/articles/:id', async (req, res) => {
    try {
        const article = await getArticleById(req.params.id);
        if (!article) {
            return res.status(404).json({ error: 'Article not found' });
        }
        res.json(article);
    } catch (error) {
        res.status(500).json({ error: sanitizeError(error) });
    }
});

app.get('/api/articles/:id/content', async (req, res) => {
    try {
        const article = await getArticleById(req.params.id);
        if (!article) {
            return res.status(404).json({ error: 'Article not found' });
        }
        if (!article.summary && article.content && process.env.MINIMAX_API_KEY) {
            article.summary = await generateSummary(article.content, process.env.MINIMAX_API_KEY);
            await pool.query('UPDATE articles SET summary = ? WHERE id = ?', [article.summary, req.params.id]);
        }
        res.json(article);
    } catch (error) {
        res.status(500).json({ error: sanitizeError(error) });
    }
});

app.get('/api/articles/:id/original', async (req, res) => {
    try {
        const article = await getArticleById(req.params.id);
        if (!article) {
            return res.status(404).json({ error: 'Article not found' });
        }
        if (!article.url) {
            return res.status(400).json({ error: 'Article has no URL' });
        }
        if (!isSafeUrl(article.url)) {
            return res.status(400).json({ error: 'Article URL is not accessible' });
        }

        // Cache original HTML for 30 minutes
        const html = await cache(`original:${id}`, 30 * 60 * 1000, async () => {
            const axios = (await import('axios')).default;
            const response = await axios.get(article.url, {
                timeout: 15000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; RSS Reader/1.0)'
                },
                maxRedirects: 5,
                maxContentLength: 5 * 1024 * 1024 // 5MB limit
            });
            return response.data;
        });

        res.json({ html, url: article.url });
    } catch (error) {
        res.status(502).json({ error: 'Failed to fetch original article' });
    }
});

app.patch('/api/articles/:id/read', async (req, res) => {
    try {
        const { id } = req.params;
        const { ai_read, web_read } = req.body;
        const updates = [];
        const params = [];
        if (ai_read !== undefined) {
            updates.push('ai_read = ?');
            params.push(ai_read ? 1 : 0);
        }
        if (web_read !== undefined) {
            updates.push('web_read = ?');
            params.push(web_read ? 1 : 0);
        }
        if (updates.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }
        params.push(id);
        await pool.query(`UPDATE articles SET ${updates.join(', ')} WHERE id = ?`, params);
        cacheClear('articles');
        res.json({ message: 'Article updated' });
    } catch (error) {
        res.status(500).json({ error: sanitizeError(error) });
    }
});

// Mark all visible articles as read
app.patch('/api/articles/read-all', async (req, res) => {
    try {
        const { source_id, keyword } = req.body;
        const conditions = [];
        const params = [];
        if (source_id) {
            conditions.push('source_id = ?');
            params.push(source_id);
        }
        if (keyword) {
            conditions.push('(title LIKE ? OR summary LIKE ? OR content LIKE ?)');
            const kw = `%${keyword}%`;
            params.push(kw, kw, kw);
        }
        const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
        const [result] = await pool.query(`UPDATE articles SET ai_read = 1 ${whereClause}`, params);
        cacheClear('articles');
        res.json({ message: 'Articles marked as read', affected: result.affectedRows });
    } catch (error) {
        res.status(500).json({ error: sanitizeError(error) });
    }
});

// ─── Cron Job ───────────────────────────────────────────────────────────────

let cronRunning = false;

cron.schedule('0 0,6,12,18 * * *', async () => {
    if (cronRunning) {
        logger.info('Cron fetch already running, skipping');
        return;
    }
    cronRunning = true;
    logger.info('Running scheduled fetch');
    try {
        const [rssSources] = await pool.query('SELECT id, url FROM rss_sources');
        for (const source of rssSources) {
            try {
                const count = await fetchAndStoreArticles(source.id, source.url);
                if (count > 0) logger.info(`Cron: ${count} new articles from source ${source.id}`);
            } catch (e) {
                logger.error(`Cron error fetching source ${source.id}`, e);
            }
        }
        cacheClear('articles');
        logger.info('Scheduled fetch completed');
    } catch (error) {
        logger.error('Scheduled fetch error', error);
    } finally {
        cronRunning = false;
    }
});

// ─── Startup ────────────────────────────────────────────────────────────────

async function initialFetch() {
    logger.info('Running initial fetch');
    try {
        const [rssSources] = await pool.query('SELECT id, url FROM rss_sources');
        for (const source of rssSources) {
            try {
                const count = await fetchAndStoreArticles(source.id, source.url);
                if (count > 0) logger.info(`Initial fetch: ${count} new articles from source ${source.id}`);
            } catch (e) {
                logger.error(`Initial fetch error for source ${source.id}`, e);
            }
        }
        cacheClear('articles');
        logger.info('Initial fetch completed');
    } catch (error) {
        logger.error('Initial fetch error', error);
    }
}

const server = app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
    initialFetch();
});

// Graceful shutdown
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

async function shutdown(signal) {
    logger.info(`Received ${signal}, shutting down gracefully`);
    server.close(() => {
        logger.info('HTTP server closed');
    });
    try {
        await pool.end();
        logger.info('Database pool closed');
    } catch (e) {
        logger.error('Error closing database pool', e);
    }
    process.exit(0);
}
