import { redirect } from "next/navigation"
import { isFirmAdmin } from "@/lib/auth/get-user-role"

export default async function OrganizationLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Enterprise RBAC: Strict Route Guard
  const hasAccess = await isFirmAdmin();

  if (!hasAccess) {
    // If the user attempts to hit the route manually without the role, strictly kick them out
    redirect("/")
  }

  return <>{children}</>
}
