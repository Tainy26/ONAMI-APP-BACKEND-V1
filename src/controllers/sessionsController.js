const pool = require("../db/pool");

// POST /teams/:teamId/sessions  (trainer)
exports.createTeamSession = async (req, res) => {
  try {
    const teamId = req.teamId; // viene del middleware requireTrainerOwnsTeam
    const { date, type, duration, notes } = req.body;

    if (!date) {
      return res.status(400).json({ ok: false, error: "Missing field: date" });
    }

    const result = await pool.query(
      `INSERT INTO sessions (team_id, created_by, date, type, duration, notes)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, team_id, created_by, date, type, duration, notes, created_at`,
      [teamId, req.user.id, date, type ?? null, duration ?? null, notes ?? null]
    );

    return res.status(201).json({ ok: true, session: result.rows[0] });
  } catch (err) {
    console.error("createTeamSession error:", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
};

// GET /teams/:teamId/sessions  (trainer o athlete del team)
exports.listTeamSessions = async (req, res) => {
  try {
    const teamId = Number(req.params.teamId);
    if (!Number.isFinite(teamId)) {
      return res.status(400).json({ ok: false, error: "Invalid team id" });
    }

    // acceso:
    // - trainer: team debe ser suyo
    // - athlete: debe pertenecer a ese team
    if (req.user.role === "trainer") {
      const ok = await pool.query(
        `SELECT 1 FROM teams WHERE id = $1 AND trainer_id = $2`,
        [teamId, req.user.id]
      );
      if (ok.rows.length === 0) return res.status(404).json({ ok: false, error: "Team not found" });
    } else if (req.user.role === "athlete") {
      if (req.user.team_id == null || Number(req.user.team_id) !== teamId) {
        return res.status(403).json({ ok: false, error: "Forbidden" });
      }
    } else {
      return res.status(403).json({ ok: false, error: "Forbidden" });
    }

    const result = await pool.query(
      `SELECT id, team_id, created_by, date, type, duration, notes, created_at
       FROM sessions
       WHERE team_id = $1
       ORDER BY date ASC, id ASC`,
      [teamId]
    );

    return res.json({ ok: true, team_id: teamId, sessions: result.rows });
  } catch (err) {
    console.error("listTeamSessions error:", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
};

// PUT /sessions/:sessionId  (trainer)
exports.updateTeamSession = async (req, res) => {
  try {
    const sessionId = Number(req.params.sessionId);
    if (!Number.isFinite(sessionId)) {
      return res.status(400).json({ ok: false, error: "Invalid session ID" });
    }

    // Verificar que la sesión pertenece a un team del trainer
    const s = await pool.query(
      `SELECT s.id, s.team_id
       FROM sessions s
       JOIN teams t ON t.id = s.team_id
       WHERE s.id = $1 AND t.trainer_id = $2`,
      [sessionId, req.user.id]
    );
    if (s.rows.length === 0) {
      return res.status(404).json({ ok: false, error: "Session Not Found" });
    }

    const { date, type, duration, notes } = req.body;

    const result = await pool.query(
      `UPDATE sessions
       SET
         date = COALESCE($1, date),
         type = COALESCE($2, type),
         duration = COALESCE($3, duration),
         notes = COALESCE($4, notes)
       WHERE id = $5
       RETURNING id, team_id, created_by, date, type, duration, notes, created_at`,
      [date ?? null, type ?? null, duration ?? null, notes ?? null, sessionId]
    );

    return res.json({ ok: true, session: result.rows[0] });
  } catch (err) {
    console.error("updateTeamSession error:", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
};

// DELETE /sessions/:sessionId  (trainer)
exports.deleteTeamSession = async (req, res) => {
  try {
    const sessionId = Number(req.params.sessionId);
    if (!Number.isFinite(sessionId)) {
      return res.status(400).json({ ok: false, error: "Invalid session id" });
    }

    // Borrar solo si pertenece a un team del trainer
    const result = await pool.query(
      `DELETE FROM sessions s
       USING teams t
       WHERE s.id = $1 AND s.team_id = t.id AND t.trainer_id = $2
       RETURNING s.id`,
      [sessionId, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ ok: false, error: "Session not found" });
    }

    return res.json({ ok: true, deleted_id: result.rows[0].id });
  } catch (err) {
    console.error("deleteTeamSession error:", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
};

// GET /sessions/mine  (trainer: todos sus teams, athlete: su team)
exports.getMySessions = async (req, res) => {
  try {
    if (req.user.role === "athlete") {
      if (req.user.team_id == null) {
        return res.status(400).json({ ok: false, error: "Athlete has no team assigned" });
      }

      const teamId = Number(req.user.team_id);

      const result = await pool.query(
        `SELECT id, team_id, created_by, date, type, duration, notes, created_at
         FROM sessions
         WHERE team_id = $1
         ORDER BY date ASC, id ASC`,
        [teamId]
      );

      return res.json({ ok: true, scope: "athlete_team", team_id: teamId, sessions: result.rows });
    }

    if (req.user.role === "trainer") {
      const result = await pool.query(
        `SELECT s.id, s.team_id, s.created_by, s.date, s.type, s.duration, s.notes, s.created_at
         FROM sessions s
         JOIN teams t ON t.id = s.team_id
         WHERE t.trainer_id = $1
         ORDER BY s.date ASC, s.id ASC`,
        [req.user.id]
      );

      return res.json({ ok: true, scope: "trainer_teams", sessions: result.rows });
    }

    return res.status(403).json({ ok: false, error: "Forbidden" });
  } catch (err) {
    console.error("getMySessions error:", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
};

exports.getSessionDetail = async (req, res) => {
  try {
    const sessionId = Number(req.params.sessionId);
    if (!Number.isFinite(sessionId)) {
      return res.status(400).json({ ok: false, error: "Invalid session id" });
    }

    // 1) Traer sesión + validar acceso por rol
    const s = await pool.query(
      `SELECT s.id, s.team_id, s.created_by, s.date, s.type, s.duration, s.notes, s.created_at,
              t.trainer_id
       FROM sessions s
       JOIN teams t ON t.id = s.team_id
       WHERE s.id = $1`,
      [sessionId]
    );

    if (s.rows.length === 0) {
      return res.status(404).json({ ok: false, error: "Session not found" });
    }

    const row = s.rows[0];

    if (req.user.role === "trainer") {
      if (row.trainer_id !== req.user.id) {
        return res.status(403).json({ ok: false, error: "Forbidden" });
      }
    } else if (req.user.role === "athlete") {
      if (req.user.team_id == null || Number(req.user.team_id) !== Number(row.team_id)) {
        return res.status(403).json({ ok: false, error: "Forbidden" });
      }
    } else {
      return res.status(403).json({ ok: false, error: "Forbidden" });
    }

    // 2) Traer ejercicios
    const ex = await pool.query(
      `SELECT id, session_id, name, description, sets, reps, duration_minutes, intensity, "order", created_at
       FROM session_exercises
       WHERE session_id = $1
       ORDER BY "order" ASC, id ASC`,
      [sessionId]
    );

    // 3) Respuesta (sin trainer_id)
    const session = {
      id: row.id,
      team_id: row.team_id,
      created_by: row.created_by,
      date: row.date,
      type: row.type,
      duration: row.duration,
      notes: row.notes,
      created_at: row.created_at,
    };

    return res.json({ ok: true, session, exercises: ex.rows });
  } catch (err) {
    console.error("getSessionDetail error:", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
};