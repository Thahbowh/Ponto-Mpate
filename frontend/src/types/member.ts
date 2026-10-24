import type { ObligationStatus } from "./api";

export interface MemberWard {
  id: string;
  name: string;
  registeredHouseholds: number;
  activeHouseholds: number;
  memberAccounts: number;
}

export interface MemberMe {
  user: { id: string; name: string; email: string; role: string };
  membership: null | {
    status: "PENDING" | "APPROVED" | "REJECTED";
    requestedAt: string;
    household: {
      reference: string;
      householdName: string | null;
      ward: { id: string; name: string };
    };
  };
}

export interface MemberContributionItem {
  obligationId: string;
  event: { id: string; reference: string; title: string; eventDate: string; status: string };
  amountDue: string;
  amountPaid: string;
  outstanding: string;
  status: ObligationStatus;
  canPay: boolean;
  pendingCheckout: string | null;
  payReference: string | null;
}

export interface MemberContributions {
  approved: boolean;
  household?: { reference: string; householdName: string; ward: { id: string; name: string } };
  summary: { due: string; paid: string; outstanding: string; contributionsOutstanding: number } | null;
  items: MemberContributionItem[];
}

export interface MemberPayments {
  approved: boolean;
  payments: {
    receiptNumber: string | null;
    amount: string;
    method: string;
    paidAt: string;
    event: { reference: string; title: string };
  }[];
  attempts: {
    reference: string;
    amount: string;
    status: "PENDING" | "FAILED" | "CANCELLED";
    createdAt: string;
    event: { reference: string; title: string };
  }[];
}

export interface Checkout {
  reference: string;
  amount: string;
  status: "PENDING" | "SUCCESSFUL" | "FAILED" | "CANCELLED";
  mode: string;
  event: { reference: string; title: string };
  receiptNumber?: string | null;
}

export interface DemoPayResult {
  reference: string;
  status: string;
  receiptNumber: string | null;
  outcome: string;
}

export interface JoinRequest {
  id: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  requestedAt: string;
  decidedAt: string | null;
  user: { name: string; email: string };
  household: { reference: string; householdName: string; ward: { name: string } };
}

