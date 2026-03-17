const jwt = require("jsonwebtoken");

/**
 * Middleware: verify JWT from Authorization: Bearer <token> header.
 * Attaches decoded payload to req.user.
 */
function authenticate(req, res, next) {
  const authHeader = req.headers["authorization"];
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No token provided" });
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

/**
 * Middleware: require a specific role (e.g. "creator").
 * Must be used AFTER authenticate().
 */
function requireRole(role) {
  return (req, res, next) => {
    if (req.user?.role !== role) {
      return res
        .status(403)
        .json({ error: `Forbidden: requires role '${role}'` });
    }
    next();
  };
}

module.exports = { authenticate, requireRole };
