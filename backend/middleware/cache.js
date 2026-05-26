// Simple in-memory TTL cache

const store = new Map();

export function cache(key, ttlMs, factory) {
    const entry = store.get(key);
    if (entry && Date.now() < entry.expiresAt) {
        return Promise.resolve(entry.value);
    }
    return Promise.resolve(factory()).then(value => {
        store.set(key, { value, expiresAt: Date.now() + ttlMs });
        return value;
    });
}

export function cacheClear(pattern) {
    if (!pattern) {
        store.clear();
        return;
    }
    for (const key of store.keys()) {
        if (key.includes(pattern)) {
            store.delete(key);
        }
    }
}

// Periodic cleanup of expired entries
setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
        if (now >= entry.expiresAt) {
            store.delete(key);
        }
    }
}, 60000).unref();
