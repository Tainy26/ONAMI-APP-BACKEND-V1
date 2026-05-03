const express = require("express");
const cors = require("cors");

const healthRoutes = require("./routes/healthRoutes");
const userRoutes = require("./routes/userRoutes")
const authRoutes = require("./routes/authRoutes");
const athletesRoutes = require("./routes/athletesRoutes");
const teamsRoutes = require("./routes/teamRoutes");
const dailyLoadRoutes = require("./routes/dailyLoadRoutes");
const sessionsRoutes = require ("./routes/sessionsRoutes");
const profileRoutes = require("./routes/profileRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");


const app = express();

const corsOptions = {
  origin: process.env.CORS_ORIGIN || "*",
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.options("*", cors(corsOptions));
app.use(cors(corsOptions));
app.use(express.json());

app.get("/", (req, res) => {res.send("ONAMI API FUNCIONANDO");});

app.use("/health", healthRoutes);
app.use("/users", userRoutes);
app.use("/auth", authRoutes);
app.use("/athletes", athletesRoutes);
app.use("/teams", teamsRoutes);
app.use("/daily-load", dailyLoadRoutes);
app.use("/sessions", sessionsRoutes);
app.use("/profile", profileRoutes);
app.use("/dashboard", dashboardRoutes);


module.exports = app;