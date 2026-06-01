import NextAuth from 'next-auth'
import type {} from 'next-auth/jwt'
import Google from 'next-auth/providers/google'
import Credentials from 'next-auth/providers/credentials'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { prisma } from '@/lib/prisma'
import type { UserRole } from '@/generated/prisma/client'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email: string
      name: string
      image?: string | null
      role: UserRole
    }
  }

  interface User {
    role: UserRole
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    role: UserRole
  }
}

const isDev = process.env.NODE_ENV === 'development' || process.env.ENABLE_DEV_LOGIN === 'true'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma as any) as any,
  providers: [
    Google({
      clientId: process.env['GOOGLE_CLIENT_ID'],
      clientSecret: process.env['GOOGLE_CLIENT_SECRET'],
    }),
    // Dev-only credentials provider for testing all roles without Google OAuth
    ...(isDev
      ? [
          Credentials({
            id: 'dev-login',
            name: 'Dev Login',
            credentials: {
              userId: { type: 'text' },
            },
            async authorize(credentials) {
              if (process.env.NODE_ENV !== 'development' && process.env.ENABLE_DEV_LOGIN !== 'true') return null
              const userId = credentials?.userId as string
              if (!userId) return null
              const user = await prisma.user.findUnique({
                where: { id: userId },
              })
              if (!user) return null
              return {
                id: user.id,
                email: user.email,
                name: user.name,
                image: user.image ?? user.avatar,
                role: user.role,
              }
            },
          }),
        ]
      : []),
  ],
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id!
        token.role = user.role
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as UserRole
      }
      return session
    },
  },
  pages: {
    signIn: '/login',
  },
})
