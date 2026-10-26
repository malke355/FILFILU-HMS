/**
 * Legacy unauthenticated SQL demo routes were removed.
 * All patients/appointments/users go through Prisma + auth in resources.ts / auth.ts.
 */
import { Router } from "express";

const router = Router();
export default router;
