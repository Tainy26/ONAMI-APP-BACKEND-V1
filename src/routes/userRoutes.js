const express = require("express");
const router = express.Router();
const pool = require("../db/pool");
const authMiddleware = require ("../middleware/authMiddleware");
const requireRole = require("../middleware/requireRole");

router.get("/", authMiddleware, requireRole("trainer"), async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, name, email, role, created_at, team_id FROM users ORDER BY id ASC"
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del Servidor" });
  }
});

module.exports = router;