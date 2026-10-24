import { Router } from "express";
import { handleSignedNotification } from "../lib/onlinePayments";

// Where a real payment provider would send its result. Public, but every request must carry a valid
// HMAC signature over the raw body, so nobody can fake a successful payment.
const router = Router();

router.post("/payments", async (req, res, next) => {
  try {
    const raw: Buffer | undefined = (req as any).rawBody;
    if (!raw) {
      return res.status(400).json({ success: false, error: { message: "Invalid notification" } });
    }
    const out = await handleSignedNotification(raw, req.header("x-signature") ?? undefined);
    if (!out.ok) {
      return res.status(out.status).json({ success: false, error: { message: out.message } });
    }
    res.json({ success: true, data: out.result });
  } catch (err) {
    next(err);
  }
});

export default router;
