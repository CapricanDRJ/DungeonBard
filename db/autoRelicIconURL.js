const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

// Configuration
const DB_PATH = './dungeonbard.db';
const ICONS_DIR = '../relicIcons/';
const BASE_URL = 'https://raw.githubusercontent.com/CapricanDRJ/DungeonBard/refs/heads/main/relicIcons/';

function normalizeForMatching(str) {
    // Remove all non-alphanumeric characters and convert to lowercase
    return str.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
}

function updateRelicIcons() {
    try {
        // Open database
        const db = new Database(DB_PATH);
        
        // Get all relic names from database
        const relics = db.prepare('SELECT name FROM relic').all();
        console.log(`Found ${relics.length} relics in database`);
        
        // Get all icon filenames
        const iconFiles = fs.readdirSync(ICONS_DIR)
            .filter(file => file.endsWith('.png'))
            .map(file => ({
                filename: file,
                normalized: normalizeForMatching(path.basename(file, '.png'))
            }));
        
        console.log(`Found ${iconFiles.length} icon files`);
        
        // Prepare update statement
        const updateStmt = db.prepare('UPDATE relic SET iconURL = ? WHERE name = ?');
        
        let matched = 0;
        let unmatched = [];
        
        // Process each relic
        for (const relic of relics) {
            const normalizedName = normalizeForMatching(relic.name);
            
            // Find matching icon file
            const matchingIcon = iconFiles.find(icon => 
                icon.normalized === normalizedName
            );
            
            if (matchingIcon) {
                const iconURL = BASE_URL + matchingIcon.filename;
                updateStmt.run(iconURL, relic.name);
                console.log(`✓ ${relic.name} -> ${matchingIcon.filename}`);
                matched++;
            } else {
                unmatched.push({
                    name: relic.name,
                    normalized: normalizedName
                });
                console.log(`✗ No match for: ${relic.name} (${normalizedName})`);
            }
        }
        
        db.close();
        
        console.log(`\nSummary:`);
        console.log(`Matched: ${matched}`);
        console.log(`Unmatched: ${unmatched.length}`);
        
        if (unmatched.length > 0) {
            console.log(`\nUnmatched relics:`);
            unmatched.forEach(item => {
                console.log(`  ${item.name} -> ${item.normalized}`);
            });
            
            console.log(`\nAvailable icon files:`);
            iconFiles.forEach(icon => {
                console.log(`  ${icon.filename} -> ${icon.normalized}`);
            });
        }
        
    } catch (error) {
        console.error('Error updating relic icons:', error);
    }
}

// Run the update
updateRelicIcons();
