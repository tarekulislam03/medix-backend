import OpenAI from 'openai';

// User can use OpenAI or compatible local LLM.
// To use local LLM (like Ollama/LM Studio), set OPENAI_BASE_URL=http://localhost:11434/v1 and OPENAI_API_KEY=anything
// To use real OpenAI, set proper values.

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || 'sk-dummy-key-for-local',
    baseURL: process.env.OPENAI_BASE_URL // Optional, if not set uses default
});

export interface ExtractedMedicine {
    medicine_name: string;
    quantity: number;
    batch_number: string;
    expiry_date: string;
    mrp: number;
    rate: number;
}

export const extractMedicinesFromText = async (text: string): Promise<ExtractedMedicine[]> => {
    const prompt = `
You are a pharmacy invoice parser.
Extract all medicine rows from the invoice text.

Return JSON array only.

Each object must include:
- medicine_name (string)
- quantity (number)
- batch_number (string, if not found use "")
- expiry_date (string, format YYYY-MM or similar, if not found use "")
- mrp (number)
- rate (number, purchase rate)

Ignore totals, GST summary, headers, and footer text.
If no medicines found, return empty array.

Invoice Text:
${text.substring(0, 3000)}
    `;

    try {
        const response = await openai.chat.completions.create({
            model: process.env.AI_MODEL_NAME || 'gpt-4o-mini',
            messages: [
                { role: 'system', content: 'You are a helpful assistant that extracts data into strict JSON.' },
                { role: 'user', content: prompt }
            ],
            response_format: { type: 'json_object' } // Force JSON if model supports it
        });

        const content = response.choices[0].message.content;
        if (!content) return [];

        const parsed = JSON.parse(content);
        // Expecting { "medicines": [...] } or just [...] depending on model behavior. 
        // We asked for JSON array. But strict json_object mode usually requires an object wrapper.
        // Let's iterate keys to find the array.

        let medicines: ExtractedMedicine[] = [];

        if (Array.isArray(parsed)) {
            medicines = parsed;
        } else if (typeof parsed === 'object') {
            // Find the first array property
            for (const key in parsed) {
                if (Array.isArray(parsed[key])) {
                    medicines = parsed[key];
                    break;
                }
            }
        }

        return medicines.map(m => ({
            medicine_name: String(m.medicine_name || ''),
            quantity: Number(m.quantity) || 0,
            batch_number: String(m.batch_number || ''),
            expiry_date: String(m.expiry_date || ''),
            mrp: Number(m.mrp) || 0,
            rate: Number(m.rate) || 0
        }));

    } catch (error) {
        console.error('AI Extraction Failed:', error);
        // Fallback or re-throw?
        // For now, return empty or throw.
        throw new Error('AI extraction failed');
    }
};
