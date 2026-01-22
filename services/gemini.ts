
import { GoogleGenAI, Type } from "@google/genai";
import { BloomsLevel, Question } from "../types";

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export interface GenerateQuestionParams {
  topic: string;
  bloomsLevel: BloomsLevel;
  learningObjectives?: string;
  additionalContext?: string;
  image?: string; // Base64 string
}

export const generateQuestionWithAI = async (params: GenerateQuestionParams): Promise<Partial<Question>> => {
  const modelId = "gemini-3-pro-preview"; 

  const systemInstruction = `
    Objective: Create multiple-choice questions from learning objectives to help medical students and doctors prepare for the USMLE Step 1 Exam.
    Formatting: Use Markdown. Use "###" for section headers. Use "**" for bolding key concepts.
    Testing Segment: Include patient demographics, clinical history, vital signs, and lab values in the question stem.
    Ensure answer choices are homogeneous and plausible (5 options).
  `;

  const prompt = `
    Generate a USMLE Step 1 Single Best Answer (SBA) multiple choice question based on the following parameters:
    Topic: ${params.topic}
    Bloom's Taxonomy Level: ${params.bloomsLevel}
    Learning Objectives: ${params.learningObjectives || "None"}
    Additional Context: ${params.additionalContext || "None"}
    
    Output JSON object with properties: text, explanation, learningObjectives, options (text, isCorrect), references (title, url).
  `;

  const parts: any[] = [{ text: prompt }];
  if (params.image) {
    const cleanBase64 = params.image.includes('base64,') ? params.image.split('base64,')[1] : params.image;
    parts.push({ inlineData: { mimeType: "image/png", data: cleanBase64 } });
  }

  try {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: { parts },
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            text: { type: Type.STRING },
            explanation: { type: Type.STRING },
            learningObjectives: { type: Type.ARRAY, items: { type: Type.STRING } },
            options: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  text: { type: Type.STRING },
                  isCorrect: { type: Type.BOOLEAN }
                },
                required: ["text", "isCorrect"]
              }
            },
            references: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  url: { type: Type.STRING }
                },
                required: ["title", "url"]
              }
            }
          },
          required: ["text", "explanation", "learningObjectives", "options", "references"]
        }
      }
    });

    const data = JSON.parse(response.text);
    return {
      text: data.text,
      explanation: data.explanation,
      learningObjectives: data.learningObjectives,
      options: data.options.map((opt: any, idx: number) => ({
        id: `opt-${Date.now()}-${idx}`,
        text: opt.text,
        isCorrect: opt.isCorrect
      })),
      references: data.references?.map((ref: any, idx: number) => ({
          id: `ref-${Date.now()}-${idx}`,
          title: ref.title,
          url: ref.url
      })) || [],
      tags: [params.topic],
      bloomsLevel: params.bloomsLevel
    };
  } catch (error) {
    console.error("Gemini Generation Error:", error);
    throw error;
  }
};

export const generateClinicalImage = async (prompt: string): Promise<string | null> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [{ text: `High-quality medical clinical image for educational purposes: ${prompt}. Style: Realistic clinical photography or medical illustration.` }],
      },
      config: {
        imageConfig: { aspectRatio: "1:1" }
      },
    });

    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    return null;
  } catch (error) {
    console.error("Image Generation Error:", error);
    return null;
  }
};
