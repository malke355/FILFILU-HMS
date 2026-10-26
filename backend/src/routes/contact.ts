import { Router } from "express";
import { z } from "zod";
import { writeAudit } from "../lib/audit.js";
import { assertNotTooFarPast, dateStringSchema } from "../lib/datetime.js";
import { prisma } from "../lib/prisma.js";
import { bookingLimiter, contactLimiter } from "../middleware/rateLimit.js";

const router = Router();

router.post("/contact", contactLimiter, async (req, res, next) => {
  try {
    const body = z.object({
      name: z.string().min(1).max(120),
      email: z.string().email().max(200),
      topic: z.string().min(1).max(120),
      message: z.string().min(1).max(4000),
    }).parse(req.body);

    const row = await prisma.contactMessage.create({ data: body });
    await writeAudit({
      action: "contact.create",
      entity: row.id,
      meta: { topic: body.topic, messageLength: body.message.length },
    });
    res.status(201).json({
      data: { id: row.id },
      message: `Thanks, ${body.name}. Your message was recorded.`,
    });
  } catch (err) {
    next(err);
  }
});

router.post("/bookings", bookingLimiter, async (req, res, next) => {
  try {
    const body = z.object({
      name: z.string().min(1).max(120),
      department: z.string().min(1).max(120),
      date: dateStringSchema,
    }).parse(req.body);
    assertNotTooFarPast(body.date);

    const row = await prisma.bookingRequest.create({
      data: {
        name: body.name,
        department: body.department,
        date: body.date,
        status: "requested",
      },
    });
    await writeAudit({
      action: "booking.create",
      entity: row.id,
      meta: { department: body.department, date: body.date },
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
