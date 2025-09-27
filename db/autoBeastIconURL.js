const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

// Configuration
const DB_PATH = './dungeonbard.db';
const ICONS_DIR = '../beastIcons/'; // Adjust if different
const BASE_URL = 'https://raw.githubusercontent.com/CapricanDRJ/DungeonBard/refs/heads/main/beastIcons/'; // Adjust if different

function normalizeForMatching(str) {
    // Remove all non-alphanumeric characters and convert to lowercase
    return str.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
}

function updateBeastiaryIcons() {
    try {
        // Open database
        const db = new Database(DB_PATH);
        
        // Get all entity names from database
        const beasts = db.prepare('SELECT entity FROM beastiary').all();
        console.log(`Found ${beasts.length} beasts in database`);
        
        // Get all icon filenames
        const iconFiles = fs.readdirSync(ICONS_DIR)
            .filter(file => file.endsWith('.png'))
            .map(file => ({
                filename: file,
                normalized: normalizeForMatching(path.basename(file, '.png'))
            }));
        
        console.log(`Found ${iconFiles.length} icon files`);
        
        // Prepare update statement
        const updateStmt = db.prepare('UPDATE beastiary SET iconURL = ? WHERE entity = ?');
        
        let matched = 0;
        let unmatched = [];
        
        // Process each beast
        for (const beast of beasts) {
            const normalizedEntity = normalizeForMatching(beast.entity);
            
            // Find matching icon file
            const matchingIcon = iconFiles.find(icon => 
                icon.normalized === normalizedEntity
            );
            
            if (matchingIcon) {
                const iconURL = BASE_URL + matchingIcon.filename;
                updateStmt.run(iconURL, beast.entity);
                console.log(`✓ ${beast.entity} -> ${matchingIcon.filename}`);
                matched++;
            } else {
                unmatched.push({
                    entity: beast.entity,
                    normalized: normalizedEntity
                });
                console.log(`✗ No match for: ${beast.entity} (${normalizedEntity})`);
            }
        }
        
        db.close();
        
        console.log(`\nSummary:`);
        console.log(`Matched: ${matched}`);
        console.log(`Unmatched: ${unmatched.length}`);
        
        if (unmatched.length > 0) {
            console.log(`\nUnmatched beasts:`);
            unmatched.forEach(item => {
                console.log(`  ${item.entity} -> ${item.normalized}`);
            });
            
            console.log(`\nAvailable icon files:`);
            iconFiles.forEach(icon => {
                console.log(`  ${icon.filename} -> ${icon.normalized}`);
            });
        }
        
    } catch (error) {
        console.error('Error updating beastiary icons:', error);
    }
}

// Run the update
updateBeastiaryIcons();
