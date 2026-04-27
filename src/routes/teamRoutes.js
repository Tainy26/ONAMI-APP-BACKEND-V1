const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const requireRole = require("../middleware/requireRole");
const { regenerateJoinCode, createTeam, getMyTeams, deleteTeam, updateTeam, getTeamById, getTeamAthletes, kickAthleteFromTeam, joinTeamByCode, leaveTeam, getMyTeamAsAthlete } = require("../controllers/teamsController");
const { getTeamDailyLoad, getTeamDailyLoadStats } = require("../controllers/dailyLoadController");
const requireTrainerOwnsTeam = require("../middleware/requireTrainerOwnsTeam");

/* RUTAS ATHLETE */
router.get("/mine", authMiddleware, requireRole("athlete"), getMyTeamAsAthlete);
router.post("/join", authMiddleware, requireRole("athlete"), joinTeamByCode);
router.post("/leave", authMiddleware, requireRole("athlete"), leaveTeam);

/* RUTAS TRAINER */
router.post("/", authMiddleware, requireRole("trainer"), createTeam);
router.get("/", authMiddleware, requireRole("trainer"), getMyTeams);
router.get("/:teamId/daily-load/stats", authMiddleware, requireRole("trainer"), requireTrainerOwnsTeam("teamId"), getTeamDailyLoadStats);
router.get("/:teamId/daily-load", authMiddleware, requireRole("trainer"), requireTrainerOwnsTeam("teamId"), getTeamDailyLoad);
router.get("/:teamId/athletes", authMiddleware, requireRole("trainer"), requireTrainerOwnsTeam("teamId"), getTeamAthletes);
router.delete("/:teamId/athletes/:athleteId", authMiddleware, requireRole("trainer"), requireTrainerOwnsTeam("teamId"), kickAthleteFromTeam);
router.post("/:teamId/join-code/regenerate", authMiddleware, requireRole("trainer"), requireTrainerOwnsTeam("teamId"), regenerateJoinCode);
router.get("/:teamId", authMiddleware, requireRole("trainer"), requireTrainerOwnsTeam("teamId"), getTeamById);
router.put("/:teamId", authMiddleware, requireRole("trainer"), requireTrainerOwnsTeam("teamId"), updateTeam);
router.delete("/:teamId", authMiddleware, requireRole("trainer"), requireTrainerOwnsTeam("teamId"), deleteTeam);

module.exports = router;