import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "npm:@supabase/supabase-js";
import * as kv from "./kv_store.tsx";

const app = new Hono();

app.use("*", logger(console.log));
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

async function getUserId(c: any): Promise<string | null> {
  const token = c.req.header("Authorization")?.split(" ")[1];
  if (!token) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user.id;
}

app.get("/make-server-5520aacf/health", (c) => c.json({ status: "ok" }));

// List projects for the authenticated user
app.get("/make-server-5520aacf/projects", async (c) => {
  const userId = await getUserId(c);
  if (!userId) return c.json({ error: "Unauthorized" }, 401);
  try {
    const projects = await kv.getByPrefix(`project:${userId}:`);
    return c.json({ projects });
  } catch (e) {
    console.log(`Failed to list projects for user ${userId}:`, e);
    return c.json({ error: "Failed to list projects" }, 500);
  }
});

// Upsert a single project
app.put("/make-server-5520aacf/projects/:id", async (c) => {
  const userId = await getUserId(c);
  if (!userId) return c.json({ error: "Unauthorized" }, 401);
  const id = c.req.param("id");
  try {
    const body = await c.req.json();
    const record = { ...body, id, userId, updatedAt: Date.now() };
    await kv.set(`project:${userId}:${id}`, record);
    return c.json({ ok: true, project: record });
  } catch (e) {
    console.log(`Failed to upsert project ${id} for user ${userId}:`, e);
    return c.json({ error: "Failed to save project" }, 500);
  }
});

// Delete a project
app.delete("/make-server-5520aacf/projects/:id", async (c) => {
  const userId = await getUserId(c);
  if (!userId) return c.json({ error: "Unauthorized" }, 401);
  const id = c.req.param("id");
  try {
    await kv.del(`project:${userId}:${id}`);
    return c.json({ ok: true });
  } catch (e) {
    console.log(`Failed to delete project ${id} for user ${userId}:`, e);
    return c.json({ error: "Failed to delete project" }, 500);
  }
});

Deno.serve(app.fetch);
