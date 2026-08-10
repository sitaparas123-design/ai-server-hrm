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

  static async generatePayrollInsights(employeeId, payslipData) {
    const prompt = `
You are an HCM payroll assistant.
Analyze only the payroll and compensation data provided to you.
Do not invent salary, deductions, taxes, bonuses, benefits, or payroll values.
If information is missing, explicitly state that it is unavailable.
Explain payroll information in clear employee-friendly language.
Never provide legal, tax, or financial advice as a definitive conclusion.

Return ONLY a valid JSON object with the following structure:
{
  "summary": "Detailed overall summary explaining the employee's payroll and compensation in friendly, professional language.",
  "earnings": [
    {
      "label": "Name of earning component (e.g. Basic Salary, Allowances, Bonus)",
      "amount": 1000.00
    }
  ],
  "deductions": [
    {
      "label": "Name of deduction (e.g. Tax, Provident Fund)",
      "amount": 100.00,
      "explanation": "Brief description of why this was deducted."
    }
  ],
  "netPay": 900.00,
  "insights": [
    "Key payroll insight 1",
    "Key payroll insight 2"
  ],
  "recommendations": [
    "Payroll recommendation 1",
    "Payroll recommendation 2"
  ]
}

Data for Analysis:
Employee ID: ${employeeId}
Payroll Data:
${JSON.stringify(payslipData)}
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

  static async generateLetter(letterType, contextData) {
    const prompt = `
You are an expert HR specialist and document generator.
Generate a professional, well-formatted, and complete HR letter of type: "${letterType}" based on the context data.

Use the following context details to customize the letter exactly. Do NOT use fake names, salaries, dates, or company details.
Context:
${JSON.stringify(contextData)}

You MUST return ONLY a valid JSON object matching the following structure:
{
  "documentType": "Offer Letter" | "Warning Letter" | "Promotion Letter" | etc.,
  "date": "Date of letter (use context date if provided)",
  "company": {
    "name": "Company Name",
    "address": "Company Street Address, City, State, ZIP"
  },
  "candidate": {
    "name": "Candidate Full Name",
    "email": "Candidate Email",
    "address": "Candidate Address (or empty if not provided)"
  },
  "subject": "Clear business subject line",
  "salutation": "Dear [Candidate Name],",
  "bodyParagraphs": [
    "Paragraph 1 welcoming the candidate...",
    "Paragraph 2 details...",
    "Paragraph 3 outlining contingency checks..."
  ],
  "positionDetails": {
    "jobTitle": "Job Title",
    "department": "Department Name (if provided)",
    "salary": "Salary amount",
    "joiningDate": "Expected commencement date",
    "employmentType": "Employment type (e.g. Full-Time)",
    "workLocation": "Location of work"
  },
  "terms": [
    "Please return a signed copy by [responseDeadline] to accept.",
    "This offer is subject to pre-employment background screening."
  ],
  "closing": "Standard business closing (e.g. We look forward to welcoming you to the team.)",
  "signatory": {
    "name": "Signatory Name (HR Person)",
    "designation": "Signatory Title (e.g. HR Manager)"
  }
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

  static async chat(messages, tenantId = 'global', accessLevel = 'EMPLOYEE', systemPrompt = null) {
    const history = messages.map(m => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: m.content,
    }));

    const lastUserMessage = messages.filter(m => m.role === 'user').pop();
    let retrievedContext = '';

    if (lastUserMessage) {
      try {
        const allowedLevels = ['EMPLOYEE'];
        const normalizedRole = (accessLevel || 'EMPLOYEE').toUpperCase();
        if (normalizedRole === 'MANAGER') allowedLevels.push('MANAGER');
        if (normalizedRole === 'HR') allowedLevels.push('MANAGER', 'HR');
        if (normalizedRole === 'ADMIN' || normalizedRole === 'SUPERADMIN') allowedLevels.push('MANAGER', 'HR', 'ADMIN');

        const filter = {
          tenantId: { $in: [tenantId, 'global'] },
          accessLevel: { $in: allowedLevels }
        };

        const queryEmbedding = await OpenAIService.generateEmbedding(lastUserMessage.content);
        const matches = await PineconeService.queryVector(queryEmbedding, 3, filter);
        if (matches && matches.length > 0) {
          retrievedContext = matches.map(m => m.metadata.text).join('\n\n');
        }
      } catch (err) {
        console.error("Failed to retrieve RAG context:", err.message);
      }
    }

    // Security: server-injected system prompt takes precedence
    const securityBlock = systemPrompt
      ? `${systemPrompt}\n\n`
      : '';

    const systemInstructions = {
      role: 'system',
      content: `${securityBlock}You are an expert HR Assistant and Global HCM Copilot for an Enterprise HCM Platform. 
Help employees, managers, and HR teams with questions about leaves, payroll, policies, attendance, onboarding, and performance.
Be concise, professional, and helpful. Format responses clearly in markdown.

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
