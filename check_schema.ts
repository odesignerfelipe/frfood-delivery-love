import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { readFileSync, existsSync } from 'fs';

// Try loading env vars
const envPath = '.env.local';
if (existsSync(envPath)) {
    const envConfig = dotenv.parse(readFileSync(envPath));
    for (const k in envConfig) {
        process.env[k] = envConfig[k];
    }
} else if (existsSync('.env')) {
    const envConfig = dotenv.parse(readFileSync('.env'));
    for (const k in envConfig) {
        process.env[k] = envConfig[k];
    }
}

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
    console.log("Checking platform_settings schema...");
    // Try to select just one row to get all fields
    const { data, error } = await supabase.from('platform_settings').select('*').limit(1);
    if (error) {
        console.error("Error fetching platform_settings:", error.message);
    } else if (data && data.length > 0) {
        console.log("Columns found: ", Object.keys(data[0]).join(', '));
    } else {
        console.log("Table is empty but query succeeded. Attempting deliberate error to get schema...");
        const { error: err2 } = await supabase.from('platform_settings').select('non_existent_column_123').limit(1);
        console.error("Error from deliberate bad column (might list fields in hints):", err2?.message, err2?.details, err2?.hint);
    }
}

checkSchema();
