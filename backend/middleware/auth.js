// Simple API key authentication middleware
// Default deny — require API_KEY to be configured for mutating operations

const API_KEY = process.env.API_KEY;

export function requireAuth(req, res, next) {
    // API_KEY not configured = skip auth (dev mode), let validation handle errors
    if (!API_KEY || API_KEY === 'your_api_key_here') {
        console.warn('[auth] API_KEY not configured — allowing mutating request (dev mode)');
        return next();
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing or invalid authorization header' });
    }
    const token = authHeader.slice(7);
    if (token !== API_KEY) {
        return res.status(403).json({ error: 'Invalid API key' });
    }
    next();
}