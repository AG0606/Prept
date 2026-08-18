import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import prisma from "@/lib/db";
import { Adapter } from "next-auth/adapters";

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  adapter: PrismaAdapter(prisma) as Adapter,
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      allowDangerousEmailAccountLinking: true,
    }),
    CredentialsProvider({
      name: "Demo Login",
      credentials: {
        username: { label: "Username", type: "text", placeholder: "demo" },
      },
      async authorize(credentials) {
        if (!credentials?.username) return null;
        const email = `demo+${credentials.username}@lumen.internal`;
        try {
          let user = await prisma.user.findUnique({ where: { email } });
          if (!user) {
            user = await prisma.user.create({
              data: { name: credentials.username, email: email },
            });
          }
          return user;
        } catch (err) {
          console.error("Authorize db fallback:", err);
          return { id: `demo_${credentials.username}`, name: credentials.username, email };
        }
      },
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async signIn({ user, account, profile }) {
      return true;
    },
    async jwt({ token, user, account }) {
      if (user) {
        token.sub = user.id;
        (token as any).id = user.id;
      }
      if (!token.id && token.email) {
        try {
          const dbUser = await prisma.user.findUnique({ where: { email: token.email } });
          if (dbUser) {
            token.sub = dbUser.id;
            (token as any).id = dbUser.id;
          }
        } catch (e) {
          // ignore error
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = (token as any).id || token.sub;
      }
      return session;
    },
  },
};
