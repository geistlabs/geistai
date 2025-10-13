#!/usr/bin/env node

/**
 * Script to switch between debug and normal modes in the GeistAI frontend
 *
 * Usage:
 *   node scripts/switch-debug-mode.js debug    # Enable debug mode
 *   node scripts/switch-debug-mode.js normal   # Enable normal mode
 *   node scripts/switch-debug-mode.js status   # Show current mode
 */

const fs = require('fs');
const path = require('path');

const APP_INDEX_PATH = path.join(__dirname, '../app/index.tsx');
const APP_DEBUG_PATH = path.join(__dirname, '../app/index-debug.tsx');
const BACKUP_PATH = path.join(__dirname, '../app/index.tsx.backup');

function showUsage() {
  console.log('🔄 GeistAI Debug Mode Switcher');
  console.log('');
  console.log('Usage:');
  console.log(
    '  node scripts/switch-debug-mode.js debug    # Enable debug mode',
  );
  console.log(
    '  node scripts/switch-debug-mode.js normal   # Enable normal mode',
  );
  console.log(
    '  node scripts/switch-debug-mode.js status   # Show current mode',
  );
  console.log('');
}

function checkFiles() {
  if (!fs.existsSync(APP_INDEX_PATH)) {
    console.error('❌ Error: app/index.tsx not found');
    process.exit(1);
  }

  if (!fs.existsSync(APP_DEBUG_PATH)) {
    console.error('❌ Error: app/index-debug.tsx not found');
    console.error('   Please ensure the debug files are created');
    process.exit(1);
  }
}

function isDebugMode() {
  try {
    const content = fs.readFileSync(APP_INDEX_PATH, 'utf8');
    return (
      content.includes('ChatScreenDebug') || content.includes('useChatDebug')
    );
  } catch (error) {
    return false;
  }
}

function enableDebugMode() {
  console.log('🐛 Enabling debug mode...');

  // Create backup of current index.tsx
  if (!fs.existsSync(BACKUP_PATH)) {
    fs.copyFileSync(APP_INDEX_PATH, BACKUP_PATH);
    console.log('✅ Created backup: app/index.tsx.backup');
  }

  // Copy debug version to main index.tsx
  fs.copyFileSync(APP_DEBUG_PATH, APP_INDEX_PATH);
  console.log('✅ Debug mode enabled');
  console.log('');
  console.log('🔧 Debug features now available:');
  console.log('   • Comprehensive logging in console');
  console.log('   • Debug panel with real-time metrics');
  console.log('   • Performance monitoring');
  console.log('   • Route tracking');
  console.log('   • Error tracking');
  console.log('');
  console.log('📱 In the app:');
  console.log('   • Tap the DEBUG button in the header');
  console.log('   • View real-time debug information');
  console.log('   • Monitor performance metrics');
}

function enableNormalMode() {
  console.log('🔧 Enabling normal mode...');

  // Restore from backup if available
  if (fs.existsSync(BACKUP_PATH)) {
    fs.copyFileSync(BACKUP_PATH, APP_INDEX_PATH);
    console.log('✅ Normal mode enabled (restored from backup)');
  } else {
    console.log('⚠️  Warning: No backup found, debug mode may still be active');
    console.log('   Please manually restore your original index.tsx');
  }
}

function showStatus() {
  const debugMode = isDebugMode();
  console.log('📊 Current mode:', debugMode ? '🐛 DEBUG' : '🔧 NORMAL');
  console.log('');

  if (debugMode) {
    console.log('Debug features enabled:');
    console.log('   • Enhanced logging');
    console.log('   • Debug panel');
    console.log('   • Performance monitoring');
    console.log('   • Route tracking');
  } else {
    console.log('Normal mode active');
    console.log('   • Standard logging');
    console.log('   • No debug panel');
    console.log('   • Optimized performance');
  }

  console.log('');
  console.log('Files:');
  console.log('   • app/index.tsx:', debugMode ? '🐛 DEBUG' : '🔧 NORMAL');
  console.log('   • app/index-debug.tsx: ✅ Available');
  console.log(
    '   • Backup:',
    fs.existsSync(BACKUP_PATH) ? '✅ Available' : '❌ Not found',
  );
}

function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    showUsage();
    return;
  }

  checkFiles();

  const command = args[0].toLowerCase();

  switch (command) {
    case 'debug':
      enableDebugMode();
      break;

    case 'normal':
      enableNormalMode();
      break;

    case 'status':
      showStatus();
      break;

    default:
      console.error('❌ Error: Unknown command:', command);
      console.log('');
      showUsage();
      process.exit(1);
  }
}

main();
