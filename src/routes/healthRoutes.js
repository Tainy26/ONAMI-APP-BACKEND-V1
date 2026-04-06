const express = require("express");
const router = express.Router();
const pool = require("../db/pool");

router.get("/db", async (req, res) => {
    try{
        const r = await pool.query("SELECT NOW() as now");
        res.json({ ok: true, db_time: r.rows[0]. now });
    } catch (err) {
        console.error(err);
        res.status(500).json({ ok: false, error: "DB connection failed" });
    }
});

module.exports = router;