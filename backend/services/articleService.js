import pool from '../db.js';

export async function getArticleById(id) {
    const [articles] = await pool.query(
        `SELECT a.*, s.name as source_name FROM articles a
         LEFT JOIN rss_sources s ON a.source_id = s.id WHERE a.id = ?`,
        [id]
    );
    return articles.length > 0 ? articles[0] : null;
}