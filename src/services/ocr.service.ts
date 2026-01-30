import Tesseract from 'tesseract.js';

export const extractTextFromImage = async (imagePath: string): Promise<string> => {
    try {
        const { data: { text } } = await Tesseract.recognize(
            imagePath,
            'eng',
            {
                // logger: m => console.log(m) 
            }
        );
        return text;
    } catch (error) {
        console.error('OCR Extraction Failed:', error);
        throw new Error('Failed to extract text from image');
    }
};
