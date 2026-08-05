const { Pinecone } = require('@pinecone-database/pinecone');

const cleanPineconeKey = (process.env.PINECONE_API_KEY || '').replace(/^"|"$/g, '').trim();
const pc = new Pinecone({
  apiKey: cleanPineconeKey
});

const indexName = process.env.PINECONE_INDEX || 'hcm-enterprise';

class PineconeService {
  static getIndex() {
    return pc.index(indexName);
  }

  /**
   * Upserts text chunks with their embeddings into Pinecone.
   * @param {Array} vectors - Array of objects: { id, values: [embedding], metadata: { text, source, ... } }
   */
  static async upsertVectors(vectors) {
    if (!vectors || vectors.length === 0) return;
    const index = this.getIndex();
    await index.upsert(vectors);
  }

  /**
   * Queries Pinecone for similar vectors.
   * @param {Array} queryEmbedding - The embedding vector of the search query.
   * @param {number} topK - Number of results to return.
   */
  static async queryVector(queryEmbedding, topK = 3) {
    const index = this.getIndex();
    const queryResponse = await index.query({
      vector: queryEmbedding,
      topK,
      includeMetadata: true,
    });
    return queryResponse.matches || [];
  }
}

module.exports = PineconeService;
