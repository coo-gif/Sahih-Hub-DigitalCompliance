import { db } from "./db";
import {
  tasks, policies,
  type InsertTask, type Task,
  type InsertPolicy, type Policy
} from "@shared/schema";
import { eq, desc } from "drizzle-orm";

export interface IStorage {
  // Tasks
  getTasks(): Promise<Task[]>;
  getTask(id: number): Promise<Task | undefined>;
  createTask(task: InsertTask): Promise<Task>;
  updateTask(id: number, task: Partial<InsertTask>): Promise<Task>;
  deleteTask(id: number): Promise<void>;

  // Policies
  getPolicies(): Promise<Policy[]>;
  getPolicy(id: number): Promise<Policy | undefined>;
  createPolicy(policy: InsertPolicy): Promise<Policy>;
  updatePolicy(id: number, policy: Partial<InsertPolicy>): Promise<Policy>;
  deletePolicy(id: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // Tasks
  async getTasks(): Promise<Task[]> {
    return await db.select().from(tasks).orderBy(desc(tasks.createdAt));
  }

  async getTask(id: number): Promise<Task | undefined> {
    const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
    return task;
  }

  async createTask(insertTask: InsertTask): Promise<Task> {
    const [task] = await db.insert(tasks).values(insertTask).returning();
    return task;
  }

  async updateTask(id: number, updates: Partial<InsertTask>): Promise<Task> {
    const [updated] = await db.update(tasks)
      .set(updates)
      .where(eq(tasks.id, id))
      .returning();
    return updated;
  }

  async deleteTask(id: number): Promise<void> {
    await db.delete(tasks).where(eq(tasks.id, id));
  }

  // Policies
  async getPolicies(): Promise<Policy[]> {
    return await db.select().from(policies).orderBy(desc(policies.lastUpdated));
  }

  async getPolicy(id: number): Promise<Policy | undefined> {
    const [policy] = await db.select().from(policies).where(eq(policies.id, id));
    return policy;
  }

  async createPolicy(insertPolicy: InsertPolicy): Promise<Policy> {
    const [policy] = await db.insert(policies).values(insertPolicy).returning();
    return policy;
  }

  async updatePolicy(id: number, updates: Partial<InsertPolicy>): Promise<Policy> {
    const [updated] = await db.update(policies)
      .set(updates)
      .where(eq(policies.id, id))
      .returning();
    return updated;
  }

  async deletePolicy(id: number): Promise<void> {
    await db.delete(policies).where(eq(policies.id, id));
  }
}

export const storage = new DatabaseStorage();
