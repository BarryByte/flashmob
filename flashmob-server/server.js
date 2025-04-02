import express from "express";
import bodyParser from "body-parser";
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
import v8 from "v8";
import path, { dirname } from "path";
import { fileURLToPath } from 'url';
import cors from "cors"

dotenv.config();

const totalHeapSize = v8.getHeapStatistics().total_available_size;
const totalHeapSizeMB = (totalHeapSize / 1024 / 1024).toFixed(2);
console.log(`Total Heap Size: ${totalHeapSizeMB} MB`);

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PORT = process.env.PORT || 5000;

// app.options("*", cors());
app.use(cors({
  origin: ['https://flashmob-five.vercel.app', 'http://localhost:3000'],
  methods: ['POST', 'GET', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'], 
  credentials: true
}));

app.use(bodyParser.json());
app.use(express.json());
app.use(express.static(path.join(__dirname, "flashmob-app", "dist")));

// --- Configure Gemini API ---
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.error(
    "FATAL ERROR: GEMINI_API_KEY not found in environment variables."
  );
}
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

const generationConfig = {
  temperature: 0.6,
  topP: 0.9,
  topK: 30,
  maxOutputTokens: 1024,
};

const safetySettings = [
  { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
  {
    category: "HARM_CATEGORY_HATE_SPEECH",
    threshold: "BLOCK_MEDIUM_AND_ABOVE",
  },
  {
    category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
    threshold: "BLOCK_MEDIUM_AND_ABOVE",
  },
  {
    category: "HARM_CATEGORY_DANGEROUS_CONTENT",
    threshold: "BLOCK_MEDIUM_AND_ABOVE",
  },
];

async function parseGeminiResponse(textResponse) {
  console.log(
    `Attempting to parse Gemini response:\n---\n${textResponse}\n---`
  );
  const cards = [];

  const regex = /Q:\s*(.*?)\s*\n\s*A:\s*(.*?)(?=\n\s*Q:|$)/gis;

  let match;
  while ((match = regex.exec(textResponse)) !== null) {
    const question = match[1].trim();
    const answer = match[2].trim();
    if (question && answer) {
      cards.push({ question, answer });
      console.log(`  Parsed: Q: ${question} / A: ${answer}`);
    }
  }

  if (cards.length === 0) {
    console.log("Regex parsing failed, trying alternative parsing...");
    const pairs = textResponse.split(/\n\s*\n/).filter(Boolean);

    for (const pair of pairs) {
      const qMatch = pair.match(/Q:\s*(.*?)(?:\n|$)/i);
      const aMatch = pair.match(/A:\s*(.*?)(?:\n|$)/i);

      if (qMatch && aMatch) {
        const question = qMatch[1].trim();
        const answer = aMatch[1].trim();
        if (question && answer) {
          cards.push({ question, answer });
          console.log(`  Parsed via fallback: Q: ${question} / A: ${answer}`);
        }
      }
    }
  }

  console.log(`Parsing complete. Found ${cards.length} cards.`);
  return cards;
}

app.post("/generate_questions", async (req, res) => {
  if (!GEMINI_API_KEY) {
    return res
      .status(503)
      .json({ error: "Server configuration error: AI Service not available" });
  }

  const { text, num_questions = 5 } = req.body;

  if (!text) {
    return res.status(400).json({ error: "Missing 'text' in request body" });
  }
  // Limit input text size
  if (text.length > 10000) {
    return res.status(400).json({
      error: "Input text is too large. Please limit to 10,000 characters.",
    });
  }
  const prompt = `Generate exactly ${num_questions} distinct flashcard question-and-answer pairs based on the following text.
    **Instructions:**
    1. The questions should test understanding of the key information in the text.
    2. Answers must be concise and directly derivable from the provided text *only*.
    3. Format **each** pair strictly like this, with 'Q:' starting the question line and 'A:' starting the answer line:
       Q: [The generated question text]
       A: [The generated answer text]
    4. Separate each Q&A pair with exactly one double newline (press Enter twice).
    5. Do not include any introductory text, concluding remarks, or numbering like "1.", "Pair 1:", etc. Only output the Q&A pairs in the specified format.
    **Input Text:**
    ---
    ${text}
    ---
    **Generated Q&A Pairs:**
    `;

  try {
    console.log(
      `Sending prompt to Gemini (first 100 chars of context): ${text.slice(
        0,
        100
      )}...`
    );

    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      generationConfig,
      safetySettings,
    });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const textResponse = response.text();

    const formattedCards = await parseGeminiResponse(textResponse);

    if (formattedCards.length === 0) {
      console.warn(
        "Warning: Parsing returned no cards, despite successful generation."
      );
      return res.status(500).json({
        error:
          "Could not parse Q&A pairs from the generated text. The AI might not have followed the format. Please try again or adjust the input text.",
      });
    }

    res.json({ generated_cards: formattedCards });
  } catch (error) {
    console.error(
      "An error occurred during Gemini API call or processing:",
      error
    );
    res.status(500).json({
      error: "An unexpected error occurred while generating questions.",
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server listening at http://localhost:${PORT}`);
  if (process.env.NODE_ENV !== 'production') {
      console.log(`Allowing requests from: ['https://flashmob-five.vercel.app', 'http://localhost:3000']`);
  }
});