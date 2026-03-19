import { NextAuthOptions } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import prisma from "@/lib/prisma";

export const authOptions: NextAuthOptions = {
  // Adapter connects NextAuth to the database via Prisma
  // Full adapter setup (sessions table, etc.) requires Task 2 schema migration
  // adapter: PrismaAdapter(prisma),

  providers: [
    // Providers will be added in subsequent tasks.
    // Planned: GitHub OAuth, Email/magic-link, or credentials (BYOK flow)
  ],

  session: {
    strategy: "jwt",
  },

  callbacks: {
    async session({ session, token }) {
      if (token.sub && session.user) {
        session.user.id = token.sub;
      }
      return session;
    },
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
      }
      return token;
    },
  },

  pages: {
    signIn: "/auth/signin",
  },

  secret: process.env.NEXTAUTH_SECRET,
};
