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
   * Queries Pinecone for similar vectors with optional metadata filters.
   * @param {Array} queryEmbedding - The embedding vector of the search query.
   * @param {number} topK - Number of results to return.
   * @param {Object} filter - Metadata filters to apply (e.g. { tenantId: '...' }).
   */
  static async queryVector(queryEmbedding, topK = 3, filter = null) {
    const index = this.getIndex();
    const queryParams = {
      vector: queryEmbedding,
      topK,
      includeMetadata: true,
    };
    if (filter) {
      queryParams.filter = filter;
    }
    const queryResponse = await index.query(queryParams);
    return queryResponse.matches || [];
  }
}

module.exports = PineconeService;
