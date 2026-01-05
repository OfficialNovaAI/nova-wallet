const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config({ path: '.env' });

async function listModels() {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    console.log("Fetching available models...");
    try {
        // Trying to list models. Note: listModels is on the genAI instance directly in some versions, 
        // or we might need to use the model manager if exposed. 
        // Checking SDK documentation on the fly: usually it's genAI.getGenerativeModel but for listing...

        // Let's try a direct fetch to the API endpoint to be sure what the key can access
        const apiKey = process.env.GEMINI_API_KEY;
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        const data = await response.json();

        if (data.models) {
            console.log("Available Models:");
            data.models.forEach(m => {
                console.log(`- ${m.name} (Supported: ${m.supportedGenerationMethods})`);
            });
        } else {
            console.log("No models found or error:", data);
        }
    } catch (error) {
        console.error("Error listing models:", error);
    }
}

listModels();
