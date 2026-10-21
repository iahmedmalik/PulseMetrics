import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import type { Config } from "./config";
import type { Db } from "./db/client";
import * as schema from "./db/schema";

// Owner sign-in with Better Auth: email and password, a session cookie, nothing else.
//
// The dashboard (on Vercel) and this API (on Render) are different sites, and browsers block
// cookies across sites. So the dashboard forwards /backend/* to this API, and the cookie belongs
// to the dashboard's own address. The dashboard strips the /backend part, so inside this API the
// sign-in routes simply live under /v1/auth.

type AuthConfig = Pick<Config, "BETTER_AUTH_SECRET" | "WEB_ORIGIN" | "isProduction">;
type AuthOptions = {
  /** Turn the sign-in rate limiter on outside production (tests do this). */
  rateLimit?: { enabled: boolean; signInMax?: number };
};

export function createAuth(db: Db, config: AuthConfig, options: AuthOptions = {}) {
  const limiterOn = config.isProduction || options.rateLimit?.enabled === true;
  return betterAuth({
    secret: config.BETTER_AUTH_SECRET,
    baseURL: config.WEB_ORIGIN,
    basePath: "/v1/auth",
    trustedOrigins: [config.WEB_ORIGIN],
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: { user: schema.user, session: schema.session, account: schema.account, verification: schema.verification },
    }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 10,
      maxPasswordLength: 128,
      // No email service in v1: owners are signed in straight after they sign up.
      requireEmailVerification: false,
      autoSignIn: true,
    },
    session: { expiresIn: 60 * 60 * 24 * 14, updateAge: 60 * 60 * 24 },
    // Guessing passwords is slowed down per address and per path. (The address is used only for
    // counting; the session row below never keeps it.)
    rateLimit: {
      enabled: limiterOn,
      window: 60,
      max: 100,
      customRules: {
        "/sign-in/email": { window: 60, max: options.rateLimit?.signInMax ?? 10 },
        "/sign-up/email": { window: 60, max: 5 },
      },
    },
    databaseHooks: {
      session: {
        create: {
          // Rule P-1 in spirit: do not keep owners' IP addresses either.
          before: async (session) => ({ data: { ...session, ipAddress: null } }),
        },
      },
    },
    advanced: {
      useSecureCookies: config.isProduction,
      // Better Auth skips these two checks when it thinks it is running in a test. Say so explicitly,
      // so a request from another website is refused everywhere, and the tests prove it.
      disableOriginCheck: false,
      disableCSRFCheck: false,
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
