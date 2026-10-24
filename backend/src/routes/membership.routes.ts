import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { prisma } from "../lib/prisma";
import { authenticate } from "../middleware/authenticate";
import { authorize } from "../middleware/authorize";

// Staff view of join requests. Mounted behind staff-only access.
const router = Router();
router.use(authenticate);

router.get("/", async (req, res, next) => {
  try {
    const q = req.query.status;
    const status = q === "APPROVED" || q === "REJECTED" ? q : "PENDING";
    const rows = await prisma.householdMember.findMany({
      where: { status },
      orderBy: { requestedAt: "asc" },
      take: 200,
      include: {
        user: { select: { name: true, email: true } },
        household: {
          select: { reference: true, householdName: true, ward: { select: { name: true } } },
        },
      },
    });
    res.json({
      success: true,
      data: rows.map((r) => ({
        id: r.id,
        status: r.status,
        requestedAt: r.requestedAt,
        decidedAt: r.decidedAt,
        user: r.user,
        household: r.household,
      })),
    });
  } catch (err) {
    next(err);
  }
});

const decide = (status: "APPROVED" | "REJECTED") => async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id;
    const result = await prisma.householdMember.updateMany({
      where: { id, status: "PENDING" },
      data: { status, decidedAt: new Date() },
    });
    if (result.count === 0) {
      return res.status(409).json({
        success: false,
        error: { message: "This request does not exist or has already been decided." },
      });
    }
    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: status === "APPROVED" ? "MEMBERSHIP_APPROVED" : "MEMBERSHIP_REJECTED",
        entityType: "HouseholdMember",
        entityId: id,
      },
    });
    res.json({ success: true, data: { id, status } });
  } catch (err) {
    next(err);
  }
};

router.post("/:id/approve", authorize("ADMIN"), decide("APPROVED"));
router.post("/:id/reject", authorize("ADMIN"), decide("REJECTED"));

export default router;
