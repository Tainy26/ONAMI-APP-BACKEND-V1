const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const requireRole = require("../middleware/requireRole");

const { getTrainerDashboard, getAthleteDashboard } = require("../controllers/dashboardController");

router.get("/trainer", authMiddleware, requireRole("trainer"), getTrainerDashboard);
router.get("/athlete", authMiddleware, requireRole("athlete"), getAthleteDashboard);

module.exports = router;