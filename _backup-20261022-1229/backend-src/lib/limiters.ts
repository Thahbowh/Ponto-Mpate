import { rateLimit } from "express-rate-limit";

const prod = process.env.NODE_ENV === "production";
const message = {
  success: false,
  error: { message: "Too many attempts. Please wait a few minutes and try again." },
};

/** Sign-in and registration. */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: prod ? 40 : 500,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message,
});

/** Joining a household by reference. Stops people guessing household references. */
export const joinLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: prod ? 10 : 200,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message,
});
