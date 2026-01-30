/**
 * Environment Launcher
 * Run: node start.js
 * Choose UAT or LIVE environment
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { spawn } = require('child_process');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

console.log('');
console.log('='.repeat(50));
console.log('  FOOD SAFETY AUDIT SYSTEM - Environment Launcher');
console.log('='.repeat(50));
console.log('');
console.log('  1) UAT  - https://fsaudit-uat.gmrlapps.com');
console.log('           Database: FoodSafetyDB');
console.log('');
console.log('  2) LIVE - https://fsaudit.gmrlapps.com');
console.log('           Database: FoodSafetyDB_Live');
console.log('');
console.log('  0) Exit');
console.log('');

rl.question('Select environment (1 or 2): ', (answer) => {
    rl.close();
    
    let envFile;
    let envName;
    
    switch (answer.trim()) {
        case '1':
            envFile = '.env.uat';
            envName = 'UAT';
            break;
        case '2':
            envFile = '.env.live';
            envName = 'LIVE';
            break;
        case '0':
            console.log('Exiting...');
            process.exit(0);
        default:
            console.log('Invalid choice. Exiting.');
            process.exit(1);
    }
    
    const srcPath = path.join(__dirname, envFile);
    const destPath = path.join(__dirname, '.env');
    
    if (!fs.existsSync(srcPath)) {
        console.error(`Error: ${envFile} not found!`);
        process.exit(1);
    }
    
    // Copy environment file
    fs.copyFileSync(srcPath, destPath);
    console.log('');
    console.log(`✅ Loaded ${envName} environment`);
    console.log('');
    console.log('Starting server...');
    console.log('');
    
    // Start the main app
    require('./auth-app.js');
});
