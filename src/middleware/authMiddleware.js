const jwt = require("jsonwebtoken");
const pool = require("../db/pool");

module.exports = async function authMiddleware(req, res, next) {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
      return res.status(401).json({ ok: false, error: "Missing token" });
    }

    const token = header.split(" ")[1];
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    // ✅ Traer usuario actual desde DB (evita team_id viejo)
    const r = await pool.query(
      `SELECT id, role, team_id
       FROM users
       WHERE id = $1`,
      [payload.id]
    );

    if (r.rows.length === 0) {
      return res.status(401).json({ ok: false, error: "User not found" });
    }

    req.user = {
      id: r.rows[0].id,
      role: r.rows[0].role,
      team_id: r.rows[0].team_id,
    };

    return next();
  } catch (err) {
    return res.status(401).json({ ok: false, error: "Invalid token" });
  }
};