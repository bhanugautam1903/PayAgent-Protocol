require("dotenv").config();

const express = require("express");
const cors = require("cors");

const agentRoutes = require("./routes/agentRoutes");
const permissionRoutes = require("./routes/permissionRoutes");
const taskRoutes = require("./routes/taskRoutes");

const app = express();

app.use(cors());
app.use(express.json());

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

app.use("/api/agents", agentRoutes);
app.use("/api/permissions", permissionRoutes);
app.use("/api/tasks", taskRoutes);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`PayAgent Backend running on port ${PORT}`);
});
