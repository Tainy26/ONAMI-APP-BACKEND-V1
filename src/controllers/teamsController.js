const pool = require("../db/pool");

function generateJoinCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return `ONAMI-${s}`;
}

exports.regenerateJoinCode = async (req, res) => {
  try {
    const teamId = Number(req.params.teamId);
    if (!Number.isFinite(teamId)) {
      return res.status(400).json({ ok: false, error: "Invalid team id" });
    }

    // Intentar varias veces por si colisiona (muy raro)
    for (let attempt = 0; attempt < 10; attempt++) {
      const newCode = generateJoinCode();

      try {
        const result = await pool.query(
          `UPDATE teams
           SET join_code = $1
           WHERE id = $2 AND trainer_id = $3
           RETURNING id, name, description, trainer_id, join_code, created_at`,
          [newCode, teamId, req.user.id]
        );

        if (result.rows.length === 0) {
          return res.status(404).json({ ok: false, error: "Team not found" });
        }

        return res.json({ ok: true, team: result.rows[0] });
      } catch (err) {
        if (err.code === "23505") continue; // unique_violation
        throw err;
      }
    }

    return res.status(500).json({ ok: false, error: "Could not generate unique join code" });
  } catch (err) {
    console.error("regenerateJoinCode error:", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
};

exports.createTeam = async (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({ ok: false, error: "Missing field: name" });
    }

    for (let attempt = 0; attempt < 10; attempt++) {
      const joinCode = generateJoinCode();

      try {
        const result = await pool.query(
          `INSERT INTO teams (name, description, trainer_id, join_code)
           VALUES ($1, $2, $3, $4)
           RETURNING id, name, description, trainer_id, join_code, created_at`,
          [name, description ?? null, req.user.id, joinCode]
        );

        return res.status(201).json({ ok: true, team: result.rows[0] });
      } catch (err) {
        if (err.code === "23505") continue;
        throw err;
      }
    }

    return res.status(500).json({ ok: false, error: "Could not generate unique join code" });
  } catch (err) {
    console.error("createTeam error:", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
};

// GET /teams (trainer) -> lista solo equipos del trainer logueado
exports.getMyTeams = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, description, trainer_id, join_code, created_at
       FROM teams
       WHERE trainer_id = $1
       ORDER BY id ASC`,
      [req.user.id]
    );

    return res.json({ ok: true, teams: result.rows });
  } catch (err) {
    console.error("getMyTeams error:", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
};

exports.deleteTeam = async (req, res) => {
  try {
    const teamId = Number(req.params.teamId);
    if (!Number.isFinite(teamId)) {
      return res.status(400).json({ ok: false, error: "Invalid team id" });
    }

    await pool.query(`DELETE FROM teams WHERE id = $1`, [teamId]);

    return res.json({ ok: true, deleted_team_id: teamId });
  } catch (err) {
    console.error("deleteTeam error:", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
};

exports.updateTeam = async (req, res) => {
  try {
    const teamId = Number(req.params.teamId);
    if (!Number.isFinite(teamId)) {
      return res.status(400).json({ ok: false, error: "Invalid team id" });
    }

    const { name, description } = req.body;

    if (name == null && description == null) {
      return res.status(400).json({ ok: false, error: "Nothing to update" });
    }

    // Solo puede editar si es suyo
    const result = await pool.query(
      `UPDATE teams
       SET
         name = COALESCE($1, name),
         description = COALESCE($2, description)
       WHERE id = $3 AND trainer_id = $4
       RETURNING id, name, description, trainer_id, join_code, created_at`,
      [name ?? null, description ?? null, teamId, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ ok: false, error: "Team not found" });
    }

    return res.json({ ok: true, team: result.rows[0] });
  } catch (err) {
    console.error("updateTeam error:", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
};

exports.getTeamById = async (req, res) => {
  try {
    const teamId = Number(req.params.teamId);
    if (!Number.isFinite(teamId)) {
      return res.status(400).json({ ok: false, error: "Invalid team id" });
    }

    const result = await pool.query(
      `SELECT id, name, description, trainer_id, created_at
       FROM teams
       WHERE id = $1 AND trainer_id = $2`,
      [teamId, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ ok: false, error: "Team not found" });
    }

    return res.json({ ok: true, team: result.rows[0] });
  } catch (err) {
    console.error("getTeamById error:", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
};

exports.getTeamAthletes = async (req, res) => {
  try {
    const teamId = req.teamId ?? Number(req.params.teamId);

    const result = await pool.query(
      `SELECT id, name, email, role, team_id, created_at
       FROM users
       WHERE team_id = $1 AND role = 'athlete'
       ORDER BY id ASC`,
      [teamId]
    );

    return res.json({ ok: true, team_id: teamId, athletes: result.rows });
  } catch (err) {
    console.error("getTeamAthletes error:", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
};

exports.kickAthleteFromTeam = async (req, res) => {
  try {
    const teamId = Number(req.params.teamId);
    const athleteId = Number(req.params.athleteId);

    if (!Number.isFinite(teamId) || !Number.isFinite(athleteId)) {
      return res.status(400).json({ ok: false, error: "Invalid id" });
    }

    // Seguridad extra (aunque ya usas requireTrainerOwnsTeam):
    // asegurar que el team es del trainer
    const teamCheck = await pool.query(
      `SELECT id FROM teams WHERE id = $1 AND trainer_id = $2`,
      [teamId, req.user.id]
    );
    if (teamCheck.rows.length === 0) {
      return res.status(404).json({ ok: false, error: "Team not found" });
    }

    // Expulsar: set team_id = NULL solo si el atleta está en ese team
    const result = await pool.query(
      `UPDATE users
       SET team_id = NULL
       WHERE id = $1 AND role = 'athlete' AND team_id = $2
       RETURNING id, name, email, role, team_id`,
      [athleteId, teamId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ ok: false, error: "Athlete not found in this team" });
    }

    return res.json({ ok: true, athlete: result.rows[0] });
  } catch (err) {
    console.error("kickAthleteFromTeam error:", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
};

exports.deleteAthlete = async (req, res) => {
  try {
    const athleteId = Number(req.params.athleteId);
    if (!Number.isFinite(athleteId)) {
      return res.status(400).json({ ok: false, error: "Invalid athlete id" });
    }

    // Verificar ownership: athlete -> team -> trainer
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

    // Borrar atleta (todo lo dependiente cae por CASCADE)
    const del = await pool.query(
      `DELETE FROM users
       WHERE id = $1 AND role = 'athlete'
       RETURNING id`,
      [athleteId]
    );

    if (del.rows.length === 0) {
      return res.status(404).json({ ok: false, error: "Athlete not found" });
    }

    return res.json({ ok: true, deleted_athlete_id: del.rows[0].id });
  } catch (err) {
    console.error("deleteAthlete error:", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
};

exports.joinTeamByCode = async (req, res) => {
  try {
    if (req.user.role !== "athlete") {
      return res.status(403).json({ ok: false, error: "Only athletes can join teams" });
    }

    const { join_code } = req.body;
    if (!join_code) {
      return res.status(400).json({ ok: false, error: "Missing field: join_code" });
    }

    // Si ya está en un equipo, no permitir (V1)
    const current = await pool.query(
      `SELECT team_id FROM users WHERE id = $1`,
      [req.user.id]
    );
    if (current.rows.length === 0) {
      return res.status(401).json({ ok: false, error: "User not found" });
    }
    if (current.rows[0].team_id != null) {
      return res.status(400).json({ ok: false, error: "You are already in a team" });
    }

    // Buscar team por código
    const teamRes = await pool.query(
      `SELECT id, name, trainer_id, join_code FROM teams WHERE join_code = $1`,
      [join_code]
    );
    if (teamRes.rows.length === 0) {
      return res.status(400).json({ ok: false, error: "Invalid join_code" });
    }

    const team = teamRes.rows[0];

    // Asignar team_id al atleta
    const upd = await pool.query(
      `UPDATE users
       SET team_id = $1
       WHERE id = $2 AND role = 'athlete'
       RETURNING id, name, email, role, team_id`,
      [team.id, req.user.id]
    );

    return res.json({ ok: true, team, athlete: upd.rows[0] });
  } catch (err) {
    console.error("joinTeamByCode error:", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
};

exports.leaveTeam = async (req, res) => {
  try {
    if (req.user.role !== "athlete") {
      return res.status(403).json({ ok: false, error: "Only athletes can leave teams" });
    }

    const current = await pool.query(
      `SELECT team_id FROM users WHERE id = $1`,
      [req.user.id]
    );

    if (current.rows.length === 0) {
      return res.status(401).json({ ok: false, error: "User not found" });
    }

    if (current.rows[0].team_id == null) {
      return res.status(400).json({ ok: false, error: "You are not in a team" });
    }

    const result = await pool.query(
      `UPDATE users
       SET team_id = NULL
       WHERE id = $1 AND role = 'athlete'
       RETURNING id, name, email, role, team_id`,
      [req.user.id]
    );

    return res.json({ ok: true, athlete: result.rows[0] });
  } catch (err) {
    console.error("leaveTeam error:", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
};