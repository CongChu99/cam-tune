/**
 * NextAuth catch-all route handler.
 * Handles all /api/auth/* routes (sign-in, sign-out, session, CSRF token, etc.).
 */

import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
