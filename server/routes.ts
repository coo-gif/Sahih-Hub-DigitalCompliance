import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // Tasks Routes
  app.get(api.tasks.list.path, async (req, res) => {
    const tasks = await storage.getTasks();
    res.json(tasks);
  });

  app.post(api.tasks.create.path, async (req, res) => {
    try {
      const input = api.tasks.create.input.parse(req.body);
      const task = await storage.createTask(input);
      res.status(201).json(task);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.put(api.tasks.update.path, async (req, res) => {
    try {
      const input = api.tasks.update.input.parse(req.body);
      const task = await storage.updateTask(Number(req.params.id), input);
      res.json(task);
    } catch (err) {
       if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.delete(api.tasks.delete.path, async (req, res) => {
    await storage.deleteTask(Number(req.params.id));
    res.status(204).send();
  });

  // Policies Routes
  app.get(api.policies.list.path, async (req, res) => {
    const policies = await storage.getPolicies();
    res.json(policies);
  });

  app.post(api.policies.create.path, async (req, res) => {
     try {
      const input = api.policies.create.input.parse(req.body);
      const policy = await storage.createPolicy(input);
      res.status(201).json(policy);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.put(api.policies.update.path, async (req, res) => {
     try {
      const input = api.policies.update.input.parse(req.body);
      const policy = await storage.updatePolicy(Number(req.params.id), input);
      res.json(policy);
    } catch (err) {
       if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.delete(api.policies.delete.path, async (req, res) => {
    await storage.deletePolicy(Number(req.params.id));
    res.status(204).send();
  });

  // Seed Data
  await seedDatabase();

  return httpServer;
}

async function seedDatabase() {
  const existingTasks = await storage.getTasks();
  if (existingTasks.length === 0) {
    await storage.createTask({
      title: "Quarterly Compliance Audit",
      description: "Review all financial records for Q3.",
      status: "pending",
      priority: "high",
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
    });
    await storage.createTask({
      title: "Update Privacy Policy",
      description: "Incorporate new GDPR requirements.",
      status: "in_progress",
      priority: "medium",
      dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    });
    await storage.createTask({
      title: "Staff Training: Data Security",
      description: "Ensure all employees complete the cybersecurity module.",
      status: "compliant",
      priority: "low",
      dueDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // Past due but compliant
    });
  }

  const existingPolicies = await storage.getPolicies();
  if (existingPolicies.length === 0) {
    await storage.createPolicy({
      title: "Data Protection Policy",
      content: "All sensitive data must be encrypted...",
      category: "Security",
      isActive: true,
    });
    await storage.createPolicy({
      title: "Anti-Money Laundering (AML)",
      content: "Procedures for detecting and reporting suspicious activity...",
      category: "Finance",
      isActive: true,
    });
     await storage.createPolicy({
      title: "Remote Work Guidelines",
      content: "Standards for working from home...",
      category: "HR",
      isActive: true,
    });
  }
}
