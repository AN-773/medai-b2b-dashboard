
import { GoogleGenAI, Modality, Type } from "@google/genai";
import { LearningObjective, BackendItem } from "../types";

const getAIClient = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Utility to safely parse JSON from model responses, 
 * handling potential truncation, markdown fencing, or leading/trailing whitespace.
 */
function safeJsonParse(text: string | undefined) {
  if (!text) return null;
  try {
    // Remove potential markdown code fences if the model ignores the mime type instruction
    let cleaned = text.trim();
    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.replace(/^```json/, '').replace(/```$/, '');
    } else if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```/, '').replace(/```$/, '');
    }
    return JSON.parse(cleaned.trim());
  } catch (e) {
    console.error("JSON Parse Error. Text preview:", text.substring(0, 200));
    // If truncation is suspected, we can't reliably "fix" JSON, 
    // but increasing maxOutputTokens and using Pro models reduces this risk significantly.
    return null;
  }
}

export async function auditQuestionIntegrity(item: BackendItem) {
  try {
    const ai = getAIClient();
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview', // Upgraded to Pro for deeper analysis
      contents: `You are a Senior Psychometrician. Audit this USMLE-style question for psychometric and content integrity.
      
      ITEM CONTEXT:
      STEM: ${item.stem}
      OPTIONS: ${JSON.stringify(item.options)}
      OBJECTIVE: ${item.learningObjective || "Not specified"}
      P-VALUE: ${item.pValue || "N/A"}
      
      AUDIT CRITERIA:
      1. Distractor Quality: Identify Non-functional distractors (NFDs) with low plausibility.
      2. Stem Clues: Check for grammatical cues, word-repeats, or logical giveaways.
      3. Alignment: Ensure the question actually tests the stated learning objective.
      4. USMLE Rigor: Ensure the scenario follows standard medical board formatting.
      
      You must provide a reconstructed version of the item that fixes the identified flaws.`,
      config: {
        // Significantly increased tokens and added thinking budget to prevent "Unterminated string" truncation
        maxOutputTokens: 8192,
        thinkingConfig: { thinkingBudget: 2048 },
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            integrityScore: { 
              type: Type.NUMBER,
              description: "A score from 0-100 representing overall item health."
            },
            flaws: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING },
              description: "Specific psychometric or medical inaccuracies found."
            },
            suggestedRemedy: { 
              type: Type.STRING,
              description: "Brief summary of how to improve the item."
            },
            reconstructedItem: {
              type: Type.OBJECT,
              properties: {
                stem: { type: Type.STRING },
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
                }
              },
              required: ["stem", "options"]
            }
          },
          required: ["integrityScore", "flaws", "suggestedRemedy", "reconstructedItem"]
        }
      }
    });
    return safeJsonParse(response.text);
  } catch (error) {
    console.error("Audit Engine Error:", error);
    return null;
  }
}

export async function remasterQuestion(item: BackendItem, instruction: string) {
  try {
    const ai = getAIClient();
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `Remaster this medical education assessment item according to specific directives.
      
      SOURCE ITEM STEM: ${item.stem}
      SOURCE OPTIONS: ${JSON.stringify(item.options)}
      
      USER DIRECTIVE: ${instruction}
      
      STANDARDS:
      - Maintain USMLE Step 1 rigor and tone.
      - Ensure 5 homogeneous, mutually exclusive options.
      - Use professional medical terminology.`,
      config: {
        maxOutputTokens: 8192,
        thinkingConfig: { thinkingBudget: 2048 },
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            newStem: { type: Type.STRING },
            newOptions: {
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
            explanation: { 
              type: Type.STRING,
              description: "Detailed medical explanation for the correct answer and why distractors are incorrect."
            }
          },
          required: ["newStem", "newOptions", "explanation"]
        }
      }
    });
    return safeJsonParse(response.text);
  } catch (error) {
    console.error("Remastering Engine Error:", error);
    return null;
  }
}

export async function* getDashboardSummaryStream(data: any) {
  try {
    const ai = getAIClient();
    const result = await ai.models.generateContentStream({
      model: 'gemini-3-flash-preview', // Flash is fine for streaming summaries
      contents: `Analyze this medical education data: ${JSON.stringify(data)}. 
      Provide a high-impact executive briefing for the Dean. Use Markdown.
      Focus on bank health, student risk, and curriculum gaps.`,
      config: {
        systemInstruction: "You are the Chief Psychometrician Sena. Be professional, data-driven, and concise.",
        temperature: 0.3
      }
    });

    for await (const chunk of result) {
      yield chunk.text;
    }
  } catch (error) {
    console.error("Sena Stream Error:", error);
    yield "Uplink to intelligence fleet timed out. Please check telemetry.";
  }
}

export async function parseAndAuditObjectives(rawText: string, fileData?: FileData): Promise<LearningObjective[]> {
  try {
    const ai = getAIClient();
    const prompt = `Extract actionable Learning Objectives from the following text/data. Map them to USMLE organ systems and assign appropriate Bloom's levels.`;
    const contents: any = { parts: [] };
    if (fileData) {
      contents.parts.push({ inlineData: { data: fileData.data, mimeType: fileData.mimeType } });
    }
    contents.parts.push({ text: `${prompt}\n\nCONTENT: "${rawText}"` });
    
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: contents,
      config: {
        maxOutputTokens: 4096,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              text: { type: Type.STRING },
              organSystemId: { type: Type.STRING },
              bloomLevel: { type: Type.STRING },
              targetItemCount: { type: Type.NUMBER },
              targetLectureCount: { type: Type.NUMBER }
            },
            required: ["id", "text", "organSystemId", "bloomLevel"]
          }
        }
      }
    });
    return safeJsonParse(response.text) || [];
  } catch (error) {
    console.error("Objective Extraction Error:", error);
    return [];
  }
}

export interface FileData {
  data: string; // base64
  mimeType: string;
}

export async function generateBriefingAudio(text: string): Promise<string | null> {
  try {
    const ai = getAIClient();
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: `Executive Briefing from Sena: ${text.substring(0, 1500)}` }] }],
      config: { 
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Zephyr' }
          }
        }
      }
    });
    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || null;
  } catch (error) {
    console.error("TTS Generation Error:", error);
    return null;
  }
}

export function decode(base64: string) {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
  return bytes;
}

export async function decodeAudioData(data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number) {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}
