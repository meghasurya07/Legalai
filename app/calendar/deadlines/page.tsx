import { auth0 } from "@/lib/auth/auth0";
import { redirect } from "next/navigation";
import { CalendarPage } from "@/components/calendar/calendar-page";

export default async function DeadlinesPage() {
    const session = await auth0.getSession();
    if (!session) redirect("/auth/login");

    return (
        <div className="flex flex-1 min-h-0 flex-col">
            <CalendarPage tab="deadlines" />
        </div>
    );
}
