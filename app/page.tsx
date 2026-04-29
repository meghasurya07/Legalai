import { auth0 } from "@/lib/auth/auth0";
import { ChatInterface } from "@/components/chat/chat-interface";
import { redirect } from "next/navigation";
import { getOrgContext } from "@/lib/get-org-context";

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

    // Check if the user's org context requires a redirect (e.g., SSO seat limit)
    const orgCtx = await getOrgContext();
    if (orgCtx?.redirectTo) {
        redirect(orgCtx.redirectTo);
    }

    if (chatId) {
        redirect(`/chat/${chatId}`);
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

