import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      error: {
        message: "Validation failed",
        details: err.issues.map((i) => ({ field: i.path.join("."), message: i.message })),
      },
    });
  }
  if (typeof err === "object" && err !== null && (err as any).code === "P2002") {
    return res
      .status(409)
      .json({ success: false, error: { message: "That record already exists" } });
  }
  console.error(err);
  return res
    .status(500)
    .json({ success: false, error: { message: "Something went wrong" } });
}

