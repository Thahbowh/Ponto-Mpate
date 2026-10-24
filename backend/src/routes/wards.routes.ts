import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authenticate } from "../middleware/authenticate";
import { authorize } from "../middleware/authorize";

const router = Router();
router.use(authenticate);

const wardSchema = z.object({
  name: z.string().trim().min(2).max(100),
});

router.get("/", async (_req, res, next) => {
  try {
    const wards = await prisma.ward.findMany({ orderBy: { name: "asc" } });
    res.json({ success: true, data: wards });
  } catch (err) {
    next(err);
  }
});

router.post("/", authorize("ADMIN"), async (req, res, next) => {
  try {
    const { name } = wardSchema.parse(req.body);
    const existing = await prisma.ward.findFirst({ where: { name } });
    if (existing) {
      return res
        .status(409)
        .json({ success: false, error: { message: "A ward with that name already exists" } });
    }
    const ward = await prisma.ward.create({ data: { name } });
    res.status(201).json({ success: true, data: ward });
  } catch (err) {
    next(err);
  }
});

export default router;
