import express from "express";
import cors from "cors";
import { authenticate } from "./middleware/authenticate";
import { authorize } from "./middleware/authorize";
import { authLimiter, ussdLimiter } from "./lib/limiters";
import authRoutes from "./routes/auth.routes";
import memberAuthRoutes from "./routes/memberAuth.routes";
import wardRoutes from "./routes/wards.routes";
import householdRoutes from "./routes/households.routes";
import eventRoutes from "./routes/events.routes";
import paymentRoutes from "./routes/payments.routes";
import closeRoutes from "./routes/close.routes";
import receiptRoutes from "./routes/receipts.routes";
import dashboardRoutes from "./routes/dashboard.routes";
import reconciliationRoutes from "./routes/reconciliation.routes";
import insightsRoutes from "./routes/insights.routes";
import membershipRoutes from "./routes/membership.routes";
import memberRoutes from "./routes/member.routes";
import webhookRoutes from "./routes/webhooks.routes";
import voucherWebhookRoutes from "./routes/voucherWebhook.routes";
import ussdRoutes from "./routes/ussd.routes";
import voucherRoutes from "./routes/vouchers.routes";
import { errorHandler } from "./middleware/errorHandler";

const app = express();

app.set("trust proxy", 1); // one proxy in front (for example the hosting platform)
app.use(cors({ origin: true })); // tighten to your Netlify URL before the demo
app.use(
  express.json({
    limit: "100kb",
    // Keep the exact bytes so webhook signatures can be verified
    verify: (req, _res, buf) => {
      (req as any).rawBody = buf;
    },
  })
);
app.use(express.urlencoded({ extended: false, limit: "20kb" }));

app.get("/", (_req, res) => res.send("Ponto Mpate API is running"));
app.get("/api/v1/health", (_req, res) => res.json({ success: true, status: "ok" }));

// Staff screens: administrators and viewers only. Members can never reach these.
const staffOnly = [authenticate, authorize("ADMIN", "VIEWER")];

app.use("/api/v1/auth", authLimiter);
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/auth", memberAuthRoutes);

app.use("/api/v1/wards", staffOnly, wardRoutes);
app.use("/api/v1/households", staffOnly, householdRoutes);
app.use("/api/v1/funeral-events", staffOnly, eventRoutes);
app.use("/api/v1/funeral-events", staffOnly, paymentRoutes);
app.use("/api/v1/funeral-events", staffOnly, closeRoutes);
app.use("/api/v1/receipts", staffOnly, receiptRoutes);
app.use("/api/v1/dashboard", staffOnly, dashboardRoutes);
app.use("/api/v1/reconciliation", staffOnly, reconciliationRoutes);
app.use("/api/v1/insights", staffOnly, insightsRoutes);
app.use("/api/v1/membership-requests", staffOnly, membershipRoutes);
app.use("/api/v1/vouchers", staffOnly, voucherRoutes);

// Member portal: members only, and only their own household's data
app.use("/api/v1/member", authenticate, authorize("MEMBER"), memberRoutes);

// Provider notifications (signature checked inside) and the demo USSD service
app.use("/api/v1/webhooks", webhookRoutes);
app.use("/api/v1/webhooks", voucherWebhookRoutes);
app.use("/api/v1/ussd", ussdLimiter, ussdRoutes);

app.use(errorHandler);

export default app;
