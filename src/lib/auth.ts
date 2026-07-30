import NextAuth from 'next-auth'
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

declare module '@auth/core/jwt' {
  interface JWT {
    id: string
    role: UserRole
  }
}

/**
 * ¿Se ofrece el provider `dev-login`?
 *
 * Ese provider autentica con SOLO un userId: sin contraseña, sin OAuth. Quien
 * conozca (o adivine) un id entra como ese usuario — y aquí eso significa entrar
 * como el contacto de cualquier marca y ver sus proyectos, sus entregas y su
 * universo de marca.
 *
 * La condición era `NODE_ENV === 'development' || ENABLE_DEV_LOGIN === 'true'`,
 * o sea que la variable sola bastaba para encenderlo en un build de producción.
 * En el portal interno esa misma variable está puesta en Production a propósito
 * (regla inviolable 5 de su CLAUDE.md) y ya provocó un incidente real: los dos
 * webhooks públicos aceptaban peticiones sin firmar porque su guard colgaba de
 * ella. Los dos repos comparten base de datos y costumbres; este habría heredado
 * el mismo problema el día del primer deploy.
 *
 * Hoy no hay agujero vivo porque este portal AÚN NO ESTÁ DESPLEGADO: no existe
 * proyecto suyo en Vercel. Se cierra ahora precisamente por eso — para que el
 * deploy no lo estrene.
 *
 * Ahora `NODE_ENV !== 'production'` es obligatorio. Es la mitad que Vercel no
 * deja poner a mano en un despliegue de producción, así que ni un despiste de
 * configuración la reabre.
 */
const isDev =
  process.env.NODE_ENV !== 'production' &&
  (process.env.NODE_ENV === 'development' || process.env.ENABLE_DEV_LOGIN === 'true')

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
              // Segunda barrera, dentro del authorize. La lista de providers se
              // evalúa UNA vez al cargar el módulo; esto se evalúa en cada
              // intento, así que aunque el provider quedara registrado por
              // cualquier motivo, en producción no autentica a nadie.
              if (process.env.NODE_ENV === 'production') return null
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
