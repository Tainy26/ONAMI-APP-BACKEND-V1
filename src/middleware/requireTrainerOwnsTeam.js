const pool = require ("../db/pool");

module.exports = function requireTrainerOwnsTeam(paramName = "teamId") {
    return async (req, res, next) => {
        try {
            const teamId = Number(req.params[paramName]);
            if (!Number.isFinite(teamId)) {
                return res.status(400).json({ ok: false, error: "Invalid Team ID" });
            }

            const result = await pool.query(
                `SELECT id FROM teams WHERE id = $1 AND trainer_id = $2`,
                [teamId, req.user.id]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ ok: false, error: "Team Not Found" });
            }

            req.teamId = teamId;
            next();
        }   catch (err) {
            console.error("requireTrainerOwnsTeam error: ", err);
            return res.status(500).json({ ok: false, error: "Server Error" });
        }
    };
};