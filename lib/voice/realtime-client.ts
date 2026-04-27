/**
 * RealtimeClient — Manages WebRTC connection to OpenAI Realtime API.
 * 
 * This is a client-side class that:
 * 1. Establishes a WebRTC peer connection to OpenAI
 * 2. Streams microphone audio to the model
 * 3. Receives audio responses and plays them
 * 4. Handles tool calls via the data channel
 * 5. Manages session lifecycle (connect, disconnect, silence timeout)
 */

export type VoiceAgentState = "idle" | "connecting" | "listening" | "processing" | "speaking" | "error"

export interface ToolCallEvent {
    callId: string
    name: string
    arguments: string
}

export interface RealtimeClientOptions {
    onStateChange: (state: VoiceAgentState) => void
    onTranscript: (text: string, role: "user" | "assistant") => void
    onToolCall: (tool: ToolCallEvent) => Promise<string>
    onError: (error: string) => void
}

export class RealtimeClient {
    private pc: RTCPeerConnection | null = null
    private dc: RTCDataChannel | null = null
    private audioElement: HTMLAudioElement | null = null
    private mediaStream: MediaStream | null = null
    private silenceTimer: ReturnType<typeof setTimeout> | null = null
    private sessionTimer: ReturnType<typeof setTimeout> | null = null
    private options: RealtimeClientOptions

    // Track pending tool calls for batched response.create
    private pendingToolCalls = 0

    // Cost control
    private static readonly SILENCE_TIMEOUT_MS = 30_000 // Auto-disconnect after 30s silence
    private static readonly MAX_SESSION_MS = 5 * 60 * 1000 // Max 5 minute session

    constructor(options: RealtimeClientOptions) {
        this.options = options
    }

    /**
     * Connect to OpenAI Realtime API via WebRTC.
     * @param ephemeralToken - The client_secret from POST /api/voice/session
     * @param micStream - Pre-acquired microphone MediaStream (must be acquired in user gesture chain)
     */
    async connect(ephemeralToken: string, micStream: MediaStream): Promise<void> {
        this.options.onStateChange("connecting")

        try {
            // Create peer connection
            this.pc = new RTCPeerConnection()

            // Setup audio playback
            this.audioElement = document.createElement("audio")
            this.audioElement.autoplay = true
            this.pc.ontrack = (event) => {
                if (this.audioElement) {
                    this.audioElement.srcObject = event.streams[0]
                }
            }

            // Use the pre-acquired microphone stream
            this.mediaStream = micStream
            // Add mic track to connection
            this.pc.addTrack(this.mediaStream.getTracks()[0])

            // Setup data channel for events (tool calls, transcripts, etc.)
            this.dc = this.pc.createDataChannel("oai-events")
            this.setupDataChannelHandlers()

            // Create SDP offer
            const offer = await this.pc.createOffer()
            await this.pc.setLocalDescription(offer)

            // Exchange SDP with OpenAI
            const model = "gpt-4o-mini-realtime-preview"
            const sdpResponse = await fetch(
                `https://api.openai.com/v1/realtime?model=${model}`,
                {
                    method: "POST",
                    body: offer.sdp,
                    headers: {
                        Authorization: `Bearer ${ephemeralToken}`,
                        "Content-Type": "application/sdp",
                    },
                }
            )

            if (!sdpResponse.ok) {
                throw new Error(`WebRTC SDP exchange failed: ${sdpResponse.status}`)
            }

            const answerSdp = await sdpResponse.text()
            await this.pc.setRemoteDescription({
                type: "answer",
                sdp: answerSdp,
            })

            // Start session timer (max 5 minutes)
            this.sessionTimer = setTimeout(() => {
                console.log("[RealtimeClient] Max session duration reached, disconnecting")
                this.disconnect()
            }, RealtimeClient.MAX_SESSION_MS)

            // Start silence timer
            this.resetSilenceTimer()

            this.options.onStateChange("listening")
        } catch (err) {
            console.error("[RealtimeClient] Connection error:", err)
            this.options.onError(err instanceof Error ? err.message : "Connection failed")
            this.options.onStateChange("error")
            this.cleanup()
        }
    }

    /**
     * Disconnect and clean up all resources.
     */
    disconnect(): void {
        this.cleanup()
        this.options.onStateChange("idle")
    }

    /**
     * Send a tool call result back to the model.
     * Does NOT trigger response.create — that's done in response.done
     * after ALL tool results are submitted.
     */
    private sendToolResult(callId: string, output: string): void {
        if (!this.dc || this.dc.readyState !== "open") return

        this.dc.send(
            JSON.stringify({
                type: "conversation.item.create",
                item: {
                    type: "function_call_output",
                    call_id: callId,
                    output,
                },
            })
        )
    }

    /**
     * Trigger the model to generate a response.
     * Called once after ALL tool results are submitted.
     */
    private triggerResponse(): void {
        if (!this.dc || this.dc.readyState !== "open") return
        this.dc.send(JSON.stringify({ type: "response.create" }))
    }

    /**
     * Inject text history items into the conversation.
     * These are billed at TEXT token rates ($0.60/1M, cached at $0.30/1M).
     */
    injectTextHistory(
        items: Array<{ role: "user" | "assistant"; text: string }>
    ): void {
        if (!this.dc || this.dc.readyState !== "open") return

        for (const item of items) {
            this.dc.send(
                JSON.stringify({
                    type: "conversation.item.create",
                    item: {
                        type: "message",
                        role: item.role,
                        status: "completed",
                        content: [
                            {
                                type: item.role === "user" ? "input_text" : "text",
                                text: item.text,
                            },
                        ],
                    },
                })
            )
        }
    }

    // ── Private Methods ──────────────────────────────────────────────

    private setupDataChannelHandlers(): void {
        if (!this.dc) return

        this.dc.onopen = () => {
            console.log("[RealtimeClient] Data channel open")
            // Send session.update for settings not accepted by the REST endpoint
            this.dc?.send(
                JSON.stringify({
                    type: "session.update",
                    session: {
                        truncation: {
                            type: "retention_ratio",
                            retention_ratio: 0.8,
                        },
                    },
                })
            )
        }

        this.dc.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data)
                this.handleServerEvent(data)
            } catch (err) {
                console.error("[RealtimeClient] Failed to parse event:", err)
            }
        }

        this.dc.onclose = () => {
            console.log("[RealtimeClient] Data channel closed")
            this.cleanup()
            this.options.onStateChange("idle")
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private handleServerEvent(event: any): void {
        switch (event.type) {
            case "session.created":
            case "session.updated":
                console.log("[RealtimeClient] Session:", event.type)
                break

            case "input_audio_buffer.speech_started":
                this.options.onStateChange("listening")
                this.resetSilenceTimer()
                break

            case "input_audio_buffer.speech_stopped":
                this.options.onStateChange("processing")
                break

            case "conversation.item.input_audio_transcription.completed":
                if (event.transcript) {
                    this.options.onTranscript(event.transcript, "user")
                }
                break

            case "response.audio_transcript.delta":
                // Streaming assistant transcript — could update UI in real-time
                break

            case "response.audio_transcript.done":
                if (event.transcript) {
                    this.options.onTranscript(event.transcript, "assistant")
                }
                break

            case "response.audio.started":
                this.options.onStateChange("speaking")
                break

            case "response.audio.done":
                this.options.onStateChange("listening")
                this.resetSilenceTimer()
                break

            case "response.function_call_arguments.done":
                // Queue tool call — do NOT send response.create yet
                this.pendingToolCalls++
                this.handleToolCall(event)
                break

            case "response.done": {
                // Check usage for cost monitoring
                if (event.response?.usage) {
                    console.log("[RealtimeClient] Usage:", event.response.usage)
                }

                // If there were tool calls in this response, all results should be
                // submitted by now. Trigger a single response.create for the model
                // to generate its follow-up (spoken confirmation).
                if (this.pendingToolCalls > 0) {
                    // Small delay to ensure all tool result sends complete
                    setTimeout(() => {
                        if (this.pendingToolCalls <= 0) {
                            console.log("[RealtimeClient] All tool results submitted, triggering response")
                            this.triggerResponse()
                        }
                    }, 200)
                }
                break
            }

            case "error":
                console.error("[RealtimeClient] Server error:", event.error)
                this.options.onError(event.error?.message || "Server error")
                break
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private async handleToolCall(event: any): Promise<void> {
        const callId = event.call_id
        const name = event.name
        const args = event.arguments

        if (!callId || !name) {
            this.pendingToolCalls--
            return
        }

        this.options.onStateChange("processing")
        // Pause silence timer during tool execution — tools can take 10+ seconds
        this.pauseSilenceTimer()

        try {
            console.log(`[RealtimeClient] Executing tool: ${name}`)
            const result = await this.options.onToolCall({ callId, name, arguments: args })
            console.log(`[RealtimeClient] Tool ${name} completed`)
            this.sendToolResult(callId, result)
        } catch (err) {
            console.error("[RealtimeClient] Tool call error:", err)
            this.sendToolResult(
                callId,
                JSON.stringify({ error: "Tool execution failed" })
            )
        } finally {
            this.pendingToolCalls--
            // Resume silence timer after tool completes
            if (this.pendingToolCalls <= 0) {
                this.pendingToolCalls = 0
                this.resetSilenceTimer()
            }
        }
    }

    private pauseSilenceTimer(): void {
        if (this.silenceTimer) {
            clearTimeout(this.silenceTimer)
            this.silenceTimer = null
        }
    }

    private resetSilenceTimer(): void {
        if (this.silenceTimer) clearTimeout(this.silenceTimer)
        this.silenceTimer = setTimeout(() => {
            console.log("[RealtimeClient] Silence timeout, disconnecting")
            this.disconnect()
        }, RealtimeClient.SILENCE_TIMEOUT_MS)
    }

    private cleanup(): void {
        this.pendingToolCalls = 0
        if (this.silenceTimer) {
            clearTimeout(this.silenceTimer)
            this.silenceTimer = null
        }
        if (this.sessionTimer) {
            clearTimeout(this.sessionTimer)
            this.sessionTimer = null
        }
        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach((track) => track.stop())
            this.mediaStream = null
        }
        if (this.dc) {
            this.dc.close()
            this.dc = null
        }
        if (this.pc) {
            this.pc.close()
            this.pc = null
        }
        if (this.audioElement) {
            this.audioElement.srcObject = null
            this.audioElement = null
        }
    }
}
