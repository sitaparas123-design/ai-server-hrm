const express = require('express');
const router = express.Router();
const multer = require('multer');
const pdfParse = require('pdf-parse');
const OpenAIService = require('../services/openAIService');
const PineconeService = require('../services/pineconeService');
const crypto = require('crypto');

// Use multer for memory storage of file uploads
const upload = multer({ storage: multer.memoryStorage() });

// ─────────────────────────────────────────
// REQUEST WRAPPER
// ─────────────────────────────────────────
const handle = (fn) => async (req, res) => {
  try {
    const result = await fn(req);
    res.json({ success: true, data: result });
  } catch (err) {
    console.error(`[MCP Route Error] ${req.path}:`, err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * Utility to chunk text into roughly equal sizes.
 */
function chunkText(text, chunkSize = 1000) {
  const words = text.split(/\s+/);
  const chunks = [];
  let currentChunk = [];
  let currentLength = 0;

  for (const word of words) {
    currentChunk.push(word);
    currentLength += word.length + 1;

    if (currentLength >= chunkSize) {
      chunks.push(currentChunk.join(' '));
      currentChunk = [];
      currentLength = 0;
    }
  }
  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join(' '));
  }
  return chunks;
}

// ─────────────────────────────────────────
// KNOWLEDGE INGESTION
// ─────────────────────────────────────────

// POST /api/mcp/knowledge/ingest
router.post('/ingest', upload.single('document'), handle(async (req) => {
  let text = '';
  const sourceName = req.file ? req.file.originalname : (req.body.title || 'Unknown Source');

  // Handle file upload or raw text
  if (req.file) {
    if (req.file.mimetype === 'application/pdf') {
      const pdfData = await pdfParse(req.file.buffer);
      text = pdfData.text;
    } else {
      text = req.file.buffer.toString('utf-8');
    }
  } else if (req.body.text) {
    text = req.body.text;
  } else {
    throw new Error('Please provide a file or raw text to ingest.');
  }

  // 1. Chunk the text
  const chunks = chunkText(text, 1000); // 1000 chars roughly
  if (chunks.length === 0) throw new Error('No text found to ingest.');

  console.log(`Ingesting document: ${sourceName} into ${chunks.length} chunks.`);

  // 2. Embed each chunk & 3. Upsert to Pinecone
  const vectors = [];
  for (let i = 0; i < chunks.length; i++) {
    const chunkText = chunks[i];
    const embedding = await OpenAIService.generateEmbedding(chunkText);
    
    // Create a unique ID for the vector
    const id = crypto.createHash('sha256').update(`${sourceName}-${i}`).digest('hex');

    vectors.push({
      id,
      values: embedding,
      metadata: {
        text: chunkText,
        source: sourceName,
        chunkIndex: i
      }
    });
  }

  await PineconeService.upsertVectors(vectors);

  return {
    message: 'Knowledge successfully ingested into Pinecone.',
    chunksIngested: chunks.length,
    source: sourceName
  };
}));

module.exports = router;
