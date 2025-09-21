// server.js - Smart Ergonomic Chair Dashboard with MySQL + WebSocket

const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const bodyParser = require("body-parser");
const path = require("path");
const mysql = require("mysql2");

// ---------------------
// Database Connection
// ---------------------
const db = mysql.createConnection({
  host: process.env.DB_HOST,     // e.g., aws.connect.psdb.cloud
  user: process.env.DB_USER,     // e.g., your username
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: { rejectUnauthorized: true } // needed for PlanetScale / Aiven
});

db.connect((err) => {
  if (err) {
    console.error("❌ MySQL Connection Failed:", err);
    process.exit(1);
  }
  console.log("✅ Connected to MySQL Database");
});

// ---------------------
// Express + WebSocket
// ---------------------
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Middleware
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public"))); // serve frontend

// ---------------------
// State
// ---------------------
let latestData = {
  timestamp: new Date().toISOString(),
  heartRate: 0,
  temperature: 0,
  sugarLevel: 0
};

// ---------------------
// WebSocket Handling
// ---------------------
wss.on("connection", (ws) => {
  console.log("🔗 WebSocket client connected");
  ws.send(JSON.stringify(latestData));
});

// ---------------------
// Routes
// ---------------------

// 📥 POST /data → receive sensor data
app.post("/data", (req, res) => {
  const { heartRate, temperature, sugarLevel } = req.body;

  latestData = {
    timestamp: new Date().toISOString(),
    heartRate: heartRate || 0,
    temperature: temperature || 0,
    sugarLevel: sugarLevel || 0
  };

  console.log("📥 Data Received:", latestData);

  const sql =
    "INSERT INTO readings (heartRate, temperature, sugarLevel) VALUES (?, ?, ?)";
  db.query(
    sql,
    [latestData.heartRate, latestData.temperature, latestData.sugarLevel],
    (err, result) => {
      if (err) {
        console.error("❌ MySQL Insert Error:", err);
        return res.status(500).json({ status: "error", error: err });
      }
      console.log("💾 Data saved to MySQL, Insert ID:", result.insertId);
      res.json({ status: "success", data: latestData });
    }
  );

  // broadcast to WebSocket clients
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(latestData));
    }
  });
});

// 📤 GET /data → latest reading
app.get("/data", (req, res) => {
  res.json(latestData);
});

// 📤 GET /reports → last 50 rows
app.get("/reports", (req, res) => {
  db.query(
    "SELECT * FROM readings ORDER BY timestamp DESC LIMIT 50",
    (err, results) => {
      if (err) {
        console.error("❌ MySQL Query Error:", err);
        return res.status(500).json({ status: "error", error: err });
      }
      res.json(results);
    }
  );
});

// ---------------------
// Start server
// ---------------------
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
