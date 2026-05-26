// Basic health check and endpoint tests
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';

const BASE_URL = 'http://localhost:55300';

describe('API', () => {
    let fetch;

    before(async () => {
        fetch = (await import('node-fetch')).default || globalThis.fetch;
    });

    it('GET /api/health returns ok', async () => {
        const res = await fetch(`${BASE_URL}/api/health`);
        assert.equal(res.status, 200);
        const body = await res.json();
        assert.equal(body.status, 'ok');
    });

    it('GET /api/sources returns array', async () => {
        const res = await fetch(`${BASE_URL}/api/sources`);
        assert.equal(res.status, 200);
        const body = await res.json();
        assert(Array.isArray(body));
    });

    it('GET /api/articles returns paginated result', async () => {
        const res = await fetch(`${BASE_URL}/api/articles`);
        assert.equal(res.status, 200);
        const body = await res.json();
        assert('articles' in body);
        assert('total' in body);
        assert('page' in body);
        assert(Array.isArray(body.articles));
    });

    it('GET /api/articles with keyword returns filtered result', async () => {
        const res = await fetch(`${BASE_URL}/api/articles?keyword=test`);
        assert.equal(res.status, 200);
        const body = await res.json();
        assert(Array.isArray(body.articles));
    });

    it('GET /api/articles/:id with invalid id returns 404', async () => {
        const res = await fetch(`${BASE_URL}/api/articles/999999`);
        assert.equal(res.status, 404);
    });

    it('POST /api/sources without body returns 400', async () => {
        const res = await fetch(`${BASE_URL}/api/sources`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });
        assert.equal(res.status, 400);
    });
});
