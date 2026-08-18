import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import initSqlJs from 'sql.js';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

const DB_PATH = path.join(__dirname, 'database', 'portal.sqlite');
let db = null;

async function initDb() {
  const SQL = await initSqlJs();
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS skin_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER DEFAULT 1,
      date TEXT NOT NULL,
      severity INTEGER,
      dairy INTEGER DEFAULT 0,
      sugar INTEGER DEFAULT 0,
      fried_food INTEGER DEFAULT 0,
      poor_sleep INTEGER DEFAULT 0,
      high_stress INTEGER DEFAULT 0,
      intense_workout INTEGER DEFAULT 0,
      new_product INTEGER DEFAULT 0,
      skipped_routine INTEGER DEFAULT 0,
      picking INTEGER DEFAULT 0,
      reflection TEXT,
      logged_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  saveDb();
  console.log('Database initialized');
}

function saveDb() {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

function createSkinLog(data) {
  const today = new Date().toISOString().split('T')[0];
  const existing = db.exec('SELECT id FROM skin_logs WHERE user_id = 1 AND date = ?', [today]);
  
  if (existing.length > 0 && existing[0].values.length > 0) {
    db.run(`UPDATE skin_logs SET severity = ?, dairy = ?, sugar = ?, fried_food = ?, poor_sleep = ?, high_stress = ?, intense_workout = ?, new_product = ?, skipped_routine = ?, picking = ?, reflection = ?, logged_at = CURRENT_TIMESTAMP WHERE user_id = 1 AND date = ?`,
      [data.severity, data.dairy||0, data.sugar||0, data.fried_food||0, data.poor_sleep||0, data.high_stress||0, data.intense_workout||0, data.new_product||0, data.skipped_routine||0, data.picking||0, data.reflection||null, today]);
  } else {
    db.run(`INSERT INTO skin_logs (user_id, date, severity, dairy, sugar, fried_food, poor_sleep, high_stress, intense_workout, new_product, skipped_routine, picking, reflection) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [today, data.severity, data.dairy||0, data.sugar||0, data.fried_food||0, data.poor_sleep||0, data.high_stress||0, data.intense_workout||0, data.new_product||0, data.skipped_routine||0, data.picking||0, data.reflection||null]);
  }
  
  saveDb();
  return getSkinLogByDate(today);
}

function getSkinLogByDate(date) {
  const result = db.exec('SELECT * FROM skin_logs WHERE user_id = 1 AND date = ?', [date]);
  if (result.length === 0 || result[0].values.length === 0) return null;
  const cols = result[0].columns;
  const vals = result[0].values[0];
  return Object.fromEntries(cols.map((c, i) => [c, vals[i]]));
}

function getSkinLogs(limit = 30) {
  const result = db.exec('SELECT * FROM skin_logs WHERE user_id = 1 ORDER BY date DESC LIMIT ?', [limit]);
  if (result.length === 0 || result[0].values.length === 0) return [];
  const cols = result[0].columns;
  return result[0].values.map(row => Object.fromEntries(cols.map((c, i) => [c, row[i]])));
}

function getLatestSkinLog() {
  const result = db.exec('SELECT * FROM skin_logs WHERE user_id = 1 ORDER BY logged_at DESC LIMIT 1');
  if (result.length === 0 || result[0].values.length === 0) return null;
  const cols = result[0].columns;
  const vals = result[0].values[0];
  return Object.fromEntries(cols.map((c, i) => [c, vals[i]]));
}

function canLogSkin() {
  const latest = getLatestSkinLog();
  if (!latest) return { canLog: true, lastLogAt: null, hoursSince: null };
  const lastLogTime = new Date(latest.logged_at);
  const now = new Date();
  const hoursSince = (now - lastLogTime) / (1000 * 60 * 60);
  return { canLog: hoursSince >= 2, lastLogAt: latest.logged_at, hoursSince: Math.round(hoursSince) };
}

// API Routes
app.post('/api/portal/skin-logs', (req, res) => {
  const { severity, dairy, sugar, fried_food, poor_sleep, high_stress, intense_workout, new_product, skipped_routine, picking, reflection } = req.body;
  
  if (!severity || severity < 1 || severity > 5) {
    return res.status(400).json({ error: 'Severity must be between 1 and 5' });
  }
  
  const log = createSkinLog({ severity, dairy, sugar, fried_food, poor_sleep, high_stress, intense_workout, new_product, skipped_routine, picking, reflection });
  res.json({ success: true, log });
});

app.get('/api/portal/skin-logs', (req, res) => {
  const limit = parseInt(req.query.limit) || 30;
  const logs = getSkinLogs(limit);
  res.json({ logs });
});

app.get('/api/portal/skin-logs/status', (req, res) => {
  const status = canLogSkin();
  const latest = getLatestSkinLog();
  res.json({ ...status, latestLog: latest });
});

// Serve static files — branded homepage (index.html) served at /
app.use(express.static(__dirname));

app.get('/skin-log', (req, res) => {
  res.sendFile(path.join(__dirname, 'skin-log.html'));
});

// Lightweight contact endpoint to keep forms responsive (Resend can be wired via env RESEND_API_KEY)
app.post('/api/contact', (req, res) => {
  res.json({ success: true });
});

async function start() {
  await initDb();
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Louisville Precision Walls running at http://localhost:${PORT}`);
  });
}

start();
