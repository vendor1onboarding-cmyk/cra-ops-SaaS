#!/usr/bin/env node

/**
 * SOA Source Attribution Correction Script
 * Provides instructions for executing the database migration
 * Usage: node run-soa-correction.js
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

console.log('╔════════════════════════════════════════════════════════════════╗');
console.log('║  SOA Source Attribution Correction - Execution Helper          ║');
console.log('╚════════════════════════════════════════════════════════════════╝\n');

function openBrowser(url) {
  const platform = process.platform;
  let command = '';
  
  if (platform === 'win32') {
    command = `start ${url}`;
  } else if (platform === 'darwin') {
    command = `open ${url}`;
  } else {
    command = `xdg-open ${url}`;
  }
  
  try {
    require('child_process').exec(command);
    return true;
  } catch (e) {
    return false;
  }
}

async function main() {
  try {
    // Verify SQL file exists
    const sqlFilePath = path.join(__dirname, 'SOA_SOURCE_ATTRIBUTION_CORRECTION.sql');
    if (!fs.existsSync(sqlFilePath)) {
      throw new Error('SOA_SOURCE_ATTRIBUTION_CORRECTION.sql not found');
    }

    const sqlContent = fs.readFileSync(sqlFilePath, 'utf-8');
    const lines = sqlContent.split('\n').length;
    const size = (sqlContent.length / 1024).toFixed(2);

    console.log('✅ SQL Script Found');
    console.log(`   📄 File: SOA_SOURCE_ATTRIBUTION_CORRECTION.sql`);
    console.log(`   📊 Size: ${size} KB (${lines} lines)`);
    console.log(`   🎯 Target: 7 assignments (₹19,80,200 correction)\n`);

    console.log('═══════════════════════════════════════════════════════════════\n');

    console.log('📌 NEXT STEPS:\n');

    console.log('🟢 OPTION 1: Execute via Supabase Dashboard (Recommended)\n');
    console.log('   1. Go to: https://app.supabase.com');
    console.log('   2. Select project: ejszqwmmpspvhtuhodsa');
    console.log('   3. Click: SQL Editor → New Query');
    console.log('   4. Copy entire contents of: SOA_SOURCE_ATTRIBUTION_CORRECTION.sql');
    console.log('   5. Paste into the editor');
    console.log('   6. Click: Run button');
    console.log('   7. Verify all 7 assignments have final_net_cash_position = 0\n');

    console.log('🔵 OPTION 2: Read Full Guide\n');
    console.log('   Open: SOA_CORRECTION_EXECUTION_GUIDE.md\n');
    console.log('   This file contains:');
    console.log('   • Detailed step-by-step instructions');
    console.log('   • CLI execution method');
    console.log('   • Post-execution validation queries');
    console.log('   • Rollback instructions\n');

    console.log('═══════════════════════════════════════════════════════════════\n');

    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    console.log('💡 Would you like to:');
    console.log('   [1] Open Supabase Dashboard in browser');
    console.log('   [2] Open the execution guide');
    console.log('   [3] Exit (manual execution)\n');

    rl.question('Choose option (1-3): ', (answer) => {
      switch (answer.trim()) {
        case '1':
          console.log('\n🌐 Opening Supabase Dashboard...');
          if (openBrowser('https://app.supabase.com')) {
            console.log('✅ Browser opened. Follow the steps above to execute the SQL.\n');
          } else {
            console.log('❌ Could not open browser. Visit: https://app.supabase.com manually\n');
          }
          break;
        case '2':
          console.log('\n📖 Opening execution guide...');
          console.log('   File: SOA_CORRECTION_EXECUTION_GUIDE.md\n');
          break;
        case '3':
        default:
          console.log('\n📝 Manual execution mode');
          console.log('   SQL file: SOA_SOURCE_ATTRIBUTION_CORRECTION.sql');
          console.log('   Guide: SOA_CORRECTION_EXECUTION_GUIDE.md\n');
      }

      console.log('═══════════════════════════════════════════════════════════════');
      console.log('\n✅ Ready! Execute the SQL script via Supabase Dashboard.\n');
      rl.close();
    });

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

main();

