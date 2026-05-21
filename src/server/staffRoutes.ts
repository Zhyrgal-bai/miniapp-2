import type { Express, Request, Response } from "express";
import { BusinessStaffRole } from "@prisma/client";
import {
  inviteStaffMember,
  listStaffPublicRows,
  parseStaffRole,
  previewStaffInvite,
  removeStaffMember,
  updateStaffPermissions,
  updateStaffRole,
} from "./businessStaffService.js";

type OwnerGuard = (
  req: Request,
  res: Response,
  businessId: number,
) => Promise<{ requesterDbUserId: number } | null>;

export function attachStaffRoutes(
  app: Express,
  deps: { requireStoreOwnerForApi: OwnerGuard },
): void {
  app.get("/api/staff", async (req: Request, res: Response) => {
    try {
      if (typeof req.businessId !== "number") {
        res.status(400).json({ error: "Missing tenant shop" });
        return;
      }
      const ownerCtx = await deps.requireStoreOwnerForApi(
        req,
        res,
        req.businessId,
      );
      if (!ownerCtx) return;

      const rows = await listStaffPublicRows(req.businessId);
      res.json(rows);
    } catch (e) {
      console.error("GET /api/staff:", e);
      res.status(500).json({ error: "Server error" });
    }
  });

  app.post("/api/staff/preview", async (req: Request, res: Response) => {
    try {
      if (typeof req.businessId !== "number") {
        res.status(400).json({ error: "Missing tenant shop" });
        return;
      }
      const ownerCtx = await deps.requireStoreOwnerForApi(
        req,
        res,
        req.businessId,
      );
      if (!ownerCtx) return;

      const body = req.body as { username?: unknown };
      const username = String(body.username ?? "").trim();
      const result = await previewStaffInvite({
        businessId: req.businessId,
        username,
      });
      if (!result.ok) {
        res.status(result.pendingInvite ? 404 : 400).json({
          error: result.error,
          pendingInvite: result.pendingInvite ?? false,
        });
        return;
      }
      res.json(result.preview);
    } catch (e) {
      console.error("POST /api/staff/preview:", e);
      res.status(500).json({ error: "Server error" });
    }
  });

  app.post("/api/staff/invite", async (req: Request, res: Response) => {
    try {
      if (typeof req.businessId !== "number") {
        res.status(400).json({ error: "Missing tenant shop" });
        return;
      }
      const ownerCtx = await deps.requireStoreOwnerForApi(
        req,
        res,
        req.businessId,
      );
      if (!ownerCtx) return;

      const body = req.body as { username?: unknown; role?: unknown };
      const role = parseStaffRole(body.role) ?? BusinessStaffRole.ADMIN;
      const result = await inviteStaffMember({
        businessId: req.businessId,
        invitedByUserId: ownerCtx.requesterDbUserId,
        username: String(body.username ?? ""),
        role,
      });
      if (!result.ok) {
        res.status(result.statusCode).json({ error: result.error });
        return;
      }
      res.status(201).json(result.staff);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg === "OWNER_IMMUTABLE") {
        res.status(403).json({ error: "Нельзя менять владельца" });
        return;
      }
      if (msg === "ALREADY_STAFF") {
        res.status(409).json({ error: "Пользователь уже в команде" });
        return;
      }
      console.error("POST /api/staff/invite:", e);
      res.status(500).json({ error: "Server error" });
    }
  });

  app.post("/api/staff/update-role", async (req: Request, res: Response) => {
    try {
      if (typeof req.businessId !== "number") {
        res.status(400).json({ error: "Missing tenant shop" });
        return;
      }
      const ownerCtx = await deps.requireStoreOwnerForApi(
        req,
        res,
        req.businessId,
      );
      if (!ownerCtx) return;

      const body = req.body as { userId?: unknown; role?: unknown };
      const targetUserId = Number(body.userId);
      const role = parseStaffRole(body.role);
      if (!Number.isSafeInteger(targetUserId) || targetUserId <= 0 || !role) {
        res.status(400).json({ error: "Нужны userId и role" });
        return;
      }
      if (targetUserId === ownerCtx.requesterDbUserId) {
        res.status(403).json({ error: "Нельзя изменить собственную роль" });
        return;
      }

      const result = await updateStaffRole({
        businessId: req.businessId,
        targetUserId,
        role,
      });
      if (!result.ok) {
        res.status(result.statusCode).json({ error: result.error });
        return;
      }
      res.json({ ok: true });
    } catch (e) {
      console.error("POST /api/staff/update-role:", e);
      res.status(500).json({ error: "Server error" });
    }
  });

  app.post("/api/staff/update-permissions", async (req: Request, res: Response) => {
    try {
      if (typeof req.businessId !== "number") {
        res.status(400).json({ error: "Missing tenant shop" });
        return;
      }
      const ownerCtx = await deps.requireStoreOwnerForApi(
        req,
        res,
        req.businessId,
      );
      if (!ownerCtx) return;

      const body = req.body as { userId?: unknown; permissions?: unknown };
      const targetUserId = Number(body.userId);
      if (!Number.isSafeInteger(targetUserId) || targetUserId <= 0) {
        res.status(400).json({ error: "Нужен userId" });
        return;
      }

      const result = await updateStaffPermissions({
        businessId: req.businessId,
        targetUserId,
        permissions: body.permissions,
      });
      if (!result.ok) {
        res.status(result.statusCode).json({ error: result.error });
        return;
      }
      res.json({ ok: true });
    } catch (e) {
      console.error("POST /api/staff/update-permissions:", e);
      res.status(500).json({ error: "Server error" });
    }
  });

  app.post("/api/staff/remove", async (req: Request, res: Response) => {
    try {
      if (typeof req.businessId !== "number") {
        res.status(400).json({ error: "Missing tenant shop" });
        return;
      }
      const ownerCtx = await deps.requireStoreOwnerForApi(
        req,
        res,
        req.businessId,
      );
      if (!ownerCtx) return;

      const body = req.body as { userId?: unknown };
      const targetUserId = Number(body.userId);
      if (!Number.isSafeInteger(targetUserId) || targetUserId <= 0) {
        res.status(400).json({ error: "Нужен userId" });
        return;
      }
      if (targetUserId === ownerCtx.requesterDbUserId) {
        res.status(403).json({ error: "Нельзя удалить себя" });
        return;
      }

      const result = await removeStaffMember({
        businessId: req.businessId,
        targetUserId,
      });
      if (!result.ok) {
        res.status(result.statusCode).json({ error: result.error });
        return;
      }
      res.json({ ok: true });
    } catch (e) {
      console.error("POST /api/staff/remove:", e);
      res.status(500).json({ error: "Server error" });
    }
  });
}
