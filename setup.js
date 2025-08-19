#!/usr/bin/env node
/**
 * Setup script for Book with Bea booking system
 * This script helps initialize the database and check configuration
 */

const fs = require('fs');
const path = require('path');

console.log('🚀 Book with Bea - Setup Script');
console.log('================================\n');

// Check if .env file exists
const envPath = path.join(__dirname, '.env');
const envTemplatePath = path.join(__dirname, 'env.template');

if (!fs.existsSync(envPath)) {
  console.log('❌ .env file not found!');
  
  if (fs.existsSync(envTemplatePath)) {
    console.log('📝 Creating .env file from template...');
    try {
      fs.copyFileSync(envTemplatePath, envPath);
      console.log('✅ .env file created successfully!');
      console.log('⚠️  Please edit .env file with your actual configuration values');
    } catch (error) {
      console.error('❌ Error creating .env file:', error.message);
    }
  } else {
    console.log('❌ env.template file not found!');
    console.log('💡 Please create a .env file manually with the required environment variables');
  }
} else {
  console.log('✅ .env file found');
}

// Check package.json
const packagePath = path.join(__dirname, 'package.json');
if (fs.existsSync(packagePath)) {
  console.log('✅ package.json found');
  
  // Check if node_modules exists
  const nodeModulesPath = path.join(__dirname, 'node_modules');
  if (!fs.existsSync(nodeModulesPath)) {
    console.log('⚠️  node_modules not found - run: npm install');
  } else {
    console.log('✅ node_modules found');
  }
} else {
  console.log('❌ package.json not found!');
}

// Check database schema file
const schemaPath = path.join(__dirname, 'schema.sql');
if (fs.existsSync(schemaPath)) {
  console.log('✅ Database schema file found');
} else {
  console.log('❌ schema.sql not found!');
}

// Check railway.json
const railwayPath = path.join(__dirname, 'railway.json');
if (fs.existsSync(railwayPath)) {
  console.log('✅ Railway configuration found');
} else {
  console.log('❌ railway.json not found!');
}

console.log('\n📋 Next Steps:');
console.log('==============');
console.log('1. Edit .env file with your configuration');
console.log('2. Install dependencies: npm install');
console.log('3. Set up MySQL database (local or Railway)');
console.log('4. Run database schema: Import schema.sql into your MySQL database');
console.log('5. Start development server: npm run dev');
console.log('6. For Railway deployment, follow DEPLOYMENT_GUIDE.md');

console.log('\n🔧 Configuration Required:');
console.log('=========================');
console.log('- Database connection (MySQL)');
console.log('- Email settings (Gmail recommended)');
console.log('- Google Sheets integration (optional)');

console.log('\n📚 Documentation:');
console.log('==================');
console.log('- DEPLOYMENT_GUIDE.md - Complete Railway deployment guide');
console.log('- schema.sql - Database structure');
console.log('- env.template - Environment variables template');

console.log('\n✨ Happy booking! 💅');
