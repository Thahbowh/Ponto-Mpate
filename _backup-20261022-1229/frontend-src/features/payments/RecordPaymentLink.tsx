import { Link } from "@tanstack/react-router";
import { useAuth } from "@/features/auth/AuthContext";

export function RecordPaymentLink({
  eventId,
  householdId,
  status,
  eventStatus,
}: {
  eventId: string;
  householdId: string;
  status: string;
  eventStatus: string;
}) {
  const { isAdmin } = useAuth();
  if (!isAdmin || eventStatus !== "ACTIVE" || status === "PAID") return null;
  return (
    <Link
      to="/record"
      search={{ eventId, householdId }}
      className="text-sm font-semibold text-ink underline decoration-gold decoration-2 underline-offset-4"
    >
      Record payment
    </Link>
  );
}
