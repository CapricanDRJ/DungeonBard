#!/bin/bash

# SQLite Database Export Script
# Exports game configuration tables while excluding user data, logs, and inventory

# Configuration
DB_FILE="${1:-database.db}"
OUTPUT_DIR="${2:-exports}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
rm exports/*.sql
# Check if database file exists
if [ ! -f "$DB_FILE" ]; then
    echo "Error: Database file '$DB_FILE' not found"
    echo "Usage: $0 [database_file] [output_directory]"
    exit 1
fi

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Tables to export (game configuration data)
TABLES_TO_EXPORT=(
    "domains"
    "attributes" 
    "quest"
    "items"
    "relic"
    "beastiary"
    "cursedItems"
)

# Tables to ignore (user data, logs, inventory)
IGNORED_TABLES=(
    "users"
    "avatars"
    "inventory"
    "quest_logs"
    "itemEmojis"
    "sqlite_sequence"
)

echo "Starting export from: $DB_FILE"
echo "Output directory: $OUTPUT_DIR"
echo "Timestamp: $TIMESTAMP"
echo ""

# Export each table
for table in "${TABLES_TO_EXPORT[@]}"; do
    output_file="$OUTPUT_DIR/${table}_${TIMESTAMP}.sql"
    
    echo "Exporting table: $table"
    
    # Check if table exists
    table_exists=$(sqlite3 "$DB_FILE" "SELECT name FROM sqlite_master WHERE type='table' AND name='$table';")
    
    if [ -z "$table_exists" ]; then
        echo "  Warning: Table '$table' does not exist in database"
        continue
    fi
    
    # Export table structure and data
    sqlite3 "$DB_FILE" > "$output_file" <<EOF
-- Schema for table: $table
.schema $table

-- Data for table: $table
.mode insert $table
SELECT * FROM $table;
EOF

    # Check if export was successful
    if [ $? -eq 0 ] && [ -s "$output_file" ]; then
        echo "  ✓ Exported to: $output_file"
    else
        echo "  ✗ Failed to export table: $table"
        rm -f "$output_file"
    fi
done

echo ""
echo "Ignored tables (user data/logs):"
for table in "${IGNORED_TABLES[@]}"; do
    echo "  - $table"
done

echo ""
echo "Export completed!"
echo "Files saved to: $OUTPUT_DIR"
