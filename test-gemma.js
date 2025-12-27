const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config({ path: '.env' });

async function testGemma() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error("No API KEY");
        return;
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
        model: "gemma-3-27b-it",
        tools: [{
            functionDeclarations: [{
                name: "test_tool",
                description: "test tool",
                parameters: { type: "OBJECT", properties: { val: { type: "STRING" } } }
            }]
        }]
    });

    try {
        console.log("Testing gemma-3-27b-it with tools...");
        const result = await model.generateContent("panggil test_tool dengan val 'hello'");
        console.log("Response:", JSON.stringify(result, null, 2));
    } catch (e) {
        console.error("Error calling gemma with tools:", e.message);
    }
}

testGemma();
