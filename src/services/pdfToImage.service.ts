import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import util from 'util';

const execPromise = util.promisify(exec);

export const convertPdfToImages = async (pdfPath: string): Promise<string[]> => {
    // pdf-poppler logic or fallback
    // Since we are likely on a server that might not have poppler installed, 
    // we can try using a library, but sharp doesn't handle PDF directly in all envs.
    // The user strictly asked for "pdf-poppler".

    // In nodejs with pdf-poppler, it usually requires system binaries.
    // However, let's try to assume it's set up or fallback to a basic converter if possible.
    // Actually, "pdf-poppler" is a wrapper around "pdftocairo" etc.
    // If it fails, we will throw error.

    const outputDir = path.dirname(pdfPath);
    const baseName = path.basename(pdfPath, path.extname(pdfPath));
    // We will create a temp dir for images

    // Attempting to use a simpler strategy if pdf-poppler is complex:
    // If we can't use pdf-poppler easily in this specific environment without checking binaries,
    // we might have issues. But I must follow instructions.

    // Using a common workaround: pdf-to-img packages that include binaries or strict pdf-poppler usage.
    // Since I cannot guarantee binaries on "Windows" user machine via simple npm install of `pdf-poppler` (it often fails on windows without manual Setup), 
    // I will use `pdf-poppler` package logic but wrap it carefully.

    // actually, let's use 'pdf2pic' or similar if allowed? 
    // User said: "PDF to image: pdf-poppler". I MUST use it.

    const pdfPoppler = require('pdf-poppler');

    const opts = {
        format: 'png',
        out_dir: outputDir,
        out_prefix: baseName,
        page: null // convert all pages
    };

    try {
        await pdfPoppler.convert(pdfPath, opts);
    } catch (err) {
        console.error('pdf-poppler failed:', err);
        throw new Error('Failed to convert PDF to image. Please ensure poppler-utils is installed or upload an Image directly.');
    }

    // Find generated files
    // pdf-poppler generates files like basename-1.png, basename-2.png
    const files = fs.readdirSync(outputDir);
    const convertedFiles = files
        .filter(f => f.startsWith(baseName) && f.endsWith('.png') && f !== path.basename(pdfPath))
        .map(f => path.join(outputDir, f));

    return convertedFiles;
};

export const processImage = async (imagePath: string): Promise<string> => {
    // Sharp preprocessing for better OCR
    const processedPath = imagePath.replace(/(\.[\w\d_-]+)$/i, '_processed$1');

    await sharp(imagePath)
        .grayscale() // Convert to B&W
        .resize(1800, null, { withoutEnlargement: false, fit: 'inside' }) // High res
        .sharpen()
        .normalize()
        .toFile(processedPath);

    return processedPath;
};
