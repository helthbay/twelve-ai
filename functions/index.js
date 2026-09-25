const { GoogleGenAI } = require('@google/genai');

// ✅ شێوازێ ڕاست و پارێزراو بۆ خواندنا کلیلێ لە Environment Variables
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function main() {
  const response = ... // کۆدێن تە یێن مایە لێرە دانە
}
