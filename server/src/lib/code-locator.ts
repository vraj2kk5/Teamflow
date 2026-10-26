import path from "path";

export interface AffectedFileLocation {
  layer: "Frontend (Client)" | "Backend (API)" | "Database & Models" | "Architecture & Config";
  relativePath: string;
  fileName: string;
  lineNumber?: number;
  columnNumber?: number;
  vsCodeUrl: string;
  gitHubUrl: string;
  reason: string;
  confidence: "EXACT_STACK_TRACE" | "AI_INFERRED";
}

// Map of canonical known project files for instant heuristic localization
const KNOWN_CODEBASE_FILES: Record<
  string,
  {
    relativePath: string;
    layer: AffectedFileLocation["layer"];
    keywords: string[];
    description: string;
  }
> = {
  issueDetail: {
    relativePath: "client/src/components/issues/IssueDetailView.tsx",
    layer: "Frontend (Client)",
    keywords: ["issuedetail", "task detail", "filter", "cannot read properties of undefined", "task view", "preview"],
    description: "Issue & task detailed view component with media player, comments, and status transitions",
  },
  kanbanBoard: {
    relativePath: "client/src/components/board/KanbanBoard.tsx",
    layer: "Frontend (Client)",
    keywords: ["kanban", "board", "columns", "card", "drag", "todo", "in_progress", "done"],
    description: "Kanban board column management and card dispatching",
  },
  kanbanCard: {
    relativePath: "client/src/components/board/KanbanCard.tsx",
    layer: "Frontend (Client)",
    keywords: ["kanbancard", "card click", "assignee avatar", "due date badge"],
    description: "Interactive Kanban task card element",
  },
  mediaPlayer: {
    relativePath: "client/src/components/media/MediaPlayer.tsx",
    layer: "Frontend (Client)",
    keywords: ["mediaplayer", "video player", "audio player", "playback", "stream", "webm", "mp4"],
    description: "In-browser video and voice note playback with range buffering",
  },
  projectAnalytics: {
    relativePath: "client/src/components/analytics/ProjectAnalyticsView.tsx",
    layer: "Frontend (Client)",
    keywords: ["burndown", "velocity", "analytics", "sprint", "chart", "hours burned"],
    description: "Interactive SVG sprint burndown chart and team velocity analytics",
  },
  authContext: {
    relativePath: "client/src/contexts/AuthContext.tsx",
    layer: "Frontend (Client)",
    keywords: ["authcontext", "useauth", "session expired", "logout", "token cookie", "redirect login"],
    description: "React Auth Context managing client login sessions and tokens",
  },
  issuesService: {
    relativePath: "server/src/modules/issues/issues.service.ts",
    layer: "Backend (API)",
    keywords: ["issues.service", "issueservice", "createissue", "updatestatus", "assignee", "sequencenumber", "tf-"],
    description: "Core issue creation, sequencing (TF-1, TF-2), and status lifecycle state engine",
  },
  attachmentsService: {
    relativePath: "server/src/modules/attachments/attachments.service.ts",
    layer: "Backend (API)",
    keywords: ["attachment", "upload", "multer", "storage", "mimetype", "max_video_mb", "videoupload"],
    description: "Media attachment validation, magic bytes sniffing, and storage token signing",
  },
  notificationsService: {
    relativePath: "server/src/modules/notifications/notifications.service.ts",
    layer: "Backend (API)",
    keywords: ["notification", "bell", "self-assignment", "actorId", "createnotification", "unread"],
    description: "In-app notifications dispatcher and unread counter service",
  },
  authService: {
    relativePath: "server/src/modules/auth/auth.service.ts",
    layer: "Backend (API)",
    keywords: ["auth.service", "jwt", "bcrypt", "password", "login", "register", "token", "unauthorized"],
    description: "Authentication service handling JWT tokens and bcrypt password hashing",
  },
  projectsService: {
    relativePath: "server/src/modules/projects/projects.service.ts",
    layer: "Backend (API)",
    keywords: ["projects.service", "invitecode", "addmember", "burndown", "velocityweekly", "projectmemberships"],
    description: "Project management, collaborator membership, and sprint analytics queries",
  },
  realtimeEvents: {
    relativePath: "server/src/lib/events.ts",
    layer: "Backend (API)",
    keywords: ["realtime", "eventsource", "sse", "stream", "broadcast", "heartbeat"],
    description: "Server-Sent Events (SSE) live broadcast hub",
  },
  webhookService: {
    relativePath: "server/src/lib/webhook.ts",
    layer: "Backend (API)",
    keywords: ["webhook", "discord", "slack", "embed", "notify channel"],
    description: "Discord & Slack incoming webhook integration service",
  },
  prismaSchema: {
    relativePath: "server/prisma/schema.prisma",
    layer: "Database & Models",
    keywords: ["prisma", "p2002", "p2003", "p2025", "unique constraint", "foreign key", "model issue", "database schema"],
    description: "Prisma ORM schema defining PostgreSQL tables, enums, and relation constraints",
  },
  storageDriver: {
    relativePath: "server/src/lib/storage/local-disk.driver.ts",
    layer: "Backend (API)",
    keywords: ["localdiskdriver", "s3driver", "byte-range", "range header", "http 206", "partial content"],
    description: "Storage abstraction driver handling HTTP 206 video chunk streaming and signed tokens",
  },
};

const GITHUB_REPO_BASE = "https://github.com/vraj2kk5/Teamflow/blob/main";
const WORKSPACE_DIR = process.cwd().replace(/[/\\]server$/, ""); // Monorepo root: C:\Users\Asus\OneDrive\Desktop\Teamflow

export class CodeLocator {
  /**
   * Automatically identifies the affected file(s) and lines from error logs or description.
   */
  static locate(input: {
    title?: string;
    description?: string;
    errorLog?: string;
    actualResult?: string;
  }): AffectedFileLocation[] {
    const results: AffectedFileLocation[] = [];
    const seenFiles = new Set<string>();

    const rawError = input.errorLog || "";
    const combinedText = [
      input.title,
      input.description,
      input.errorLog,
      input.actualResult,
    ]
      .filter(Boolean)
      .join("\n");

    // 1. Precise Stack Trace Extraction
    // Matches patterns like:
    // at Component (c:\...\client\src\components\issues\IssueDetailView.tsx:501:34)
    // at IssueDetailView.tsx:501:34
    // at server/src/modules/issues/issues.service.ts:548:12
    const stackTraceRegex = /(?:at\s+(?:[A-Za-z0-9_$.<>]+\s+\()?|[([]?)([\w/\\.-]+?\.(?:tsx|ts|jsx|js|prisma))(?::(\d+))?(?::(\d+))?\)?/gi;

    let match: RegExpExecArray | null;
    while ((match = stackTraceRegex.exec(rawError)) !== null) {
      const rawPath = match[1];
      const lineStr = match[2];
      const colStr = match[3];

      const lineNumber = lineStr ? parseInt(lineStr, 10) : undefined;
      const columnNumber = colStr ? parseInt(colStr, 10) : undefined;

      const normalized = this.normalizeFilePath(rawPath);
      if (normalized && !seenFiles.has(normalized.relativePath)) {
        seenFiles.add(normalized.relativePath);

        results.push({
          layer: normalized.layer,
          relativePath: normalized.relativePath,
          fileName: path.basename(normalized.relativePath),
          lineNumber,
          columnNumber,
          vsCodeUrl: this.buildVSCodeUrl(normalized.relativePath, lineNumber, columnNumber),
          gitHubUrl: this.buildGitHubUrl(normalized.relativePath, lineNumber),
          reason: `Exact failure point identified in runtime error stack trace at line ${lineNumber || 1}.`,
          confidence: "EXACT_STACK_TRACE",
        });
      }
    }

    // 2. Intelligent Codebase Keyword & Module Inferrer (if no direct trace or to supplement)
    const lowerCombined = combinedText.toLowerCase();

    for (const [key, known] of Object.entries(KNOWN_CODEBASE_FILES)) {
      if (seenFiles.has(known.relativePath)) continue;

      const matchedKeyword = known.keywords.find((kw) => lowerCombined.includes(kw.toLowerCase()));
      if (matchedKeyword) {
        seenFiles.add(known.relativePath);
        results.push({
          layer: known.layer,
          relativePath: known.relativePath,
          fileName: path.basename(known.relativePath),
          vsCodeUrl: this.buildVSCodeUrl(known.relativePath),
          gitHubUrl: this.buildGitHubUrl(known.relativePath),
          reason: `Matched keyword "${matchedKeyword}" related to ${known.description}.`,
          confidence: "AI_INFERRED",
        });
      }

      // Limit to top 3 inferred files
      if (results.length >= 3) break;
    }

    // 3. Fallback default if nothing matched
    if (results.length === 0) {
      const isFrontend =
        lowerCombined.includes("click") ||
        lowerCombined.includes("button") ||
        lowerCombined.includes("screen") ||
        lowerCombined.includes("page");

      const defaultTarget = isFrontend
        ? KNOWN_CODEBASE_FILES.issueDetail
        : KNOWN_CODEBASE_FILES.issuesService;

      results.push({
        layer: defaultTarget.layer,
        relativePath: defaultTarget.relativePath,
        fileName: path.basename(defaultTarget.relativePath),
        vsCodeUrl: this.buildVSCodeUrl(defaultTarget.relativePath),
        gitHubUrl: this.buildGitHubUrl(defaultTarget.relativePath),
        reason: defaultTarget.description,
        confidence: "AI_INFERRED",
      });
    }

    return results;
  }

  private static normalizeFilePath(rawPath: string): { relativePath: string; layer: AffectedFileLocation["layer"] } | null {
    // Clean Windows/POSIX path separators
    const cleaned = rawPath.replace(/\\/g, "/");

    // Ignore node_modules, webpack internals, or react-dom internals
    if (
      cleaned.includes("node_modules") ||
      cleaned.includes("webpack") ||
      cleaned.includes("react-dom") ||
      cleaned.includes("next/dist")
    ) {
      return null;
    }

    // Extract relative path from workspace root
    let relative = cleaned;
    const clientIdx = cleaned.indexOf("client/src/");
    const serverIdx = cleaned.indexOf("server/src/");
    const prismaIdx = cleaned.indexOf("server/prisma/");

    if (clientIdx !== -1) {
      relative = cleaned.substring(clientIdx);
    } else if (serverIdx !== -1) {
      relative = cleaned.substring(serverIdx);
    } else if (prismaIdx !== -1) {
      relative = cleaned.substring(prismaIdx);
    } else {
      // Just a filename like "IssueDetailView.tsx" - check if it matches known files
      const baseName = path.basename(cleaned);
      for (const known of Object.values(KNOWN_CODEBASE_FILES)) {
        if (known.relativePath.endsWith(baseName)) {
          relative = known.relativePath;
          break;
        }
      }
    }

    // Determine layer
    let layer: AffectedFileLocation["layer"] = "Architecture & Config";
    if (relative.startsWith("client/")) {
      layer = "Frontend (Client)";
    } else if (relative.startsWith("server/prisma/")) {
      layer = "Database & Models";
    } else if (relative.startsWith("server/")) {
      layer = "Backend (API)";
    }

    return { relativePath: relative, layer };
  }

  private static buildVSCodeUrl(relativePath: string, lineNumber?: number, columnNumber?: number): string {
    const fullPath = path.resolve(WORKSPACE_DIR, relativePath).replace(/\\/g, "/");
    let url = `vscode://file/${fullPath}`;
    if (lineNumber) {
      url += `:${lineNumber}`;
      if (columnNumber) {
        url += `:${columnNumber}`;
      }
    }
    return url;
  }

  private static buildGitHubUrl(relativePath: string, lineNumber?: number): string {
    let url = `${GITHUB_REPO_BASE}/${relativePath}`;
    if (lineNumber) {
      url += `#L${lineNumber}`;
    }
    return url;
  }
}
