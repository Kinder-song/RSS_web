-- Add last_fetched and article_count to rss_sources for better UX
ALTER TABLE rss_sources
ADD COLUMN last_fetched DATETIME NULL DEFAULT NULL AFTER language,
ADD COLUMN article_count INT UNSIGNED DEFAULT 0 AFTER last_fetched,
ADD INDEX idx_last_fetched (last_fetched);