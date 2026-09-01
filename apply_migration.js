const { Client } = require('pg');
const fs = require('fs');

async function main() {
    // Read from .env
    const env = fs.readFileSync('apps/api/.env', 'utf8');
    const dbUrlMatch = env.match(/DATABASE_URL="([^"]+)"/);
    if (!dbUrlMatch) {
        console.error("DATABASE_URL not found in apps/api/.env");
        process.exit(1);
    }
    const dbUrl = dbUrlMatch[1];
    
    const client = new Client({ connectionString: dbUrl });
    await client.connect();
    
    const sql = fs.readFileSync('supabase/migrations/0017_fix_invitation_notifications.sql', 'utf8');
    await client.query(sql);
    
    console.log("Migration applied successfully!");
    await client.end();
}

main().catch(console.error);
