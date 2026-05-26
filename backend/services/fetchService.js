import pool from '../db.js';
import { parseRSS, fetchArticleCover } from '../rss.js';
import { logger } from '../middleware/logger.js';

// Simple async mutex with timeout
function createMutex(timeoutMs = 30000) {
    let queue = Promise.resolve();
    return {
        acquire() {
            let release;
            const wait = new Promise(resolve => { release = resolve; });
            const previous = queue;
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Mutex timeout')), timeoutMs)
            );

            queue = previous.then(() =>
                Promise.race([wait, timeoutPromise])
                    .catch(err => {
                        logger.error('Mutex acquire timeout, releasing', err);
                        release(); // Release on timeout to prevent deadlock
                        throw err;
                    })
            ).then(() => release);

            return previous.then(() => release).catch(() => {});
        }
    };
}

// Per-source mutexes to prevent concurrent fetches of the same source
const sourceMutexes = new Map();
function getSourceMutex(sourceId) {
    if (!sourceMutexes.has(sourceId)) {
        sourceMutexes.set(sourceId, createMutex());
    }
    return sourceMutexes.get(sourceId);
}

// Shared fetch + store logic used by manual fetch, fetch-all, cron, and initial fetch
export async function fetchAndStoreArticles(sourceId, sourceUrl) {
    const mutex = getSourceMutex(sourceId);
    const release = await mutex.acquire();
    try {
        const articles = await parseRSS(sourceUrl);
        if (articles.length === 0) return 0;

        // Batch-check existing URLs with a single query
        const urls = articles.map(a => a.url);
        const placeholders = urls.map(() => '?').join(',');
        const [existing] = await pool.query(
            `SELECT url FROM articles WHERE source_id = ? AND url IN (${placeholders})`,
            [sourceId, ...urls]
        );
        const existingUrls = new Set(existing.map(r => r.url));

        // Filter to only new articles
        const newArticles = articles.filter(a => !existingUrls.has(a.url));
        if (newArticles.length === 0) return 0;

        // Batch insert (cover_path starts as NULL for articles needing covers)
        const values = [];
        const valuePlaceholders = [];
        const pendingCovers = []; // { id: autoIncIdx, url: articleUrl }
        for (const article of newArticles) {
            valuePlaceholders.push('(?, ?, ?, ?, ?, ?)');
            values.push(sourceId, article.title, article.url, article.published_at, article.cover_path, article.content);
            if (!article.cover_path) {
                pendingCovers.push({ id: values.length / 6, url: article.url });
            }
        }

        // Insert articles first (to get auto-increment IDs), then fetch covers and update
        const [insertResult] = await pool.query(
            `INSERT INTO articles (source_id, title, url, published_at, cover_path, content) VALUES ${valuePlaceholders.join(', ')}`,
            values
        );

        // Fetch covers in parallel batches, then batch-update
        const BATCH_SIZE = 5;
        const insertCount = insertResult.affectedRows;
        for (let i = 0; i < pendingCovers.length; i += BATCH_SIZE) {
            const batch = pendingCovers.slice(i, i + BATCH_SIZE);
            const covers = await Promise.all(batch.map(a => fetchArticleCover(a.url)));
            for (let j = 0; j < batch.length; j++) {
                const coverUrl = covers[j];
                if (coverUrl) {
                    const articleId = insertResult.insertId + batch[j].id - 1;
                    await pool.query('UPDATE articles SET cover_path = ? WHERE id = ?', [coverUrl, articleId]);
                }
            }
        }

        return newArticles.length;
    } catch (error) {
        if (error.message === 'Mutex timeout') {
            logger.error(`Fetch timeout for source ${sourceId}, skipping`);
            return 0;
        }
        throw error;
    } finally {
        if (release) release();
    }
}
