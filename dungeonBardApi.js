const express = require('express');
const sqlite3 = require('better-sqlite3');
const axios = require('axios');
const cookieParser = require('cookie-parser');
const crypto = require('crypto'); // built-in — for generating unguessable session tokens
const config = require('../dungeonBard/config.json');
const { skillNames, skillLevel, profNames, profLevel } = require('../dungeonBard/assets/levels');

const app = express();
const PORT = 3002;

const MAIN_DB_PATH    = '../dungeonBard/db/dungeonbard.db';
const SESSION_DB_PATH = './db/sessions.db';

const ADMIN_WHITELIST = [
  "115211754081878021",
  "454459089720967168",
  "1023433404206821387",
  "218183092714602496"
];

const PROFESSION_NAMES = ["Artisan", "Soldier", "Healer"];

const SESSION_LIFETIME_MS  = 7 * 24 * 60 * 60 * 1000; // 7 days hard cap
const REVERIFY_INTERVAL_MS = 60 * 60 * 1000;           // re-check with Discord hourly

// --- VALIDATION RANGES (easily adjustable) ---
const RANGES = {
  professionXp: { min: 1, max: 100 },
  coins:        { min: 1, max: 10 },
  maxCount:     { min: 1, max: 5 },
  name:         { maxLength: 100 },
  description:  { maxLength: 200 },
  questArea:    { maxLength: 50 },
  areaDesc:     { maxLength: 100 }
};

// --- DATABASE SETUP ---
let db, sessionDb;
try {
  db = new sqlite3(MAIN_DB_PATH);
  sessionDb = new sqlite3(SESSION_DB_PATH);

  // One-time migration: the old schema (cookie = bare discordId, no real
  // token stored) can't support re-verifying with Discord. If it's still
  // around, replace it — back up db/sessions.db first if you want a copy.
  // Effect: everyone has to log in again once after this change ships.
  const existingCols = sessionDb.prepare("PRAGMA table_info(sessions)").all().map(c => c.name);
  if (existingCols.length && !existingCols.includes('session_token')) {
    sessionDb.prepare('DROP TABLE sessions').run();
  }

  sessionDb.prepare(`
    CREATE TABLE IF NOT EXISTS sessions (
      session_token    TEXT PRIMARY KEY,
      discord_id       TEXT NOT NULL,
      username          TEXT,
      access_token      TEXT NOT NULL,
      refresh_token     TEXT,
      last_verified_at  INTEGER NOT NULL,
      expires_at        INTEGER NOT NULL
    )
  `).run();

  // Bot action queue — web server inserts, bot polls WHERE processedAt IS NULL
  db.prepare(`
    CREATE TABLE IF NOT EXISTS botQueue (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      type        TEXT NOT NULL,
      guildId     TEXT NOT NULL,
      userId      TEXT NOT NULL,
      payload     TEXT,
      createdAt   INTEGER NOT NULL,
      processedAt INTEGER
    )
  `).run();
} catch (err) {
  console.error("❌ CRITICAL: Failed to initialize databases:", err.message);
  process.exit(1);
}

// --- STATIC CACHES (populated once at startup) ---
const DOMAINS = db.prepare("SELECT id, title, background FROM domains ORDER BY id").all();
const AREAS   = db.prepare("SELECT DISTINCT questArea FROM quest WHERE questArea IS NOT NULL ORDER BY questArea ASC").all().map(r => r.questArea);
const BEASTS  = db.prepare("SELECT DISTINCT type, entity FROM beastiary ORDER BY type ASC").all();
const RELICS  = db.prepare("SELECT DISTINCT id, name FROM relic ORDER BY id ASC").all();
console.log(`✅ Startup cache loaded: ${DOMAINS.length} domains, ${AREAS.length} areas, ${BEASTS.length} beast types, ${RELICS.length} relics.`);

const REGISTRY_TTL = 2 * 60 * 1000; // 2 minutes
let registryCache = null;
let registryCachedAt = 0;

// --- PREPARED STATEMENTS ---
const dbQuery = {
  getSession:            sessionDb.prepare("SELECT * FROM sessions WHERE session_token = ?"),
  insertSession:         sessionDb.prepare("INSERT OR REPLACE INTO sessions (session_token, discord_id, username, access_token, refresh_token, last_verified_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)"),
  touchSession:          sessionDb.prepare("UPDATE sessions SET last_verified_at = ? WHERE session_token = ?"),
  updateTokens:          sessionDb.prepare("UPDATE sessions SET access_token = ?, refresh_token = ?, last_verified_at = ? WHERE session_token = ?"),
  deleteSession:         sessionDb.prepare("DELETE FROM sessions WHERE session_token = ?"),
  getAllQuests:           db.prepare("SELECT id, name, description, questArea, domainId FROM quest ORDER BY questArea ASC, name ASC"),
  getQuestsByAreaDomain: db.prepare("SELECT id, name FROM quest WHERE questArea = ? AND domainId & ? ORDER BY name ASC"),
  getQuestById:          db.prepare("SELECT * FROM quest WHERE id = ?"),
  insertQuest:           db.prepare(`
    INSERT INTO quest (domainId, questArea, areaDesc, name, description, profession, professionId, professionXp,
      skill1, skill2, skill3, skill4, skill5, skill6, beastiary, relic, coins, maxCount)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),
  updateQuest:           db.prepare(`
    UPDATE quest SET domainId=?, questArea=?, areaDesc=?, name=?, description=?, profession=?, professionId=?,
      professionXp=?, skill1=?, skill2=?, skill3=?, skill4=?, skill5=?, skill6=?, beastiary=?, relic=?, coins=?, maxCount=?
    WHERE id=?
  `),
  // Player-facing statements
  getPlayerGuilds:       db.prepare("SELECT guildId, displayName, overallExp FROM users WHERE userId = ? ORDER BY overallExp DESC"),
  getUser:               db.prepare("SELECT * FROM users WHERE userId = ? AND guildId = ?"),
  getDomain:             db.prepare("SELECT domainId FROM users WHERE userId = ? AND guildId = ?"),
  getDistinctQuestArea:  db.prepare("SELECT DISTINCT questArea, areaDesc FROM quest WHERE questArea IS NOT NULL AND domainId & (1 << (? - 1)) ORDER BY questArea ASC"),
  getOneDistinctQuestArea: db.prepare("SELECT DISTINCT questArea, areaDesc FROM quest WHERE questArea = ? LIMIT 1"),
  getQuestsInArea:       db.prepare("SELECT id, name, description FROM quest WHERE questArea = ? AND domainId & (1 << (? - 1)) ORDER BY name ASC"),
  getActiveItems:        db.prepare("SELECT * FROM inventory WHERE userId = ? AND guildId = ? AND duration > 31536000"),
  delExpired:            db.prepare("DELETE FROM inventory WHERE duration < strftime('%s', 'now') AND duration > 31536000 AND userId = ? AND guildId = ?"),
  setActive:             db.prepare("UPDATE inventory SET duration = duration - strftime('%s', 'now') WHERE userId = ? AND guildId = ? AND duration > 31536000"),
  profBonus:             db.prepare("UPDATE inventory SET duration = duration + strftime('%s', 'now') WHERE userId = ? AND guildId = ? AND professionId != 0 AND professionBonus = (SELECT MAX(professionBonus) FROM inventory i2 WHERE i2.userId = inventory.userId AND i2.guildId = inventory.guildId AND i2.professionId = inventory.professionId)"),
  skillBonus:            db.prepare("UPDATE inventory SET duration = duration + strftime('%s', 'now') WHERE userId = ? AND guildId = ? AND skill != 0 AND skillBonus = (SELECT MAX(skillBonus) FROM inventory i2 WHERE i2.userId = inventory.userId AND i2.guildId = inventory.guildId AND i2.skill = inventory.skill)"),
  addCoins:              db.prepare("UPDATE users SET coins = coins + ? WHERE userId = ? AND guildId = ?"),
  addToInventory:        db.prepare("INSERT INTO inventory (userId, guildId, name, skillBonus, skill, duration, emojiId) VALUES (?, ?, ?, ?, ?, ?, ?)"),
  insertQuestUser:       db.prepare("INSERT OR REPLACE INTO users (userId, guildId, displayName, avatarFile, domainId) VALUES (?, ?, ?, ?, ?)"),
  getRandomBeast:        db.prepare("SELECT * FROM beastiary WHERE type = ? ORDER BY RANDOM() LIMIT 1"),
  getRandomRelic:        db.prepare("SELECT * FROM relic WHERE id = ? ORDER BY RANDOM() LIMIT 1"),
  insertBotQueue:        db.prepare("INSERT INTO botQueue (type, guildId, userId, payload, createdAt) VALUES (?, ?, ?, ?, ?)"),
  storeQuest:            db.prepare(`
    INSERT INTO questTracker (
      guildId, userId, encryptedUserId, domainId, questId,
      artisanExp, soldierExp, healerExp, overallExp,
      artisanExpGained, soldierExpGained, healerExpGained, expGained,
      skill1, skill2, skill3, skill4, skill5, skill6,
      sawMonster, beatMonster, relic, quantity
    )
    SELECT
      ?, ?, ?, ?, ?,
      u.artisanExp, u.soldierExp, u.healerExp, u.overallExp,
      (u.artisanExp - ?), (u.soldierExp - ?), (u.healerExp - ?), (u.overallExp - ?),
      u.skill1, u.skill2, u.skill3, u.skill4, u.skill5, u.skill6,
      ?, ?, ?, ?
    FROM users u
    WHERE u.userId = ? AND u.guildId = ?
  `)
};

// --- MIDDLEWARE ---
app.use(express.json());
app.use(cookieParser());

// Confirms the access token is still live and returns the Discord identity.
async function verifyDiscordToken(accessToken) {
  const res = await axios.get('https://discord.com/api/users/@me', {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  return res.data;
}

// Exchanges a refresh token for a new access/refresh token pair.
async function refreshDiscordToken(refreshToken) {
  const res = await axios.post('https://discord.com/api/oauth2/token',
    new URLSearchParams({
      client_id: config.ClientID,
      client_secret: config.ClientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );
  return res.data;
}

// Returns the session row if the cookie maps to a live, non-expired session
// — re-verifying with Discord at most once an hour, with a refresh-token
// fallback. Does NOT decide whitelist membership; that's a separate check
// in the gate below, since dungeonBard has routes that are public (no
// session at all) and routes that need both a valid session and whitelist.
async function getAuthedSession(req) {
  const sessionToken = req.cookies.session;
  if (!sessionToken) return null;

  const session = dbQuery.getSession.get(sessionToken);
  if (!session) return null;
  if (session.expires_at < Date.now()) {
    dbQuery.deleteSession.run(sessionToken);
    return null;
  }

  if (Date.now() - session.last_verified_at < REVERIFY_INTERVAL_MS) {
    return session; // verified recently enough — skip the Discord round-trip
  }

  try {
    await verifyDiscordToken(session.access_token);
    dbQuery.touchSession.run(Date.now(), sessionToken);
    return session;
  } catch (err) {
    if (session.refresh_token) {
      try {
        const refreshed = await refreshDiscordToken(session.refresh_token);
        dbQuery.updateTokens.run(refreshed.access_token, refreshed.refresh_token, Date.now(), sessionToken);
        return { ...session, access_token: refreshed.access_token, refresh_token: refreshed.refresh_token };
      } catch (refreshErr) {
        console.error('[sessionRefresh_ERROR]', refreshErr.message, { sessionToken });
      }
    }
    dbQuery.deleteSession.run(sessionToken);
    return null;
  }
}

// Deny-by-default gate, three-tier:
//   public  — no session required
//   player  — valid session, any logged-in Discord user (/play*, /api/play*)
//   admin   — valid session AND whitelist (/admin, /api/quests*, etc.)
const PUBLIC_PATHS  = ['/', '/login', '/callback', '/quests'];
const PLAYER_PATHS  = ['/play'];   // prefix-matched below

app.use(async (req, res, next) => {
  if (PUBLIC_PATHS.includes(req.path)) return next();
  try {
    const session = await getAuthedSession(req);
    if (!session) {
      res.clearCookie('session');
      return req.path.startsWith('/api/')
        ? res.status(403).json({ error: 'Access denied.' })
        : res.redirect('/');
    }
    req.session  = session;
    req.discordId = session.discord_id;

    // Player tier: /play and /api/play — any valid session is fine
    if (req.path.startsWith('/play') || req.path.startsWith('/api/play')) return next();

    // Admin tier: everything else needs whitelist
    if (!ADMIN_WHITELIST.includes(session.discord_id)) {
      return req.path.startsWith('/api/')
        ? res.status(403).json({ error: 'Access denied.' })
        : res.status(403).send('Not authorized.');
    }
    next();
  } catch (err) {
    console.error('[authGate_ERROR]', err.message);
    return req.path.startsWith('/api/')
      ? res.status(500).json({ error: 'Auth check failed.' })
      : res.status(500).send('Auth check failed.');
  }
});

// --- QUEST REGISTRY RENDERER (for /quests) ---
function buildQuestRegistry() {
  const quests = dbQuery.getAllQuests.all();

  // Group by domain, then by questArea
  const lines = [];
  const divider = '═'.repeat(56);

  lines.push(divider);
  lines.push('  DUNGEON BARD — QUEST REGISTRY');
  lines.push(divider);

  for (const domain of DOMAINS) {
    const bit = 1 << (domain.id - 1);
    const domainQuests = quests.filter(q => q.domainId & bit);
    if (domainQuests.length === 0) continue;

    // Group by area
    const areaMap = new Map();
    for (const q of domainQuests) {
      if (!areaMap.has(q.questArea)) areaMap.set(q.questArea, []);
      areaMap.get(q.questArea).push(q);
    }
    const areas = [...areaMap.entries()];

    lines.push('');
    lines.push(`▌ ${domain.title}`);
    lines.push('│');

    areas.forEach(([area, areaQuests], aIdx) => {
      const isLastArea = aIdx === areas.length - 1;
      lines.push(`${isLastArea ? '└' : '├'}──► ${area}`);

      areaQuests.forEach((q, qIdx) => {
        const isLastQuest = qIdx === areaQuests.length - 1;
        const prefix = isLastArea ? '      ' : '│     ';
        lines.push(`${prefix}${isLastQuest ? '└' : '├'}── ${q.name}`);
        if (q.description) {
          const descPrefix = isLastArea ? '      ' : '│     ';
          const contPrefix = isLastQuest ? '    ' : '│   ';
          lines.push(`${descPrefix}${contPrefix}  ${q.description}`);
        }
      });

      if (!isLastArea) lines.push('│');
    });
  }

  lines.push('');
  lines.push(divider);
  return lines.join('\n');
}

function buildQuestFields(body) {
  const {
    questId, domainIds, questArea, areaDesc, name, description,
    professionId, professionXp, skill1, skill2, skill3, skill4, skill5, skill6,
    beastiary, relic, coins, maxCount
  } = body;

  if (!name || !questArea || !areaDesc || !description || !professionId)
    return { error: "Missing required fields." };

  if (name.length > RANGES.name.maxLength)
    return { error: `name exceeds ${RANGES.name.maxLength} characters.` };
  if (description.length > RANGES.description.maxLength)
    return { error: `description exceeds ${RANGES.description.maxLength} characters.` };
  if (questArea.length > RANGES.questArea.maxLength)
    return { error: `questArea exceeds ${RANGES.questArea.maxLength} characters.` };
  if (areaDesc.length > RANGES.areaDesc.maxLength)
    return { error: `areaDesc exceeds ${RANGES.areaDesc.maxLength} characters.` };

  if (beastiary && !BEASTS.some(b => b.type === beastiary))
    return { error: "Invalid beastiary type." };
  if (relic && !RELICS.some(r => r.id === relic))
    return { error: "Invalid relic id." };

  const profId = parseInt(professionId);
  if (![1, 2, 3].includes(profId)) return { error: "Invalid professionId." };

  const xp = parseInt(professionXp);
  const c = parseInt(coins);
  const mc = parseInt(maxCount);
  const skills = [
    parseInt(skill1) || 0,
    parseInt(skill2) || 0,
    parseInt(skill3) || 0,
    parseInt(skill4) || 0,
    parseInt(skill5) || 0,
    parseInt(skill6) || 0
  ];

  const ids = Array.isArray(domainIds) ? domainIds.map(Number).filter(n => n >= 1 && n <= DOMAINS.length) : [];
  if (ids.length === 0) return { error: "At least one domain must be selected." };
  const domainBitmask = ids.reduce((mask, id) => mask | (1 << (id - 1)), 0);

  return {
    fields: [
      domainBitmask, questArea, areaDesc, name, description,
      PROFESSION_NAMES[profId - 1], profId, xp,
      ...skills,
      beastiary || null, relic || null, c, mc
    ],
    questId,
    xp, c, mc, skills
  };
}

// --- FIREWALL VALIDATION ---
// On insert: strict range enforcement. On update: allow if in range OR matches old value.
function validateWithFirewall(validated) {
  const { questId, xp, c, mc, skills } = validated;
  
  // For new quests (insert), enforce strict ranges
  if (!questId) {
    if (isNaN(xp) || xp < RANGES.professionXp.min || xp > RANGES.professionXp.max)
      return { error: `professionXp must be ${RANGES.professionXp.min}–${RANGES.professionXp.max}.` };
    if (isNaN(c) || c < RANGES.coins.min || c > RANGES.coins.max)
      return { error: `coins must be ${RANGES.coins.min}–${RANGES.coins.max}.` };
    if (isNaN(mc) || mc < RANGES.maxCount.min || mc > RANGES.maxCount.max)
      return { error: `maxCount must be ${RANGES.maxCount.min}–${RANGES.maxCount.max}.` };
    return { ok: true };
  }

  // For updates, fetch current quest and allow if new value matches old OR is in valid range
  const currentQuest = dbQuery.getQuestById.get(parseInt(questId));
  if (!currentQuest) return { error: "Quest not found." };

  // Check professionXp: in range OR matches old value
  if (!(xp === currentQuest.professionXp || (xp >= RANGES.professionXp.min && xp <= RANGES.professionXp.max)))
    return { error: `professionXp out of range and differs from current value.` };

  // Check coins: in range OR matches old value
  if (!(c === currentQuest.coins || (c >= RANGES.coins.min && c <= RANGES.coins.max)))
    return { error: `coins out of range and differs from current value.` };

  // Check maxCount: in range OR matches old value
  if (!(mc === currentQuest.maxCount || (mc >= RANGES.maxCount.min && mc <= RANGES.maxCount.max)))
    return { error: `maxCount out of range and differs from current value.` };

  return { ok: true };
}

// --- PUBLIC ROUTES ---

app.get('/login', (req, res) => {
  const authUrl = `https://discord.com/api/oauth2/authorize?client_id=${config.ClientID}&redirect_uri=${encodeURIComponent('https://dm.tsl.rocks/callback')}&response_type=code&scope=identify`;
  res.redirect(authUrl);
});

app.get('/callback', async (req, res) => {
  const code = req.query.code;
  if (!code) return res.status(400).send("No code provided.");
  try {
    const tokenResponse = await axios.post('https://discord.com/api/oauth2/token',
      new URLSearchParams({
        client_id: config.ClientID,
        client_secret: config.ClientSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: 'https://dm.tsl.rocks/callback',
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );
    const { access_token, refresh_token } = tokenResponse.data;
    const userResponse = await axios.get('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${access_token}` }
    });
    const discordId = userResponse.data.id;
    const username  = userResponse.data.global_name || userResponse.data.username;

    const sessionToken = crypto.randomBytes(32).toString('hex');
    const now = Date.now();
    const expiresAt = now + SESSION_LIFETIME_MS;
    dbQuery.insertSession.run(sessionToken, discordId, username, access_token, refresh_token, now, expiresAt);

    res.cookie('session', sessionToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
      maxAge: SESSION_LIFETIME_MS
    });
    res.redirect(ADMIN_WHITELIST.includes(discordId) ? '/admin' : '/play');
  } catch (err) {
    console.error("[OAuth_ERROR]", err.response?.data || err.message);
    res.status(500).send("Authentication failed.");
  }
});

// Public quest registry — shown to anyone not on the whitelist
app.get('/quests', (req, res) => {
  try {
    if (!registryCache || Date.now() - registryCachedAt > REGISTRY_TTL) {
      registryCache = buildQuestRegistry();
      registryCachedAt = Date.now();
    }
    const registry = registryCache;
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Dungeon Bard — Quest Registry</title>
<style>
  body { background: #1a1a1a; color: #c8c8b4; font-family: monospace; padding: 30px; }
  pre  { white-space: pre-wrap; font-size: 0.95rem; line-height: 1.6; }
  .login-link { display: block; text-align: right; margin-top: 20px; color: #555; font-size: 0.8rem; text-decoration: none; }
  .login-link:hover { color: #888; }
</style>
</head>
<body>
<pre>${registry}</pre>
<a href="/login" class="login-link">[ login ]</a>
</body>
</html>`);
  } catch (err) {
    console.error("[questRegistry_ERROR]", err.message);
    res.status(500).send("Failed to load quest registry.");
  }
});

app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Dungeon Bard</title>
<style>
  body { font-family: sans-serif; padding: 40px; background: #2c2f33; color: #dcddde; text-align: center; }
  .card { background: #36393f; padding: 40px; border-radius: 8px; max-width: 400px; margin: auto; box-shadow: 0 2px 8px rgba(0,0,0,0.4); }
  h1 { color: #fff; margin-bottom: 20px; }
  p { margin-bottom: 30px; color: #b9bbbe; }
  .btn { padding: 12px 24px; background: #5865F2; color: white; border: none; border-radius: 4px; font-size: 1rem; cursor: pointer; text-decoration: none; display: inline-block; }
  .btn:hover { background: #4752C4; }
</style>
</head>
<body>
<div class="card">
  <h1>Dungeon Bard</h1>
  <p>Login with Discord to continue.</p>
  <a href="/login" class="btn">Login with Discord</a>
</div>
</body>
</html>`);
});
// Admin panel — whitelisted users only
app.get('/admin', (req, res) => {
  const username = req.session.username || 'Scribe';
  const domainsJson    = JSON.stringify(DOMAINS);
  const areasJson      = JSON.stringify(AREAS);
  const beastsJson     = JSON.stringify(BEASTS);
  const relicsJson     = JSON.stringify(RELICS);
  const skillNamesJson = JSON.stringify(skillNames);
  const professionsJson = JSON.stringify(PROFESSION_NAMES);

  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Dungeon Bard</title>
<style>
  body { font-family: sans-serif; padding: 20px; background: #2c2f33; color: #dcddde; line-height: 1.5; }
  .card { background: #36393f; padding: 20px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.4); max-width: 860px; margin: auto; }
  h1, h3 { color: #fff; }
  .hidden { display: none; }
  .error   { color: #f04747; font-weight: bold; }
  .success { color: #43b581; font-weight: bold; }
  .control-group { margin-bottom: 18px; padding: 14px; border: 1px solid #4f545c; border-radius: 4px; background: #2f3136; }
  label { font-weight: bold; display: block; margin-bottom: 5px; color: #b9bbbe; }
  input[type="text"], input[type="number"], textarea, select {
    width: 100%; padding: 8px; margin-bottom: 12px; box-sizing: border-box;
    border: 1px solid #4f545c; border-radius: 4px; background: #40444b; color: #dcddde;
  }
  input[type="number"] { width: 120px; }
  .btn { padding: 9px 18px; cursor: pointer; background: #5865F2; color: white; border: none; border-radius: 4px; font-size: 0.95rem; margin-right: 8px; }
  .btn:hover { background: #4752C4; }
  .btn-secondary { background: #4f545c; }
  .btn-secondary:hover { background: #686d73; }
  .checkbox-row { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 12px; }
  .checkbox-item { display: flex; align-items: center; gap: 6px; font-weight: normal; color: #dcddde; }
  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  hr { border-color: #4f545c; margin: 16px 0; }
  #quest-list { width: 100%; margin-bottom: 10px; }
  .skill-bonus-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 12px; }
  .skill-bonus-row select { width: auto; margin-bottom: 0; }
  .skill-bonus-row input  { width: 80px; margin-bottom: 0; }
</style>
</head>
<body>
<div class="card">
  <h1>Dungeon Bard</h1>
  <p>Welcome, ${username}. <a href="/play" style="color:#b9bbbe;font-size:0.85rem;">[ Player Panel ]</a></p>
  <hr>
  <h3>Quest Editor</h3>

  <!-- Step 1: Domain -->
  <div class="control-group">
    <label for="domain-select">1. Select Domain:</label>
    <select id="domain-select" onchange="loadQuests()">
      <option value="" disabled selected>-- Choose a Domain --</option>
    </select>
  </div>

  <!-- Step 2: Area -->
  <div id="area-controls" class="control-group hidden">
    <label for="area-select">2. Select Quest Area:</label>
    <select id="area-select" onchange="loadQuests()">
      <option value="" disabled selected>-- Choose an Area --</option>
    </select>
  </div>

  <!-- Step 3: Quest selection -->
  <div id="quest-controls" class="control-group hidden">
    <label for="quest-list">3. Select Quest to Edit (or create new):</label>
    <select id="quest-list" onchange="loadQuestForEdit(this.value)">
      <option value="" disabled selected>-- Choose a Quest --</option>
    </select>
    <button class="btn btn-secondary" onclick="clearForm()">+ New Quest</button>
  </div>

  <div id="status-msg" class="hidden" style="margin-bottom:10px;"></div>

  <!-- Quest Edit/Create Form -->
  <div id="quest-form" class="control-group hidden">
    <h3 id="form-title">New Quest</h3>
    <input type="hidden" id="q-id">

    <div class="two-col">
      <div>
        <label>Quest Name</label>
        <input type="text" id="q-name" placeholder="e.g. The Lost Relic">
      </div>
      <div>
        <label>Quest Area</label>
        <select id="q-area"></select>
      </div>
    </div>

    <label>Area Description</label>
    <textarea id="q-area-desc" rows="2" placeholder="Short description of this area..."></textarea>

    <label>Quest Description</label>
    <textarea id="q-desc" rows="3" placeholder="Describe the quest..."></textarea>

    <div class="two-col">
      <div>
        <label>Profession</label>
        <select id="q-profession-id">
          <option value="" disabled selected>-- Choose --</option>
        </select>
      </div>
      <div>
        <label>Profession XP Awarded (1–100)</label>
        <input type="number" id="q-xp" min="1" max="100" value="1">
      </div>
    </div>

    <label>Skill Bonuses (set each to 0 or higher):</label>
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px;" id="skill-inputs"></div>

    <div class="two-col">
      <div>
        <label>Coins Awarded</label>
        <select id="q-coins">
          ${[1,2,3,4,5,6,7,8,9,10].map(n => `<option value="${n}">${n}</option>`).join('')}
        </select>
      </div>
      <div>
        <label>Max Count</label>
        <select id="q-maxcount">
          ${[1,2,3,4,5].map(n => `<option value="${n}">${n}</option>`).join('')}
        </select>
      </div>
    </div>

    <label>Beastiary (optional — encounter type)</label>
    <select id="q-beast">
      <option value="">None</option>
    </select>

    <label>Relic (optional)</label>
    <select id="q-relic">
      <option value="">None</option>
    </select>

    <hr>
    <label>Apply Quest to Domains:</label>
    <div id="domain-checkboxes" class="checkbox-row"></div>

    <div style="margin-top:12px;">
      <button class="btn" onclick="saveQuest()">Save Quest</button>
      <button class="btn btn-secondary" onclick="clearForm()">Cancel</button>
    </div>
  </div>
</div>

<script>
  const DOMAINS     = ${domainsJson};
  const AREAS       = ${areasJson};
  const BEASTS      = ${beastsJson};
  const RELICS      = ${relicsJson};
  const SKILL_NAMES = ${skillNamesJson};
  const PROFESSIONS = ${professionsJson};

  let currentDomainId = null;

  // Populate all static dropdowns once on load
  (function initStaticDropdowns() {
    const domSel = document.getElementById('domain-select');
    DOMAINS.forEach(d => {
      const opt = document.createElement('option');
      opt.value = d.id; opt.textContent = d.title;
      domSel.appendChild(opt);
    });

    const areaSel = document.getElementById('area-select');
    const qArea   = document.getElementById('q-area');
    AREAS.forEach(a => {
      [areaSel, qArea].forEach(sel => {
        const opt = document.createElement('option');
        opt.value = a; opt.textContent = a;
        sel.appendChild(opt);
      });
    });

    const profSel = document.getElementById('q-profession-id');
    PROFESSIONS.forEach((p, i) => {
      const opt = document.createElement('option');
      opt.value = i + 1; opt.textContent = p;
      profSel.appendChild(opt);
    });

    const beastSel = document.getElementById('q-beast');
    BEASTS.forEach(b => {
      const opt = document.createElement('option');
      opt.value = b.type; opt.textContent = \`\${b.type} (\${b.entity})\`;
      beastSel.appendChild(opt);
    });

    const relicSel = document.getElementById('q-relic');
    RELICS.forEach(r => {
      const opt = document.createElement('option');
      opt.value = r.id; opt.textContent = \`\${r.id} — \${r.name}\`;
      relicSel.appendChild(opt);
    });

    const cbContainer = document.getElementById('domain-checkboxes');
    DOMAINS.forEach(d => {
      const label = document.createElement('label');
      label.className = 'checkbox-item';
      label.innerHTML = \`<input type="checkbox" name="domain" value="\${d.id}"> \${d.title}\`;
      cbContainer.appendChild(label);
    });

    // Generate 6 skill input fields
    const skillContainer = document.getElementById('skill-inputs');
    for (let i = 1; i <= 6; i++) {
      const div = document.createElement('div');
      div.innerHTML = \`
        <label for="q-skill-\${i}">Skill \${i}</label>
        <input type="number" id="q-skill-\${i}" min="0" value="0">
      \`;
      skillContainer.appendChild(div);
    }

    document.getElementById('area-controls').classList.remove('hidden');
  })();

  function updateSkillLabels(domainId) {
    if (!domainId) return;
    const names = SKILL_NAMES[domainId - 1];
    if (!names) return;
    for (let i = 1; i <= 6; i++) {
      const label = document.querySelector(\`label[for="q-skill-\${i}"]\`);
      if (label) label.textContent = \`Skill \${i}: \${names[i - 1]}\`;
    }
  }

  async function loadQuests() {
    const domainId = document.getElementById('domain-select').value;
    const area     = document.getElementById('area-select').value;
    currentDomainId = domainId ? parseInt(domainId) : null;
    if (currentDomainId) updateSkillLabels(currentDomainId);
    if (!domainId || !area) return;

    try {
      const res = await fetch(\`/api/quests?area=\${encodeURIComponent(area)}&domain=\${domainId}\`);
      if (res.status === 403) { window.location.href = '/'; return; }
      const quests = await res.json();
      const sel = document.getElementById('quest-list');
      sel.innerHTML = '<option value="" disabled selected>-- Choose a Quest --</option>';
      quests.forEach(q => {
        const opt = document.createElement('option');
        opt.value = q.id; opt.textContent = q.name;
        sel.appendChild(opt);
      });
      document.getElementById('quest-controls').classList.remove('hidden');
      clearForm();
    } catch (e) { console.error("Load quests failed", e); }
  }

  async function loadQuestForEdit(id) {
    if (!id) return;
    try {
      const res = await fetch(\`/api/quests/\${id}\`);
      if (res.status === 403) { window.location.href = '/'; return; }
      const q = await res.json();

      document.getElementById('q-id').value             = q.id;
      document.getElementById('form-title').textContent  = 'Edit Quest';
      document.getElementById('q-name').value            = q.name;
      document.getElementById('q-area').value            = q.questArea;
      document.getElementById('q-area-desc').value       = q.areaDesc;
      document.getElementById('q-desc').value            = q.description;
      document.getElementById('q-profession-id').value  = q.professionId;
      document.getElementById('q-xp').value              = q.professionXp;

      // Load coins — add out-of-range value if needed
      const coinSelect = document.getElementById('q-coins');
      coinSelect.value = q.coins;
      if (!Array.from(coinSelect.options).some(o => parseInt(o.value) === q.coins)) {
        const opt = document.createElement('option');
        opt.value = q.coins;
        opt.textContent = q.coins + ' (current)';
        opt.selected = true;
        coinSelect.appendChild(opt);
      }

      // Load maxCount — add out-of-range value if needed
      const mcSelect = document.getElementById('q-maxcount');
      mcSelect.value = q.maxCount;
      if (!Array.from(mcSelect.options).some(o => parseInt(o.value) === q.maxCount)) {
        const opt = document.createElement('option');
        opt.value = q.maxCount;
        opt.textContent = q.maxCount + ' (current)';
        opt.selected = true;
        mcSelect.appendChild(opt);
      }

      document.getElementById('q-beast').value           = q.beastiary || '';
      document.getElementById('q-relic').value           = q.relic || '';

      // Load all 6 skill values
      for (let i = 1; i <= 6; i++) {
        document.getElementById(\`q-skill-\${i}\`).value = q[\`skill\${i}\`] || 0;
      }

      document.querySelectorAll('input[name="domain"]').forEach(cb => {
        cb.checked = !!(q.domainId & (1 << (parseInt(cb.value) - 1)));
      });

      document.getElementById('quest-form').classList.remove('hidden');
      hideStatus();
    } catch (e) { console.error("Load quest failed", e); }
  }

  function clearForm() {
    document.getElementById('q-id').value             = '';
    document.getElementById('form-title').textContent  = 'New Quest';
    document.getElementById('q-name').value            = '';
    document.getElementById('q-area').value            = document.getElementById('area-select').value || '';
    document.getElementById('q-area-desc').value       = '';
    document.getElementById('q-desc').value            = '';
    document.getElementById('q-profession-id').value  = '';
    document.getElementById('q-xp').value              = 1;
    document.getElementById('q-coins').value           = 1;
    document.getElementById('q-maxcount').value        = 1;
    document.getElementById('q-beast').value           = '';
    document.getElementById('q-relic').value           = '';
    for (let i = 1; i <= 6; i++) {
      document.getElementById(\`q-skill-\${i}\`).value = 0;
    }
    document.querySelectorAll('input[name="domain"]').forEach(cb => {
      cb.checked = currentDomainId ? parseInt(cb.value) === currentDomainId : false;
    });
    document.getElementById('quest-form').classList.remove('hidden');
    hideStatus();
  }

  async function saveQuest() {
    const id = document.getElementById('q-id').value;
    const skills = {};
    for (let i = 1; i <= 6; i++) {
      skills[\`skill\${i}\`] = parseInt(document.getElementById(\`q-skill-\${i}\`).value) || 0;
    }
    const body = {
      domainIds:    Array.from(document.querySelectorAll('input[name="domain"]:checked')).map(cb => parseInt(cb.value)),
      questArea:    document.getElementById('q-area').value.trim(),
      areaDesc:     document.getElementById('q-area-desc').value.trim(),
      name:         document.getElementById('q-name').value.trim(),
      description:  document.getElementById('q-desc').value.trim(),
      professionId: document.getElementById('q-profession-id').value,
      professionXp: document.getElementById('q-xp').value,
      coins:        document.getElementById('q-coins').value,
      maxCount:     document.getElementById('q-maxcount').value,
      beastiary:    document.getElementById('q-beast').value || null,
      relic:        document.getElementById('q-relic').value || null,
      ...skills,
      questId:      id || null
    };

    try {
      const res = await fetch(id ? \`/api/quests/\${id}\` : '/api/quests', {
        method:  id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body)
      });
      if (res.status === 403) { window.location.href = '/'; return; }
      const data = await res.json();
      if (!res.ok) { showStatus(data.error, false); return; }
      showStatus(id ? 'Quest updated.' : \`Quest created (id: \${data.id})\`, true);
      loadQuests();
    } catch (e) { showStatus('Failed to save quest.', false); }
  }

  function showStatus(msg, ok) {
    const el = document.getElementById('status-msg');
    el.textContent = msg;
    el.className = ok ? 'success' : 'error';
    el.classList.remove('hidden');
  }
  function hideStatus() { document.getElementById('status-msg').classList.add('hidden'); }
</script>
</body>
</html>`);
});

// --- PLAYER PANEL ROUTES (session-only tier) ---

// Map area definitions — coordinates relative to 1002×1005 image.
// Each area has polygon points [x,y,...] relative to the 1002×1005 source image.
// Center diamond (roughly x:300-700, y:300-860) is intentionally unclaimed — reserved for future use.
// Adjust coords in PLAY_MAP_AREAS to fine-tune hotspot boundaries.
const PLAY_MAP_AREAS = [
  { area: "Lair of Self Care",  coords: "60,95 420,95 420,320 300,460 60,460" },
  { area: "Chamber of Oration", coords: "420,95 1000,95 1000,400 840,420 700,340 420,320" },
  { area: "Scribe's Tower",     coords: "840,420 1000,400 1000,780 660,720 700,540 700,340 840,420" },
  { area: "Hall of Marvels",    coords: "60,460 300,460 420,320 420,560 300,700 60,680" },
  { area: "Tribunal of Forms",  coords: "60,680 300,700 420,840 420,980 60,980" },
  { area: "Vault of Vellum",    coords: "420,840 660,720 1000,780 1000,980 420,980" },
];

// Helper: look up or resolve guildId from cookie or default (highest overallExp)
function resolveGuildId(req) {
  const cookieGuild = req.cookies.selectedGuild;
  const guilds = dbQuery.getPlayerGuilds.all(req.discordId);
  if (!guilds.length) return null;
  if (cookieGuild && guilds.some(g => g.guildId === cookieGuild)) return cookieGuild;
  return guilds[0].guildId; // already sorted by overallExp DESC
}

// GET /play — guild picker or redirect to /play/:guildId
app.get('/play', (req, res) => {
  const guilds = dbQuery.getPlayerGuilds.all(req.discordId);
  if (!guilds.length) return res.status(400).send('No guild membership found. Use the bot in a Discord server first.');
  const guildId = resolveGuildId(req);
  res.redirect(`/play/${guildId}`);
});

// GET /play/:guildId — main player panel
app.get('/play/:guildId', (req, res) => {
  const { guildId } = req.params;
  const guilds = dbQuery.getPlayerGuilds.all(req.discordId);
  if (!guilds.length || !guilds.some(g => g.guildId === guildId)) {
    return res.status(403).send('You are not a member of that guild.');
  }
  // Set/refresh selectedGuild cookie (30 days, not httpOnly so JS can also read it)
  res.cookie('selectedGuild', guildId, { httpOnly: true, secure: true, sameSite: 'Lax', maxAge: 30 * 24 * 60 * 60 * 1000 });

  const user = dbQuery.getUser.get(req.discordId, guildId);
  const domainId = user?.domainId || null;
  const username = req.session.username || 'Adventurer';
  const isAdmin  = ADMIN_WHITELIST.includes(req.discordId);

  const guildsJson   = JSON.stringify(guilds);
  const domainsJson  = JSON.stringify(DOMAINS);
  const mapAreasJson = JSON.stringify(PLAY_MAP_AREAS);
  const imageBase    = 'https://raw.githubusercontent.com/CapricanDRJ/DungeonBard/main/placeImages/';

  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Dungeon Bard — Quest Panel</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: sans-serif; background: #2c2f33; color: #dcddde; margin: 0; padding: 16px; }
  .card { background: #36393f; border-radius: 8px; padding: 20px; max-width: 900px; margin: auto; box-shadow: 0 2px 8px rgba(0,0,0,.4); }
  h1, h2 { color: #fff; margin: 0 0 8px; }
  .nav { display: flex; gap: 12px; align-items: center; margin-bottom: 16px; flex-wrap: wrap; }
  .nav select { background: #40444b; color: #dcddde; border: 1px solid #4f545c; border-radius: 4px; padding: 6px 10px; }
  .nav a { color: #b9bbbe; font-size: .85rem; text-decoration: none; }
  .nav a:hover { color: #fff; }
  hr { border-color: #4f545c; margin: 14px 0; }
  /* Map */
  .map-wrap { position: relative; display: inline-block; width: 100%; max-width: 700px; }
  .map-wrap img { width: 100%; height: auto; display: block; border-radius: 6px; }
  .map-wrap svg { position: absolute; top: 0; left: 0; width: 100%; height: 100%; }
  .map-wrap svg polygon { fill: rgba(255,220,100,.15); stroke: rgba(255,220,100,.5); stroke-width: 2; cursor: pointer; transition: fill .15s; }
  .map-wrap svg polygon:hover, .map-wrap svg polygon.active { fill: rgba(255,220,100,.4); stroke: #ffd700; }
  /* Controls */
  .controls { margin-top: 16px; }
  label { display: block; font-size: .85rem; color: #b9bbbe; margin-bottom: 4px; }
  select, .btn { padding: 8px 14px; border-radius: 4px; border: 1px solid #4f545c; background: #40444b; color: #dcddde; font-size: .95rem; }
  .btn { cursor: pointer; border: none; }
  .btn-primary { background: #5865F2; color: #fff; }
  .btn-primary:hover { background: #4752C4; }
  .btn-primary:disabled { background: #3c4394; color: #888; cursor: not-allowed; }
  .btn-danger  { background: #ed4245; color: #fff; }
  .btn-danger:hover  { background: #c03537; }
  .btn-success { background: #57f287; color: #000; }
  .btn-success:hover { background: #3ac76d; }
  .area-img { width: 100%; max-width: 500px; border-radius: 6px; margin-top: 10px; display: none; }
  .quest-detail { background: #2f3136; border-radius: 6px; padding: 14px; margin-top: 12px; display: none; }
  .quest-detail h3 { margin: 0 0 6px; color: #fff; }
  .quest-detail p { margin: 0 0 10px; color: #b9bbbe; font-size: .9rem; }
  .count-row { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
  .count-row input { width: 60px; padding: 6px; background: #40444b; border: 1px solid #4f545c; border-radius: 4px; color: #dcddde; text-align: center; }
  .result-box { background: #2f3136; border-radius: 6px; padding: 14px; margin-top: 14px; display: none; }
  .result-box h3 { color: #57f287; margin: 0 0 8px; }
  .result-box .defeat { color: #ed4245; }
  .result-box pre { font-size: .78rem; color: #b9bbbe; white-space: pre-wrap; margin: 8px 0 0; }
  .stat-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 8px; }
  .stat-box { background: #40444b; border-radius: 4px; padding: 8px; text-align: center; }
  .stat-box .val { font-size: 1.1rem; font-weight: bold; color: #fff; }
  .stat-box .lbl { font-size: .75rem; color: #b9bbbe; }
  .domain-select-wrap { padding: 20px; background: #2f3136; border-radius: 6px; }
  .domain-btn { display: block; width: 100%; text-align: left; padding: 10px 14px; margin-bottom: 8px;
    background: #40444b; border: 1px solid #4f545c; border-radius: 4px; color: #dcddde; cursor: pointer; font-size: .95rem; }
  .domain-btn:hover { background: #4f545c; }
  #status { margin-top: 10px; font-size: .9rem; }
</style>
</head>
<body>
<div class="card">
  <div class="nav">
    <h1>Dungeon Bard</h1>
    <span style="color:#b9bbbe">|</span>
    <span>${username}</span>
    <span style="color:#b9bbbe">|</span>
    <label style="margin:0;display:inline">Guild:
      <select id="guild-select" onchange="switchGuild(this.value)">
        ${guilds.map(g => `<option value="${g.guildId}" ${g.guildId === guildId ? 'selected' : ''}>${g.displayName || g.guildId} (${g.overallExp} XP)</option>`).join('')}
      </select>
    </label>
    ${isAdmin ? '<a href="/admin">[ Admin Panel ]</a>' : ''}
    <a href="/quests">[ Quest Registry ]</a>
  </div>
  <hr>

  <div id="domain-wrap" style="display:${domainId ? 'none' : 'block'}">
    <div class="domain-select-wrap">
      <h2>Choose Your Domain</h2>
      <p style="color:#b9bbbe;font-size:.9rem">Select the domain you wish to adventure in:</p>
      ${DOMAINS.map(d => `<button class="domain-btn" onclick="selectDomain(${d.id})">${d.title}</button>`).join('')}
    </div>
  </div>

  <div id="quest-wrap" style="display:${domainId ? 'block' : 'none'}">
    <h2>Quest Map</h2>
    <div class="map-wrap">
      <img src="${imageBase}sd.png" alt="Quest Map" id="map-img">
      <svg viewBox="0 0 1002 1005" id="map-svg">
        ${PLAY_MAP_AREAS.map(a => `<polygon points="${a.coords}" data-area="${a.area}" onclick="selectArea('${a.area.replace(/'/g,"\\'")}', this)" title="${a.area}"/>`).join('\n        ')}
      </svg>
    </div>

    <div class="controls">
      <label>Area</label>
      <select id="area-select" onchange="onAreaSelect(this.value)" style="width:100%;max-width:400px">
        <option value="">— Select an area —</option>
      </select>

      <img id="area-img" class="area-img" alt="Area">

      <div style="margin-top:12px">
        <label>Quest</label>
        <select id="quest-select" onchange="onQuestSelect(this.value)" style="width:100%;max-width:400px" disabled>
          <option value="">— Select a quest —</option>
        </select>
      </div>

      <div class="quest-detail" id="quest-detail">
        <h3 id="quest-name"></h3>
        <p id="quest-desc"></p>
        <div class="count-row">
          <label style="margin:0">Count:</label>
          <input type="number" id="quest-count" value="1" min="1" max="1">
          <span id="quest-maxcount-label" style="color:#b9bbbe;font-size:.85rem"></span>
        </div>
        <button class="btn btn-success" id="claim-btn" onclick="claimQuest()">Claim Quest</button>
        <div id="status"></div>
      </div>
    </div>
  </div>

  <div class="result-box" id="result-box">
    <h3 id="result-title">Quest Complete!</h3>
    <div id="result-body"></div>
  </div>
</div>

<script>
  const DOMAINS    = ${domainsJson};
  const MAP_AREAS  = ${mapAreasJson};
  const IMAGE_BASE = '${imageBase}';
  const GUILD_ID   = '${guildId}';
  let currentDomainId = ${domainId || 'null'};
  let currentQuest = null;

  // Populate area dropdown from map areas (filtering later against DB after area select)
  function initAreaDropdown() {
    const sel = document.getElementById('area-select');
    sel.innerHTML = '<option value="">— Select an area —</option>';
    MAP_AREAS.forEach(a => {
      const opt = document.createElement('option');
      opt.value = a.area;
      opt.textContent = a.area;
      sel.appendChild(opt);
    });
  }
  initAreaDropdown();

  function switchGuild(guildId) {
    window.location.href = '/play/' + guildId;
  }

  async function selectDomain(domainId) {
    try {
      const res = await fetch('/api/play/domain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guildId: GUILD_ID, domainId })
      });
      if (!res.ok) throw new Error((await res.json()).error);
      currentDomainId = domainId;
      document.getElementById('domain-wrap').style.display = 'none';
      document.getElementById('quest-wrap').style.display  = 'block';
    } catch (e) { alert('Failed to set domain: ' + e.message); }
  }

  // Map click
  function selectArea(areaName, el) {
    document.querySelectorAll('#map-svg polygon').forEach(p => p.classList.remove('active'));
    el.classList.add('active');
    const sel = document.getElementById('area-select');
    sel.value = areaName;
    loadAreaQuests(areaName);
  }

  // Dropdown select
  function onAreaSelect(areaName) {
    if (!areaName) return;
    // Sync map highlight
    document.querySelectorAll('#map-svg polygon').forEach(p => {
      p.classList.toggle('active', p.dataset.area === areaName);
    });
    loadAreaQuests(areaName);
  }

  async function loadAreaQuests(areaName) {
    document.getElementById('quest-detail').style.display = 'none';
    document.getElementById('result-box').style.display   = 'none';
    currentQuest = null;

    const img = document.getElementById('area-img');
    img.src = IMAGE_BASE + areaName.replace(/[^a-zA-Z0-9]/g, '') + '.png';
    img.style.display = 'block';
    img.onerror = () => img.style.display = 'none';

    const qs = document.getElementById('quest-select');
    qs.innerHTML = '<option value="">Loading...</option>';
    qs.disabled = true;
    try {
      const res = await fetch('/api/play/quests?area=' + encodeURIComponent(areaName) + '&guildId=' + GUILD_ID);
      const quests = await res.json();
      qs.innerHTML = '<option value="">— Select a quest —</option>';
      quests.forEach(q => {
        const opt = document.createElement('option');
        opt.value = q.id;
        opt.textContent = q.name;
        opt.dataset.desc = q.description || '';
        opt.dataset.max  = q.maxCount || 1;
        qs.appendChild(opt);
      });
      qs.disabled = false;
    } catch(e) {
      qs.innerHTML = '<option value="">Failed to load quests</option>';
    }
  }

  function onQuestSelect(questId) {
    const qs  = document.getElementById('quest-select');
    const opt = qs.options[qs.selectedIndex];
    if (!questId || !opt) { document.getElementById('quest-detail').style.display = 'none'; return; }
    const maxCount = parseInt(opt.dataset.max) || 1;
    currentQuest = { id: questId, maxCount };
    document.getElementById('quest-name').textContent  = opt.textContent;
    document.getElementById('quest-desc').textContent  = opt.dataset.desc;
    document.getElementById('quest-count').max         = maxCount;
    document.getElementById('quest-count').value       = 1;
    document.getElementById('quest-maxcount-label').textContent = 'max ' + maxCount;
    document.getElementById('quest-detail').style.display = 'block';
    document.getElementById('result-box').style.display   = 'none';
    document.getElementById('status').textContent = '';
  }

  async function claimQuest() {
    if (!currentQuest) return;
    const count = Math.min(parseInt(document.getElementById('quest-count').value) || 1, currentQuest.maxCount);
    const btn = document.getElementById('claim-btn');
    btn.disabled = true;
    btn.textContent = 'Claiming...';
    document.getElementById('status').textContent = '';
    try {
      const res = await fetch('/api/play/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questId: currentQuest.id, count, guildId: GUILD_ID })
      });
      const data = await res.json();
      if (!res.ok) { document.getElementById('status').textContent = data.error || 'Failed.'; return; }
      showResult(data);
    } catch(e) {
      document.getElementById('status').textContent = 'Request failed.';
    } finally {
      btn.disabled = false;
      btn.textContent = 'Claim Quest';
    }
  }

  function showResult(data) {
    const box = document.getElementById('result-box');
    box.style.display = 'block';
    document.getElementById('result-title').textContent = data.outcome === 'defeat' ? 'Defeated!' : 'Quest Complete!';
    document.getElementById('result-title').className = data.outcome === 'defeat' ? 'defeat' : '';
    let html = '<div class="stat-grid">';
    html += stat('XP Earned', data.xpEarned);
    html += stat('Coins Earned', '🪙 ' + data.coinsEarned);
    html += stat('Overall XP', data.overallExp);
    html += stat('Artisan XP', data.artisanExp);
    html += stat('Soldier XP', data.soldierExp);
    html += stat('Healer XP', data.healerExp);
    html += '</div>';
    if (data.monster) html += '<p style="margin-top:10px;color:#b9bbbe">⚔️ ' + data.monster + '</p>';
    if (data.relic)   html += '<p style="margin-top:4px;color:#ffd700">✨ ' + data.relic + '</p>';
    if (data.battleLog) html += '<pre>' + data.battleLog + '</pre>';
    document.getElementById('result-body').innerHTML = html;
    box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  function stat(lbl, val) {
    return '<div class="stat-box"><div class="val">' + val + '</div><div class="lbl">' + lbl + '</div></div>';
  }
</script>
</body>
</html>`);
});

// --- PLAYER API ---

// POST /api/play/domain — set domain for first-time players
app.post('/api/play/domain', (req, res) => {
  const { guildId, domainId } = req.body;
  if (!guildId || !domainId) return res.status(400).json({ error: 'guildId and domainId required.' });
  const id = parseInt(domainId);
  if (!DOMAINS.some(d => d.id === id)) return res.status(400).json({ error: 'Invalid domain.' });
  // Verify the player actually belongs to this guild
  const guilds = dbQuery.getPlayerGuilds.all(req.discordId);
  if (!guilds.some(g => g.guildId === guildId)) return res.status(403).json({ error: 'Not a member of that guild.' });
  try {
    const username = req.session.username || 'Adventurer';
    dbQuery.insertQuestUser.run(req.discordId, guildId, username, null, id);
    // Queue role sync for the bot
    dbQuery.insertBotQueue.run('roleSync', guildId, req.discordId, JSON.stringify({ domainId: id }), Date.now());
    res.json({ ok: true });
  } catch (err) {
    console.error('[setDomain_ERROR]', err.message, { discordId: req.discordId, guildId });
    res.status(500).json({ error: 'Failed to set domain.' });
  }
});

// GET /api/play/quests?area=&guildId= — quests for an area filtered by player domain
app.get('/api/play/quests', (req, res) => {
  const { area, guildId } = req.query;
  if (!area || !guildId) return res.status(400).json({ error: 'area and guildId required.' });
  const guilds = dbQuery.getPlayerGuilds.all(req.discordId);
  if (!guilds.some(g => g.guildId === guildId)) return res.status(403).json({ error: 'Not a member of that guild.' });
  try {
    const user = dbQuery.getUser.get(req.discordId, guildId);
    if (!user?.domainId) return res.status(400).json({ error: 'No domain set.' });
    res.json(dbQuery.getQuestsInArea.all(area, user.domainId));
  } catch (err) {
    console.error('[playQuests_ERROR]', err.message, { area, guildId });
    res.status(500).json({ error: 'Failed to fetch quests.' });
  }
});

// POST /api/play/claim — claim a quest; mirrors quest.js questcomplete flow exactly
app.post('/api/play/claim', (req, res) => {
  const { questId, count, guildId } = req.body;
  if (!questId || !guildId) return res.status(400).json({ error: 'questId and guildId required.' });
  const id       = parseInt(questId);
  const multiple = Math.max(1, parseInt(count) || 1);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid questId.' });

  // Confirm guild membership
  const guilds = dbQuery.getPlayerGuilds.all(req.discordId);
  if (!guilds.some(g => g.guildId === guildId)) return res.status(403).json({ error: 'Not a member of that guild.' });

  const quest = dbQuery.getQuestById.get(id);
  if (!quest) return res.status(404).json({ error: 'Quest not found.' });

  const clampedCount = Math.min(multiple, quest.maxCount || 1);
  const user = dbQuery.getUser.get(req.discordId, guildId);
  if (!user) return res.status(400).json({ error: 'User not found in that guild.' });

  try {
    // Apply inventory bonuses (mirror quest.js transaction)
    db.transaction(() => {
      dbQuery.delExpired.run(req.discordId, guildId);
      dbQuery.setActive.run(req.discordId, guildId);
      dbQuery.profBonus.run(req.discordId, guildId);
      dbQuery.skillBonus.run(req.discordId, guildId);
    })();

    const activeItems = dbQuery.getActiveItems.all(req.discordId, guildId);
    const skillBonuses   = [1,1,1,1,1,1];
    const profBonuses    = [1,1,1];
    for (const item of activeItems) {
      if (item.skill)        skillBonuses[item.skill - 1]        = item.skillBonus;
      if (item.professionId) profBonuses[item.professionId - 1]  = item.professionBonus;
    }

    // Build log object exactly as quest.js does — initialized before any mutations
    const log = {
      guildId,
      userId:      req.discordId,
      domainId:    user.domainId,
      questId:     id,
      sawMonster:  0,       // quest.js default
      beatMonster: null,    // quest.js default — only set if monster appears
      relic:       null,
      quantity:    clampedCount,
      artisanExp:  user.artisanExp,   // pre-claim snapshot for questTracker diff
      soldierExp:  user.soldierExp,
      healerExp:   user.healerExp,
      overallExp:  user.overallExp
    };

    const profession = PROFESSION_NAMES[parseInt(quest.professionId) - 1] + 'Exp';
    const xpEarned   = quest.professionXp * profBonuses[parseInt(quest.professionId) - 1] * clampedCount;

    // Update user stats — includes displayName update matching quest.js
    const displayName = req.session.username || user.displayName || 'Adventurer';
    db.prepare(`UPDATE users SET
      displayName = ?,
      skill1 = skill1 + ?, skill2 = skill2 + ?, skill3 = skill3 + ?,
      skill4 = skill4 + ?, skill5 = skill5 + ?, skill6 = skill6 + ?,
      coins = coins + ?, ${profession} = ${profession} + ?
      WHERE userId = ? AND guildId = ?`
    ).run(
      displayName,
      quest.skill1 * clampedCount, quest.skill2 * clampedCount, quest.skill3 * clampedCount,
      quest.skill4 * clampedCount, quest.skill5 * clampedCount, quest.skill6 * clampedCount,
      quest.coins * clampedCount, xpEarned,
      req.discordId, guildId
    );

    // skillMod — two-arg signature matching quest.js exactly
    function skillMod(domainId, skill) {
      return (20 - skillLevel[domainId].findIndex(val => val <= skill));
    }

    // Battle / relic resolution — mirrors quest.js questcomplete flow exactly
    let outcome = 'success', monster = null, battleLog = null, bonusCoins = 0;

    if (quest.beastiary) {
      const beast = dbQuery.getRandomBeast.get(quest.beastiary);
      if (beast && Math.random() < beast.chance) {
        log.sawMonster = 1;   // matches quest.js: only set when chance triggers

        const difficulty    = [0.01,0.75,0.9,1.05][parseInt(beast.difficulty)];
        const attack        = skillMod(user.domainId, user.skill3) + skillBonuses[2];
        const defense       = skillMod(user.domainId, user.skill4) + skillBonuses[3];
        const hp            = skillMod(user.domainId, user.skill5);
        const monsterAttack  = skillMod(user.domainId, user.skill3) * difficulty;
        const monsterDefense = skillMod(user.domainId, user.skill4) * difficulty;

        let userHitpoints    = hp;
        let monsterHitpoints = hp * difficulty;

        // Battle log header matches quest.js format exactly
        let bLog = `Monster Attack: ${monsterAttack.toFixed(2)}, Defense: ${monsterDefense.toFixed(2)}, Hitpoints: ${monsterHitpoints.toFixed(2)}\n`;
        bLog    += `Your Attack: ${attack.toFixed(2)}, Defense: ${defense.toFixed(2)}, Hitpoints: ${userHitpoints.toFixed(2)}\n`;

        let i = 0;
        while (monsterHitpoints > 0 && userHitpoints > 0) {
          const userd20attack    = Math.floor(Math.random()*20) + attack;
          const monsterd20defense = Math.floor(Math.random()*20) + monsterDefense;
          if (userd20attack >= monsterd20defense) {
            const monsterDamage = (userd20attack - monsterd20defense) / 2;
            bLog += `You hit the **${beast.entity}** for ${monsterDamage.toFixed(2)}/${monsterHitpoints.toFixed(2)} damage!\n`;
            monsterHitpoints -= monsterDamage;
          } else {
            bLog += `You miss the **${beast.entity}**!\n`;
          }
          if (monsterHitpoints <= 0) break;
          const monsterD20attack = (i > 5) ? 20 : Math.floor(Math.random()*20) + monsterAttack;
          const userd20defense   = Math.floor(Math.random()*20) + defense;
          if (i > 7) {
            bLog += `The **${beast.entity}** hits you for ${userHitpoints.toFixed(2)}/${userHitpoints.toFixed(2)} damage!\n`;
            userHitpoints = 0;
            break;
          }
          if (monsterD20attack >= userd20defense) {
            const userDamage = (monsterD20attack - userd20defense) / 2;
            bLog += `The **${beast.entity}** hits you for ${userDamage.toFixed(2)}/${userHitpoints.toFixed(2)} damage!\n`;
            userHitpoints -= userDamage;
          } else {
            bLog += `The **${beast.entity}** misses you!\n`;
          }
          if (userHitpoints <= 0) break;
          i++;
        }

        monster   = beast.entity;
        battleLog = bLog;

        if (userHitpoints <= 0) {
          log.beatMonster = 0;  // quest.js: explicit 0 on defeat
          outcome = 'defeat';
        } else {
          log.beatMonster = 1;  // quest.js: explicit 1 on win
          bonusCoins = Math.floor(quest.coins * ((beast.difficulty * 0.3) + (0.5 * Math.random())));
          dbQuery.addCoins.run(bonusCoins, req.discordId, guildId);
          if (quest.relic) {
            const r = dbQuery.getRandomRelic.get(quest.relic);
            if (r && Math.random() < r.chance) {
              // quest.js format: "${quest.relic}: ${relic.description}" — relic type id, not r.name
              log.relic = `${quest.relic}: ${r.description}`;
              if (r.bonusXp && r.bonusXp < 9) {
                dbQuery.addToInventory.run(req.discordId, guildId, r.name, r.skillBonus, r.skill, r.duration, r.emojiId);
              } else if (r.bonusXp) {
                const rProf = PROFESSION_NAMES[parseInt(r.professionId)-1] + 'Exp';
                db.prepare(`UPDATE users SET ${rProf} = ${rProf} + ? WHERE userId = ? AND guildId = ?`)
                  .run(r.bonusXp * profBonuses[parseInt(r.professionId)-1], req.discordId, guildId);
              }
            }
          }
        }
      }
      // beast.chance did not trigger: sawMonster stays 0, beatMonster stays null — matches quest.js
    } else if (quest.relic) {
      // No beastiary — relic-only path (quest.js: beastiary === null branch)
      const r = dbQuery.getRandomRelic.get(quest.relic);
      if (r && Math.random() < r.chance) {
        log.relic = `${quest.relic}: ${r.description}`;  // quest.js format
        if (r.bonusXp && r.bonusXp < 9) {
          dbQuery.addToInventory.run(req.discordId, guildId, r.name, r.skillBonus, r.skill, r.duration, r.emojiId);
        } else if (r.bonusXp) {
          const rProf = PROFESSION_NAMES[parseInt(r.professionId)-1] + 'Exp';
          db.prepare(`UPDATE users SET ${rProf} = ${rProf} + ? WHERE userId = ? AND guildId = ?`)
            .run(r.bonusXp * profBonuses[parseInt(r.professionId)-1], req.discordId, guildId);
        }
      }
    }

    // Log to questTracker + queue bot actions — both deferred so response isn't held
    setImmediate(() => {
      try {
        const encryptedId = crypto.createHmac('sha256', config.key || '').update(req.discordId).digest('hex');
        dbQuery.storeQuest.run(
          log.guildId,
          log.userId,
          encryptedId,
          log.domainId,
          log.questId,
          log.artisanExp,   // pre-claim — SQL computes diff against current row
          log.soldierExp,
          log.healerExp,
          log.overallExp,
          log.sawMonster,
          log.beatMonster,
          log.relic,
          log.quantity,
          log.userId,       // WHERE clause
          log.guildId
        );

        // Queue level-up check — includes full pre-claim snapshot so bot
        // can run the same threshold logic as checkLevelUp without re-reading old XP
        dbQuery.insertBotQueue.run('levelUp', guildId, req.discordId, JSON.stringify({
          displayName,
          domainId:    user.domainId,
          artisanExpBefore: log.artisanExp,
          soldierExpBefore: log.soldierExp,
          healerExpBefore:  log.healerExp,
          skill1Before: user.skill1, skill2Before: user.skill2,
          skill3Before: user.skill3, skill4Before: user.skill4,
          skill5Before: user.skill5, skill6Before: user.skill6,
        }), Date.now());

      } catch (e) { console.error('[storeQuest_ERROR]', e.message, { questId: id, guildId }); }
    });

    const userAfter = dbQuery.getUser.get(req.discordId, guildId);
    res.json({
      outcome,
      xpEarned:    outcome === 'defeat' ? 0 : xpEarned,
      coinsEarned: (quest.coins * clampedCount) + bonusCoins,
      overallExp:  userAfter?.overallExp ?? user.overallExp,
      artisanExp:  userAfter?.artisanExp ?? user.artisanExp,
      soldierExp:  userAfter?.soldierExp ?? user.soldierExp,
      healerExp:   userAfter?.healerExp  ?? user.healerExp,
      monster, relic: log.relic, battleLog
    });
  } catch (err) {
    console.error('[claimQuest_ERROR]', err.message, { questId: id, guildId, discordId: req.discordId });
    res.status(500).json({ error: 'Failed to process quest.' });
  }
});

// --- ADMIN API ROUTES (all gated by the global auth middleware above) ---
app.get('/api/quests/domains', (req, res) => res.json(DOMAINS));
app.get('/api/quests/areas',   (req, res) => res.json(AREAS));
app.get('/api/beasts',         (req, res) => res.json(BEASTS));
app.get('/api/relics',         (req, res) => res.json(RELICS));

app.get('/api/quests', (req, res) => {
  const { area, domain } = req.query;
  if (!area || !domain) return res.status(400).json({ error: "area and domain required." });
  const domainId = parseInt(domain);
  if (isNaN(domainId)) return res.status(400).json({ error: "Invalid domain." });
  try {
    res.json(dbQuery.getQuestsByAreaDomain.all(area, 1 << (domainId - 1)));
  } catch (err) {
    console.error("[getQuests_ERROR]", err.message, { area, domain });
    res.status(500).json({ error: "Failed to fetch quests." });
  }
});

app.get('/api/quests/:id', (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid quest id." });
  try {
    const quest = dbQuery.getQuestById.get(id);
    if (!quest) return res.status(404).json({ error: "Quest not found." });
    res.json(quest);
  } catch (err) {
    console.error("[getQuestById_ERROR]", err.message, { id });
    res.status(500).json({ error: "Failed to fetch quest." });
  }
});

app.post('/api/quests', (req, res) => {
  const validated = buildQuestFields(req.body);
  if (validated.error) return res.status(400).json({ error: validated.error });

  const fw = validateWithFirewall(validated);
  if (!fw.ok) return res.status(400).json({ error: fw.error });

  try {
    const info = dbQuery.insertQuest.run(...validated.fields);
    registryCache = null;
    res.json({ id: info.lastInsertRowid });
  } catch (err) {
    console.error("[insertQuest_ERROR]", err.message);
    res.status(500).json({ error: "Failed to save quest." });
  }
});

app.put('/api/quests/:id', (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid quest id." });

  const validated = buildQuestFields(req.body);
  if (validated.error) return res.status(400).json({ error: validated.error });

  const fw = validateWithFirewall(validated);
  if (!fw.ok) return res.status(400).json({ error: fw.error });

  try {
    dbQuery.updateQuest.run(...validated.fields, id);
    registryCache = null;
    res.json({ ok: true });
  } catch (err) {
    console.error("[updateQuest_ERROR]", err.message, { id });
    res.status(500).json({ error: "Failed to update quest." });
  }
});

// --- SERVER START ---
const server = app.listen(PORT, () => {
  console.log(`🚀 Dungeon Bard running at http://localhost:${PORT}`);
});

process.on('uncaughtException',  (err)    => console.error('❌ UNCAUGHT EXCEPTION!', err));
process.on('unhandledRejection', (reason) => console.error('❌ UNHANDLED REJECTION!', reason));
server.on('error',               (err)    => console.error('❌ SERVER ERROR:', err));