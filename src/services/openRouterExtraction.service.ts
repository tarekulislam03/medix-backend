import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';

// OpenRouter client configured for vision and text models
const openai = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: process.env.OPENROUTER_API_KEY || "",
    defaultHeaders: {
        "HTTP-Referer": "https://github.com/pharmacy-pos-saas",
        "X-Title": "Pharmacy POS Bill Import",
    }
});

export interface ExtractedMedicine {
    medicine_name: string;
    quantity: number;
    batch_number: string;
    expiry_date: string;
    mrp: number;
    rate: number;
}

export interface ParsedBillData {
    invoiceNumber?: string;
    invoiceDate?: string;
    supplierName?: string;
    totalAmount?: number;
    items: ExtractedMedicine[];
}

/**
 * Extract text from an image using OpenRouter Vision model
 * Uses google/gemma-3-27b-it:free for vision/OCR
 */
export const extractTextFromImage = async (imagePath: string): Promise<string> => {
    console.log(`[OpenRouter] Extracting text from image: ${imagePath}`);

    // Read file and convert to base64
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString('base64');
    const ext = path.extname(imagePath).toLowerCase();

    let mimeType = 'image/jpeg';
    if (ext === '.png') mimeType = 'image/png';
    else if (ext === '.webp') mimeType = 'image/webp';
    else if (ext === '.gif') mimeType = 'image/gif';

    const dataUri = `data:${mimeType};base64,${base64Image}`;

    try {
        const response = await openai.chat.completions.create({
            model: "google/gemma-3-27b-it:free",
            messages: [
                {
                    role: "user",
                    content: [
                        {
                            type: "text",
                            text: "Extract all the text visible in this pharmacy invoice/bill image. Output only the raw text content, preserving the structure as much as possible."
                        },
                        {
                            type: "image_url",
                            image_url: {
                                url: dataUri
                            }
                        }
                    ]
                }
            ],
        });

        const text = response.choices[0]?.message?.content || '';
        console.log(`[OpenRouter] Extracted ${text.length} characters`);
        return text;
    } catch (error) {
        console.error('[OpenRouter] Text extraction failed:', error);
        throw new Error('Failed to extract text from image using OpenRouter');
    }
};

/**
 * Parse extracted text into structured medicine data
 * Uses arcee-ai/trinity-large-preview:free for JSON extraction
 */
export const parseBillText = async (text: string): Promise<ParsedBillData> => {
    console.log('[OpenRouter] Parsing bill text to JSON...');

    try {
        const response = await openai.chat.completions.create({
            model: 'arcee-ai/trinity-large-preview:free',
            messages: [
                {
                    role: 'system',
                    content: `You are an AI assistant that extracts structured data from Indian pharmacy purchase bills. 
Return ONLY valid JSON. No markdown, no explanations.

Required JSON structure:
{
    "invoiceNumber": "string",
    "invoiceDate": "string (DD-MM-YYYY or as shown)",
    "supplierName": "string",
    "totalAmount": number,
    "items": [
        {
            "medicine_name": "string (product name)",
            "quantity": number,
            "batch_number": "string",
            "expiry_date": "string (MM/YY or as shown)",
            "mrp": number,
            "rate": number (purchase rate/cost price)
        }
    ]
}

Extract ALL medicine items from the bill. Ignore totals, taxes, and footer text.`
                },
                {
                    role: 'user',
                    content: `Extract data from this bill text:\n\n${text}`
                }
            ],
        });

        const content = response.choices[0].message.content;
        console.log('[OpenRouter] Raw JSON response received');

        // Robust JSON extraction
        let jsonStr = content || '{}';

        // If content contains markdown code blocks, strip them
        const jsonMatch = jsonStr.match(/```json\s*([\s\S]*?)\s*```/) || jsonStr.match(/```\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
            jsonStr = jsonMatch[1];
        } else {
            // Fallback: find first '{' and last '}'
            const firstBrace = jsonStr.indexOf('{');
            const lastBrace = jsonStr.lastIndexOf('}');
            if (firstBrace !== -1 && lastBrace !== -1) {
                jsonStr = jsonStr.substring(firstBrace, lastBrace + 1);
            }
        }

        const parsed = JSON.parse(jsonStr);

        // Normalize and validate items
        const items: ExtractedMedicine[] = (parsed.items || []).map((item: any) => ({
            medicine_name: String(item.medicine_name || item.productName || ''),
            quantity: Number(item.quantity) || 0,
            batch_number: String(item.batch_number || item.batchNumber || ''),
            expiry_date: String(item.expiry_date || item.expiryDate || ''),
            mrp: Number(item.mrp) || 0,
            rate: Number(item.rate) || 0
        }));

        return {
            invoiceNumber: parsed.invoiceNumber,
            invoiceDate: parsed.invoiceDate,
            supplierName: parsed.supplierName,
            totalAmount: Number(parsed.totalAmount) || 0,
            items
        };

    } catch (error) {
        console.error('[OpenRouter] Bill parsing failed:', error);
        return { items: [] };
    }
};

/**
 * Complete pipeline: Image -> Text -> Structured JSON
 */
export const extractMedicinesFromImage = async (imagePath: string): Promise<ParsedBillData> => {
    // Step 1: Extract text from image
    const text = await extractTextFromImage(imagePath);

    // Step 2: Parse text to structured JSON
    const data = await parseBillText(text);

    return data;
};
