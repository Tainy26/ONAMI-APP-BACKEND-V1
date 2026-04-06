const pool = require("../db/pool");

exports.getMyProfile = async (req, res) => {
  try {
    const userRes = await pool.query(
      `SELECT id, name, email, role, team_id, created_at
       FROM users
       WHERE id = $1`,
      [req.user.id]
    );

    if (userRes.rows.length === 0) {
      return res.status(404).json({ ok: false, error: "User not found" });
    }

    const user = userRes.rows[0];

    let athlete_profile = null;
    let trainer_profile = null;

    if (user.role === "athlete") {
      const p = await pool.query(
        `SELECT user_id, birth_date, height_cm, weight_kg, position, phone, bio, updated_at
         FROM athlete_profiles
         WHERE user_id = $1`,
        [user.id]
      );
      athlete_profile = p.rows[0] ?? null;
    }

    if (user.role === "trainer") {
      const p = await pool.query(
        `SELECT user_id, phone, organization, bio, updated_at
         FROM trainer_profiles
         WHERE user_id = $1`,
        [user.id]
      );
      trainer_profile = p.rows[0] ?? null;
    }

    return res.json({ ok: true, user, athlete_profile, trainer_profile });
  } catch (err) {
    console.error("getMyProfile error:", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
};

exports.updateMyProfile = async (req, res) => {
  try {
    const role = req.user.role;

    if (role === "athlete") {
      const { birth_date, height_cm, weight_kg, position, phone, bio } = req.body;

      if (height_cm != null && (!Number.isInteger(height_cm) || height_cm < 50 || height_cm > 250)) {
        return res.status(400).json({ ok: false, error: "height_cm must be an integer between 50 and 250" });
      }

      if (weight_kg != null) {
        const w = Number(weight_kg);
        if (!Number.isFinite(w) || w < 20 || w > 300) {
          return res.status(400).json({ ok: false, error: "weight_kg must be a number between 20 and 300" });
        }
      }

      const result = await pool.query(
        `INSERT INTO athlete_profiles (user_id, birth_date, height_cm, weight_kg, position, phone, bio, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
         ON CONFLICT (user_id)
         DO UPDATE SET
           birth_date = EXCLUDED.birth_date,
           height_cm = EXCLUDED.height_cm,
           weight_kg = EXCLUDED.weight_kg,
           position = EXCLUDED.position,
           phone = EXCLUDED.phone,
           bio = EXCLUDED.bio,
           updated_at = CURRENT_TIMESTAMP
         RETURNING user_id, birth_date, height_cm, weight_kg, position, phone, bio, updated_at`,
        [
          req.user.id,
          birth_date ?? null,
          height_cm ?? null,
          weight_kg ?? null,
          position ?? null,
          phone ?? null,
          bio ?? null,
        ]
      );

      return res.json({ ok: true, athlete_profile: result.rows[0], trainer_profile: null });
    }

    if (role === "trainer") {
      const { phone, organization, bio } = req.body;

      const result = await pool.query(
        `INSERT INTO trainer_profiles (user_id, phone, organization, bio, updated_at)
         VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
         ON CONFLICT (user_id)
         DO UPDATE SET
           phone = EXCLUDED.phone,
           organization = EXCLUDED.organization,
           bio = EXCLUDED.bio,
           updated_at = CURRENT_TIMESTAMP
         RETURNING user_id, phone, organization, bio, updated_at`,
        [req.user.id, phone ?? null, organization ?? null, bio ?? null]
      );

      return res.json({ ok: true, trainer_profile: result.rows[0], athlete_profile: null });
    }

    return res.status(403).json({ ok: false, error: "Invalid role" });
  } catch (err) {
    console.error("updateMyProfile error:", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
};

exports.getAthleteProfileForTrainer = async (req, res) => {
  try {
    const athleteId = Number(req.params.athleteId);
    if (!Number.isFinite(athleteId)) {
      return res.status(400).json({ ok: false, error: "Invalid athlete id" });
    }

    const check = await pool.query(
      `SELECT u.id
       FROM users u
       JOIN teams t ON t.id = u.team_id
       WHERE u.id = $1
         AND u.role = 'athlete'
         AND t.trainer_id = $2`,
      [athleteId, req.user.id]
    );

    if (check.rows.length === 0) {
      return res.status(403).json({ ok: false, error: "Forbidden" });
    }

    const userRes = await pool.query(
      `SELECT id, name, email, role, team_id, created_at
       FROM users
       WHERE id = $1`,
      [athleteId]
    );

    if (userRes.rows.length === 0) {
      return res.status(404).json({ ok: false, error: "Athlete not found" });
    }

    const profileRes = await pool.query(
      `SELECT user_id, birth_date, height_cm, weight_kg, position, phone, bio, updated_at
       FROM athlete_profiles
       WHERE user_id = $1`,
      [athleteId]
    );

    return res.json({
      ok: true,
      athlete: userRes.rows[0],
      athlete_profile: profileRes.rows[0] ?? null,
    });
  } catch (err) {
    console.error("getAthleteProfileForTrainer error:", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
};