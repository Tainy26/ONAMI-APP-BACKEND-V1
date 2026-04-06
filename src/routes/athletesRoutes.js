const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const requireRole = require("../middleware/requireRole");
const { getAthleteDailyLoadStats } = require("../controllers/dailyLoadController");
const { getAthleteProfileForTrainer } = require("../controllers/profileController");
const { deleteAthlete } = require("../controllers/teamsController");

router.get("/:athleteId/daily-load/stats", authMiddleware, requireRole("trainer"), getAthleteDailyLoadStats);
router.get("/:athleteId/profile", authMiddleware, requireRole("trainer"), getAthleteProfileForTrainer);
router.delete("/:athleteId", authMiddleware, requireRole("trainer"), deleteAthlete);

module.exports = router;