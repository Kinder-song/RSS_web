import pool from './db.js';

async function migrate() {
    console.log('Starting database migration...');

    try {
        // Check if columns already exist
        const [columns] = await pool.query('DESCRIBE rss_sources');
        const columnNames = columns.map(c => c.Field);

        if (columnNames.includes('last_fetched')) {
            console.log('✓ last_fetched column already exists');
        } else {
            await pool.query(
                'ALTER TABLE rss_sources ADD COLUMN last_fetched DATETIME NULL DEFAULT NULL AFTER language'
            );
            console.log('✓ Added last_fetched column');
        }

        if (columnNames.includes('article_count')) {
            console.log('✓ article_count column already exists');
        } else {
            await pool.query(
                'ALTER TABLE rss_sources ADD COLUMN article_count INT UNSIGNED DEFAULT 0 AFTER last_fetched'
            );
            console.log('✓ Added article_count column');
        }

        // Add index
        try {
            await pool.query('ALTER TABLE rss_sources ADD INDEX idx_last_fetched (last_fetched)');
            console.log('✓ Added idx_last_fetched index');
        } catch (e) {
            if (e.message.includes('Duplicate')) {
                console.log('✓ idx_last_fetched index already exists');
            } else throw e;
        }

        console.log('\nMigration completed successfully!');
    } catch (e) {
        console.error('Migration failed:', e.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

migrate();