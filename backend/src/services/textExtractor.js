/* ═══════════════════════════════════════════════════
   SeminarIA — Text Extraction Service
   Extracts text from PDF and DOCX files
   ═══════════════════════════════════════════════════ */

const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

/**
 * Extract text content from a file based on its extension
 * @param {string} filePath - Absolute path to the file
 * @param {string} originalName - Original filename (for extension detection)
 * @returns {string} Extracted text content
 */
async function extractText(filePath, originalName) {
    const ext = path.extname(originalName || filePath).toLowerCase();

    if (!fs.existsSync(filePath)) {
        throw new Error('Archivo no encontrado');
    }

    switch (ext) {
        case '.pdf':
            return extractFromPDF(filePath);
        case '.docx':
            return extractFromDOCX(filePath);
        case '.doc':
            return extractFromDOCX(filePath); // mammoth can handle some .doc files
        default:
            throw new Error(`Formato no soportado para extracción de texto: ${ext}`);
    }
}

async function extractFromPDF(filePath) {
    const buffer = fs.readFileSync(filePath);
    const data = await pdfParse(buffer);
    return data.text || '';
}

async function extractFromDOCX(filePath) {
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value || '';
}

module.exports = { extractText };
