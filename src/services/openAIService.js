const OpenAI = require('openai');
const PineconeService = require('./pineconeService');

const cleanApiKey = (process.env.OPENAI_API_KEY || '').replace(/^"|"$/g, '').trim();
const openai = new OpenAI({ apiKey: cleanApiKey });
// Default model. User can override via env if needed.
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

/**
 * Core text generation helper.
 * Wraps all OpenAI API calls with consistent error handling.
 */
async function generate(prompt, jsonMode = false) {
  const params = {
    model: MODEL,
    messages: [{ role: 'user', content: prompt }],
  };
  
  if (jsonMode) {
    params.response_format = { type: 'json_object' };
  }
  
  const response = await openai.chat.completions.create(params);
  const text = response.choices[0].message.content;
  
  if (jsonMode) {
    try {
      return JSON.parse(text);
    } catch (e) {
      console.error("Failed to parse JSON response from OpenAI:", text);
      throw e;
    }
  }
  return text;
}

class OpenAIService {
  static async generateEmbedding(text) {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
    });
    return response.data[0].embedding;
  }

  // ─────────────────────────────────────────
  // RESUME OPERATIONS
  // ─────────────────────────────────────────

  static async parseResume(resumeText) {
    const prompt = `
You are an expert ATS (Applicant Tracking System) resume parser.
Extract structured information from the resume text below.
Return ONLY a valid JSON object with this exact schema:
{
  "name": "Full Name (string)",
  "email": "Email address (string or null)",
  "phone": "Phone number (string or null)",
  "skills": ["skill1", "skill2"],
  "experience_years": 0,
  "education": "Highest degree or institution (string or null)",
  "current_role": "Current or last job title (string or null)",
  "summary": "2-sentence professional summary (string)"
}

Resume Text:
${resumeText}
    `.trim();
    return generate(prompt, true);
  }

  static async scoreResume(resumeText, criteria) {
    const prompt = `
You are a senior HR recruiter. Evaluate the candidate's resume against the job criteria.
Return ONLY a valid JSON object with this schema:
{
  "score": 75,
  "matchScore": 75,
  "reasoning": "Short explanation of the score",
  "strengths": ["strength1", "strength2"],
  "weaknesses": ["weakness1"],
  "recommendation": "Shortlist" | "Reject" | "Hold"
}

Job Criteria:
${JSON.stringify(criteria)}

Resume Text:
${resumeText}
    `.trim();
    return generate(prompt, true);
  }

  static async shortlistResume(resumeText, jobDescription) {
    const prompt = `
You are a senior HR recruiter making a shortlisting decision.
Evaluate the candidate's fitness for the following job description.
Return ONLY a valid JSON object with this schema:
{
  "matchScore": 80,
  "shortlisted": true,
  "strengths": ["strength1", "strength2"],
  "weaknesses": ["weakness1"],
  "recommendation": "Proceed to Technical Interview",
  "fitSummary": "1-2 sentence summary of overall fit"
}

Job Description:
${jobDescription}

Resume Text:
${resumeText}
    `.trim();
    return generate(prompt, true);
  }

  // ─────────────────────────────────────────
  // INTERVIEW OPERATIONS
  // ─────────────────────────────────────────

  static async generateInterview(role, requirements) {
    const prompt = `
You are a technical interview expert.
Generate 8 relevant interview questions for a ${role} position.
Return ONLY a valid JSON object with this schema:
{
  "questions": [
    {
      "category": "Technical | Behavioral | Situational",
      "question": "The question text",
      "idealAnswer": "Key points the ideal answer should cover"
    }
  ]
}

Requirements:
${requirements || 'General professional skills and experience.'}
    `.trim();
    return generate(prompt, true);
  }

  static async evaluateInterview(transcript, criteria) {
    const prompt = `
You are a senior HR evaluator. Analyze this interview transcript and score the candidate.
Return ONLY a valid JSON object with this schema:
{
  "overallScore": 78,
  "recommendation": "Hire" | "Reject" | "Second Interview",
  "competencies": [
    { "name": "Technical Skills", "score": 80, "comments": "..." },
    { "name": "Communication", "score": 75, "comments": "..." },
    { "name": "Problem Solving", "score": 82, "comments": "..." }
  ],
  "strengths": ["..."],
  "areasForImprovement": ["..."],
  "summary": "2-3 sentence evaluation summary"
}

Evaluation Criteria:
${JSON.stringify(criteria || {})}

Interview Transcript:
${transcript}
    `.trim();
    return generate(prompt, true);
  }

  static async passFailInterview(evaluationData) {
    const prompt = `
Based on the following interview evaluation data, make a final Pass/Fail decision.
Return ONLY a valid JSON object:
{
  "decision": "Pass" | "Fail",
  "confidence": 85,
  "rationale": "Clear explanation of why the candidate passed or failed"
}

Evaluation Data:
${JSON.stringify(evaluationData)}
    `.trim();
    return generate(prompt, true);
  }

  // ─────────────────────────────────────────
  // DOCUMENT & REPORTING
  // ─────────────────────────────────────────

  static async analyzeDocument(documentText, context) {
    const prompt = `
You are an enterprise HR document analyst.
Context: ${context}

Analyze the following text and provide a structured JSON response:
{
  "summary": "Key points summary",
  "actionItems": ["action1", "action2"],
  "riskFlags": ["risk1"],
  "compliance": "Compliant" | "Review Required" | "Non-Compliant",
  "insights": "Detailed analysis paragraph"
}

Document:
${documentText}
    `.trim();
    return generate(prompt, true);
  }

  static async generateReport(topic, data) {
    const prompt = `
You are an enterprise HR analytics engine.
Generate a comprehensive report on: "${topic}"

Return ONLY a valid JSON object:
{
  "title": "${topic}",
  "executiveSummary": "2-3 sentences",
  "keyFindings": ["finding1", "finding2"],
  "metrics": { "key1": "value1" },
  "recommendations": ["recommendation1", "recommendation2"],
  "riskAlerts": ["alert1"],
  "content": "Full detailed report text (markdown allowed)"
}

Data for Analysis:
${JSON.stringify(data)}
    `.trim();
    return generate(prompt, true);
  }

  // ─────────────────────────────────────────
  // PERFORMANCE & ONBOARDING
  // ─────────────────────────────────────────

  static async reviewPerformance(kpis, feedback) {
    return OpenAIService.evaluatePerformance(kpis, feedback);
  }

  static async evaluatePerformance(kpis, feedback) {
    const prompt = `
You are a performance management expert.
Evaluate the following employee KPIs and feedback.
Return ONLY a valid JSON object:
{
  "overallRating": "Exceeds Expectations" | "Meets Expectations" | "Needs Improvement",
  "score": 82,
  "kpiAnalysis": [
    { "kpi": "KPI Name", "status": "Achieved" | "Partial" | "Missed", "comment": "..." }
  ],
  "strengths": ["..."],
  "developmentAreas": ["..."],
  "managerRecommendation": "Promotion Ready" | "Standard Increment" | "PIP Required",
  "summary": "2-3 sentence evaluation summary"
}

KPIs:
${JSON.stringify(kpis || [])}

Feedback:
${JSON.stringify(feedback || {})}
    `.trim();
    return generate(prompt, true);
  }

  static async generateOnboarding(role, department) {
    const prompt = `
You are an HR onboarding specialist.
Create a 30-60-90 day onboarding plan for a new ${role} joining the ${department} department.
Return ONLY a valid JSON object:
{
  "role": "${role}",
  "department": "${department}",
  "plan": {
    "day30": { "title": "First 30 Days", "goals": ["goal1"], "tasks": ["task1"] },
    "day60": { "title": "Days 31-60", "goals": ["goal1"], "tasks": ["task1"] },
    "day90": { "title": "Days 61-90", "goals": ["goal1"], "tasks": ["task1"] }
  },
  "trainingModules": ["module1", "module2"],
  "successMetrics": ["metric1"]
}
    `.trim();
    return generate(prompt, true);
  }

  // ─────────────────────────────────────────
  // SUPER ADMIN ANALYTICS
  // ─────────────────────────────────────────

  static async executeAnalytics(query, schemaContext) {
    const prompt = `
You are a data analyst working on an Enterprise HR SaaS platform.
Answer the following analytics query using the provided schema context.
Return ONLY a valid JSON object:
{
  "query": "${query}",
  "answer": "Direct answer to the question",
  "insights": ["insight1", "insight2"],
  "metrics": { "key1": "value1" },
  "chartSuggestion": "bar" | "line" | "pie" | "none",
  "chartData": []
}

Schema Context:
${JSON.stringify(schemaContext || {})}
    `.trim();
    return generate(prompt, true);
  }

  // ─────────────────────────────────────────
  // AI CHAT
  // ─────────────────────────────────────────

  static async chat(messages) {
    const history = messages.map(m => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: m.content,
    }));

    const lastUserMessage = messages.filter(m => m.role === 'user').pop();
    let retrievedContext = '';

    if (lastUserMessage) {
      try {
        const queryEmbedding = await OpenAIService.generateEmbedding(lastUserMessage.content);
        const matches = await PineconeService.queryVector(queryEmbedding, 3);
        if (matches && matches.length > 0) {
          retrievedContext = matches.map(m => m.metadata.text).join('\n\n');
        }
      } catch (err) {
        console.error("Failed to retrieve RAG context:", err.message);
      }
    }

    const systemInstructions = {
      role: 'system',
      content: `You are an expert HR Assistant for an Enterprise HCM Platform. 
Help employees and HR teams with questions about leaves, payroll, policies, attendance, onboarding, and performance.
Be concise, professional, and helpful. Format responses clearly.

Use the following enterprise knowledge context to answer if it's relevant to the user's question:
### ENTERPRISE CONTEXT ###
${retrievedContext}
### END CONTEXT ###
`
    };

    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [systemInstructions, ...history],
    });

    return { reply: response.choices[0].message.content };
  }
}

module.exports = OpenAIService;
