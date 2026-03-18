const { generatePreview } = require('./services/ai-generator');
require('dotenv').config({ path: __dirname + '/.env' });

async function runTests() {
  console.log("🚀 Starting Tests...");
  console.log("----------------------------------------");

  try {
    console.log("1️⃣ Testing AI Content Generation (Groq API)...");
    const startTime = Date.now();
    const preview = await generatePreview("Java memory management");
    const duration = Date.now() - startTime;
    
    console.log("✅ AI Generation Successful!");
    console.log(`⏱️ Response Time: ${duration}ms (Goal: < 5000ms)`);
    console.log(`📝 Generated Topic: ${preview.topic}`);
    console.log(`📜 Content Preview (first 100 chars):\n${preview.content.substring(0, 100)}...`);
  } catch (err) {
    console.error("❌ AI Generation Failed:", err.message);
  }

  console.log("----------------------------------------");
  console.log("🏁 Tests Completed.");
  process.exit(0);
}

runTests();
