require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// Routes
const mcpRoutes = require('./src/routes/mcpRoutes');
const knowledgeRoutes = require('./src/routes/knowledgeRoutes');
app.use('/api/mcp', mcpRoutes);
app.use('/api/mcp/knowledge', knowledgeRoutes);

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'AI MCP Server' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('[AI MCP SERVER ERROR]', err.stack);
  res.status(500).json({ error: 'Internal AI Server Error', details: err.message });
});

app.listen(PORT, () => {
  console.log(`[AI MCP SERVER] Running on http://localhost:${PORT}`);
});
