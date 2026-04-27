"use client"

import { useVoiceAgent } from "@/context/voice-context"
import { Mic, X, Shield } from "lucide-react"
import { useState } from "react"

/**
 * VoiceEnableBanner — Shows a one-time opt-in banner for the voice agent.
 * 
 * Displays when:
 * - Voice is not yet enabled
 * - User hasn't dismissed the banner before
 * 
 * Includes privacy information so law firms feel comfortable enabling it.
 */
export function VoiceEnableBanner() {
    const { isEnabled, toggleEnabled } = useVoiceAgent()
    const [dismissed, setDismissed] = useState(() => {
        if (typeof window === "undefined") return true
        return !!localStorage.getItem("wesley_voice_banner_dismissed")
    })

    if (isEnabled || dismissed) return null

    const handleEnable = () => {
        toggleEnabled()
        localStorage.setItem("wesley_voice_banner_dismissed", "true")
        setDismissed(true)
    }

    const handleDismiss = () => {
        localStorage.setItem("wesley_voice_banner_dismissed", "true")
        setDismissed(true)
    }

    return (
        <div className="voice-banner">
            <div className="voice-banner__icon">
                <Mic size={20} />
            </div>

            <div className="voice-banner__content">
                <h4 className="voice-banner__title">
                    Try Wesley Voice Assistant
                </h4>
                <p className="voice-banner__description">
                    Talk to Wesley hands-free. Ask about your schedule, run workflows, or navigate the app — all by voice.
                </p>
                <div className="voice-banner__privacy">
                    <Shield size={12} />
                    <span>
                        Audio is only sent when you click the mic. No recordings are stored. Your chat history is sent as text only.
                    </span>
                </div>
            </div>

            <div className="voice-banner__actions">
                <button
                    className="voice-banner__enable"
                    onClick={handleEnable}
                >
                    Enable Voice
                </button>
                <button
                    className="voice-banner__dismiss"
                    onClick={handleDismiss}
                    title="Dismiss"
                >
                    <X size={16} />
                </button>
            </div>

            <style jsx>{`
                .voice-banner {
                    position: fixed;
                    bottom: 24px;
                    left: 50%;
                    transform: translateX(-50%);
                    z-index: 9997;
                    display: flex;
                    align-items: center;
                    gap: 16px;
                    background: hsl(240 6% 12% / 0.95);
                    backdrop-filter: blur(20px);
                    border: 1px solid hsl(250 20% 28%);
                    border-radius: 16px;
                    padding: 16px 20px;
                    max-width: 580px;
                    width: calc(100% - 48px);
                    box-shadow: 0 8px 40px rgba(0, 0, 0, 0.35),
                        0 0 0 1px hsla(250, 50%, 50%, 0.1);
                    animation: bannerSlideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1);
                }

                .voice-banner__icon {
                    width: 44px;
                    height: 44px;
                    border-radius: 12px;
                    background: linear-gradient(135deg, hsl(250 70% 55%), hsl(280 70% 55%));
                    color: white;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                }

                .voice-banner__content {
                    flex: 1;
                    min-width: 0;
                }

                .voice-banner__title {
                    font-size: 14px;
                    font-weight: 600;
                    color: hsl(0 0% 92%);
                    margin: 0 0 4px;
                }

                .voice-banner__description {
                    font-size: 12px;
                    color: hsl(0 0% 65%);
                    margin: 0 0 6px;
                    line-height: 1.4;
                }

                .voice-banner__privacy {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    font-size: 11px;
                    color: hsl(140 40% 55%);
                }

                .voice-banner__actions {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    flex-shrink: 0;
                }

                .voice-banner__enable {
                    padding: 8px 18px;
                    border-radius: 10px;
                    border: none;
                    background: linear-gradient(135deg, hsl(250 70% 55%), hsl(280 70% 55%));
                    color: white;
                    font-size: 13px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.15s ease;
                    white-space: nowrap;
                }

                .voice-banner__enable:hover {
                    transform: scale(1.03);
                    box-shadow: 0 4px 16px hsla(260, 60%, 50%, 0.3);
                }

                .voice-banner__dismiss {
                    width: 32px;
                    height: 32px;
                    border-radius: 8px;
                    border: none;
                    background: transparent;
                    color: hsl(0 0% 50%);
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.15s ease;
                }

                .voice-banner__dismiss:hover {
                    background: hsl(0 0% 20%);
                    color: hsl(0 0% 80%);
                }

                @keyframes bannerSlideUp {
                    from {
                        opacity: 0;
                        transform: translateX(-50%) translateY(20px);
                    }
                    to {
                        opacity: 1;
                        transform: translateX(-50%) translateY(0);
                    }
                }
            `}</style>
        </div>
    )
}
