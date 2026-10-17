import { db } from "./db";
import { users } from "@shared/schema";
import bcrypt from "bcrypt";

const SALT_ROUNDS = 10;

// Initial passwords come from the environment so none live in the source.
const defaultUsers = [
  { name: 'Nourin Saira', email: 'hr@sahihcertify.com', passwordEnv: 'HR_INITIAL_PASSWORD', role: 'admin' as const },
  { name: 'Nazif Ahammad', email: 'coo@sahihcertify.com', passwordEnv: 'COO_INITIAL_PASSWORD', role: 'admin' as const },
  { name: 'Mohamed Ali Al Ahbabi', email: 'ceo@sahihcertify.com', passwordEnv: 'CEO_INITIAL_PASSWORD', role: 'admin' as const },
];

export async function initializeDefaultUsers(): Promise<void> {
  console.log('[init] Starting default users initialization...');
  console.log('[init] Environment:', process.env.NODE_ENV);
  
  try {
    // Test database connection first
    const allUsers = await db.select({ id: users.id, email: users.email }).from(users);
    console.log(`[init] Found ${allUsers.length} existing users in database`);
    
    for (const user of defaultUsers) {
      try {
        // Check if user exists (case-insensitive)
        const existingUsers = await db.select({ id: users.id, email: users.email }).from(users);
        const existing = existingUsers.find(u => u.email.toLowerCase() === user.email.toLowerCase());
        
        if (existing) {
          // Never overwrite the password of an account that already exists
          continue;
        }

        const password = process.env[user.passwordEnv];
        if (!password) {
          console.warn(`[init] ${user.passwordEnv} is not set; skipping creation of ${user.email}`);
          continue;
        }

        console.log(`[init] Creating user: ${user.email}`);
        await db.insert(users).values({
          name: user.name,
          email: user.email,
          passwordHash: await bcrypt.hash(password, SALT_ROUNDS),
          role: user.role,
          inductionStatus: 'completed',
          isActive: true,
        });
        console.log(`[init] Successfully created user: ${user.email}`);
      } catch (err: any) {
        console.error(`[init] Error creating user ${user.email}:`, err.message || err);
      }
    }
    
    console.log('[init] Default users initialization complete');
  } catch (err: any) {
    console.error('[init] Database connection error:', err.message || err);
  }
}
