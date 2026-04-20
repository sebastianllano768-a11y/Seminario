/* ═══════════════════════════════════════════════════
   SeminarIA — Text Extraction Service
   Extracts text from PDF and DOCX buffers (in-memory, no disk access)
   ═══════════════════════════════════════════════════ */

const path = require('path');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

/**
 * Extract text content from a Buffer based on the original filename extension.
 * Works entirely in RAM — no filesystem access required.
 * @param {Buffer} buffer - File content as a Buffer
 * @param {string} originalName - Original filename (for extension detection)
 * @returns {Promise<string>} Extracted text content
 */
async function extractText(buffer, originalName) {
    const ext = path.extname(originalName || '').toLowerCase();

    switch (ext) {
        case '.pdf':
            return extractFromPDFBuffer(buffer);
        case '.docx':
        case '.doc':
            return extractFromDOCXBuffer(buffer);
        default:
            // For unsupported types (pptx, xlsx etc.) return empty — AI will note it
            return '';
    }
}

async function extractFromPDFBuffer(buffer) {
    const data = await pdfParse(buffer);
    return data.text || '';
}

async function extractFromDOCXBuffer(buffer) {
    const result = await mammoth.extractRawText({ buffer });
    return result.value || '';
}

module.exports = { extractText };
