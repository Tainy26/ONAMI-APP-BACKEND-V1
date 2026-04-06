const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const pool = require("../db/pool");

function signToken(user) {
    return jwt.sign(
        { id: user.id, role: user.role, team_id: user.team_id },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
    );
}

exports.register = async (req, res) => {
  try {
    const { name, email, password, role, join_code } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ ok: false, error: "Missing fields" });
    }

    if (!["trainer", "athlete"].includes(role)) {
      return res.status(400).json({ ok: false, error: "Invalid role" });
    }

    const existing = await pool.query("SELECT id FROM users WHERE email=$1", [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ ok: false, error: "Email already registered" });
    }

    let teamId = null;

    if (role === "athlete") {
      if (!join_code) {
        return res.status(400).json({ ok: false, error: "join_code is required for athletes" });
      }

      const teamRes = await pool.query(
        `SELECT id FROM teams WHERE join_code = $1`,
        [join_code]
      );

      if (teamRes.rows.length === 0) {
        return res.status(400).json({ ok: false, error: "Invalid join_code" });
      }

      teamId = teamRes.rows[0].id;
    }

    const hashed = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO users (name, email, password, role, team_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, email, role, team_id, created_at`,
      [name, email, hashed, role, teamId]
    );

    const user = result.rows[0];
    const token = signToken(user);

    return res.status(201).json({ ok: true, user, token });
  } catch (err) {
    console.error("register error:", err);
    return res.status(500).json({ ok: false, error: "Server Error" });
  }
};

exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;
        
        if(!email || !password) {
            return res.status(400).json({ ok: false, error: "Missing fields" });
        }

        const result = await pool.query(
            "SELECT id, name, email, password, role, team_id FROM users WHERE email=$1", [email]
        );

        if (result.rows.length === 0) {
        return res.status(401).json({ ok: false, error: "Invalid credentials" });
        }

        const userRow = result.rows[0];
        const ok = await bcrypt.compare(password, userRow.password);

        if (!ok) {
        return res.status(401).json({ ok: false, error: "Invalid credentials" });
        }

        const user = {
            id: userRow.id,
            name: userRow.name,
            email: userRow.email,
            role: userRow.role,
            team_id: userRow.team_id,
        };

        const token = signToken(user);

        return res.json({ ok: true, user, token });
    }   catch (err) {
        console.error("Login Error: ", err);
        return res.status(500).json({ ok: false, error: "Server error" });
    }
};