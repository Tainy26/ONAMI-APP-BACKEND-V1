const pool = require("../db/pool");

exports.upsertMyDailyLoad = async (req, res) => {
  try {
    const { date, fatigue, soreness, sleep_quality, stress, mood, notes } = req.body;

    if (!date || fatigue == null) {
      return res.status(400).json({ ok: false, error: "Missing fields: date, fatigue" });
    }

    const check1to10 = (v) => v == null || (Number.isInteger(v) && v >= 1 && v <= 10);
    if (
      !check1to10(fatigue) ||
      !check1to10(soreness) ||
      !check1to10(sleep_quality) ||
      !check1to10(stress) ||
      !check1to10(mood)
    ) {
      return res.status(400).json({ ok: false, error: "Values must be integers between 1 and 10" });
    }

    const result = await pool.query(
      `INSERT INTO daily_load (user_id, date, fatigue, soreness, sleep_quality, stress, mood, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (user_id, date)
       DO UPDATE SET
         fatigue = EXCLUDED.fatigue,
         soreness = EXCLUDED.soreness,
         sleep_quality = EXCLUDED.sleep_quality,
         stress = EXCLUDED.stress,
         mood = EXCLUDED.mood,
         notes = EXCLUDED.notes
       RETURNING id, user_id, date, fatigue, soreness, sleep_quality, stress, mood, notes, created_at`,
      [
        req.user.id,
        date,
        fatigue,
        soreness ?? null,
        sleep_quality ?? null,
        stress ?? null,
        mood ?? null,
        notes ?? null,
      ]
    );

    return res.status(200).json({ ok: true, daily_load: result.rows[0] });
  } catch (err) {
    console.error("upsertMyDailyLoad error:", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
};

exports.getMyDailyLoad = async (req, res) => {
  try {
    const { from, to } = req.query;

    let sql = `
      SELECT id, user_id, date, fatigue, soreness, sleep_quality, stress, mood, notes, created_at
      FROM daily_load
      WHERE user_id = $1
    `;
    const params = [req.user.id];

    if (from) {
      params.push(from);
      sql += ` AND date >= $${params.length}`;
    }
    if (to) {
      params.push(to);
      sql += ` AND date <= $${params.length}`;
    }

    sql += ` ORDER BY date DESC`;

    const result = await pool.query(sql, params);
    return res.json({ ok: true, daily_load: result.rows });
  } catch (err) {
    console.error("getMyDailyLoad error:", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
};

exports.getTeamDailyLoad = async (req, res) => {
  try {
    const teamId = Number(req.params.teamId);
    if (!Number.isFinite(teamId)) {
      return res.status(400).json({ ok: false, error: "Invalid team id" });
    }

    const teamCheck = await pool.query(
      `SELECT id FROM teams WHERE id = $1 AND trainer_id = $2`,
      [teamId, req.user.id]
    );

    if (teamCheck.rows.length === 0) {
      return res.status(404).json({ ok: false, error: "Team not found" });
    }

    const { from, to } = req.query;

    let sql = `
      SELECT
        u.id AS athlete_id,
        u.name AS athlete_name,
        u.email AS athlete_email,
        u.team_id,
        dl.id AS daily_load_id,
        dl.date,
        dl.fatigue,
        dl.soreness,
        dl.sleep_quality,
        dl.stress,
        dl.mood,
        dl.notes,
        dl.created_at
      FROM users u
      LEFT JOIN daily_load dl
        ON dl.user_id = u.id
    `;

    const params = [teamId];
    const where = [`u.team_id = $1`, `u.role = 'athlete'`];

    if (from) {
      params.push(from);
      where.push(`(dl.date IS NULL OR dl.date >= $${params.length})`);
    }

    if (to) {
      params.push(to);
      where.push(`(dl.date IS NULL OR dl.date <= $${params.length})`);
    }

    sql += ` WHERE ${where.join(" AND ")} ORDER BY u.id ASC, dl.date DESC NULLS LAST`;

    const result = await pool.query(sql, params);

    return res.json({ ok: true, team_id: teamId, rows: result.rows });
  } catch (err) {
    console.error("getTeamDailyLoad error:", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
};

exports.getMyDailyLoadStats = async (req, res) => {
  try {
    // Último registro
    const last = await pool.query(
      `SELECT id, user_id, date, fatigue, soreness, sleep_quality, stress, mood, notes, created_at
       FROM daily_load
       WHERE user_id = $1
       ORDER BY date DESC
       LIMIT 1`,
      [req.user.id]
    );

    // Promedio últimos 7 días
    const avg7 = await pool.query(
      `SELECT
         AVG(fatigue)::numeric(10,2) AS fatigue_avg,
         AVG(soreness)::numeric(10,2) AS soreness_avg,
         AVG(sleep_quality)::numeric(10,2) AS sleep_quality_avg,
         AVG(stress)::numeric(10,2) AS stress_avg,
         AVG(mood)::numeric(10,2) AS mood_avg
       FROM daily_load
       WHERE user_id = $1 AND date >= CURRENT_DATE - INTERVAL '6 days'`,
      [req.user.id]
    );

    // Promedio últimos 28 días
    const avg28 = await pool.query(
      `SELECT
         AVG(fatigue)::numeric(10,2) AS fatigue_avg,
         AVG(soreness)::numeric(10,2) AS soreness_avg,
         AVG(sleep_quality)::numeric(10,2) AS sleep_quality_avg,
         AVG(stress)::numeric(10,2) AS stress_avg,
         AVG(mood)::numeric(10,2) AS mood_avg
       FROM daily_load
       WHERE user_id = $1 AND date >= CURRENT_DATE - INTERVAL '27 days'`,
      [req.user.id]
    );

    // Tendencia simple: 7 días recientes vs 7 anteriores
    const trend = await pool.query(
      `WITH last7 AS (
         SELECT AVG(fatigue) AS avg_f
         FROM daily_load
         WHERE user_id = $1 AND date >= CURRENT_DATE - INTERVAL '6 days'
       ),
       prev7 AS (
         SELECT AVG(fatigue) AS avg_f
         FROM daily_load
         WHERE user_id = $1
           AND date BETWEEN (CURRENT_DATE - INTERVAL '13 days') AND (CURRENT_DATE - INTERVAL '7 days')
       )
       SELECT
         (SELECT avg_f FROM last7) AS last7_fatigue_avg,
         (SELECT avg_f FROM prev7) AS prev7_fatigue_avg`,
      [req.user.id]
    );

    const t = trend.rows[0] || {};
    const last7Fat = t.last7_fatigue_avg == null ? null : Number(t.last7_fatigue_avg);
    const prev7Fat = t.prev7_fatigue_avg == null ? null : Number(t.prev7_fatigue_avg);

    let fatigue_trend = null; // "up" | "down" | "flat"
    if (last7Fat != null && prev7Fat != null) {
      const diff = last7Fat - prev7Fat;
      if (diff > 0.5) fatigue_trend = "up";
      else if (diff < -0.5) fatigue_trend = "down";
      else fatigue_trend = "flat";
    }

    return res.json({
      ok: true,
      last: last.rows[0] ?? null,
      avg_7d: avg7.rows[0],
      avg_28d: avg28.rows[0],
      trend: {
        last7_fatigue_avg: t.last7_fatigue_avg,
        prev7_fatigue_avg: t.prev7_fatigue_avg,
        fatigue_trend,
      },
    });
  } catch (err) {
    console.error("getMyDailyLoadStats error:", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
};

exports.getTeamDailyLoadStats = async (req, res) => {
  try {
    const teamId = Number(req.params.teamId);
    if (!Number.isFinite(teamId)) {
      return res.status(400).json({ ok: false, error: "Invalid team id" });
    }

    // Verificar que el team pertenece al trainer
    const teamCheck = await pool.query(
      `SELECT id FROM teams WHERE id = $1 AND trainer_id = $2`,
      [teamId, req.user.id]
    );
    if (teamCheck.rows.length === 0) {
      return res.status(404).json({ ok: false, error: "Team not found" });
    }

    // Por atleta: último registro + avg 7d + alerta (>=8 en últimos 3 días)
    const perAthlete = await pool.query(
      `
      WITH athletes AS (
        SELECT id, name, email
        FROM users
        WHERE team_id = $1 AND role = 'athlete'
      ),
      last_dl AS (
        SELECT DISTINCT ON (user_id)
          user_id,
          date AS last_date,
          fatigue AS last_fatigue
        FROM daily_load
        WHERE user_id IN (SELECT id FROM athletes)
        ORDER BY user_id, date DESC
      ),
      avg7 AS (
        SELECT user_id, AVG(fatigue)::numeric(10,2) AS avg_7d_fatigue
        FROM daily_load
        WHERE user_id IN (SELECT id FROM athletes)
          AND date >= CURRENT_DATE - INTERVAL '6 days'
        GROUP BY user_id
      ),
      alert3 AS (
        SELECT user_id,
               (COUNT(*) FILTER (WHERE fatigue >= 8) >= 2) AS high_fatigue_recent
        FROM daily_load
        WHERE user_id IN (SELECT id FROM athletes)
          AND date >= CURRENT_DATE - INTERVAL '2 days'
        GROUP BY user_id
      )
      SELECT
        a.id AS athlete_id,
        a.name,
        a.email,
        l.last_date,
        l.last_fatigue,
        v.avg_7d_fatigue,
        COALESCE(al.high_fatigue_recent, false) AS alert_high_fatigue
      FROM athletes a
      LEFT JOIN last_dl l ON l.user_id = a.id
      LEFT JOIN avg7 v ON v.user_id = a.id
      LEFT JOIN alert3 al ON al.user_id = a.id
      ORDER BY a.id ASC
      `,
      [teamId]
    );

    // Resumen equipo (avg 7d de fatiga)
    const teamAvg7 = await pool.query(
      `
      SELECT AVG(dl.fatigue)::numeric(10,2) AS team_avg_7d_fatigue
      FROM daily_load dl
      JOIN users u ON u.id = dl.user_id
      WHERE u.team_id = $1 AND u.role = 'athlete'
        AND dl.date >= CURRENT_DATE - INTERVAL '6 days'
      `,
      [teamId]
    );

    return res.json({
      ok: true,
      team_id: teamId,
      team_avg_7d_fatigue: teamAvg7.rows[0]?.team_avg_7d_fatigue ?? null,
      athletes: perAthlete.rows,
    });
  } catch (err) {
    console.error("getTeamDailyLoadStats error:", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
};

exports.getAthleteDailyLoadStats = async (req, res) => {
  try {
    const athleteId = Number(req.params.athleteId);
    if (!Number.isFinite(athleteId)) {
      return res.status(400).json({ ok: false, error: "Invalid athlete id" });
    }

    // Verificar que el atleta pertenece a un team del trainer
    const check = await pool.query(
      `SELECT u.id
       FROM users u
       JOIN teams t ON t.id = u.team_id
       WHERE u.id = $1 AND u.role = 'athlete' AND t.trainer_id = $2`,
      [athleteId, req.user.id]
    );

    if (check.rows.length === 0) {
      return res.status(403).json({ ok: false, error: "Forbidden" });
    }

    // Reutilizamos lógica similar a /mine/stats pero con athleteId

    const last = await pool.query(
      `SELECT id, user_id, date, fatigue, soreness, sleep_quality, stress, mood, notes, created_at
       FROM daily_load
       WHERE user_id = $1
       ORDER BY date DESC
       LIMIT 1`,
      [athleteId]
    );

    const avg7 = await pool.query(
      `SELECT AVG(fatigue)::numeric(10,2) AS fatigue_avg
       FROM daily_load
       WHERE user_id = $1
         AND date >= CURRENT_DATE - INTERVAL '6 days'`,
      [athleteId]
    );

    const avg28 = await pool.query(
      `SELECT AVG(fatigue)::numeric(10,2) AS fatigue_avg
       FROM daily_load
       WHERE user_id = $1
         AND date >= CURRENT_DATE - INTERVAL '27 days'`,
      [athleteId]
    );

    const trend = await pool.query(
      `WITH last7 AS (
         SELECT AVG(fatigue) AS avg_f
         FROM daily_load
         WHERE user_id = $1
           AND date >= CURRENT_DATE - INTERVAL '6 days'
       ),
       prev7 AS (
         SELECT AVG(fatigue) AS avg_f
         FROM daily_load
         WHERE user_id = $1
           AND date BETWEEN (CURRENT_DATE - INTERVAL '13 days')
                         AND (CURRENT_DATE - INTERVAL '7 days')
       )
       SELECT
         (SELECT avg_f FROM last7) AS last7_fatigue_avg,
         (SELECT avg_f FROM prev7) AS prev7_fatigue_avg`,
      [athleteId]
    );

    const t = trend.rows[0] || {};
    const last7Fat = t.last7_fatigue_avg == null ? null : Number(t.last7_fatigue_avg);
    const prev7Fat = t.prev7_fatigue_avg == null ? null : Number(t.prev7_fatigue_avg);

    let fatigue_trend = null;
    if (last7Fat != null && prev7Fat != null) {
      const diff = last7Fat - prev7Fat;
      if (diff > 0.5) fatigue_trend = "up";
      else if (diff < -0.5) fatigue_trend = "down";
      else fatigue_trend = "flat";
    }

    return res.json({
      ok: true,
      athlete_id: athleteId,
      last: last.rows[0] ?? null,
      avg_7d_fatigue: avg7.rows[0]?.fatigue_avg ?? null,
      avg_28d_fatigue: avg28.rows[0]?.fatigue_avg ?? null,
      trend: {
        last7_fatigue_avg: t.last7_fatigue_avg,
        prev7_fatigue_avg: t.prev7_fatigue_avg,
        fatigue_trend,
      },
    });

  } catch (err) {
    console.error("getAthleteDailyLoadStats error:", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
};