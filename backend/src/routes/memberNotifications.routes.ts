import { Router } from "express";
import { prisma } from "../lib/prisma";

// A member's own messages. Mounted behind authenticate + authorize("MEMBER").
const router = Router();

router.get("/", async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const [rows, unread] = await Promise.all([
      prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { event: { select: { reference: true } } },
      }),
      prisma.notification.count({ where: { userId, readAt: null } }),
    ]);
    res.json({
      success: true,
      data: {
        unread,
        items: rows.map((n) => ({
          id: n.id,
          title: n.title,
          message: n.message,
          createdAt: n.createdAt,
          read: n.readAt !== null,
          event: n.event?.reference ?? null,
        })),
      },
    });
  } catch (err) {
    next(err);
  }
});

router.post("/:id/read", async (req, res, next) => {
  try {
    await prisma.notification.updateMany({
      where: { id: req.params.id, userId: req.user!.id, readAt: null },
      data: { readAt: new Date() },
    });
    res.json({ success: true, data: { id: req.params.id, read: true } });
  } catch (err) {
    next(err);
  }
});

export default router;
