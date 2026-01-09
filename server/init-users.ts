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
        
        if (!existing) {
          console.log(`[init] Creating user: ${user.email}`);
          const hashedPassword = await bcrypt.hash(user.password, SALT_ROUNDS);
          await db.insert(users).values({
            name: user.name,
            email: user.email,
            passwordHash: hashedPassword,
            role: user.role,
            inductionStatus: 'completed',
            isActive: true,
          });
          console.log(`[init] Successfully created user: ${user.email}`);
        } else {
          console.log(`[init] User already exists: ${user.email} (id: ${existing.id})`);
        }
      } catch (err: any) {
        console.error(`[init] Error creating user ${user.email}:`, err.message || err);
      }
    }
    
    console.log('[init] Default users initialization complete');
  } catch (err: any) {
    console.error('[init] Database connection error:', err.message || err);
  }
}
