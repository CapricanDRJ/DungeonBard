const express = require('express');
const sqlite3 = require('better-sqlite3');
const axios = require('axios');
const cookieParser = require('cookie-parser');
const config = require('../dungeonBard/config.json');

const app = express();
const PORT = 3002;

// --- CONFIGURATION & PATHS ---
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
 
 sessionDb.prepare(`
 CREATE TABLE IF NOT EXISTS sessions (
 discord_id TEXT PRIMARY KEY,
 expires_at INTEGER
 )
 `).run();

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

const session = sessionDb.prepare("SELECT * FROM sessions WHERE discord_id =?").get(discordId);
 
 if (!session || session.expires_at < Date.now()) {
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
 // Fixed: changed table name from 'quests' to 'quest' to match your schema
 // Fixed: using 'questArea' to match your POST route logic
 const areas = db.prepare("SELECT DISTINCT questArea FROM quest WHERE (questArea &?)!= 0")
.all(1 << (domainId - 1));
 res.json(areas.map(a => a.questArea));
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
 const authUrl = `https://discord.com/api/oauth2/authorize?client_id=config.ClientID&redirect_uri={encodeURIComponent('https://dm.tsl.rocks/callback')}&response_type=code&scope=identify`;
 res.redirect(authUrl);
});

app.get('/callback', async (req, res) => {
 const code = req.query.code;
 if (!code) return res.status(400).send("No code provided.");

 try {
 const tokenResponse = await axios.post('https://discord.com/api/oauth2/token', new URLSearchParams({
 client_id: config.ClientID,
 client_secret: config.ClientSecret,
 grant_type: 'authorization_code',
 code: code,
 redirect_uri: `https://dm.tsl.rocks/callback`,
 }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });

 const userResponse = await axios.get('https://discord.com/api/users/@me', {
 headers: { Authorization: `Bearer ${tokenResponse.data.access_token}` }
 });

 const discordId = userResponse.data.id;
 const expires_at = Date.now() + (7 * 24 * 60 * 60 * 1000); // 7 days

sessionDb.prepare("INSERT OR REPLACE INTO sessions (discord_id, expires_at) VALUES (?,?)").run(discordId, expires_at);

 res.cookie('discordId', discordId, { httpOnly: true, secure: false, sameSite: 'Lax' });
 res.redirect('/');
 } catch (err) {
 console.error("OAuth Error:", err.response?.data || err.message);
 res.status(500).send("Authentication failed.");
 }
});

// --- HTML INTERFACE ---
// --- HTML INTERFACE ---
app.get('/', (req, res) => {
 res.send(`
 <!DOCTYPE html>
 <html lang="en">
 <head>
 <meta charset="UTF-8">
 <title>Dungeon Bard Admin</title>
 <style>
 body { font-family: sans-serif; padding: 20px; background: #f4f4f4; line-height: 1.5; }
.card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); max-width: 800px; margin: auto; }
.hidden { display: none; }
.error { color: red; font-weight: bold; }
.control-group { margin-bottom: 20px; padding: 15px; border: 1px solid #eee; border-radius: 4px; }
 label { font-weight: bold; display: block; margin-bottom: 5px; }
 input[type="text"], textarea, select { width: 100%; padding: 8px; margin-bottom: 15px; box-sizing: border-box; border: 1px solid #ccc; border-radius: 4px; }
 button { padding: 10px 15px; cursor: pointer; background: #5865F2; color: white; border: none; border-radius: 4px; width: 100%; font-size: 1rem; }
 button:hover { background: #4752C4; }
.checkbox-item { display: block; font-weight: normal; margin-bottom: 5px; cursor: pointer; }
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
 <p id="loading-msg">Loading controls...</p>
 
 <!-- Step 1: Domain Selection -->
 <div id="domain-controls" class="control-group hidden">
 <label for="domain-select">1. Select Domain:</label>
 <select id="domain-select" onchange="loadAreas(this.value)"></select>
 </div>

 <!-- Step 2: Area Selection -->
 <div id="area-controls" class="control-group hidden"></div>

 <!-- Step 3: Quest Form -->
 <div id="quest-form" class="control-group hidden">
 <label>2. Quest Name</label>
 <input type="text" id="q-name" placeholder="e.g. The Lost Relic">
 
 <label>3. Description</label>
 <textarea id="q-desc" rows="3" placeholder="Describe the quest..."></textarea>
 
 <label>4. Area Bitmask (questArea)</label>
 <input type="text" id="q-area" placeholder="e.g. 1, 2, 4">
 
 <button onclick="saveQuest()">Save Quest</button>
 </div>
 </div>
 </div>

 <script>
 // 1. Check Auth Status
 async function checkStatus() {
 try {
 const res = await fetch('/api/auth/status');
 const data = await res.json();
 if (data.authenticated) {
 document.getElementById('auth-section').classList.add('hidden');
 document.getElementById('admin-section').classList.remove('hidden');
 loadDomains();
 }
 } catch (e) { console.error("Auth check failed", e); }
 }

 // 2. Load Domains into Dropdown
 async function loadDomains() {
 try {
 const res = await fetch('/api/quests/domains');
 const domains = await res.json();
 const select = document.getElementById('domain-select');
 select.innerHTML = '<option value="" disabled selected>-- Choose a Domain --</option>';
 domains.forEach(d => {
 const opt = document.createElement('option');
 opt.value = d.id;
 opt.textContent = d.title;
 select.appendChild(opt);
 });
 document.getElementById('domain-controls').classList.remove('hidden');
 document.getElementById('loading-msg').classList.add('hidden');
 } catch (e) { 
 console.error("Load domains failed", e); 
 document.getElementById('loading-msg').textContent = "Failed to load domains.";
 }
 }

 // 3. Load ALL Areas globally
 async function loadAreas(domainId) {
 if (!domainId) return;
 window.currentDomainId = domainId;

 try {
 const res = await fetch(\`/api/quests/areas\`); // Removed domain_id filter
 const areas = await res.json();
 const container = document.getElementById('area-controls');
 
 container.innerHTML = '<label>Select Area(s) (Quick Pick):</label>';
 
 if (areas.length === 0) {
 container.innerHTML += '<em style="color: #666;">No existing areas found in DB. Type mask manually.</em>';
 } else {
 areas.forEach(a => {
 const label = document.createElement('label');
 label.className = 'checkbox-item';
 // Pass the area value to our toggle function
 label.innerHTML = \`<input type="checkbox" class="area-checkbox" value="\a" onchange="updateAreaMask()"> \{a} \`;
 container.appendChild(label);
 });
 }

 container.classList.remove('hidden');
 document.getElementById('quest-form').classList.remove('hidden');
 } catch (e) { 
 console.error("Load areas failed", e); 
 }
 }

 // 4. Calculate bitmask from checkboxes and update the text field
 function updateAreaMask() {
 const checkboxes = document.querySelectorAll('.area-checkbox:checked');
 let mask = 0;
 checkboxes.forEach(cb => {
 mask |= parseInt(cb.value);
 });
 document.getElementById('q-area').value = mask;
 }

 // 5. Save the Quest
 async function saveQuest() {
 const name = document.getElementById('q-name').value;
 const description = document.getElementById('q-desc').value;
 const questArea = document.getElementById('q-area').value;
 const domainId = window.currentDomainId;

 if (!name ||!questArea) { alert("Name and Area are required."); return; }

 try {
 const res = await fetch('/api/quests', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ name, description, questArea, domainId })
 });
 
 if (res.ok) {
 alert("Quest saved successfully!");
 document.getElementById('q-name').value = '';
 document.getElementById('q-desc').value = '';
 document.getElementById('q-area').value = '';
 // Uncheck all checkboxes
 document.querySelectorAll('.area-checkbox').forEach(cb => cb.checked = false);
 } else {
 const err = await res.json();
 alert("Error: " + err.error);
 }
 } catch (e) { alert("Failed to save quest."); }
 }

 checkStatus();
 </script>
 </body>
 </html>
 `);
});

// Helper for frontend status check
app.get('/api/auth/status', (req, res) => {
 const discordId = req.cookies.discordId;
 const session = discordId? sessionDb.prepare("SELECT * FROM sessions WHERE discord_id =?").get(discordId) : null;
 const authenticated = session && session.expires_at > Date.now();
 res.json({ authenticated });
});

// --- SERVER START ---
const server = app.listen(PORT, () => {
 console.log(`🚀 Dungeon Bard Admin running at http://localhost:${PORT}`);
});

// --- GLOBAL ERROR HANDLERS ---
process.on('uncaughtException', (err) => {
 console.error('❌ UNCAUGHT EXCEPTION!', err);
});

process.on('unhandledRejection', (reason, promise) => {
 console.error('❌ UNHANDLED REJECTION!', reason);
});

server.on('error', (err) => {
 console.error('❌ SERVER ERROR:', err);
});