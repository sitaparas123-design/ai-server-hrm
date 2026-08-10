const express = require('express');
const router = express.Router();
const OpenAIService = require('../services/openAIService');

// ─────────────────────────────────────────
// REQUEST WRAPPER
// Standardizes success/error response shape.
// ─────────────────────────────────────────
const handle = (fn) => async (req, res) => {
  try {
    const result = await fn(req);
    res.json({ success: true, data: result });
  } catch (err) {
    console.error(`[MCP Route Error] ${req.path}:`, err.message);
    const status = err.message.toLowerCase().includes('required') ? 400 : 500;
    res.status(status).json({ success: false, error: err.message });
  }
};

// ─────────────────────────────────────────
// RESUME OPERATIONS
// ─────────────────────────────────────────

// Called by: candidateController, hrController, publicController
router.post('/resume/parse', handle(async (req) => {
  const { resumeText } = req.body;
  if (!resumeText) throw new Error('resumeText is required');
  return OpenAIService.parseResume(resumeText);
}));

// Called by: candidateController score check
router.post('/resume/score', handle(async (req) => {
  const { resumeText, criteria } = req.body;
  if (!resumeText || !criteria) throw new Error('resumeText and criteria are required');
  return OpenAIService.scoreResume(resumeText, criteria);
}));

// Called by: hrController, candidateController, publicController
router.post('/resume/shortlist', handle(async (req) => {
  const { resumeText, jobDescription } = req.body;
  if (!resumeText) throw new Error('resumeText is required');
  return OpenAIService.shortlistResume(resumeText, jobDescription || 'General role');
}));

// Called by: employeeController (resume creation endpoint)
router.post('/resume/create', handle(async (req) => {
  const { details } = req.body;
  if (!details) throw new Error('details are required');
  // Parse details as a resume-like text
  const resumeText = typeof details === 'string' ? details : JSON.stringify(details);
  return OpenAIService.parseResume(resumeText);
}));

// ─────────────────────────────────────────
// INTERVIEW OPERATIONS
// ─────────────────────────────────────────

// Called by: hrController (AI-assisted interview prep)
router.post('/interview/generate', handle(async (req) => {
  const { role, requirements } = req.body;
  if (!role) throw new Error('role is required');
  return OpenAIService.generateInterview(role, requirements);
}));

// Called by: hrController (post-interview evaluation)
router.post('/interview/evaluate', handle(async (req) => {
  const { transcript, criteria } = req.body;
  if (!transcript) throw new Error('transcript is required');
  return OpenAIService.evaluateInterview(transcript, criteria);
}));

// Called by: hrController (pass/fail adjudication)
router.post('/interview/pass-fail', handle(async (req) => {
  const { evaluationData } = req.body;
  if (!evaluationData) throw new Error('evaluationData is required');
  return OpenAIService.passFailInterview(evaluationData);
}));

// ─────────────────────────────────────────
// DOCUMENT & REPORTING
// ─────────────────────────────────────────

// Called by: employeeController (policy Q&A, document analysis)
router.post('/document/analyze', handle(async (req) => {
  const { documentText, context } = req.body;
  if (!documentText) throw new Error('documentText is required');
  return OpenAIService.analyzeDocument(documentText, context || 'General HR Document');
}));

// Called by: compensationController, managerController, superAdminController
router.post('/report/generate', handle(async (req) => {
  const { topic, data } = req.body;
  if (!topic) throw new Error('topic is required');
  return OpenAIService.generateReport(topic, data || {});
}));

// ─────────────────────────────────────────
// PERFORMANCE & ONBOARDING
// ─────────────────────────────────────────

// Called by: managerController.getPerformanceSummaries (legacy name: reviewPerformance)
router.post('/performance/review', handle(async (req) => {
  const { kpis, feedback } = req.body;
  return OpenAIService.reviewPerformance(kpis, feedback);
}));

// Called by: managerController.getPerformanceSummaries (new method name)
router.post('/performance/evaluate', handle(async (req) => {
  const { kpis, feedback } = req.body;
  return OpenAIService.evaluatePerformance(kpis, feedback);
}));

// Called by: hrController (new employee onboarding plan)
router.post('/onboarding/generate', handle(async (req) => {
  const { role, department } = req.body;
  if (!role) throw new Error('role is required');
  return OpenAIService.generateOnboarding(role, department || 'General');
}));

router.post('/letter/generate', handle(async (req) => {
  const { letterType, contextData } = req.body;
  if (!letterType) throw new Error('letterType is required');
  return OpenAIService.generateLetter(letterType, contextData || {});
}));

// ─────────────────────────────────────────
// SUPER ADMIN ANALYTICS
// ─────────────────────────────────────────

// Called by: superAdminController.executeAnalytics
router.post('/analytics/execute', handle(async (req) => {
  const { query, schemaContext } = req.body;
  if (!query) throw new Error('query is required');
  return OpenAIService.executeAnalytics(query, schemaContext);
}));

// Called by: employeeController.aiPayrollInsights
router.post('/payroll/insights', handle(async (req) => {
  const { employeeId, payslipData } = req.body;
  return OpenAIService.generatePayrollInsights(employeeId, payslipData || {});
}));

// Called by: copilotController (HR Helpdesk Chatbot / Copilot)
router.post('/chat', handle(async (req) => {
  const { messages, tenantId, accessLevel, systemPrompt } = req.body;
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    throw new Error('messages array is required');
  }
  return OpenAIService.chat(messages, tenantId || 'global', accessLevel || 'EMPLOYEE', systemPrompt || null);
}));

module.exports = router;
