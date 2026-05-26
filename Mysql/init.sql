CREATE DATABASE IF NOT EXISTS RSS CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE RSS;

CREATE TABLE IF NOT EXISTS rss_sources (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    url VARCHAR(512) NOT NULL UNIQUE,
    language VARCHAR(50) DEFAULT 'zh',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS articles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    source_id INT NOT NULL,
    title VARCHAR(512),
    url VARCHAR(512),
    summary TEXT,
    content TEXT,
    cover_path VARCHAR(512),
    published_at DATETIME,
    ai_read TINYINT(1) DEFAULT 0,
    web_read TINYINT(1) DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (source_id) REFERENCES rss_sources(id) ON DELETE CASCADE,
    UNIQUE INDEX idx_source_url (source_id, url),
    INDEX idx_source_id (source_id),
    INDEX idx_published_at (published_at),
    INDEX idx_ai_read (ai_read),
    INDEX idx_web_read (web_read)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
