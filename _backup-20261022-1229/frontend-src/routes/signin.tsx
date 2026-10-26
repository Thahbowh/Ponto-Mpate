import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { SignIn } from "@/components/site/SignIn.tsx";

const signInSearchSchema = z.object({
  mode: z.enum(["signin", "signup", "phone"]).optional(),
});

export const Route = createFileRoute("/signin")({
  validateSearch: signInSearchSchema,
  component: SignIn,
  head: () => ({
    meta: [
      { title: "Sign in — Ponto Mpate" },
      { name: "description", content: "Sign in to your Ponto Mpate account." },
    ],
  }),
});