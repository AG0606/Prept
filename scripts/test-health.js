const fs = require('fs');
const dotenv = require('dotenv');
const env = dotenv.parse(fs.readFileSync('.env'));
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { EdgeTTS } = require('node-edge-tts');
const os = require('os');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

async function testEverything() {
  console.log('================ API HEALTH CHECK ================');
  
  // 1. Gemini Models Test
  const geminiModels = ['gemini-flash-latest', 'gemini-3.5-flash', 'gemini-3.7-flash'];
  for (const m of geminiModels) {
    try {
      const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: m });
      const res = await model.generateContent('Say hello in 1 word');
      console.log(`✅ 1. Google Gemini API (${m}): LIVE ->`, res.response.text().trim());
      break;
    } catch (e) {
      console.log(`❌ 1. Google Gemini API (${m}):`, e.message);
    }
  }

  // 2. Groq Chat API
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + env.GROQ_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: 'Say hello in 1 word' }],
        max_tokens: 10
      })
    });
    const data = await res.json();
    if (res.ok && data.choices?.[0]) {
      console.log('✅ 2. Groq LLM API (Llama 3.3 70B): LIVE ->', data.choices[0].message.content.trim());
    } else {
      console.log('❌ 2. Groq LLM API: FAILED ->', JSON.stringify(data));
    }
  } catch (e) {
    console.log('❌ 2. Groq LLM API: FAILED ->', e.message);
  }

  // 3. Edge TTS
  try {
    const tempFile = path.join(os.tmpdir(), 'test-tts.mp3');
    const tts = new EdgeTTS({ voice: 'en-US-AvaMultilingualNeural', lang: 'en-US' });
    await tts.ttsPromise('Testing audio', tempFile);
    const stats = fs.statSync(tempFile);
    fs.unlinkSync(tempFile);
    console.log('✅ 3. Microsoft Edge TTS Service: LIVE -> Generated', stats.size, 'bytes');
  } catch (e) {
    console.log('❌ 3. Microsoft Edge TTS: FAILED ->', e.message);
  }

  // 4. Sentiment Analysis
  try {
    if (env.HF_TOKEN) {
      const res = await fetch('https://api-inference.huggingface.co/models/distilbert-base-uncased-finetuned-sst-2-english', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + env.HF_TOKEN, 'Content-Type': 'application/json' },
        body: JSON.stringify({ inputs: 'I am very confident about this interview.' })
      });
      if (res.ok) {
        const data = await res.json();
        console.log('✅ 4. Sentiment API (HuggingFace): LIVE ->', JSON.stringify(data));
      } else {
        console.log('⚠️ 4. Sentiment API: HF returned status', res.status, '(Built-in rule-based fallback will handle analysis)');
      }
    } else {
      console.log('ℹ️ 4. Sentiment API: Built-in rule-based fallback active');
    }
  } catch (e) {
    console.log('⚠️ 4. Sentiment API: Network error, built-in fallback active ->', e.message);
  }

  // 5. Database (Prisma)
  try {
    const prisma = new PrismaClient();
    await prisma.$connect();
    const count = await prisma.user.count();
    console.log('✅ 5. Prisma SQLite Database: LIVE -> Connected (Users in DB: ' + count + ')');
    await prisma.$disconnect();
  } catch (e) {
    console.log('❌ 5. Database: FAILED ->', e.message);
  }

  console.log('==================================================');
}

testEverything();
