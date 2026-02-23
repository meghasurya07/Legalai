import { auth0 } from "@/lib/auth0";
import { ChatInterface } from "@/components/chat-interface";
import { redirect } from "next/navigation";

export default async function AppPage({
    searchParams
}: {
    searchParams: Promise<{ chatId?: string }>
}) {
    const session = await auth0.getSession();
    const { chatId } = await searchParams;

    if (!session) {
        redirect("/auth/login");
    }

    return (
        <div className="flex flex-1 min-h-0 flex-col">
            <ChatInterface
                initialConversationId={chatId || undefined}
                conversationType="assistant"
            />
        </div>
    );
}
