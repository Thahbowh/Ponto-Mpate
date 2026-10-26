import { Router } from "express";
import { prisma } from "../lib/prisma";
import { authenticate } from "../middleware/authenticate";

const router = Router();
router.use(authenticate);

router.get("/:id", async (req, res, next) => {
  try {
    const key = req.params.id;
    const receipt = await prisma.receipt.findFirst({
      where: { OR: [{ id: key }, { reference: key }] },
      include: {
        payment: {
          include: {
            recordedBy: { select: { name: true } },
            obligation: {
              include: {
                household: {
                  select: {
                    reference: true,
                    householdName: true,
                    ward: { select: { name: true } },
                  },
                },
                event: { select: { reference: true, title: true, eventDate: true } },
              },
            },
          },
        },
      },
    });
    if (!receipt) {
      return res.status(404).json({ success: false, error: { message: "Receipt not found" } });
    }

    const p = receipt.payment;
    res.json({
      success: true,
      data: {
        receiptNumber: receipt.reference,
        issuedAt: receipt.issuedAt,
        amount: p.amount.toFixed(2),
        method: p.method,
        paidAt: p.paidAt,
        recordedBy: p.recordedBy.name,
        household: p.obligation.household,
        event: p.obligation.event,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
