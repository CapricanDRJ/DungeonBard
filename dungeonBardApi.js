const express = require('express');
const sqlite3 = require('better-sqlite3');
const axios = require('axios');
const cookieParser = require('cookie-parser');
const config = require('../dungeonBard/config.json');

const app = express();
const PORT = process.env.PORT || 3000;

// --- CONFIGURATION & PATHS ---
// Corrected to lowercase 'b' as requested
const MAIN_DB_PATH = '../dungeonBard/db/dungeonbard.db'; 
const SESSION_DB_PATH = './db/sessions.db';

const ADMIN_WHITELIST = [
 "115211754081878021",
 "454459089720967168",
 "1023433404206821387",
 "218183092714602496"
];

// --- DATABASE SETUP ---
let db;
let sessionDb;
let cachedDomains = [];

try {
 db = new sqlite3(MAIN_DB_PATH);
 sessionDb = new sqlite3(SESSION_DB_PATH);
 
 // Synchronous startup cache
 const domains = db.prepare("SELECT id, title FROM domains").all();
 cachedDomains = domains;
 console.log(`✅ Startup cache loaded: ${domains.length} domains found.`);
} catch (err) {
 console.error("❌ CRITICAL: Failed to initialize databases:", err.message);
 process.exit(1);
}

// --- MIDDLEWARE ---
app.use(express.json());
app.use(cookieParser());

function checkAuth(req, res, next) {
 const discordId = req.cookies.discordId;
 if (!discordId) {
 return res.status(403).json({ error: "Authentication required." });
 }

 const session = sessionDb.prepare("SELECT * FROM sessions WHERE discordId =?").get(discordId);
 
 if (!session || session.expiresAt < Date.now()) {
 return res.status(403).json({ error: "Session expired or invalid." });
 }

 if (!ADMIN_WHITELIST.includes(discordId)) {
 return res.status(403).json({ error: "Access denied: Admin privileges required." });
 }

 next();
}

// --- API ROUTES ---

// Get cached domains
app.get('/api/quests/domains', (req, res) => {
 res.json(cachedDomains);
});

// Get areas for a specific domain (using bitmask logic)
app.get('/api/quests/areas', (req, res) => {
 const domainId = parseInt(req.query.domain_id);
 if (isNaN(domainId)) return res.status(400).json({ error: "Invalid domain ID" });

 try {
 // Replicating quest.js logic: filter areas where the domain bit is set
 const areas = db.prepare("SELECT DISTINCT area_name FROM quests WHERE (area_mask &?)!= 0")
.all(1 << (domainId - 1));
 res.json(areas.map(a => a.area_name));
 } catch (err) {
 res.status(500).json({ error: "Database error fetching areas." });
 }
});

// List/Create Quests
app.get('/api/quests', checkAuth, (req, res) => {
 try {
 const quests = db.prepare("SELECT * FROM quest").all();
 res.json(quests);
 } catch (err) {
 res.status(500).json({ error: "Failed to fetch quests." });
 }
});

app.post('/api/quests', checkAuth, (req, res) => {
 const { name, description, questArea, domainId } = req.body;
 try {
 const info = db.prepare(
 "INSERT INTO quest (name, description, questArea, domainId) VALUES (?,?,?,?)"
 ).run(name, description, questArea, domainId);
 res.json({ id: info.lastInsertRowid });
 } catch (err) {
 res.status(500).json({ error: "Failed to save quest." });
 }
});

// --- AUTHENTICATION ROUTES (OAuth2) ---

app.get('/login', (req, res) => {
 const authUrl = `https://discord.com/api/oauth2/authorize?client_id=config.ClientId&redirect_uri={encodeURIComponent(req.protocol + '://' + req.get('host') + '/callback')}&response_type=code&scope=identify`;
 res.redirect(authUrl);
});

app.get('/callback', async (req, res) => {
 const code = req.query.code;
 if (!code) return res.status(400).send("No code provided.");

 try {
 const tokenResponse = await axios.post('https://discord.com/api/oauth2/token', new URLSearchParams({
 client_id: config.ClientId,
 client_secret: config.ClientSecret,
 grant_type: 'authorization_code',
 code: code,
 redirect_uri: `req.protocol://{req.get('host')}/callback`,
 }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });

 const userResponse = await axios.get('https://discord.com/api/users/@me', {
 headers: { Authorization: `Bearer ${tokenResponse.data.access_token}` }
 });

 const discordId = userResponse.data.id;
 const expiresAt = Date.now() + (7 * 24 * 60 * 60 * 1000); // 7 days

 sessionDb.prepare("INSERT OR REPLACE INTO sessions (discordId, expiresAt) VALUES (?,?)").run(discordId, expiresAt);

 res.cookie('discordId', discordId, { httpOnly: true, secure: false, sameSite: 'Lax' });
 res.redirect('/');
 } catch (err) {
 console.error("OAuth Error:", err.response?.data || err.message);
 res.status(500).send("Authentication failed.");
 }
});

// --- HTML INTERFACE ---
app.get('/', (req, res) => {
 res.send(`
 <!DOCTYPE html>
 <html>
 <head>
 <title>Dungeon Bard Admin</title>
 <style>
 body { font-family: sans-serif; padding: 20px; background: #f4f4f4; }
.card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
.hidden { display: none; }
.error { color: red; }
 </style>
 </head>
 <body>
 <div id="app" class="card">
 <h1>Dungeon Bard Admin</h1>
 <div id="auth-section">
 <p>You are not logged in.</p>
 <button onclick="window.location.href='/login'">Login with Discord</button>
 </div>
 <div id="admin-section" class="hidden">
 <p>Welcome, Admin.</p>
 <hr>
 <h3>Quest Editor</h3>
 <div id="editor">
 <!-- UI logic would go here -->
 <p>Loading controls...</p>
 </div>
 </div>
 </div>

 <script>
 async function checkStatus() {
 try {
 const res = await fetch('/api/auth/status');
 const data = await res.json();
 if (data.authenticated) {
 document.getElementById('auth-section').classList.add('hidden');
 document.getElementById('admin-section').classList.remove('hidden');
 }
 } catch (e) { console.error("Auth check failed", e); }
 }
 // Add endpoint for status check
 checkStatus();
 </script>
 </body>
 </html>
 `);
});

// Helper for frontend status check
app.get('/api/auth/status', (req, res) => {
 const discordId = req.cookies.discordId;
 const session = discordId? sessionDb.prepare("SELECT * FROM sessions WHERE discordId =?").get(discordId) : null;
 const authenticated = session && session.expiresAt > Date.now();
 res.json({ authenticated });
});

// --- SERVER START ---
const server = app.listen(PORT, () => {
 console.log(`🚀 Dungeon Bard Admin running at http://localhost:${PORT}`);
});

// --- GLOBAL ERROR HANDLERS (To prevent silent exits) ---

process.on('uncaughtException', (err) => {
 console.error('❌ UNCAUGHT EXCEPTION! The server is crashing:', err);
 // We don't exit immediately so you can read the log
});

process.on('unhandledRejection', (reason, promise) => {
 console.error('❌ UNHANDLED REJECTION! A promise failed:', reason);
});

server.on('error', (err) => {
 console.error('❌ SERVER ERROR:', err);
});