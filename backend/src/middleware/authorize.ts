import type { Request, Response, NextFunction } from "express";

export function authorize(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res
        .status(403)
        .json({ success: false, error: { message: "You do not have permission" } });
    }
    next();
  };
}

