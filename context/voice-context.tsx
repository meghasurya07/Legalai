"use client"

import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from "react"
import { RealtimeClient, type VoiceAgentState, type ToolCallEvent } from "@/lib/voice/realtime-client"
import { PAGE_ROUTES } from "@/lib/voice/agent-tools"
import { useRouter } from "next/navigation"

interface VoiceContextType {
    /** Current state of the voice agent */
    state: VoiceAgentState
    /** Whether voice is enabled by the user */
    isEnabled: boolean
    /** Transcripts from the current session */
    transcripts: Array<{ role: "user" | "assistant"; text: string }>
    /** Error message if any */
    error: string | null
    /** Start a voice session (mic button clicked) */
    startSession: () => Promise<void>
    /** Stop the current voice session */
    stopSession: () => void
    /** Toggle voice feature on/off */
    toggleEnabled: () => void
    /** Current action being performed */
    currentAction: string | null
}

const VoiceContext = createContext<VoiceContextType>({
    state: "idle",
    isEnabled: false,
    transcripts: [],
    error: null,
    startSession: async () => {},
    stopSession: () => {},
    toggleEnabled: () => {},
    currentAction: null,
})

// Daily usage tracking (resets at midnight)
function getDailyUsageKey(): string {
    const today = new Date().toISOString().split("T")[0]
    return `wesley_voice_usage_${today}`
}

function getDailyUsageMinutes(): number {
    if (typeof window === "undefined") return 0
    const stored = localStorage.getItem(getDailyUsageKey())
    return stored ? parseFloat(stored) : 0
}

function addDailyUsageMinutes(minutes: number): void {
    if (typeof window === "undefined") return
    const current = getDailyUsageMinutes()
    localStorage.setItem(getDailyUsageKey(), String(current + minutes))
}

const DAILY_LIMIT_MINUTES = 45

export function VoiceAgentProvider({ children }: { children: ReactNode }) {
    const [state, setState] = useState<VoiceAgentState>("idle")
    const [isEnabled, setIsEnabled] = useState(false)
    const [transcripts, setTranscripts] = useState<Array<{ role: "user" | "assistant"; text: string }>>([])
    const [error, setError] = useState<string | null>(null)
    const [currentAction, setCurrentAction] = useState<string | null>(null)

    const clientRef = useRef<RealtimeClient | null>(null)
    const sessionStartRef = useRef<number>(0)
    const router = useRouter()

    /**
     * Execute a tool call from the AI.
     * Tools like get_schedule, add_calendar_event call Wesley's API routes.
     * navigate_to performs client-side navigation.
     */
    const handleToolCall = useCallback(
        async (tool: ToolCallEvent): Promise<string> => {
            let args: Record<string, unknown> = {}
            try {
                args = JSON.parse(tool.arguments)
            } catch {
                return JSON.stringify({ error: "Invalid tool arguments" })
            }

            setCurrentAction(`Running ${tool.name}...`)

            try {
                switch (tool.name) {
                    case "navigate_to": {
                        const path = args.path as string | undefined
                        const page = args.page as string | undefined
                        const route = path || (page ? PAGE_ROUTES[page] : null)
                        if (route) {
                            router.push(route)
                            setCurrentAction(`Navigated to ${path || page}`)
                        }
                        return JSON.stringify({ success: true, navigated_to: route || page })
                    }

                    case "get_schedule": {
                        const startDate = (args.start_date as string) || new Date().toISOString()
                        const endDate =
                            (args.end_date as string) ||
                            new Date(new Date(startDate).getTime() + 24 * 60 * 60 * 1000).toISOString()

                        const res = await fetch(
                            `/api/calendar/events?start=${encodeURIComponent(startDate)}&end=${encodeURIComponent(endDate)}`
                        )
                        const events = await res.json()
                        // Summarize for voice: limit to first 10 events
                        const limited = Array.isArray(events) ? events.slice(0, 10) : events
                        return JSON.stringify(limited)
                    }

                    case "add_calendar_event": {
                        const res = await fetch("/api/calendar/events", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                title: args.title,
                                startAt: args.start_at,
                                endAt: args.end_at || null,
                                eventType: args.event_type || "meeting",
                                description: args.description || null,
                                courtName: args.court_name || null,
                                caseNumber: args.case_number || null,
                                allDay: args.all_day || false,
                                forceCreate: true, // Skip conflict check in voice mode
                            }),
                        })
                        const event = await res.json()
                        return JSON.stringify(event)
                    }

                    case "run_workflow": {
                        // Get workflow ID from type by matching title
                        const listRes = await fetch("/api/templates/list")
                        const templates = await listRes.json()
                        const workflowType = (args.workflow_type as string || "").toLowerCase().replace(/-/g, " ")
                        const workflow = Array.isArray(templates)
                            ? templates.find(
                                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                  (t: any) =>
                                      t.id === args.workflow_type ||
                                      t.title?.toLowerCase().includes(workflowType)
                              )
                            : null

                        if (!workflow) {
                            return JSON.stringify({
                                error: `Workflow '${args.workflow_type}' not found. Available workflows: ${Array.isArray(templates) ? templates.map((t: { title: string }) => t.title).join(', ') : 'none'}`,
                            })
                        }

                        // Fire the workflow (don't await the full AI execution — it runs async)
                        const runRes = await fetch("/api/templates/runs", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                workflowId: workflow.id,
                                inputData: args.inputs || {},
                            }),
                        })
                        const run = await runRes.json()
                        return JSON.stringify({
                            success: !run.error,
                            workflowName: workflow.title,
                            runId: run.id,
                            status: run.status,
                            message: run.error ? `Failed: ${run.error}` : `Started workflow '${workflow.title}'. It will complete in the background.`
                        })
                    }

                    case "search_documents": {
                        const res = await fetch("/api/documents/projects")
                        const projects = await res.json()
                        // Search across projects by title
                        const query = (args.query as string || "").toLowerCase()
                        const filtered = Array.isArray(projects)
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            ? projects.filter((p: any) =>
                                  p.title?.toLowerCase().includes(query) ||
                                  p.organization?.toLowerCase().includes(query) ||
                                  p.description?.toLowerCase().includes(query)
                              ).slice(0, 5)
                            : []
                        return JSON.stringify({
                            results: filtered,
                            count: filtered.length,
                            message: filtered.length > 0
                                ? `Found ${filtered.length} document(s) matching '${args.query}'.`
                                : `No documents found matching '${args.query}'.`
                        })
                    }

                    case "get_recent_chats": {
                        const typeParam = args.type ? `?type=${args.type}` : ""
                        const res = await fetch(`/api/recent-chats${typeParam}`)
                        const chats = await res.json()
                        const limited = Array.isArray(chats) ? chats.slice(0, 10) : chats
                        return JSON.stringify(limited)
                    }

                    case "read_document": {
                        const fileId = args.file_id as string
                        if (!fileId) {
                            return JSON.stringify({ error: "file_id is required" })
                        }
                        const res = await fetch(`/api/documents/${fileId}/text`)
                        const doc = await res.json()
                        // Truncate to ~2000 chars for voice summary
                        const text = doc.text
                            ? doc.text.substring(0, 2000) + (doc.text.length > 2000 ? "... [truncated]" : "")
                            : "No text content found."
                        return JSON.stringify({
                            fileName: doc.fileName,
                            text,
                            totalLength: doc.text?.length || 0,
                        })
                    }

                    case "start_new_chat": {
                        const title = (args.title as string) || "New Conversation"
                        // Create conversation via API
                        const res = await fetch("/api/chat/conversations", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                title,
                                type: "assistant",
                            }),
                        })
                        const conv = await res.json()
                        if (conv.id) {
                            // Navigate to the new chat
                            router.push(`/chat/${conv.id}`)
                            setCurrentAction(`Started new chat: ${title}`)
                        }
                        return JSON.stringify({
                            success: !!conv.id,
                            conversationId: conv.id,
                            title,
                            message: conv.id
                                ? `Created new conversation '${title}' and navigated to it.`
                                : `Failed to create conversation.`
                        })
                    }

                    case "open_conversation": {
                        const searchQuery = (args.search_query as string || "").toLowerCase()
                        // Search recent chats
                        const res = await fetch("/api/recent-chats")
                        const chats = await res.json()
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        const match = Array.isArray(chats) ? chats.find((c: any) =>
                            c.title?.toLowerCase().includes(searchQuery) ||
                            c.preview?.toLowerCase().includes(searchQuery)
                        ) : null

                        if (match) {
                            router.push(`/chat/${match.id}`)
                            setCurrentAction(`Opened: ${match.title}`)
                            return JSON.stringify({
                                success: true,
                                conversationId: match.id,
                                title: match.title,
                                message: `Opened conversation '${match.title}'.`
                            })
                        }
                        return JSON.stringify({
                            success: false,
                            message: `Could not find a conversation matching '${args.search_query}'. Try a different search term.`
                        })
                    }

                    case "save_memory": {
                        const content = args.content as string
                        if (!content) {
                            return JSON.stringify({ error: "content is required" })
                        }
                        const res = await fetch("/api/memory", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                content,
                                memoryType: args.memory_type || "fact",
                                source: "voice_agent",
                            }),
                        })
                        const mem = await res.json()
                        return JSON.stringify({
                            success: !mem.error,
                            message: mem.error ? `Failed to save: ${mem.error}` : `Saved to memory: "${content.substring(0, 50)}..."`
                        })
                    }

                    default:
                        return JSON.stringify({ error: `Unknown tool: ${tool.name}` })
                }
            } catch (err) {
                console.error(`[VoiceAgent] Tool ${tool.name} failed:`, err)
                return JSON.stringify({
                    error: `${tool.name} failed: ${err instanceof Error ? err.message : "Unknown error"}`,
                })
            } finally {
                // Clear action after a short delay
                setTimeout(() => setCurrentAction(null), 2000)
            }
        },
        [router]
    )

    /**
     * Start a new voice session.
     */
    const startSession = useCallback(async () => {
        // Check daily limit
        if (getDailyUsageMinutes() >= DAILY_LIMIT_MINUTES) {
            setError("Daily voice limit reached (45 min). Try again tomorrow or type your request.")
            return
        }

        setError(null)
        setTranscripts([])
        setState("connecting")

        try {
            // 1. Request microphone FIRST — must happen in the user gesture chain
            //    before any async network calls, or browsers will block it.
            let micStream: MediaStream
            try {
                // Check if mediaDevices API is available
                if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                    throw new Error(
                        "Your browser doesn't support microphone access. Try using Chrome or Edge."
                    )
                }

                console.log("[VoiceAgent] Requesting microphone access...")
                console.log("[VoiceAgent] Secure context:", window.isSecureContext)
                console.log("[VoiceAgent] URL:", window.location.href)

                micStream = await navigator.mediaDevices.getUserMedia({ audio: true })
                console.log("[VoiceAgent] Microphone access granted, tracks:", micStream.getAudioTracks().length)
            } catch (micErr) {
                console.error("[VoiceAgent] Microphone error details:", {
                    name: micErr instanceof DOMException ? micErr.name : "unknown",
                    message: micErr instanceof Error ? micErr.message : String(micErr),
                    isSecureContext: window.isSecureContext,
                    url: window.location.href,
                })
                if (micErr instanceof Error && micErr.message.includes("browser doesn't support")) {
                    throw micErr
                }
                if (micErr instanceof DOMException && micErr.name === "NotAllowedError") {
                    throw new Error(
                        "Microphone access denied. Please allow microphone permission in your browser settings, then refresh the page."
                    )
                }
                if (micErr instanceof DOMException && micErr.name === "NotFoundError") {
                    throw new Error(
                        "No microphone found. Please connect a microphone and try again."
                    )
                }
                throw new Error(
                    `Microphone error: ${micErr instanceof Error ? micErr.message : "Unknown error"}`
                )
            }

            // 2. Get ephemeral token from our server
            const sessionRes = await fetch("/api/voice/session", { method: "POST" })
            const sessionData = await sessionRes.json()

            if (!sessionData.success || !sessionData.data?.clientSecret) {
                // Clean up mic if session fails
                micStream.getTracks().forEach((t) => t.stop())
                throw new Error(sessionData.error?.message || "Failed to create voice session")
            }

            // 3. Create and connect the WebRTC client (pass pre-acquired mic stream)
            const client = new RealtimeClient({
                onStateChange: (newState) => {
                    setState(newState)
                    // Track usage when session ends
                    if (newState === "idle" && sessionStartRef.current > 0) {
                        const duration = (Date.now() - sessionStartRef.current) / 60_000
                        addDailyUsageMinutes(duration)
                        sessionStartRef.current = 0
                    }
                },
                onTranscript: (text, role) => {
                    setTranscripts((prev) => [...prev, { role, text }])
                },
                onToolCall: handleToolCall,
                onError: (errMsg) => {
                    setError(errMsg)
                },
            })

            clientRef.current = client
            sessionStartRef.current = Date.now()

            await client.connect(sessionData.data.clientSecret, micStream)
        } catch (err) {
            console.error("[VoiceAgent] Session start error:", err)
            setError(err instanceof Error ? err.message : "Failed to start voice session")
            setState("idle")
        }
    }, [handleToolCall])

    /**
     * Stop the current voice session.
     */
    const stopSession = useCallback(() => {
        if (clientRef.current) {
            clientRef.current.disconnect()
            clientRef.current = null
        }
        setState("idle")
        setCurrentAction(null)
    }, [])

    /**
     * Toggle voice feature enabled/disabled.
     */
    const toggleEnabled = useCallback(() => {
        setIsEnabled((prev) => {
            if (prev && clientRef.current) {
                // Turning off — disconnect any active session
                clientRef.current.disconnect()
                clientRef.current = null
                setState("idle")
            }
            return !prev
        })
    }, [])

    return (
        <VoiceContext.Provider
            value={{
                state,
                isEnabled,
                transcripts,
                error,
                startSession,
                stopSession,
                toggleEnabled,
                currentAction,
            }}
        >
            {children}
        </VoiceContext.Provider>
    )
}

export function useVoiceAgent() {
    return useContext(VoiceContext)
}
