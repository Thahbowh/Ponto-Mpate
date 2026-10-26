import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authenticate } from "../middleware/authenticate";
import { authorize } from "../middleware/authorize";
import { newHouseholdReference } from "../lib/voucher";

const router = Router();
router.use(authenticate);

// The reference is never typed in: it is created automatically for every new household.
const householdSchema = z.object({
  householdName: z.string().trim().min(2).max(120),
  wardId: z.string().min(1),
  houseNumber: z
    .string()
    .trim()
    .min(1, "Enter the house number")
    .max(20, "Use at most 20 characters")
    .regex(/^[A-Za-z0-9 \/.\-]+$/, "Use letters, numbers, spaces, / or - only"),
});

router.get("/", async (req, res, next) => {
  try {
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
    const digits = search.replace(/\s/g, "");
    const wardId = typeof req.query.wardId === "string" ? req.query.wardId : undefined;

    const households = await prisma.household.findMany({
      where: {
        ...(wardId ? { wardId } : {}),
        ...(search
          ? {
              OR: [
                { householdName: { contains: search } },
                { houseNumber: { contains: search } },
                { reference: { contains: digits } },
              ],
            }
          : {}),
      },
      include: { ward: { select: { id: true, name: true } } },
      orderBy: { reference: "asc" },
      take: 200,
    });
    res.json({ success: true, data: households });
  } catch (err) {
    next(err);
  }
});

router.post("/", authorize("ADMIN"), async (req, res, next) => {
  try {
    const input = householdSchema.parse(req.body);

    const ward = await prisma.ward.findUnique({ where: { id: input.wardId } });
    if (!ward || !ward.isActive) {
      return res
        .status(400)
        .json({ success: false, error: { message: "Ward does not exist or is inactive" } });
    }

    const duplicate = await prisma.household.findFirst({
      where: { householdName: input.householdName, wardId: input.wardId },
    });
    if (duplicate) {
      return res.status(409).json({
        success: false,
        error: { message: "This household is already registered in that ward" },
      });
    }

    const household = await prisma.household.create({
      data: {
        householdName: input.householdName,
        wardId: input.wardId,
        houseNumber: input.houseNumber,
        reference: await newHouseholdReference(),
      },
      include: { ward: { select: { id: true, name: true } } },
    });
    res.status(201).json({ success: true, data: household });
  } catch (err) {
    next(err);
  }
});

export default router;
