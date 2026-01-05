
const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config({ path: '.env' });

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
    console.error("GEMINI_API_KEY not found");
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);

async function main() {
    console.log("Checking available models...");

    // Try to use a configured model to access the underlying request if possible, or just bruteforce standard names
    const modelsToTest = ["gemini-1.5-flash", "gemini-1.5-flash-latest", "gemini-2.0-flash-exp", "gemini-pro", "gemini-2.0-flash"];

    for (const modelName of modelsToTest) {
        try {
            console.log(`\n--- Testing ${modelName} ---`);
            const model = genAI.getGenerativeModel({ model: modelName });
            const result = await model.generateContent("Hi");
            console.log(`[SUCCESS] ${modelName} responded: ${result.response.text().substring(0, 50)}...`);
        } catch (error) {
            console.log(`[FAILED] ${modelName}: ${error.message}`);
        }
    }
}

main();
