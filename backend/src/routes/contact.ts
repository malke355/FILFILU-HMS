import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";

const router = Router();

router.post("/contact", async (req, res, next) => {
  try {
    const body = z.object({
      name: z.string().min(1),
      email: z.string().email(),
      topic: z.string().min(1),
      message: z.string().min(1),
    }).parse(req.body);

    const row = await prisma.contactMessage.create({ data: body });
    await prisma.auditLog.create({
      data: {
        action: "contact.create",
        entity: row.id,
        metaJson: JSON.stringify({ email: body.email, topic: body.topic }),
      },
    });
    res.status(201).json({
      data: { id: row.id },
      message: `Thanks, ${body.name}. Your message was recorded.`,
    });
  } catch (err) {
    next(err);
  }
});

router.post("/bookings", async (req, res, next) => {
  try {
    const body = z.object({
      name: z.string().min(1),
      department: z.string().min(1),
      date: z.string().min(1),
    }).parse(req.body);

    const row = await prisma.bookingRequest.create({
      data: {
        name: body.name,
        department: body.department,
        date: body.date,
        status: "requested",
      },
    });
    await prisma.auditLog.create({
      data: {
        action: "booking.create",
        entity: row.id,
        metaJson: JSON.stringify(body),
      },
    });
    res.status(201).json({
      data: { id: row.id, status: row.status },
      message: `${body.name}, your ${body.department} visit is requested for ${body.date}.`,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
