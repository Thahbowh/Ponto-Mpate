import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { prisma } from "../lib/prisma";

const router = Router();

const registerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(190),
  password: z.string().min(10, "Use at least 10 characters").max(72, "Use at most 72 characters"),
});

// Self-registration can only ever create a MEMBER. Nothing from the request can change the role.
router.post("/register", async (req, res, next) => {
  try {
    const input = registerSchema.parse(req.body);
    const email = input.email.toLowerCase();

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({
        success: false,
        error: { message: "An account with this email already exists. Try signing in instead." },
      });
    }

    const passwordHash = await bcrypt.hash(input.password, 10);
    const user = await prisma.user.create({
      data: { name: input.name, email, passwordHash, role: "MEMBER" },
    });
    await prisma.auditLog.create({
      data: { userId: user.id, action: "MEMBER_REGISTERED", entityType: "User", entityId: user.id },
    });

    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET!, {
      expiresIn: (process.env.JWT_EXPIRES_IN || "8h") as any,
    });
    res.status(201).json({
      success: true,
      data: { token, user: { id: user.id, name: user.name, email: user.email, role: user.role } },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
