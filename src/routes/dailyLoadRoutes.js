const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const requireRole = require("../middleware/requireRole");

const {upsertMyDailyLoad, getMyDailyLoad, getMyDailyLoadStats} = require("../controllers/dailyLoadController");

router.post("/", authMiddleware, requireRole("athlete"), upsertMyDailyLoad);
router.get("/mine", authMiddleware, requireRole("athlete"), getMyDailyLoad);
router.get("/mine/stats", authMiddleware, requireRole("athlete"), getMyDailyLoadStats);

module.exports = router;