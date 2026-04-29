import { logger } from '@/lib/logger'
import { NextResponse } from "next/server"
import { requireAuth } from '@/lib/auth/require-auth'
import { apiError } from "@/lib/api-utils"
import { buildUserContext } from "@/lib/voice/user-context"
import { WESLEY_VOICE_SYSTEM_PROMPT } from "@/lib/voice/voice-prompt"
import { WESLEY_VOICE_TOOLS } from "@/lib/voice/agent-tools"

/**
 * POST /api/voice/session
 * 
 * Mints an ephemeral token from OpenAI for the Realtime API WebRTC connection.
 * Also fetches user context from Supabase to inject as text into the session.
 * 
 * The ephemeral token expires in 60 seconds — browser must use it immediately.
 */
export async function POST() {
    try {
        const auth = await requireAuth()
        if (auth instanceof Response) return auth
        const { userId } = auth

        // Resolve org context
        let orgId: string | undefined
        try {
            const { data: userSettings } = await (await import("@/lib/supabase/server")).supabase
                .from("user_settings")
                .select("default_org_id")
                .eq("user_id", userId)
                .single()
            if (userSettings?.default_org_id) orgId = userSettings.default_org_id
        } catch {
            // user_settings row might not exist
        }

        // Build user context from Supabase (calendar, chats, memories)
        const userContext = await buildUserContext(userId, orgId)

        // Combine system prompt with user context and today's date
        const today = new Date()
        const dateContext = `\nCURRENT DATE AND TIME: ${today.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} ${today.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' })}\nToday's ISO date: ${today.toISOString().split('T')[0]}`
        const fullInstructions = `${WESLEY_VOICE_SYSTEM_PROMPT}\n${dateContext}\n\n${userContext}`

        // Mint ephemeral token from OpenAI Realtime API
        // NOTE: Only include parameters accepted by the REST session endpoint.
        // truncation and modalities are set via session.update on the data channel after connecting.
        const openaiResponse = await fetch("https://api.openai.com/v1/realtime/sessions", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: "gpt-4o-mini-realtime-preview",
                modalities: ["audio", "text"],
                voice: "coral",
                instructions: fullInstructions,
                tools: WESLEY_VOICE_TOOLS,
                input_audio_transcription: {
                    model: "whisper-1",
                },
                turn_detection: {
                    type: "server_vad",
                    threshold: 0.5,
                    prefix_padding_ms: 300,
                    silence_duration_ms: 1500,
                },
                max_response_output_tokens: 1024,
            }),
        })

        if (!openaiResponse.ok) {
            const errorBody = await openaiResponse.text()
            logger.error("voice", `OpenAI error: ${openaiResponse.status}`, errorBody)
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        message: `OpenAI returned ${openaiResponse.status}`,
                        details: errorBody,
                    },
                },
                { status: openaiResponse.status }
            )
        }

        const sessionData = await openaiResponse.json()

        return NextResponse.json({
            success: true,
            data: {
                // The ephemeral token for WebRTC connection (expires in 60s)
                clientSecret: sessionData.client_secret?.value,
                // Session metadata
                sessionId: sessionData.id,
                model: sessionData.model,
                voice: sessionData.voice,
                // User context for client-side history injection
                userId,
                orgId,
            },
        })
    } catch (err) {
        logger.error('voice/session', 'Failed to create voice session', err)
        return apiError("Failed to create voice session", 500, err)
    }
}