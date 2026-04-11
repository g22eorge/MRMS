import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";

import { prisma } from "@/lib/prisma";

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL,
  database: prismaAdapter(prisma, { provider: "sqlite" }),
  emailAndPassword: { enabled: true },
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: true,
        defaultValue: "OPS",
        input: false,
      },
      isActive: {
        type: "boolean",
        required: true,
        defaultValue: true,
        input: false,
      },
    },
  },
  session: {
    // Keep sessions reasonably short.
    // expiresIn: session lifetime (seconds)
    // disableSessionRefresh: prevents extending sessions indefinitely
    expiresIn: 60 * 60 * 8, // 8 hours
    disableSessionRefresh: true,
    cookieCache: { enabled: true, maxAge: 60 * 5 }, // 5 minutes
  },
});
