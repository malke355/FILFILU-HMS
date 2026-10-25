import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { query } from "../db/pool.js";

const router = Router();

const patientSchema = z.object({
  full_name: z.string().min(1),
  age: z.number().int().positive().optional().nullable(),
  gender: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
});

const appointmentSchema = z.object({
  patient_id: z.number().int().positive(),
  doctor_id: z.number().int().positive().optional().nullable(),
  appointment_date: z.string().min(1),
  reason: z.string().optional().nullable(),
  status: z.string().optional(),
});

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  full_name: z.string().min(1),
  role: z.string().optional(),
});

/** Register user — password hashed with bcrypt (parameterized INSERT). */
router.post("/users/register", async (req, res, next) => {
  try {
    const body = registerSchema.parse(req.body);
    const passwordHash = await bcrypt.hash(body.password, 10);
    const result = await query(
      `INSERT INTO users (email, password_hash, full_name, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, full_name, role, created_at`,
      [body.email.toLowerCase(), passwordHash, body.full_name, body.role || "patient"],
    );
    res.status(201).json({ data: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

/** Save patient (parameterized INSERT). */
router.post("/patients", async (req, res, next) => {
  try {
    const body = patientSchema.parse(req.body);
    const result = await query(
      `INSERT INTO patients (full_name, age, gender, phone, address)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [body.full_name, body.age ?? null, body.gender ?? null, body.phone ?? null, body.address ?? null],
    );
    res.status(201).json({ data: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

/** Fetch all patients (parameterized SELECT). */
router.get("/patients", async (_req, res, next) => {
  try {
    const result = await query(`SELECT * FROM patients ORDER BY id ASC`);
    res.json({ data: result.rows });
  } catch (err) {
    next(err);
  }
});

/** Save appointment (parameterized INSERT). */
router.post("/appointments", async (req, res, next) => {
  try {
    const body = appointmentSchema.parse(req.body);
    const result = await query(
      `INSERT INTO appointments (patient_id, doctor_id, appointment_date, reason, status)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        body.patient_id,
        body.doctor_id ?? null,
        body.appointment_date,
        body.reason ?? null,
        body.status || "scheduled",
      ],
    );
    res.status(201).json({ data: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

/** Fetch all appointments (parameterized SELECT with joins). */
router.get("/appointments", async (_req, res, next) => {
  try {
    const result = await query(
      `SELECT a.*, p.full_name AS patient_name, d.full_name AS doctor_name
       FROM appointments a
       LEFT JOIN patients p ON p.id = a.patient_id
       LEFT JOIN doctors d ON d.id = a.doctor_id
       ORDER BY a.appointment_date DESC`,
    );
    res.json({ data: result.rows });
  } catch (err) {
    next(err);
  }
});

export default router;
