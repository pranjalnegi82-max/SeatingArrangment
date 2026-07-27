// middleware/auth.js
//
// JWT authentication middleware, as requested for the CSV import
// routes. NOTE: this project does not currently have a login /
// user system anywhere (no auth routes, no users table, no token
// issuance) -- this middleware only verifies a token if one is
// presented; it does not create the login flow that would issue
// one. See README section "Auth" for how to mint a dev token for
// testing until a real login page exists.
//
// Set SKIP_AUTH=true in .env to bypass verification entirely during
// local development before a login flow exists. Never set that in
// production.
const jwt = require('jsonwebtoken');

function authMiddleware(req, res, next) {
  if (process.env.SKIP_AUTH === 'true') {
    return next();
  }

  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Missing or malformed Authorization header. Expected: Bearer <token>' });
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret-change-me');
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
}

module.exports = authMiddleware;
