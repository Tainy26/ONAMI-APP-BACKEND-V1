const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const requireRole = require("../middleware/requireRole");
const requireTrainerOwnsTeam = require("../middleware/requireTrainerOwnsTeam");
const { createTeamSession, listTeamSessions, updateTeamSession, deleteTeamSession, getMySessions, getSessionDetail } = require("../controllers/sessionsController");
const { listSessionExercises, addSessionExercise, updateSessionExercise, deleteSessionExercise } = require("../controllers/sessionExercisesController");
// Crear sesión para un equipo (solo trainer dueño)
router.post("/team/:teamId", authMiddleware, requireRole("trainer"), requireTrainerOwnsTeam("teamId"), createTeamSession);

// Listar sesiones del equipo (trainer dueño o athlete del equipo)
router.get("/team/:teamId", authMiddleware, listTeamSessions);

router.get("/mine", authMiddleware, getMySessions);

// ✅ Ejercicios dentro de sesión
router.get("/:sessionId/exercises", authMiddleware, listSessionExercises);

router.post("/:sessionId/exercises", authMiddleware, requireRole("trainer"), addSessionExercise);

router.get("/:sessionId", authMiddleware, getSessionDetail);

router.put("/:sessionId/exercises/:exerciseId", authMiddleware, requireRole("trainer"), updateSessionExercise);

router.delete("/:sessionId/exercises/:exerciseId", authMiddleware, requireRole("trainer"), deleteSessionExercise);

// Editar sesión (solo trainer)
router.put("/:sessionId", authMiddleware, requireRole("trainer"), updateTeamSession);

// Borrar sesión (solo trainer)
router.delete("/:sessionId", authMiddleware, requireRole("trainer"), deleteTeamSession);

module.exports = router;