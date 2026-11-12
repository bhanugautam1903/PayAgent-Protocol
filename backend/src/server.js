require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { rateLimit } = require("express-rate-limit");

const agentRoutes = require("./routes/agentRoutes");
const permissionRoutes = require("./routes/permissionRoutes");
const taskRoutes = require("./routes/taskRoutes");

const app = express();

if (process.env.RENDER) {
  app.set("trust proxy", 1);
}

app.use(cors());
app.use(express.json({ limit: "1mb" }));

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests. Please try again later.",
  },
});

const taskWriteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many task requests. Please try again later.",
  },
});

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    project: "PayAgent Protocol",
    message: "Welcome to PayAgent Backend!",
  });
});

app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    status: "healthy",
    service: "PayAgent API",
    version: "1.0.0",
  });
});

app.use("/api", apiLimiter);

app.use("/api/tasks", (req, res, next) => {
  if (req.method === "POST") {
    return taskWriteLimiter(req, res, next);
  }

  next();
});

app.use("/api/agents", agentRoutes);
app.use("/api/permissions", permissionRoutes);
app.use("/api/tasks", taskRoutes);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`PayAgent Backend running on port ${PORT}`);
});
