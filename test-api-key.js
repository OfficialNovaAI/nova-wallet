const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config({ path: '.env' });

const apiKey = process.env.GEMINI_API_KEY;
console.log("API Key:", apiKey ? `${apiKey.substring(0, 10)}...` : "NOT FOUND");

if (!apiKey) {
    console.error("GEMINI_API_KEY tidak ditemukan!");
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);

async function testSimple() {
    try {
        // Test tanpa tools (function calling)
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
        const result = await model.generateContent("Say hi");
        console.log("SUCCESS! Response:", result.response.text());
    } catch (error) {
        console.error("FAILED:", error.message);
    }
}

testSimple();
