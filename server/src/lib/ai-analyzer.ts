import { CodeLocator, AffectedFileLocation } from "./code-locator";
import { Priority } from "@prisma/client";
import { logger } from "./logger";

export interface BugAnalysisInput {
  title?: string;
  description?: string;
  errorLog?: string;
  stepsToReproduce?: string;
  expectedResult?: string;
  actualResult?: string;
}

export interface BugAnalysisResult {
  suggestedPriority: Priority;
  category:
    | "Frontend / UI"
    | "Backend / API"
    | "Database & ORM"
    | "Auth & Security"
    | "Performance & Network"
    | "Configuration";
  rootCauseAnalysis: string;
  suggestedFix: string;
  suggestedStepsToReproduce: string[];
  reproductionConfidence: number;
  aiEngine: "Gemini AI" | "Heuristic Diagnostics Engine";
  affectedFiles: AffectedFileLocation[];
}

export class AIBugAnalyzer {
  /**
   * Analyzes bug details using Gemini AI if key exists, with fallback to intelligent local diagnostic engine.
   */
  static async analyze(input: BugAnalysisInput): Promise<BugAnalysisResult> {
    const affectedFiles = CodeLocator.locate(input);
    const geminiKey = process.env.GEMINI_API_KEY?.trim();

    let result: BugAnalysisResult | null = null;
    if (geminiKey) {
      try {
        result = await this.callGemini(geminiKey, input);
      } catch (err) {
        logger.warn("[AI-ANALYZER] Gemini API call failed, falling back to heuristic engine", err);
      }
    }

    if (!result) {
      result = this.heuristicAnalyze(input);
    }

    result.affectedFiles = affectedFiles;
    return result;
  }

  private static async callGemini(
    apiKey: string,
    input: BugAnalysisInput
  ): Promise<BugAnalysisResult | null> {
    const prompt = `You are a senior full-stack software engineer and bug triage expert.
Analyze this bug report and return a JSON object with this exact shape:
{
  "suggestedPriority": "CRITICAL" | "HIGH" | "MEDIUM" | "LOW",
  "category": "Frontend / UI" | "Backend / API" | "Database & ORM" | "Auth & Security" | "Performance & Network" | "Configuration",
  "rootCauseAnalysis": "2-3 sentences explaining the root technical cause",
  "suggestedFix": "Concrete, actionable recommendation or code snippet to fix this issue",
  "suggestedStepsToReproduce": ["step 1", "step 2", "step 3"],
  "reproductionConfidence": 85
}

Bug Title: ${input.title || "Untitled"}
Description: ${input.description || "N/A"}
Error Log / Stack Trace: ${input.errorLog || "N/A"}
Expected Result: ${input.expectedResult || "N/A"}
Actual Result: ${input.actualResult || "N/A"}`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.2,
        },
      }),
    });

    if (!response.ok) {
      logger.warn(`Gemini returned status ${response.status}`);
      return null;
    }

    const data = await response.json();
    const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!candidateText) return null;

    const parsed = JSON.parse(candidateText);
    return {
      suggestedPriority: (parsed.suggestedPriority as Priority) || Priority.HIGH,
      category: parsed.category || "Backend / API",
      rootCauseAnalysis: parsed.rootCauseAnalysis,
      suggestedFix: parsed.suggestedFix,
      suggestedStepsToReproduce: Array.isArray(parsed.suggestedStepsToReproduce)
        ? parsed.suggestedStepsToReproduce
        : ["Reproduce action in browser", "Observe unexpected behavior"],
      reproductionConfidence: parsed.reproductionConfidence || 90,
      aiEngine: "Gemini AI",
    };
  }

  /**
   * Deterministic full-stack diagnostic engine that matches common web stack patterns
   */
  private static heuristicAnalyze(input: BugAnalysisInput): BugAnalysisResult {
    const text = [
      input.title,
      input.description,
      input.errorLog,
      input.actualResult,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    // 1. Database & Prisma patterns
    if (
      text.includes("prisma") ||
      text.includes("unique constraint") ||
      text.includes("p2002") ||
      text.includes("foreign key") ||
      text.includes("p2003") ||
      text.includes("p2025") ||
      text.includes("connection pool") ||
      text.includes("postgresql")
    ) {
      const isUnique = text.includes("unique") || text.includes("p2002");
      return {
        suggestedPriority: isUnique ? Priority.MEDIUM : Priority.HIGH,
        category: "Database & ORM",
        rootCauseAnalysis: isUnique
          ? "Database violation: An entity with the same unique key or email already exists in PostgreSQL."
          : "ORM query failure: PostgreSQL reported a constraint violation or record not found.",
        suggestedFix: isUnique
          ? "Add an upfront existence check before calling `prisma.create()` or catch the `P2002` error code to return a user-friendly 409 Conflict."
          : "Verify database relationships, cascading foreign keys, and ensure the target entity exists in Prisma schema.",
        suggestedStepsToReproduce: [
          "Attempt to save duplicate record or invalid foreign key",
          "Observe PrismaClientKnownRequestError in server log",
          "Verify database schema constraint",
        ],
        reproductionConfidence: 95,
        aiEngine: "Heuristic Diagnostics Engine",
        affectedFiles: [],
      };
    }

    // 2. Auth, JWT, Permissions
    if (
      text.includes("401") ||
      text.includes("403") ||
      text.includes("unauthorized") ||
      text.includes("forbidden") ||
      text.includes("jwt") ||
      text.includes("token expired") ||
      text.includes("token is missing") ||
      text.includes("permission")
    ) {
      return {
        suggestedPriority: Priority.HIGH,
        category: "Auth & Security",
        rootCauseAnalysis:
          "Authentication / Authorization gate failure: The request either lacks a valid JWT session cookie, token has expired, or the user's role lacks access.",
        suggestedFix:
          "Check `requireAuth` and `requireRole` middleware. Verify that `res.cookie('token')` has `sameSite: 'lax'` and that `Authorization: Bearer` fallback is sent by client headers.",
        suggestedStepsToReproduce: [
          "Log in as regular MEMBER or unauthenticated session",
          "Attempt accessing protected resource or endpoint",
          "Observe 401 or 403 response code",
        ],
        reproductionConfidence: 90,
        aiEngine: "Heuristic Diagnostics Engine",
        affectedFiles: [],
      };
    }

    // 3. Frontend null/undefined / hydration crashes
    if (
      text.includes("cannot read properties of undefined") ||
      text.includes("cannot read properties of null") ||
      text.includes("is not a function") ||
      text.includes("minified react error") ||
      text.includes("hydration") ||
      text.includes("rendering") ||
      text.includes("typeerror")
    ) {
      const isUndefined = text.includes("cannot read properties of undefined");
      return {
        suggestedPriority: Priority.CRITICAL,
        category: "Frontend / UI",
        rootCauseAnalysis: isUndefined
          ? "Uncaught TypeError: A component attempted to access properties or call array methods (e.g., .filter(), .map()) on an undefined or null state variable before API response resolved."
          : "Client-side React rendering crash: Component lifecycle failed during state render.",
        suggestedFix:
          "Apply defensive optional chaining (e.g. `items?.filter()`) and provide fallback defaults `(data || [])` during the initial loading skeleton state.",
        suggestedStepsToReproduce: [
          "Open the affected view with cold browser cache",
          "Trigger component mounting before API payload resolves",
          "Inspect DevTools Console for unhandled TypeError",
        ],
        reproductionConfidence: 95,
        aiEngine: "Heuristic Diagnostics Engine",
      };
    }

    // 4. Rate Limiting & DoS Protection
    if (
      text.includes("429") ||
      text.includes("too many requests") ||
      text.includes("rate_limit_exceeded") ||
      text.includes("rate limit")
    ) {
      return {
        suggestedPriority: Priority.LOW,
        category: "Performance & Network",
        rootCauseAnalysis:
          "Rate limiter triggered: The client exceeded the allowed threshold within the 15-minute sliding window.",
        suggestedFix:
          "Verify whether the rate limiter should exclude developer localhost or switch from IP-based keys to user-ID-based counters.",
        suggestedStepsToReproduce: [
          "Send more than 20 auth requests or 30 uploads within 15 minutes",
          "Observe 429 RATE_LIMIT_EXCEEDED response",
        ],
        reproductionConfidence: 90,
        aiEngine: "Heuristic Diagnostics Engine",
      };
    }

    // 5. General Fallback
    const isCritical =
      text.includes("crash") ||
      text.includes("fatal") ||
      text.includes("down") ||
      text.includes("data loss");

    return {
      suggestedPriority: isCritical ? Priority.CRITICAL : Priority.MEDIUM,
      category: isCritical ? "Backend / API" : "Frontend / UI",
      rootCauseAnalysis: isCritical
        ? "Severe execution halt: An unexpected exception or uncaught error occurred in the execution pipeline."
        : "Functional defect: The actual component behavior deviates from the expected software contract.",
      suggestedFix:
        "Inspect server application logs and network response bodies. Add validation guards in the controller layer using Zod schemas.",
      suggestedStepsToReproduce: [
        "Navigate to target module in TeamFlow",
        "Perform action described in report",
        "Compare actual outcome against expected acceptance criteria",
      ],
      reproductionConfidence: 80,
      aiEngine: "Heuristic Diagnostics Engine",
    };
  }
}
