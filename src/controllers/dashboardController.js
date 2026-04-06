const pool = require("../db/pool");

exports.getTrainerDashboard = async (req, res) => {
  try {
    // 1) Teams del trainer + contador de atletas
    const teamsRes = await pool.query(
      `SELECT
         t.id,
         t.name,
         t.description,
         t.join_code,
         t.created_at,
         COUNT(u.id) FILTER (WHERE u.role = 'athlete')::int AS athletes_count
       FROM teams t
       LEFT JOIN users u ON u.team_id = t.id
       WHERE t.trainer_id = $1
       GROUP BY t.id
       ORDER BY t.id ASC`,
      [req.user.id]
    );

    const teams = teamsRes.rows;

    // Si no tiene teams, devolvemos dashboard vacío
    if (teams.length === 0) {
      return res.json({ ok: true, teams: [], summary: { total_teams: 0, total_athletes: 0 } });
    }

    const teamIds = teams.map(t => t.id);

    // 2) Avg 7d fatigue por team
    const avgRes = await pool.query(
      `SELECT
         u.team_id,
         AVG(dl.fatigue)::numeric(10,2) AS team_avg_7d_fatigue
       FROM daily_load dl
       JOIN users u ON u.id = dl.user_id
       WHERE u.team_id = ANY($1)
         AND u.role = 'athlete'
         AND dl.date >= CURRENT_DATE - INTERVAL '6 days'
       GROUP BY u.team_id`,
      [teamIds]
    );

    const avgByTeam = new Map();
    for (const row of avgRes.rows) avgByTeam.set(row.team_id, row.team_avg_7d_fatigue);

    // 3) Alertas: >=2 registros con fatigue>=8 en últimos 3 días (hoy/ayer/anteayer)
    const alertsRes = await pool.query(
      `WITH recent AS (
         SELECT
           u.team_id,
           u.id AS athlete_id,
           u.name AS athlete_name,
           u.email AS athlete_email,
           COUNT(*) FILTER (WHERE dl.fatigue >= 8) AS high_days,
           MAX(dl.date) AS last_date,
           MAX(dl.fatigue) FILTER (WHERE dl.date = (SELECT MAX(date) FROM daily_load WHERE user_id = u.id)) AS last_fatigue
         FROM users u
         JOIN daily_load dl ON dl.user_id = u.id
         WHERE u.team_id = ANY($1)
           AND u.role = 'athlete'
           AND dl.date >= CURRENT_DATE - INTERVAL '2 days'
         GROUP BY u.team_id, u.id, u.name, u.email
       )
       SELECT *
       FROM recent
       WHERE high_days >= 2
       ORDER BY team_id ASC, athlete_id ASC`,
      [teamIds]
    );

    const alertsByTeam = new Map();
    for (const row of alertsRes.rows) {
      if (!alertsByTeam.has(row.team_id)) alertsByTeam.set(row.team_id, []);
      alertsByTeam.get(row.team_id).push({
        athlete_id: row.athlete_id,
        name: row.athlete_name,
        email: row.athlete_email,
        high_days_last_3d: Number(row.high_days),
        last_date: row.last_date,
        last_fatigue: row.last_fatigue ?? null,
      });
    }

    // 4) Adherencia: cuántos athletes registraron hoy y en últimos 3 días
    const adherenceRes = await pool.query(
      `SELECT
         u.team_id,
         COUNT(u.id) FILTER (WHERE u.role = 'athlete')::int AS athletes_total,
         COUNT(DISTINCT u.id) FILTER (
           WHERE u.role = 'athlete'
             AND EXISTS (
               SELECT 1 FROM daily_load dl
               WHERE dl.user_id = u.id AND dl.date = CURRENT_DATE
             )
         )::int AS athletes_with_load_today,
         COUNT(DISTINCT u.id) FILTER (
           WHERE u.role = 'athlete'
             AND EXISTS (
               SELECT 1 FROM daily_load dl
               WHERE dl.user_id = u.id AND dl.date >= CURRENT_DATE - INTERVAL '2 days'
             )
         )::int AS athletes_with_load_last_3d
       FROM users u
       WHERE u.team_id = ANY($1)
       GROUP BY u.team_id`,
      [teamIds]
    );

    const adherenceByTeam = new Map();
    for (const row of adherenceRes.rows) {
      adherenceByTeam.set(row.team_id, {
        athletes_total: row.athletes_total,
        athletes_with_load_today: row.athletes_with_load_today,
        athletes_with_load_last_3d: row.athletes_with_load_last_3d,
      });
    }

    // Construimos respuesta final por team
    const teamsOut = teams.map(t => ({
      ...t,
      team_avg_7d_fatigue: avgByTeam.get(t.id) ?? null,
      alerts_high_fatigue: alertsByTeam.get(t.id) ?? [],
      adherence: adherenceByTeam.get(t.id) ?? {
        athletes_total: t.athletes_count,
        athletes_with_load_today: 0,
        athletes_with_load_last_3d: 0,
      },
    }));

    const totalTeams = teamsOut.length;
    const totalAthletes = teamsOut.reduce((acc, x) => acc + (x.athletes_count || 0), 0);
    const totalAlerts = teamsOut.reduce((acc, x) => acc + (x.alerts_high_fatigue?.length || 0), 0);

    return res.json({
      ok: true,
      summary: {
        total_teams: totalTeams,
        total_athletes: totalAthletes,
        total_alerts_high_fatigue: totalAlerts,
      },
      teams: teamsOut,
    });
  } catch (err) {
    console.error("getTrainerDashboard error:", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
};

exports.getAthleteDashboard = async (req, res) => {
  try {
    const userId = req.user.id;

    // 1️⃣ Info del user + team
    const userRes = await pool.query(
      `SELECT u.id, u.name, u.team_id, t.name AS team_name, t.trainer_id
       FROM users u
       LEFT JOIN teams t ON t.id = u.team_id
       WHERE u.id = $1`,
      [userId]
    );

    if (userRes.rows.length === 0) {
      return res.status(404).json({ ok: false, error: "User not found" });
    }

    const user = userRes.rows[0];

    // 2️⃣ Último daily_load
    const lastLoadRes = await pool.query(
      `SELECT date, fatigue, soreness, sleep_quality, stress, mood
       FROM daily_load
       WHERE user_id = $1
       ORDER BY date DESC
       LIMIT 1`,
      [userId]
    );

    const last_load = lastLoadRes.rows[0] ?? null;

    // 3️⃣ Promedios 7d y 3d
    const avgRes = await pool.query(
      `SELECT
         AVG(fatigue) FILTER (WHERE date >= CURRENT_DATE - INTERVAL '6 days')::numeric(10,2) AS avg_7d,
         AVG(fatigue) FILTER (WHERE date >= CURRENT_DATE - INTERVAL '2 days')::numeric(10,2) AS avg_3d,
         COUNT(*) FILTER (WHERE date >= CURRENT_DATE - INTERVAL '2 days' AND fatigue >= 8) AS high_days_last_3d
       FROM daily_load
       WHERE user_id = $1`,
      [userId]
    );

    const stats = avgRes.rows[0];

    const personal_alert = stats.high_days_last_3d >= 2;

    // 4️⃣ Ha registrado hoy?
    const todayRes = await pool.query(
      `SELECT 1
       FROM daily_load
       WHERE user_id = $1 AND date = CURRENT_DATE`,
      [userId]
    );

    const has_registered_today = todayRes.rows.length > 0;

    // 5️⃣ Próxima sesión (si tiene team)
    let next_session = null;
    let last_session = null;

    if (user.team_id) {
      const nextRes = await pool.query(
        `SELECT id, date, type, duration
         FROM sessions
         WHERE team_id = $1 AND date >= CURRENT_DATE
         ORDER BY date ASC
         LIMIT 1`,
        [user.team_id]
      );

      next_session = nextRes.rows[0] ?? null;

      const lastSessionRes = await pool.query(
        `SELECT id, date, type, duration
         FROM sessions
         WHERE team_id = $1 AND date < CURRENT_DATE
         ORDER BY date DESC
         LIMIT 1`,
        [user.team_id]
      );

      last_session = lastSessionRes.rows[0] ?? null;
    }

    return res.json({
      ok: true,
      athlete: {
        id: user.id,
        name: user.name,
        team_id: user.team_id,
        team_name: user.team_name,
        trainer_id: user.trainer_id,
      },
      load_summary: {
        last_load,
        avg_7d_fatigue: stats.avg_7d,
        avg_3d_fatigue: stats.avg_3d,
        personal_alert,
        has_registered_today,
      },
      sessions: {
        next_session,
        last_session,
      },
    });
  } catch (err) {
    console.error("getAthleteDashboard error:", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
};