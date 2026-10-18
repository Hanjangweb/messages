const app = require('../server');

module.exports = (req, res) => {
    // Vercel Serverless routing normalization:
    // When Vercel rewrites /api/* to /api/index.js, ensure req.url reflects the actual intended API route
    const originalRoute = 
        (req.query && req.query.__vercel_route) ||
        req.headers['x-matched-path'] || 
        req.headers['x-forwarded-uri'] || 
        req.headers['x-invoke-path'];

    if (originalRoute && (req.url.startsWith('/api/index') || req.url === '/api' || req.url === '/api/')) {
        req.url = originalRoute.split('?')[0];
    }
    return app(req, res);
};
