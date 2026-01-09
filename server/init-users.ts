import { db } from "./db";
import { users } from "@shared/schema";
import { sql } from "drizzle-orm";
import bcrypt from "bcrypt";

const SALT_ROUNDS = 10;

const defaultUsers = [
  { name: 'Nourin Saira', email: 'hr@sahihcertify.com', password: 'HRO@2026', role: 'admin' as const },
  { name: 'Nazif Ahammad', email: 'coo@sahihcertify.com', password: 'COO@2026', role: 'admin' as const },
  { name: 'Mohamed Ali Al Ahbabi', email: 'ceo@sahihcertify.com', password: 'CEO@2026', role: 'admin' as const },
];

export async function initializeDefaultUsers(): Promise<void> {
  console.log('[init] Checking default users...');
  
  for (const user of defaultUsers) {
    try {
      const [existing] = await db.select({ id: users.id }).from(users).where(
        sql`LOWER(${users.email}) = LOWER(${user.email})`
      );
      
      if (!existing) {
        const hashedPassword = await bcrypt.hash(user.password, SALT_ROUNDS);
        await db.insert(users).values({
          name: user.name,
          email: user.email,
          passwordHash: hashedPassword,
          role: user.role,
          inductionStatus: 'completed',
          isActive: true,
        });
        console.log(`[init] Created user: ${user.email}`);
      } else {
        console.log(`[init] User already exists: ${user.email}`);
      }
    } catch (err) {
      console.error(`[init] Error with user ${user.email}:`, err);
    }
  }
  
  console.log('[init] Default users check complete');
}
