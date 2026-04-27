/**
 * Tool definitions for the Wesley Voice Agent.
 * These are sent to the OpenAI Realtime API as part of the session config.
 * The AI can call these tools during voice conversations.
 * 
 * Tool results are executed server-side against Wesley's existing API routes,
 * except `navigate_to` which returns a UI command for the browser to execute.
 */

export const WESLEY_VOICE_TOOLS = [
    {
        type: "function" as const,
        name: "get_schedule",
        description: "Get the user's calendar events for a specific date or date range. Call this whenever the user asks about their schedule, upcoming events, hearings, or deadlines. ALWAYS call navigate_to('calendar') alongside this.",
        parameters: {
            type: "object",
            properties: {
                start_date: {
                    type: "string",
                    description: "Start date in ISO 8601 format (e.g., 2026-04-27T00:00:00Z). Defaults to today if not specified."
                },
                end_date: {
                    type: "string",
                    description: "End date in ISO 8601 format. Defaults to end of start_date if not specified."
                },
            },
        },
    },
    {
        type: "function" as const,
        name: "add_calendar_event",
        description: "Add a new event to the user's calendar. Use for hearings, deadlines, meetings, reminders, or any scheduled item. ALWAYS call navigate_to('calendar') alongside this.",
        parameters: {
            type: "object",
            properties: {
                title: {
                    type: "string",
                    description: "Title of the event (e.g., 'Hearing - Sharma vs State')"
                },
                start_at: {
                    type: "string",
                    description: "Start date/time in ISO 8601 format"
                },
                end_at: {
                    type: "string",
                    description: "End date/time in ISO 8601 format. Optional for deadlines."
                },
                event_type: {
                    type: "string",
                    enum: ["meeting", "hearing", "deposition", "filing", "consultation", "internal", "other"],
                    description: "Type of event. Use 'filing' for deadlines, 'hearing' for court dates, 'meeting' for general meetings, 'consultation' for client consultations."
                },
                description: {
                    type: "string",
                    description: "Additional details about the event"
                },
                court_name: {
                    type: "string",
                    description: "Name of the court, if applicable"
                },
                case_number: {
                    type: "string",
                    description: "Case number, if applicable"
                },
                all_day: {
                    type: "boolean",
                    description: "Whether the event lasts all day. Defaults to false."
                },
            },
            required: ["title", "start_at"],
        },
    },
    {
        type: "function" as const,
        name: "run_workflow",
        description: "Run a Wesley workflow template such as company research, contract analysis, legal memo, or document comparison. ALWAYS call navigate_to('workflows') alongside this so the user can see progress.",
        parameters: {
            type: "object",
            properties: {
                workflow_type: {
                    type: "string",
                    enum: [
                        "company-profile",
                        "contract-analysis",
                        "legal-memo",
                        "document-comparison",
                        "translation",
                        "redline-analysis",
                        "client-alert",
                        "draft-from-template",
                    ],
                    description: "The type of workflow to run"
                },
                inputs: {
                    type: "object",
                    description: "Input parameters for the workflow. Varies by type. For company-profile, use {companyName: '...'}. For contract-analysis, use {documentId: '...'}.",
                },
            },
            required: ["workflow_type"],
        },
    },
    {
        type: "function" as const,
        name: "search_documents",
        description: "Search through the user's uploaded legal documents and projects in Wesley's vault. ALWAYS call navigate_to('documents') alongside this.",
        parameters: {
            type: "object",
            properties: {
                query: {
                    type: "string",
                    description: "Search query for documents"
                },
            },
            required: ["query"],
        },
    },
    {
        type: "function" as const,
        name: "navigate_to",
        description: "Navigate Wesley's UI to show the user a specific page or resource. Use this alongside data-fetching tools so the user sees results on screen. For specific resources, use path parameter (e.g., '/chat/abc-123').",
        parameters: {
            type: "object",
            properties: {
                page: {
                    type: "string",
                    enum: ["calendar", "documents", "workflows", "chat", "settings", "prompt-library", "help", "organization", "recent-chats", "home"],
                    description: "The page to navigate to. Use this for standard pages."
                },
                path: {
                    type: "string",
                    description: "A specific URL path to navigate to (e.g., '/chat/conversation-id'). Use this to open a specific conversation or document. Takes priority over 'page' if both provided."
                },
            },
        },
    },
    {
        type: "function" as const,
        name: "get_recent_chats",
        description: "Get the user's recent chat conversations in Wesley. Use when the user asks about past conversations or what they discussed. Use this to find a conversation ID so you can open it with navigate_to.",
        parameters: {
            type: "object",
            properties: {
                type: {
                    type: "string",
                    description: "Filter by chat type (optional). Leave empty for all."
                },
            },
        },
    },
    {
        type: "function" as const,
        name: "read_document",
        description: "Read the text content of a specific document by its file ID. Use when the user asks to read, review, or summarize a specific document they've uploaded to Wesley.",
        parameters: {
            type: "object",
            properties: {
                file_id: {
                    type: "string",
                    description: "The UUID of the file to read"
                },
            },
            required: ["file_id"],
        },
    },
    {
        type: "function" as const,
        name: "start_new_chat",
        description: "Start a new chat conversation in Wesley and navigate to it. Use when the user says things like 'start a new chat', 'let's discuss...', 'ask Wesley about...'.",
        parameters: {
            type: "object",
            properties: {
                title: {
                    type: "string",
                    description: "Title for the new conversation. Derive from the user's topic."
                },
                initial_message: {
                    type: "string",
                    description: "The first message to send in the chat. This will be the user's question or topic."
                },
            },
            required: ["title"],
        },
    },
    {
        type: "function" as const,
        name: "open_conversation",
        description: "Find and open a specific past conversation by searching its title or content. First searches recent chats, then navigates to the matching conversation.",
        parameters: {
            type: "object",
            properties: {
                search_query: {
                    type: "string",
                    description: "Search term to find the conversation (e.g., 'patent law discussion', 'contract review')"
                },
            },
            required: ["search_query"],
        },
    },
    {
        type: "function" as const,
        name: "save_memory",
        description: "Save an important note, preference, or reminder to the user's memory in Wesley. Use when the user says 'remember this', 'note that...', 'save this for later'.",
        parameters: {
            type: "object",
            properties: {
                content: {
                    type: "string",
                    description: "The memory content to save"
                },
                memory_type: {
                    type: "string",
                    enum: ["preference", "fact", "instruction", "context"],
                    description: "Type of memory. 'preference' for user preferences, 'fact' for important facts, 'instruction' for workflow preferences, 'context' for general context."
                },
            },
            required: ["content"],
        },
    },
] as const

/**
 * Map of page names to Next.js route paths for navigation.
 */
export const PAGE_ROUTES: Record<string, string> = {
    calendar: "/calendar",
    documents: "/documents",
    workflows: "/templates",
    chat: "/chat",
    settings: "/settings",
    "prompt-library": "/prompt-library",
    help: "/help",
    organization: "/organization",
    "recent-chats": "/recent-chats",
    home: "/",
}
