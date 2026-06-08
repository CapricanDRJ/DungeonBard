/**
 * dungeonBardApi.js
 * Unified Admin API & Quest Editor
 * 
 * Path:./dungeonBardApi.js
 */

const express = require('express');
const sqlite3 = require('better-sqlite3');
const axios = require('axios');
const cookieParser = require('cookie-parser');

const app = express();
app.use(express.json());
app.use(cookieParser());

// --- CONFIGURATION & PATHS ---
const config = require('../dungeonBard/config.json');

const MAIN_DB_PATH = '../dungeonBard/db/dungeonBard.db';
const SESSION_DB_PATH = './db/sessions.db';

const ADMIN_WHITELIST = [
 "115211754081878021",
 "454459089720967168",
 "1023433404206821387",
 "218183092714602496"
];

// --- DATABASE SETUP ---
const db = new sqlite3(MAIN_DB_PATH);
const sessionDb = new sqlite3(SESSION_DB_PATH);

sessionDb.exec(`
 CREATE TABLE IF NOT EXISTS sessions (
 discordId TEXT PRIMARY KEY,
 username TEXT,
 avatar TEXT,
 expiresAt INTEGER
 )
`);

// --- STARTUP CACHE ---
// We load this once at boot to avoid repeated disk I/O.
const cachedDomains = [];

try {
 console.log("Initializing startup cache...");
 // Adhering to quest.js: SELECT id, title, description FROM domains ORDER BY id
 // We alias 'title' as 'name' here so the frontend logic remains clean.
 const domains = db.prepare("SELECT id, title AS name, description FROM domains ORDER BY id").all();
 cachedDomains.push(...domains);
 console.log(`✅ Startup cache loaded: ${cachedDomains.length} domains found.`);
} catch (err) {
 console.error("❌ Failed to initialize startup cache:", err.message);
 // We don't exit, but the domain-related features will fail gracefully via the API error handlers.
}

// --- AUTHENTICATION MIDDLEWARE ---
const checkAuth = (req, res, next) => {
 const discordId = req.cookies.discordId;
 if (!discordId) return res.status(401).json({ error: "Not authenticated" });

 const session = sessionDb.prepare("SELECT * FROM sessions WHERE discordId =?").get(discordId);
 if (!session || session.expiresAt < Date.now()) {
 return res.status(401).json({ error: "Session expired" });
 }

 if (!ADMIN_WHITELIST.includes(discordId)) {
 return res.status(403).json({ error: "Access denied: Admin only" });
 }

 req.user = session;
 next();
};

// --- DISCORD OAUTH2 ROUTES ---
app.get('/login', (req, res) => {
 const url = `https://discord.com/api/oauth2/authorize?client_id=config.ClientId&redirect_uri={encodeURIComponent('https://dm.tsl.rocks/callback')}&response_type=code&scope=identify`;
 res.redirect(url);
});

app.get('/callback', async (req, res) => {
 const code = req.query.code;
 if (!code) return res.send("No code provided.");

 try {
 const tokenResponse = await axios.post('https://discord.com/api/oauth2/token', new URLSearchParams({
 client_id: config.ClientId,
 client_secret: config.ClientSecret,
 grant_type: 'authorization_code',
 code: code,
 redirect_uri: 'https://dm.tsl.rocks/callback'
 }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });

 const accessToken = tokenResponse.data.access_token;

 const userResponse = await axios.get('https://discord.com/api/users/@me', {
 headers: { Authorization: `Bearer ${accessToken}` }
 });

 const { id, username, avatar } = userResponse.data;
 const expiresAt = Date.now() + (24 * 60 * 60 * 1000);

 sessionDb.prepare("REPLACE INTO sessions (discordId, username, avatar, expiresAt) VALUES (?,?,?,?)")
.run(id, username, avatar, expiresAt);

 res.cookie('discordId', id, { httpOnly: true, maxAge: 24 * 60 * 60 * 1000 });
 res.redirect('/');
 } catch (err) {
 console.error("OAuth Callback Error:", err.response?.data || err.message);
 res.send("Authentication failed.");
 }
});

app.get('/api/auth/status', (req, res) => {
 const discordId = req.cookies.discordId;
 if (!discordId) return res.json({ authenticated: false });
 const session = sessionDb.prepare("SELECT username, avatar FROM sessions WHERE discordId =?").get(discordId);
 res.json({ authenticated:!!session, user: session });
});

// --- QUEST EDITOR API ROUTES ---

app.get('/api/quests/domains', checkAuth, (req, res) => {
 // Serves the in-memory cache instead of querying the DB
 res.json(cachedDomains);
});

app.get('/api/quests/areas', checkAuth, (req, res) => {
 const domainId = parseInt(req.query.domainId);
 if (isNaN(domainId)) return res.status(400).json({ error: "Invalid domainId" });

 try {
 const stmt = db.prepare("SELECT DISTINCT questArea, areaDesc FROM quest WHERE questArea IS NOT NULL AND domainId & (1 << (? - 1)) ORDER BY questArea ASC");
 const areas = stmt.all(domainId);
 res.json(areas);
 } catch (err) {
 res.status(500).json({ error: err.message });
 }
});

app.get('/api/quests/list', checkAuth, (req, res) => {
 const domainId = parseInt(req.query.domainId);
 const area = req.query.area;

 try {
 const stmt = db.prepare("SELECT id, name, description FROM quest WHERE questArea =? AND domainId & (1 << (? - 1)) ORDER BY name ASC");
 const quests = stmt.all(area, domainId);
 res.json(quests);
 } catch (err) {
 res.status(500).json({ error: err.message });
 }
});

app.get('/api/quests/get', checkAuth, (req, res) => {
 const id = req.query.id;
 try {
 const quest = db.prepare("SELECT * FROM quest WHERE id =?").get(id);
 res.json(quest);
 } catch (err) {
 res.status(500).json({ error: err.message });
 }
});

app.post('/api/quests/save', checkAuth, (req, res) => {
 const { id, name, description, questArea, selectedDomains } = req.body;

 let bitmask = 0;
 selectedDomains.forEach(dId => {
 bitmask |= (1 << (parseInt(dId) - 1));
 });

 try {
 if (id) {
 db.prepare("UPDATE quest SET name =?, description =?, questArea =?, domainId =? WHERE id =?")
.run(name, description, questArea, bitmask, id);
 } else {
 db.prepare("INSERT INTO quest (name, description, questArea, domainId) VALUES (?,?,?,?)")
.run(name, description, questArea, bitmask);
 }
 res.json({ success: true });
 } catch (err) {
 console.error("Save Error:", err);
 res.status(500).json({ error: err.message });
 }
});

// --- FRONTEND UI ---
app.get('/', (req, res) => {
 res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
 <meta charset="UTF-8">
 <meta name="viewport" content="width=device-width, initial-scale=1.0">
 <title>Dungeon Bard Admin</title>
 <style>
 body { font-family: sans-serif; background: #1a1a1a; color: #e0e0e0; margin: 0; padding: 20px; }
.container { max-width: 800px; margin: 0 auto; }
.card { background: #2a2a2a; padding: 20px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.3); margin-bottom: 20px; }
 h1, h2 { color: #fff; }
 button { cursor: pointer; padding: 8px 16px; border: none; border-radius: 4px; background: #4a90e2; color: white; font-weight: bold; }
 button:hover { background: #357abd; }
 button.secondary { background: #555; }
 input, textarea, select { width: 100%; padding: 10px; margin: 10px 0; background: #333; border: 1px solid #444; color: white; border-radius: 4px; box-sizing: border-box; }
.hidden { display: none; }
.flex { display: flex; gap: 10px; align-items: center; }
.domain-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 10px 0; }
.domain-item { background: #333; padding: 10px; border-radius: 4px; }
.nav-step { margin-bottom: 20px; padding-bottom: 10px; border-bottom: 1px solid #444; }
 </style>
</head>
<body>
 <div class="container">
 <div id="auth-section" class="card">
 <h1>Dungeon Bard Admin</h1>
 <p>Please login with Discord to continue.</p>
 <button onclick="location.href='/login'">Login with Discord</button>
 </div>

 <div id="admin-section" class="hidden">
 <div class="flex" style="justify-content: space-between;">
 <h1 id="user-greeting">Welcome</h1>
 <button class="secondary" onclick="location.reload()">Logout</button>
 </div>

 <div class="card">
 <h2>Quest Editor</h2>
 
 <div class="nav-step">
 <strong>1. Select Primary Domain</strong>
 <div id="domain-radios" class="domain-grid"></div>
 </div>

 <div id="step-area" class="nav-step hidden">
 <strong>2. Select Area</strong>
 <select id="area-dropdown" onchange="loadQuests()">
 <option value="">-- Choose an Area --</option>
 </select>
 </div>

 <div id="step-quest" class="nav-step hidden">
 <strong>3. Select Quest</strong>
 <div class="flex">
 <select id="quest-dropdown" onchange="loadQuestDetails()" style="flex-grow: 1;">
 <option value="">-- Choose a Quest --</option>
 </select>
 <button onclick="prepNewQuest()">+ New</button>
 </div>
 </div>

 <div id="editor-form" class="hidden">
 <hr>
 <h3 id="form-title">Edit Quest</h3>
 <input type="hidden" id="edit-id">
 <input type="hidden" id="edit-area">
 
 <label>Quest Name</label>
 <input type="text" id="edit-name">

 <label>Description</label>
 <textarea id="edit-desc" rows="5"></textarea>

 <label>Enable Additional Domains</label>
 <div id="additional-domains" class="domain-grid"></div>

 <div class="flex" style="margin-top: 20px;">
 <button onclick="saveQuest()">Save Quest</button>
 <button class="secondary" onclick="resetEditor()">Cancel</button>
 </div>
 </div>
 </div>
 </div>
 </div>

 <script>
 let currentDomainId = null;
 let allDomains = [];

 async function checkAuth() {
 const res = await fetch('/api/auth/status');
 const data = await res.json();
 if (data.authenticated) {
 document.getElementById('auth-section').classList.add('hidden');
 document.getElementById('admin-section').classList.remove('hidden');
 document.getElementById('user-greeting').innerText = \`Hello, \${data.user.username}\`;
 initDomains();
 }
 }

 async function initDomains() {
 const res = await fetch('/api/quests/domains');
 allDomains = await res.json();
 const container = document.getElementById('domain-radios');
 container.innerHTML = '';
 allDomains.forEach(d => {
 const div = document.createElement('div');
 div.className = 'domain-item';
 div.innerHTML = \`<label><input type="radio" name="domain" value="\d.id" onchange="selectDomain(\{d.id})"> \${d.name}</label>\`;
 container.appendChild(div);
 });

 const checkboxContainer = document.getElementById('additional-domains');
 checkboxContainer.innerHTML = '';
 allDomains.forEach(d => {
 const div = document.createElement('div');
 div.innerHTML = \`<label><input type="checkbox" class="domain-checkbox" value="\d.id"> \{d.name}</label>\`;
 checkboxContainer.appendChild(div);
 });
 }

 async function selectDomain(id) {
 currentDomainId = id;
 document.getElementById('step-area').classList.remove('hidden');
 document.getElementById('step-quest').classList.add('hidden');
 document.getElementById('editor-form').classList.add('hidden');
 
 const res = await fetch(\`/api/quests/areas?domainId=\${id}\`);
 const areas = await res.json();
 const dropdown = document.getElementById('area-dropdown');
 dropdown.innerHTML = '<option value="">-- Choose an Area --</option>';
 areas.forEach(a => {
 const opt = document.createElement('option');
 opt.value = a.questArea;
 opt.innerText = a.areaDesc || a.questArea;
 dropdown.appendChild(opt);
 });
 }

 async function loadQuests() {
 const area = document.getElementById('area-dropdown').value;
 if (!area) return;
 document.getElementById('step-quest').classList.remove('hidden');
 const res = await fetch(\`/api/quests/list?domainId=\currentDomainId&area=\{area}\`);
 const quests = await res.json();
 const dropdown = document.getElementById('quest-dropdown');
 dropdown.innerHTML = '<option value="">-- Choose a Quest --</option>';
 quests.forEach(q => {
 const opt = document.createElement('option');
 opt.value = q.id;
 opt.innerText = q.name;
 dropdown.appendChild(opt);
 });
 }

 async function loadQuestDetails() {
 const id = document.getElementById('quest-dropdown').value;
 if (!id) return;
 const res = await fetch(\`/api/quests/get?id=\${id}\`);
 const q = await res.json();
 showEditor(q);
 }

 function prepNewQuest() {
 const area = document.getElementById('area-dropdown').value;
 if (!area) return alert("Select an area first!");
 showEditor({ id: null, name: '', description: '', questArea: area, domainId: 0 });
 }

 function showEditor(q) {
 document.getElementById('editor-form').classList.remove('hidden');
 document.getElementById('form-title').innerText = q.id? 'Edit Quest' : 'New Quest';
 document.getElementById('edit-id').value = q.id || '';
 document.getElementById('edit-name').value = q.name || '';
 document.getElementById('edit-desc').value = q.description || '';
 document.getElementById('edit-area').value = q.questArea || '';

 const checkboxes = document.querySelectorAll('.domain-checkbox');
 checkboxes.forEach(cb => {
 const dId = parseInt(cb.value);
 cb.checked = (q.domainId & (1 << (dId - 1)))!== 0;
 });
 }

 function resetEditor() {
 document.getElementById('editor-form').classList.add('hidden');
 document.getElementById('quest-dropdown').value = '';
 }

 async function saveQuest() {
 const payload = {
 id: document.getElementById('edit-id').value,
 name: document.getElementById('edit-name').value,
 description: document.getElementById('edit-desc').value,
 questArea: document.getElementById('edit-area').value,
 selectedDomains: Array.from(document.querySelectorAll('.domain-checkbox:checked')).map(cb => cb.value)
 };
 const res = await fetch('/api/quests/save', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify(payload)
 });
 if (res.ok) {
 alert("Saved successfully!");
 loadQuests();
 resetEditor();
 } else {
 const err = await res.json();
 alert("Error: " + err.error);
 }
 }

 checkAuth();
 </script>
</body>
</html>
 `);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
 console.log(`\n🚀 Dungeon Bard Admin running at http://localhost:${PORT}`);
});