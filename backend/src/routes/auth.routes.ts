import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authenticate } from "../middleware/authenticate";

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email } });

    const ok = user && (await bcrypt.compare(password, user.passwordHash));
    if (!user || !ok) {
      return res
        .status(401)
        .json({ success: false, error: { message: "Incorrect email or password" } });
    }

    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET!, {
      expiresIn: (process.env.JWT_EXPIRES_IN || "8h") as any,
    });

    res.json({
      success: true,
      data: {
        token,
        user: { id: user.id, name: user.name, email: user.email, role: user.role },
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get("/me", authenticate, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) {
      return res.status(404).json({ success: false, error: { message: "User not found" } });
    }
    res.json({
      success: true,
      data: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
