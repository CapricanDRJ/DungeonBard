const express = require('express');
const sqlite3 = require('better-sqlite3');
const axios = require('axios');
const cookieParser = require('cookie-parser');
const config = require('../dungeonBard/config.json');
const { skillNames } = require('../dungeonBard/assets/levels');

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

// --- DATABASE SETUP ---
let db, sessionDb;
try {
  db = new sqlite3(MAIN_DB_PATH);
  sessionDb = new sqlite3(SESSION_DB_PATH);
  sessionDb.prepare(`
    CREATE TABLE IF NOT EXISTS sessions (
      discord_id TEXT PRIMARY KEY,
      username   TEXT,
      expires_at INTEGER
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
  checkSession:          sessionDb.prepare("SELECT * FROM sessions WHERE discord_id = ?"),
  upsertSession:         sessionDb.prepare("INSERT OR REPLACE INTO sessions (discord_id, username, expires_at) VALUES (?, ?, ?)"),
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
  `)
};

// --- MIDDLEWARE ---
app.use(express.json());
app.use(cookieParser());

// Returns the session if valid + on whitelist, otherwise null
function getAuthedSession(req) {
  const discordId = req.cookies.discordId;
  if (!discordId || !ADMIN_WHITELIST.includes(discordId)) return null;
  const session = dbQuery.checkSession.get(discordId);
  if (!session || session.expires_at < Date.now()) return null;
  return session;
}

function checkAuth(req, res, next) {
  if (!getAuthedSession(req)) return res.status(403).json({ error: "Access denied." });
  next();
}

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

// --- QUEST FIELDS BUILDER / VALIDATOR ---
function buildQuestFields(body) {
  const {
    domainIds, questArea, areaDesc, name, description,
    professionId, professionXp, skillBonus, skillIndex,
    beastiary, relic, coins, maxCount
  } = body;

  if (!name || !questArea || !areaDesc || !description || !professionId)
    return { error: "Missing required fields." };

  if (name.length > 100)        return { error: "name exceeds 100 characters." };
  if (description.length > 200) return { error: "description exceeds 200 characters." };
  if (questArea.length > 50)    return { error: "questArea exceeds 50 characters." };
  if (areaDesc.length > 100)    return { error: "areaDesc exceeds 100 characters." };

  if (beastiary && !BEASTS.some(b => b.type === beastiary))
    return { error: "Invalid beastiary type." };
  if (relic && !RELICS.some(r => r.id === relic))
    return { error: "Invalid relic id." };

  const profId = parseInt(professionId);
  if (![1, 2, 3].includes(profId)) return { error: "Invalid professionId." };

  const xp = parseInt(professionXp);
  if (isNaN(xp) || xp < 10 || xp > 100) return { error: "professionXp must be 10–100." };

  const c = parseInt(coins);
  if (isNaN(c) || c < 1 || c > 10) return { error: "coins must be 1–10." };

  const mc = parseInt(maxCount) || 1;

  const ids = Array.isArray(domainIds) ? domainIds.map(Number).filter(n => n >= 1 && n <= DOMAINS.length) : [];
  if (ids.length === 0) return { error: "At least one domain must be selected." };
  const domainBitmask = ids.reduce((mask, id) => mask | (1 << (id - 1)), 0);

  const skills = [0, 0, 0, 0, 0, 0];
  const si = parseInt(skillIndex);
  const sb = parseInt(skillBonus) || 0;
  if (si >= 1 && si <= 6 && sb > 0) skills[si - 1] = sb;

  return {
    fields: [
      domainBitmask, questArea, areaDesc, name, description,
      PROFESSION_NAMES[profId - 1], profId, xp,
      ...skills,
      beastiary || null, relic || null, c, mc
    ]
  };
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
    const userResponse = await axios.get('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${tokenResponse.data.access_token}` }
    });
    const discordId = userResponse.data.id;
    const username  = userResponse.data.global_name || userResponse.data.username;
    const expires_at = Date.now() + (7 * 24 * 60 * 60 * 1000);
    dbQuery.upsertSession.run(discordId, username, expires_at);
    res.cookie('discordId', discordId, { httpOnly: true, secure: true, sameSite: 'Lax' });
    res.redirect('/');
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

// Root: server-side auth gate — no client-side auth logic at all
app.get('/', (req, res) => {
  const session = getAuthedSession(req);
  if (!session) return res.redirect('/quests');

  // Only reaches here if cookie matches a whitelisted, unexpired session
  const username = session.username || 'Scribe';
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
  <p>Welcome, ${username}.</p>
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
        <label>Profession XP Awarded (10–100)</label>
        <input type="number" id="q-xp" min="10" max="100" value="10">
      </div>
    </div>

    <label>Skill Bonus (select one skill and amount; leave at 0 for none)</label>
    <div class="skill-bonus-row">
      <select id="q-skill-index">
        <option value="0">No skill bonus</option>
      </select>
        <label>Bonus Amount</label>
        <select id="q-skill-bonus">
          ${[0,1,2,3,4,5].map(n => `<option value="${n}">${n}</option>`).join('')}
        </select>
    </div>

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

    document.getElementById('area-controls').classList.remove('hidden');
  })();

  function updateSkillDropdown(domainId) {
    const sel = document.getElementById('q-skill-index');
    const current = sel.value;
    sel.innerHTML = '<option value="0">No skill bonus</option>';
    const names = SKILL_NAMES[domainId - 1];
    if (!names) return;
    names.forEach((name, i) => {
      const opt = document.createElement('option');
      opt.value = i + 1; opt.textContent = \`Skill \${i + 1}: \${name}\`;
      sel.appendChild(opt);
    });
    sel.value = current || '0';
  }

  async function loadQuests() {
    const domainId = document.getElementById('domain-select').value;
    const area     = document.getElementById('area-select').value;
    currentDomainId = domainId ? parseInt(domainId) : null;
    if (currentDomainId) updateSkillDropdown(currentDomainId);
    if (!domainId || !area) return;

    try {
      const res = await fetch(\`/api/quests?area=\${encodeURIComponent(area)}&domain=\${domainId}\`);
      if (res.status === 403) { window.location.href = '/quests'; return; }
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
      if (res.status === 403) { window.location.href = '/quests'; return; }
      const q = await res.json();

      document.getElementById('q-id').value             = q.id;
      document.getElementById('form-title').textContent  = 'Edit Quest';
      document.getElementById('q-name').value            = q.name;
      document.getElementById('q-area').value            = q.questArea;
      document.getElementById('q-area-desc').value       = q.areaDesc;
      document.getElementById('q-desc').value            = q.description;
      document.getElementById('q-profession-id').value  = q.professionId;
      document.getElementById('q-xp').value              = q.professionXp;
      document.getElementById('q-coins').value           = q.coins;
      document.getElementById('q-maxcount').value        = q.maxCount;
      document.getElementById('q-beast').value           = q.beastiary || '';
      document.getElementById('q-relic').value           = q.relic || '';

      const skills = [q.skill1, q.skill2, q.skill3, q.skill4, q.skill5, q.skill6];
      const si = skills.findIndex(s => s > 0);
      document.getElementById('q-skill-index').value = si >= 0 ? si + 1 : 0;
      document.getElementById('q-skill-bonus').value = si >= 0 ? skills[si] : 0;

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
    document.getElementById('q-xp').value              = 10;
    document.getElementById('q-coins').value           = 1;
    document.getElementById('q-maxcount').value        = 1;
    document.getElementById('q-beast').value           = '';
    document.getElementById('q-relic').value           = '';
    document.getElementById('q-skill-index').value     = 0;
    document.getElementById('q-skill-bonus').value     = 0;
    document.querySelectorAll('input[name="domain"]').forEach(cb => {
      cb.checked = currentDomainId ? parseInt(cb.value) === currentDomainId : false;
    });
    document.getElementById('quest-form').classList.remove('hidden');
    hideStatus();
  }

  async function saveQuest() {
    const id = document.getElementById('q-id').value;
    const body = {
      domainIds:    Array.from(document.querySelectorAll('input[name="domain"]:checked')).map(cb => parseInt(cb.value)),
      questArea:    document.getElementById('q-area').value.trim(),
      areaDesc:     document.getElementById('q-area-desc').value.trim(),
      name:         document.getElementById('q-name').value.trim(),
      description:  document.getElementById('q-desc').value.trim(),
      professionId: document.getElementById('q-profession-id').value,
      professionXp: document.getElementById('q-xp').value,
      skillIndex:   document.getElementById('q-skill-index').value,
      skillBonus:   document.getElementById('q-skill-bonus').value,
      coins:        document.getElementById('q-coins').value,
      maxCount:     document.getElementById('q-maxcount').value,
      beastiary:    document.getElementById('q-beast').value || null,
      relic:        document.getElementById('q-relic').value || null,
    };

    try {
      const res = await fetch(id ? \`/api/quests/\${id}\` : '/api/quests', {
        method:  id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body)
      });
      if (res.status === 403) { window.location.href = '/quests'; return; }
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

// --- API ROUTES (all behind checkAuth) ---
app.get('/api/quests/domains', checkAuth, (req, res) => res.json(DOMAINS));
app.get('/api/quests/areas',   checkAuth, (req, res) => res.json(AREAS));
app.get('/api/beasts',         checkAuth, (req, res) => res.json(BEASTS));
app.get('/api/relics',         checkAuth, (req, res) => res.json(RELICS));

app.get('/api/quests', checkAuth, (req, res) => {
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

app.get('/api/quests/:id', checkAuth, (req, res) => {
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

app.post('/api/quests', checkAuth, (req, res) => {
  const { fields, error } = buildQuestFields(req.body);
  if (error) return res.status(400).json({ error });
  try {
    const info = dbQuery.insertQuest.run(...fields);
    registryCache = null;
    res.json({ id: info.lastInsertRowid });
  } catch (err) {
    console.error("[insertQuest_ERROR]", err.message);
    res.status(500).json({ error: "Failed to save quest." });
  }
});

app.put('/api/quests/:id', checkAuth, (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid quest id." });
  const { fields, error } = buildQuestFields(req.body);
  if (error) return res.status(400).json({ error });
  try {
    dbQuery.updateQuest.run(...fields, id);
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