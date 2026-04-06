const pool = require("../db/pool");

// helper: comprobar acceso a una sesión (trainer dueño del team o athlete del team)
async function canAccessSession(sessionId, user) {
  // Devuelve: { ok: true, team_id, trainer_id } o { ok:false }
  const r = await pool.query(
    `SELECT s.id, s.team_id, t.trainer_id
     FROM sessions s
     JOIN teams t ON t.id = s.team_id
     WHERE s.id = $1`,
    [sessionId]
  );

  if (r.rows.length === 0) return { ok: false };

  const row = r.rows[0];

  if (user.role === "trainer") {
    if (row.trainer_id !== user.id) return { ok: false };
    return { ok: true, team_id: row.team_id, trainer_id: row.trainer_id };
  }

  if (user.role === "athlete") {
    if (user.team_id == null || Number(user.team_id) !== Number(row.team_id)) return { ok: false };
    return { ok: true, team_id: row.team_id, trainer_id: row.trainer_id };
  }

  return { ok: false };
}

// GET /sessions/:sessionId/exercises  (trainer o athlete autorizado)
exports.listSessionExercises = async (req, res) => {
  try {
    const sessionId = Number(req.params.sessionId);
    if (!Number.isFinite(sessionId)) {
      return res.status(400).json({ ok: false, error: "Invalid session id" });
    }

    const access = await canAccessSession(sessionId, req.user);
    if (!access.ok) {
      return res.status(403).json({ ok: false, error: "Forbidden" });
    }

    const result = await pool.query(
      `SELECT id, session_id, name, description, sets, reps, duration_minutes, intensity, "order", created_at
       FROM session_exercises
       WHERE session_id = $1
       ORDER BY "order" ASC, id ASC`,
      [sessionId]
    );

    return res.json({ ok: true, session_id: sessionId, exercises: result.rows });
  } catch (err) {
    console.error("listSessionExercises error:", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
};

// POST /sessions/:sessionId/exercises  (solo trainer dueño del team)
exports.addSessionExercise = async (req, res) => {
  try {
    const sessionId = Number(req.params.sessionId);
    if (!Number.isFinite(sessionId)) {
      return res.status(400).json({ ok: false, error: "Invalid session id" });
    }

    const access = await canAccessSession(sessionId, req.user);
    if (!access.ok || req.user.role !== "trainer") {
      return res.status(403).json({ ok: false, error: "Forbidden" });
    }

    const { name, description, sets, reps, duration_minutes, intensity, order } = req.body;

    if (!name) {
      return res.status(400).json({ ok: false, error: "Missing field: name" });
    }

    const result = await pool.query(
      `INSERT INTO session_exercises (session_id, name, description, sets, reps, duration_minutes, intensity, "order")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, session_id, name, description, sets, reps, duration_minutes, intensity, "order", created_at`,
      [
        sessionId,
        name,
        description ?? null,
        sets ?? null,
        reps ?? null,
        duration_minutes ?? null,
        intensity ?? null,
        order ?? 0,
      ]
    );

    return res.status(201).json({ ok: true, exercise: result.rows[0] });
  } catch (err) {
    console.error("addSessionExercise error:", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
};

// PUT /sessions/:sessionId/exercises/:exerciseId  (solo trainer dueño)
exports.updateSessionExercise = async (req, res) => {
  try {
    const sessionId = Number(req.params.sessionId);
    const exerciseId = Number(req.params.exerciseId);

    if (!Number.isFinite(sessionId) || !Number.isFinite(exerciseId)) {
      return res.status(400).json({ ok: false, error: "Invalid id" });
    }

    const access = await canAccessSession(sessionId, req.user);
    if (!access.ok || req.user.role !== "trainer") {
      return res.status(403).json({ ok: false, error: "Forbidden" });
    }

    const { name, description, sets, reps, duration_minutes, intensity, order } = req.body;

    const result = await pool.query(
      `UPDATE session_exercises
       SET
         name = COALESCE($1, name),
         description = COALESCE($2, description),
         sets = COALESCE($3, sets),
         reps = COALESCE($4, reps),
         duration_minutes = COALESCE($5, duration_minutes),
         intensity = COALESCE($6, intensity),
         "order" = COALESCE($7, "order")
       WHERE id = $8 AND session_id = $9
       RETURNING id, session_id, name, description, sets, reps, duration_minutes, intensity, "order", created_at`,
      [
        name ?? null,
        description ?? null,
        sets ?? null,
        reps ?? null,
        duration_minutes ?? null,
        intensity ?? null,
        order ?? null,
        exerciseId,
        sessionId,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ ok: false, error: "Exercise not found" });
    }

    return res.json({ ok: true, exercise: result.rows[0] });
  } catch (err) {
    console.error("updateSessionExercise error:", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
};

// DELETE /sessions/:sessionId/exercises/:exerciseId  (solo trainer dueño)
exports.deleteSessionExercise = async (req, res) => {
  try {
    const sessionId = Number(req.params.sessionId);
    const exerciseId = Number(req.params.exerciseId);

    if (!Number.isFinite(sessionId) || !Number.isFinite(exerciseId)) {
      return res.status(400).json({ ok: false, error: "Invalid id" });
    }

    const access = await canAccessSession(sessionId, req.user);
    if (!access.ok || req.user.role !== "trainer") {
      return res.status(403).json({ ok: false, error: "Forbidden" });
    }

    const result = await pool.query(
      `DELETE FROM session_exercises
       WHERE id = $1 AND session_id = $2
       RETURNING id`,
      [exerciseId, sessionId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ ok: false, error: "Exercise not found" });
    }

    return res.json({ ok: true, deleted_id: result.rows[0].id });
  } catch (err) {
    console.error("deleteSessionExercise error:", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
};

