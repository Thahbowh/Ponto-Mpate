import { Router } from "express";
import { handleSignedVoucherNotification } from "../lib/voucher";

// Where a real voucher provider would send its confirmation. Public, but every request must carry a
// valid HMAC signature over the raw body, so nobody can fake a confirmed payment.
const router = Router();

router.post("/vouchers", async (req, res, next) => {
  try {
    const raw: Buffer | undefined = (req as any).rawBody;
    if (!raw) {
      return res.status(400).json({ success: false, error: { message: "Invalid notification" } });
    }
    const out = await handleSignedVoucherNotification(raw, req.header("x-signature") ?? undefined);
    if (!out.ok) {
      return res.status(out.status).json({ success: false, error: { message: out.message } });
    }
    res.json({ success: true, data: out.result });
  } catch (err) {
    next(err);
  }
});

export default router;
