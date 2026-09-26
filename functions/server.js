// ═══════════════════════════════════════════════════════════════
//  Twelve AI — Server (Node.js + Express + Gemini 3.8 Flash)
//  File: server.js — Version 3.0 (Interactions API)
// ═══════════════════════════════════════════════════════════════

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { GoogleGenAI } = require('@google/genai');

const app = express();
const PORT = process.env.PORT || 3000;

// ═══════════════════════════════════════════════════════════════
//  Middlewares
// ═══════════════════════════════════════════════════════════════
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(__dirname));

// ═══════════════════════════════════════════════════════════════
//  Route یا سەرەکی
// ═══════════════════════════════════════════════════════════════
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'twelve-ai.html'));
});

app.get('/twelve-ai', (req, res) => {
    res.sendFile(path.join(__dirname, 'twelve-ai.html'));
});

// ═══════════════════════════════════════════════════════════════
//  Gemini AI Setup (Interactions API)
// ═══════════════════════════════════════════════════════════════
const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
    console.error("⚠️ GEMINI_API_KEY د فایلا .env دا نەهاتە دۆزینەوە!");
    process.exit(1);
}

const ai = new GoogleGenAI({ apiKey: apiKey });
console.log("✅ Gemini AI (Interactions API) هاتە کارپێکرن!");
console.log("🔑 API Key:", apiKey.substring(0, 15) + "...");

// ═══════════════════════════════════════════════════════════════
//  ✅ مۆدێلا نوو — gemini-3.8-flash
// ═══════════════════════════════════════════════════════════════
const GEMINI_MODEL = "gemini-3.8-flash";

// ═══════════════════════════════════════════════════════════════
//  API Endpoint: /api/chat
// ═══════════════════════════════════════════════════════════════
app.post('/api/chat', async (req, res) => {
    const startTime = Date.now();

    try {
        const { prompt, attachment, studentCode, studentName } = req.body;

        console.log(`\n📨 داواکارییا نوو:`);
        console.log(`   👤 ${studentName || 'نەدیار'} (${studentCode || 'نەدیار'})`);
        console.log(`   💬 ${prompt ? prompt.substring(0, 50) : '(بێ پەیام)'}`);
        console.log(`   📎 فایل: ${attachment ? attachment.mimeType : 'نەبوو'}`);

        if (!prompt && !attachment) {
            return res.status(400).json({
                success: false,
                error: "پەیام یان فایل پێدڤییە"
            });
        }

        // پێکهاتنا input بۆ Interactions API
        const inputParts = [];

        // ١. دەق
        if (prompt && prompt.trim() !== "") {
            inputParts.push({
                type: "text",
                text: prompt
            });
        } else {
            inputParts.push({
                type: "text",
                text: "ئەڤی فایلی بخوێنە و ڕوونکردنەڤەیەکێ بدە."
            });
        }

        // ٢. فایل (وێنە یان PDF)
        if (attachment && attachment.data && attachment.mimeType) {
            if (attachment.mimeType.startsWith("image/")) {
                inputParts.push({
                    type: "image",
                    data: attachment.data,
                    mime_type: attachment.mimeType
                });
            } else if (attachment.mimeType === "application/pdf") {
                inputParts.push({
                    type: "document",
                    data: attachment.data,
                    mime_type: attachment.mimeType
                });
            }
        }

        console.log(`   🚀 فرێکرن بۆ Gemini (${GEMINI_MODEL})...`);
        console.log(`   📦 کۆیا پشکان: ${inputParts.length}`);

        // ================================================================
        //  ✅ بانگکرنا Interactions API یا نوو
        // ================================================================
        const interaction = await ai.interactions.create({
            model: GEMINI_MODEL,
            input: inputParts
        });

        console.log("   ✅ وەڵام هات!");
        console.log("   📝 Interaction ID:", interaction.id);

        // ڤەگرتنا دەقی وەڵامی
        let text = interaction.output_text || "";

        // ئەگەر output_text نەبیت، دشێین ژ steps بخوێنین
        if (!text && interaction.steps) {
            for (const step of interaction.steps) {
                if (step.type === "model_output" && step.content) {
                    for (const block of step.content) {
                        if (block.type === "text" && block.text) {
                            text += block.text;
                        }
                    }
                }
            }
        }

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`   ✅ وەڵام هات د ${duration}s دا`);
        console.log(`   📝 درێژییا وەڵامێ: ${text.length} پیت`);

        res.json({
            success: true,
            reply: text || "⚠️ وەڵامەک نەهاتە دۆزینەوە.",
            duration: duration,
            model: GEMINI_MODEL,
            interactionId: interaction.id
        });

    } catch (error) {
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);

        console.error("\n❌ خەلەتی د Gemini API دا:");
        console.error("📝", error.message);
        console.error("⏱️  دەم:", duration, "s");

        let errorMsg = "ئاریشەیەک د پەیوەندیکرن ب ژیرییا دەستکرد دا چێبوو.";

        if (error.message.includes("API key") || error.message.includes("API_KEY")) {
            errorMsg = "🔑 API Key نەدروستە. تکایە کلیلێ نوی دروست بکە.";
        } else if (error.message.includes("quota") || error.message.includes("429")) {
            errorMsg = "⏰ سنوورێ بکارئینانێ ژێدەر کرییە. پاش 1 خولەک دوبارە هەوڵ بدە.";
        } else if (error.message.includes("SAFETY") || error.message.includes("blocked")) {
            errorMsg = "🚫 داخوازیا تە ئاریشەیەک هەیە. تکایە ب شێوازەکێ دی بنڤیسە.";
        } else if (error.message.includes("404")) {
            errorMsg = "🔍 مۆدێلا Gemini نەهاتە دۆزینەوە. تکایە پاکێتا @google/genai نوی بکە.";
        } else if (error.message.includes("network") || error.message.includes("ENOTFOUND")) {
            errorMsg = "🌐 کێشەیا تۆڕێ. تکایە پشکنین بکە ئینتەرنێت کار دکەت.";
        }

        res.status(500).json({
            success: false,
            error: errorMsg,
            details: error.message
        });
    }
});

// ═══════════════════════════════════════════════════════════════
//  Endpoint: /health
// ═══════════════════════════════════════════════════════════════
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        service: 'Twelve AI Server',
        api: 'Interactions API',
        model: GEMINI_MODEL,
        hasApiKey: !!process.env.GEMINI_API_KEY,
        timestamp: new Date().toISOString()
    });
});

// ═══════════════════════════════════════════════════════════════
//  Endpoint: /test-gemini
// ═══════════════════════════════════════════════════════════════
app.get('/test-gemini', async (req, res) => {
    try {
        console.log(`\n🧪 تێستا Gemini API (${GEMINI_MODEL})...`);

        const interaction = await ai.interactions.create({
            model: GEMINI_MODEL,
            input: "بێژە: سەلام"
        });

        const text = interaction.output_text || "(وەڵام نەهات)";

        console.log("✅ تێست سەرکەفتوو:", text);

        res.json({
            success: true,
            message: "Gemini API کار دکەت!",
            api: "Interactions API",
            model: GEMINI_MODEL,
            response: text,
            interactionId: interaction.id
        });
    } catch (error) {
        console.error("❌ تێست شکا:", error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ═══════════════════════════════════════════════════════════════
//  Error Handler
// ═══════════════════════════════════════════════════════════════
app.use((err, req, res, next) => {
    console.error("\n⚠️ خەلەتی گشتی:", err.message);
    res.status(500).json({
        success: false,
        error: "ئاریشەیا سەرڤەری: " + err.message
    });
});

// ═══════════════════════════════════════════════════════════════
//  دەستپێکرنا سەرڤەری
// ═══════════════════════════════════════════════════════════════
app.listen(PORT, () => {
    console.log("\n═══════════════════════════════════════════");
    console.log("🚀 سەرڤەرێ Twelve AI کار دکەت!");
    console.log("═══════════════════════════════════════════");
    console.log(`🌐 لاپەڕە: http://localhost:${PORT}`);
    console.log(`🧪 تێست Gemini: http://localhost:${PORT}/test-gemini`);
    console.log(`💚 Health: http://localhost:${PORT}/health`);
    console.log(`🤖 مۆدێلا چالاک: ${GEMINI_MODEL}`);
    console.log(`🔧 API: Interactions API (نوو)`);
    console.log("═══════════════════════════════════════════\n");
});
