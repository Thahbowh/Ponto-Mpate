import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export function authenticate(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res
      .status(401)
      .json({ success: false, error: { message: "Authentication required" } });
  }
  try {
    const payload = jwt.verify(header.slice(7), process.env.JWT_SECRET!) as {
      id: string;
      role: string;
    };
    req.user = { id: payload.id, role: payload.role };
    next();
  } catch {
    return res
      .status(401)
      .json({ success: false, error: { message: "Invalid or expired token" } });
  }
}

