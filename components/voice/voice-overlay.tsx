"use client"

import { useVoiceAgent } from "@/context/voice-context"
import { Mic, MicOff, Loader2, Volume2, X, AlertCircle } from "lucide-react"
import { useEffect, useState } from "react"

/**
 * VoiceOverlay — Floating voice agent UI that appears on every page.
 * 
 * States:
 * - idle: Small mic button in bottom-right
 * - connecting: Pulsing animation, "Connecting..."
 * - listening: Expanding rings, "Listening..."
 * - processing: Thinking animation, "Processing..."
 * - speaking: Sound wave animation, shows transcript
 * - error: Error message with retry option
 */
export function VoiceOverlay() {
    const {
        state,
        isEnabled,
        transcripts,
        error,
        startSession,
        stopSession,
        toggleEnabled,
        currentAction,
    } = useVoiceAgent()

    const [showTranscript, setShowTranscript] = useState(false)
    const [delayedIdle, setDelayedIdle] = useState(true)

    // Delay the collapse so the UI animates out smoothly
    useEffect(() => {
        if (state !== "idle") {
            const timer = setTimeout(() => setDelayedIdle(false), 0)
            return () => clearTimeout(timer)
        }
        const timer = setTimeout(() => setDelayedIdle(true), 500)
        return () => clearTimeout(timer)
    }, [state])

    const isExpanded = state !== "idle" || !delayedIdle

    // Don't render if voice is not enabled
    if (!isEnabled) {
        return (
            <button
                onClick={toggleEnabled}
                className="voice-fab voice-fab--inactive"
                title="Enable Wesley Voice Agent"
                aria-label="Enable Wesley Voice Agent"
            >
                <MicOff size={20} />
            </button>
        )
    }

    const isActive = state !== "idle"
    const lastTranscript = transcripts[transcripts.length - 1]

    return (
        <>
            {/* Backdrop when expanded */}
            {isExpanded && state !== "idle" && (
                <div
                    className="voice-backdrop"
                    onClick={stopSession}
                    aria-hidden="true"
                />
            )}

            {/* Main voice overlay */}
            <div className={`voice-overlay ${isExpanded ? "voice-overlay--expanded" : ""}`}>
                {/* Error display */}
                {error && (
                    <div className="voice-error">
                        <AlertCircle size={14} />
                        <span>{error}</span>
                    </div>
                )}

                {/* Current action */}
                {currentAction && (
                    <div className="voice-action">
                        <Loader2 size={14} className="voice-spin" />
                        <span>{currentAction}</span>
                    </div>
                )}

                {/* Transcript display */}
                {isExpanded && showTranscript && transcripts.length > 0 && (
                    <div className="voice-transcripts">
                        {transcripts.slice(-4).map((t, i) => (
                            <div
                                key={i}
                                className={`voice-transcript voice-transcript--${t.role}`}
                            >
                                <span className="voice-transcript__role">
                                    {t.role === "user" ? "You" : "Wesley"}:
                                </span>{" "}
                                {t.text}
                            </div>
                        ))}
                    </div>
                )}

                {/* Last transcript preview */}
                {isExpanded && !showTranscript && lastTranscript && (
                    <button
                        className="voice-last-transcript"
                        onClick={() => setShowTranscript(true)}
                    >
                        <span className="voice-transcript__role">
                            {lastTranscript.role === "user" ? "You" : "Wesley"}:
                        </span>{" "}
                        {lastTranscript.text.substring(0, 80)}
                        {lastTranscript.text.length > 80 ? "..." : ""}
                    </button>
                )}

                {/* State label */}
                {isActive && (
                    <div className="voice-state-label">
                        {state === "connecting" && "Connecting..."}
                        {state === "listening" && "Listening..."}
                        {state === "processing" && "Thinking..."}
                        {state === "speaking" && "Wesley is speaking"}
                        {state === "error" && "Error occurred"}
                    </div>
                )}

                {/* Control buttons */}
                <div className="voice-controls">
                    {/* Toggle transcript visibility */}
                    {isActive && transcripts.length > 0 && (
                        <button
                            className="voice-btn voice-btn--small"
                            onClick={() => setShowTranscript(!showTranscript)}
                            title={showTranscript ? "Hide transcript" : "Show transcript"}
                        >
                            {showTranscript ? "Hide" : "Show"} transcript
                        </button>
                    )}

                    {/* Main mic button */}
                    {!isActive ? (
                        <button
                            className="voice-fab voice-fab--active"
                            onClick={startSession}
                            title="Start voice session"
                            aria-label="Start voice session with Wesley"
                        >
                            <Mic size={22} />
                        </button>
                    ) : (
                        <button
                            className={`voice-fab voice-fab--live voice-fab--${state}`}
                            onClick={stopSession}
                            title="Stop voice session"
                            aria-label="Stop voice session"
                        >
                            {state === "connecting" && <Loader2 size={22} className="voice-spin" />}
                            {state === "listening" && <Mic size={22} />}
                            {state === "processing" && <Loader2 size={22} className="voice-spin" />}
                            {state === "speaking" && <Volume2 size={22} />}
                            {state === "error" && <AlertCircle size={22} />}
                        </button>
                    )}

                    {/* Disable voice */}
                    {!isActive && (
                        <button
                            className="voice-btn voice-btn--disable"
                            onClick={toggleEnabled}
                            title="Disable voice agent"
                        >
                            <X size={14} />
                        </button>
                    )}
                </div>
            </div>

            <style jsx>{`
                .voice-backdrop {
                    position: fixed;
                    inset: 0;
                    z-index: 9998;
                    background: rgba(0, 0, 0, 0.15);
                    backdrop-filter: blur(2px);
                    animation: voiceFadeIn 0.2s ease;
                }

                .voice-overlay {
                    position: fixed;
                    bottom: 24px;
                    right: 24px;
                    z-index: 9999;
                    display: flex;
                    flex-direction: column;
                    align-items: flex-end;
                    gap: 8px;
                    transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
                }

                .voice-overlay--expanded {
                    bottom: 32px;
                    right: 32px;
                }

                /* FAB (Floating Action Button) */
                .voice-fab {
                    width: 52px;
                    height: 52px;
                    border-radius: 50%;
                    border: none;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.2s ease;
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
                }

                .voice-fab--inactive {
                    position: fixed;
                    bottom: 24px;
                    right: 24px;
                    z-index: 9999;
                    background: hsl(240 5% 20%);
                    color: hsl(240 5% 60%);
                    width: 44px;
                    height: 44px;
                    opacity: 0.6;
                }

                .voice-fab--inactive:hover {
                    opacity: 1;
                    background: hsl(240 5% 25%);
                    color: hsl(240 5% 80%);
                    transform: scale(1.05);
                }

                .voice-fab--active {
                    background: linear-gradient(135deg, hsl(250 70% 55%), hsl(280 70% 55%));
                    color: white;
                }

                .voice-fab--active:hover {
                    transform: scale(1.08);
                    box-shadow: 0 6px 28px rgba(120, 80, 220, 0.35);
                }

                .voice-fab--live {
                    width: 60px;
                    height: 60px;
                    color: white;
                    animation: voicePulse 2s ease-in-out infinite;
                }

                .voice-fab--listening {
                    background: linear-gradient(135deg, hsl(140 70% 45%), hsl(160 70% 45%));
                    box-shadow: 0 0 0 0 hsla(150, 70%, 45%, 0.4);
                    animation: voicePulseRings 1.5s ease-in-out infinite;
                }

                .voice-fab--processing {
                    background: linear-gradient(135deg, hsl(40 80% 50%), hsl(30 80% 50%));
                }

                .voice-fab--speaking {
                    background: linear-gradient(135deg, hsl(250 70% 55%), hsl(280 70% 55%));
                    animation: voiceSpeaking 0.8s ease-in-out infinite;
                }

                .voice-fab--connecting,
                .voice-fab--error {
                    background: hsl(240 5% 25%);
                }

                /* State label */
                .voice-state-label {
                    background: hsl(240 5% 15% / 0.9);
                    backdrop-filter: blur(12px);
                    color: hsl(0 0% 85%);
                    padding: 6px 14px;
                    border-radius: 20px;
                    font-size: 12px;
                    font-weight: 500;
                    letter-spacing: 0.02em;
                    animation: voiceSlideUp 0.2s ease;
                    border: 1px solid hsl(240 5% 22%);
                }

                /* Transcripts */
                .voice-transcripts {
                    background: hsl(240 5% 12% / 0.95);
                    backdrop-filter: blur(16px);
                    border-radius: 16px;
                    padding: 12px;
                    max-width: 340px;
                    max-height: 200px;
                    overflow-y: auto;
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                    animation: voiceSlideUp 0.3s ease;
                    border: 1px solid hsl(240 5% 20%);
                }

                .voice-transcript {
                    font-size: 13px;
                    line-height: 1.5;
                    color: hsl(0 0% 80%);
                }

                .voice-transcript--assistant {
                    color: hsl(250 70% 75%);
                }

                .voice-transcript__role {
                    font-weight: 600;
                    font-size: 11px;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    opacity: 0.7;
                }

                .voice-last-transcript {
                    background: hsl(240 5% 15% / 0.85);
                    backdrop-filter: blur(12px);
                    border: 1px solid hsl(240 5% 22%);
                    border-radius: 12px;
                    padding: 8px 12px;
                    max-width: 300px;
                    font-size: 12px;
                    color: hsl(0 0% 75%);
                    cursor: pointer;
                    text-align: left;
                    animation: voiceSlideUp 0.2s ease;
                }

                .voice-last-transcript:hover {
                    background: hsl(240 5% 18% / 0.9);
                }

                /* Error */
                .voice-error {
                    background: hsl(0 60% 20% / 0.9);
                    backdrop-filter: blur(12px);
                    border: 1px solid hsl(0 50% 35%);
                    color: hsl(0 80% 80%);
                    padding: 8px 14px;
                    border-radius: 12px;
                    font-size: 12px;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    max-width: 300px;
                    animation: voiceSlideUp 0.2s ease;
                }

                /* Action indicator */
                .voice-action {
                    background: hsl(250 30% 18% / 0.9);
                    backdrop-filter: blur(12px);
                    border: 1px solid hsl(250 30% 30%);
                    color: hsl(250 60% 80%);
                    padding: 6px 12px;
                    border-radius: 12px;
                    font-size: 12px;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    animation: voiceSlideUp 0.2s ease;
                }

                /* Controls */
                .voice-controls {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }

                .voice-btn {
                    border: none;
                    cursor: pointer;
                    transition: all 0.15s ease;
                }

                .voice-btn--small {
                    background: hsl(240 5% 18%);
                    color: hsl(0 0% 70%);
                    padding: 4px 10px;
                    border-radius: 12px;
                    font-size: 11px;
                }

                .voice-btn--small:hover {
                    background: hsl(240 5% 25%);
                    color: white;
                }

                .voice-btn--disable {
                    width: 28px;
                    height: 28px;
                    border-radius: 50%;
                    background: hsl(240 5% 20%);
                    color: hsl(240 5% 50%);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 0;
                }

                .voice-btn--disable:hover {
                    background: hsl(0 50% 30%);
                    color: hsl(0 80% 80%);
                }

                /* Animations */
                .voice-spin {
                    animation: voiceSpin 1s linear infinite;
                }

                @keyframes voiceSpin {
                    to { transform: rotate(360deg); }
                }

                @keyframes voicePulse {
                    0%, 100% { transform: scale(1); }
                    50% { transform: scale(1.04); }
                }

                @keyframes voicePulseRings {
                    0% { box-shadow: 0 0 0 0 hsla(150, 70%, 45%, 0.5); }
                    70% { box-shadow: 0 0 0 16px hsla(150, 70%, 45%, 0); }
                    100% { box-shadow: 0 0 0 0 hsla(150, 70%, 45%, 0); }
                }

                @keyframes voiceSpeaking {
                    0%, 100% { transform: scale(1); }
                    50% { transform: scale(1.06); }
                }

                @keyframes voiceFadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }

                @keyframes voiceSlideUp {
                    from { opacity: 0; transform: translateY(8px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </>
    )
}
