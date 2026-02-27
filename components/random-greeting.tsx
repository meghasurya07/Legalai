"use client"

import * as React from "react"

const GENERIC_GREETINGS = [
    "How can I assist you today?",
    "What legal question is on your mind?",
    "Ready to help with your legal research.",
    "Let's dive into your legal matter.",
    "What would you like to explore today?",
]

function getGreetings(name?: string | null): string[] {
    if (name) {
        return [
            ...GENERIC_GREETINGS,
            `Welcome back, ${name}!`,
            `Good to see you, ${name}. How can I help?`,
            `Hi ${name}, what are we working on today?`,
            `Hello ${name}, ready to assist you.`,
            `Hey ${name}, what can I help you with?`,
        ]
    }
    return [
        ...GENERIC_GREETINGS,
        "Ask me anything about your case.",
        "How can I support your legal work?",
        "Need help analyzing a legal document?",
        "Let's tackle your legal questions together.",
        "What can I help you research today?",
    ]
}

export default function RandomGreeting() {
    const [greeting] = React.useState(() => {
        const cachedName = localStorage.getItem('vault_user_name')
        const greetings = getGreetings(cachedName)
        return greetings[Math.floor(Math.random() * greetings.length)]
    })

    // Sync localStorage cache in background for next visit
    React.useEffect(() => {
        fetch('/api/user/settings')
            .then(res => res.json())
            .then(data => {
                if (data.success && data.data?.user_name) {
                    localStorage.setItem('vault_user_name', data.data.user_name)
                } else {
                    localStorage.removeItem('vault_user_name')
                }
            })
            .catch(() => { })
    }, [])

    return <>{greeting}</>
}
