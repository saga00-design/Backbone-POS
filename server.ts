import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ limit: '10mb', extended: true }));

  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });

  // API Routes
  app.post("/api/quiz/generate", async (req, res) => {
    try {
      const { menuItem } = req.body;
      if (!menuItem) {
        return res.status(400).json({ error: "Menu item is required" });
      }

      console.log(`Generating quiz for: ${menuItem.name}`);

      const prompt = `Generate a 5-question multiple choice quiz for a staff member about the following menu item:
      Name: ${menuItem.name}
      Description: ${menuItem.description || "N/A"}
      Category: ${menuItem.categoryId || "N/A"}
      
      Questions should cover:
      1. Ingredients or Description
      2. Potential Allergies (state "None known" if not applicable based on description)
      3. A pairing suggestion (e.g., drink or side)
      4. An upselling tip
      5. A random fact or detailed component
      
      Each question must have exactly 4 options and 1 correct answer index (0-3).`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              dishName: { type: Type.STRING },
              questions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    question: { type: Type.STRING },
                    options: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING }
                    },
                    correctIndex: { type: Type.INTEGER },
                    explanation: { type: Type.STRING }
                  },
                  required: ["question", "options", "correctIndex", "explanation"]
                }
              }
            },
            required: ["dishName", "questions"]
          }
        }
      });

      if (!response.text) {
        throw new Error("No text returned from Gemini");
      }

      const quizData = JSON.parse(response.text);
      res.json(quizData);
    } catch (error: any) {
      console.error("Quiz Generation Error:", error);
      res.status(500).json({ 
        error: "Failed to generate quiz", 
        details: error.message || "Unknown error",
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
