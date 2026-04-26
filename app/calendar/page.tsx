import { auth0 } from "@/lib/auth/auth0";
import { redirect } from "next/navigation";

export default async function CalendarPage() {
    const session = await auth0.getSession();
    if (!session) redirect("/auth/login");

    redirect("/calendar/schedule");
}
