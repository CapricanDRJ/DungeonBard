const express = require('express');
const Database = require('better-sqlite3');
const axios = require('axios');
const cookieParser = require('cookie-parser');
const fs = require('fs');

const app = express();
const PORT = 3002;

// --- CONFIGURATION LOADING ---
// Using direct relative paths as requested
let config;
try {
 const configData = fs.readFileSync('../dungeonBard/config.json', 'utf8');
 config = JSON.parse(configData);
} catch (err) {
 console.error("CRITICAL: Could not load../dungeonBard/config.json");
 console.error(err.message);
 process.exit(1);
}

// Ensure these exist in your config.json:
// { "ClientId": "...", "ClientSecret": "...", "ADMIN_WHITELIST": ["123456789"] }
const CLIENT_ID = config.ClientID;
const CLIENT_SECRET = config.ClientSecret;
const REDIRECT_URI = 'https://dm.tsl.rocks/callback';
const ADMIN_WHITELIST = [
 "115211754081878021",
 "454459089720967168",
 "1023433404206821387",
 "218183092714602496"
];

// --- DATABASE INITIALIZATION ---
let mainDb;
let sessionDb;

try {
 // 1. Connect to the main DungeonBard database
 mainDb = new Database('../dungeonBard/db/dungeonBard.db');
 // Test connectivity with a simple query
 mainDb.prepare('SELECT 1').get();
 console.log("✅ Connected to dungeonBard.db");

 // 2. Connect to (or create) the local sessions database
 // Ensure the./db directory exists before running
 sessionDb = new Database('./db/sessions.db');
 sessionDb.prepare(`
 CREATE TABLE IF NOT EXISTS sessions (
 session_id TEXT PRIMARY KEY,
 discord_id TEXT,
 expires_at INTEGER
 )
 `).run();
 console.log("✅ Connected to sessions.db");

} catch (err) {
 console.error("CRITICAL: Database connection failed.");
 console.error(err.message);
 process.exit(1);
}

// --- MIDDLEWARE ---
app.use(cookieParser());
app.use(express.json());

// Helper to check if a user is authenticated via session cookie
function isAuthenticated(req, res, next) {
 const sessionId = req.cookies.session_id;
 if (!sessionId) return next(false);

 const session = sessionDb.prepare('SELECT * FROM sessions WHERE session_id =? AND expires_at >?')
.get(sessionId, Date.now());

 if (session) {
 req.user = session; // Attach session data to request
 return next(true);
 }
 next(false);
}

// Custom error handler for authentication failures
const authGuard = (req, res, next) => {
 isAuthenticated(req, res, (auth) => {
 if (auth) next();
 else res.status(403).json({ error: "Unauthorized. Please login via Discord." });
 });
};

// --- ROUTES ---

// 1. Status/Home Route
// Returns the health of the system and current auth state
app.get('/', (req, res) => {
 const authStatus = isAuthenticated(req, res, (auth) => auth);
 res.json({
 service: "dungeonBard API",
 status: "online",
 databases: {
 main: "connected",
 sessions: "connected"
 },
 authenticated:!!authStatus
 });
});

// 2. Login Route
// Redirects the user to Discord's OAuth2 authorization page
app.get('/login', (req, res) => {
 const discordUrl = `https://discord.com/api/oauth2/authorize?client_id={CLIENT_ID}&redirect_uri={encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=identify`;
 res.redirect(discordUrl);
});

// 3. Callback Route
// The critical endpoint where Discord sends the user back with a code
app.get('/callback', async (req, res) => {
 const code = req.query.code;

 if (!code) {
 return res.status(400).json({ error: "No code provided by Discord." });
 }

 try {
 // A. Exchange code for Access Token
 const tokenResponse = await axios.post('https://discord.com/api/oauth2/token', new URLSearchParams({
 client_id: CLIENT_ID,
 client_secret: CLIENT_SECRET,
 grant_type: 'authorization_code',
 code: code,
 redirect_uri: REDIRECT_URI,
 }), {
 headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
 });

 const accessToken = tokenResponse.data.access_token;

 // B. Fetch User Profile using the token
 const userResponse = await axios.get('https://discord.com/api/users/@me', {
 headers: { Authorization: `Bearer ${accessToken}` }
 });

 const discordUser = userResponse.data;

 // C. Validate against Admin Whitelist
 if (!ADMIN_WHITELIST.includes(discordUser.id)) {
 console.warn(`Unauthorized login attempt by ID: ${discordUser.id}`);
 return res.status(403).json({ error: "You are not authorized to access this admin panel." });
 }

 // D. Create Session in sessions.db
 const sessionId = require('crypto').randomBytes(32).toString('hex');
 const expiresAt = Date.now() + (24 * 60 * 60 * 1000); // 24 hour session

 sessionDb.prepare('INSERT INTO sessions (session_id, discord_id, expires_at) VALUES (?,?,?)')
.run(sessionId, discordUser.id, expiresAt);

 // E. Set Cookie and Redirect
 res.cookie('session_id', sessionId, {
 httpOnly: true,
 secure: true, // Set to true because you are using HTTPS via Caddy
 sameSite: 'Lax'
 });

 res.redirect('/admin');

 } catch (err) {
 console.error("OAuth2 Error:", err.response? err.response.data : err.message);
 res.status(500).json({ error: "Authentication failed during exchange." });
 }
});

// 4. Protected Admin Route
// This is where your quest editing logic will eventually live
app.get('/admin', authGuard, (req, res) => {
 res.json({
 message: "Welcome to the DungeonBard Admin Panel",
 user_id: req.user.discord_id,
 session_expires: new Date(req.user.expires_at).toISOString()
 });
});

// 5. Logout Route
app.get('/logout', (req, res) => {
 const sessionId = req.cookies.session_id;
 if (sessionId) {
 sessionDb.prepare('DELETE FROM sessions WHERE session_id =?').run(sessionId);
 }
 res.clearCookie('session_id');
 res.json({ message: "Logged out successfully." });
});

// --- START SERVER ---
app.listen(PORT, () => {
 console.log(`🚀 dungeonBard API running on port ${PORT}`);
 console.log(`🔗 Redirect URI configured as: ${REDIRECT_URI}`);
});
