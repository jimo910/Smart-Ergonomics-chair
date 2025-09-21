  // server.js (Backend for Smart Ergonomic Chair Dashboard)
// server.js - Smart Ergonomic Chair Dashboard with MySQL

const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const bodyParser = require("body-parser");
const path = require("path");
const mysql = require("mysql2");


//const PORT = process.env.PORT || 3000;
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  // optional SSL config if provider requires it:
  // ssl: { rejectUnauthorized: true }
});

// Create Express app + HTTP server
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Middleware
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public"))); // serve frontend files

// ✅ MySQL Connection
//const db = mysql.createConnection({
//  host: "localhost",
//  user: "root",       // change if you use another user
  //password: "Yamjam@2020",       // set your MySQL password here
  //database: "smart_chair"
//});

//db.connect((err) => {
  //if (err) {
    //console.error("❌ MySQL Connection Failed:", err);
    //process.exit(1);
  //}
  //console.log("✅ Connected to MySQL Database");
//});

// Store latest data in memory for WebSocket clients
let latestData = {
  timestamp: new Date().toISOString(),
  heartRate: 0,
  temperature: 0,
  sugarLevel: 0
};

// Handle WebSocket connections
wss.on("connection", (ws) => {
  console.log("🔗 New WebSocket client connected");
  // Send latest data immediately
  ws.send(JSON.stringify(latestData));
});

// 📥 POST /data → receive new sensor readings
app.post("/data", (req, res) => {
  const { heartRate, temperature, sugarLevel } = req.body;

  latestData = {
    timestamp: new Date().toISOString(),
    heartRate: heartRate || 0,
    temperature: temperature || 0,
    sugarLevel: sugarLevel || 0
  };

  console.log("📥 Data Received:", latestData);

  // Save into MySQL
  const sql = "INSERT INTO readings (heartRate, temperature, sugarLevel) VALUES (?, ?, ?)";
  db.query(sql, [latestData.heartRate, latestData.temperature, latestData.sugarLevel], (err, result) => {
    if (err) {
      console.error("❌ MySQL Insert Error:", err);
      res.status(500).json({ status: "error", error: err });
    } else {
      console.log("💾 Data saved to MySQL, Insert ID:", result.insertId);
      res.json({ status: "success", data: latestData });
    }
  });

  // Broadcast to all WebSocket clients
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

// 📤 GET /reports → last 50 saved readings
app.get("/reports", (req, res) => {
  db.query("SELECT * FROM readings ORDER BY timestamp DESC LIMIT 50", (err, results) => {
    if (err) {
      console.error("❌ MySQL Query Error:", err);
      res.status(500).json({ status: "error", error: err });
    } else {
      res.json(results);
    }
  });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
