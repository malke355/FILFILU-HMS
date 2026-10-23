/**
 * Filfilu demo auth + RBAC + RLS (client-side mock).
 * TODO: replace with real JWT/session cookies and server-side policies.
 */
(function (global) {
  const SESSION_KEY = "filfilu.session";

  /** @typedef {"admin"|"doctor"|"nurse"|"patient"} Role */

  const PERMISSIONS = {
    admin: [
      "dashboard:admin",
      "staff:read",
      "staff:write",
      "departments:read",
      "departments:write",
      "schedule:read",
      "schedule:write",
      "schedule:publish",
      "patients:read_all",
      "appointments:read_all",
      "reports:read",
      "exchanges:approve",
    ],
    doctor: [
      "dashboard:doctor",
      "schedule:read_own",
      "patients:read_assigned",
      "appointments:read_own",
      "appointments:write_own",
      "exchanges:request",
      "notifications:read_own",
    ],
    nurse: [
      "dashboard:nurse",
      "schedule:read_own",
      "patients:read_ward",
      "appointments:read_ward",
      "exchanges:request",
      "notifications:read_own",
    ],
    patient: [
      "dashboard:patient",
      "appointments:read_own",
      "appointments:request",
      "doctors:read_public",
      "profile:read_own",
      "profile:write_own",
      "notifications:read_own",
    ],
  };

  const NAV = {
    admin: [
      { id: "overview", label: "Overview" },
      { id: "staff", label: "Staff" },
      { id: "schedule", label: "Duty schedule" },
      { id: "appointments", label: "Appointments" },
      { id: "reports", label: "Reports" },
    ],
    doctor: [
      { id: "overview", label: "Overview" },
      { id: "schedule", label: "My shifts" },
      { id: "patients", label: "My patients" },
      { id: "appointments", label: "Appointments" },
      { id: "exchanges", label: "Shift swaps" },
    ],
    nurse: [
      { id: "overview", label: "Overview" },
      { id: "schedule", label: "My shifts" },
      { id: "ward", label: "Ward board" },
      { id: "appointments", label: "Clinic list" },
      { id: "exchanges", label: "Shift swaps" },
    ],
    patient: [
      { id: "overview", label: "Overview" },
      { id: "appointments", label: "My visits" },
      { id: "doctors", label: "Find a doctor" },
      { id: "profile", label: "Profile" },
    ],
  };

  /* —— Mock database (SAMPLE DATA) —— */
  const DB = {
    users: [
      { id: "u-admin", role: "admin", name: "Selam Bekele", email: "admin@filfilu.com", password: "filfilu" },
      { id: "u-doc-1", role: "doctor", name: "Dr. Helen Tesfaye", email: "doctor@filfilu.com", password: "filfilu", staffId: "s-doc-1", dept: "General Medicine" },
      { id: "u-doc-2", role: "doctor", name: "Dr. Sara Mekonnen", email: "sara@filfilu.com", password: "filfilu", staffId: "s-doc-2", dept: "Cardiology" },
      { id: "u-nurse-1", role: "nurse", name: "Rahel Abebe", email: "nurse@filfilu.com", password: "filfilu", staffId: "s-nurse-1", ward: "Ward A" },
      { id: "u-pat-1", role: "patient", name: "Amina Mohammed", email: "patient@filfilu.com", password: "filfilu", patientId: "p-1" },
      { id: "u-pat-2", role: "patient", name: "Yonas Hailu", email: "yonas@filfilu.com", password: "filfilu", patientId: "p-2" },
    ],
    staff: [
      { id: "s-doc-1", name: "Dr. Helen Tesfaye", role: "doctor", dept: "General Medicine", status: "active" },
      { id: "s-doc-2", name: "Dr. Sara Mekonnen", role: "doctor", dept: "Cardiology", status: "active" },
      { id: "s-doc-3", name: "Dr. Dawit Bekele", role: "doctor", dept: "Pediatrics", status: "active" },
      { id: "s-nurse-1", name: "Rahel Abebe", role: "nurse", dept: "Maternity", ward: "Ward A", status: "active" },
      { id: "s-nurse-2", name: "Lidya Tadesse", role: "nurse", dept: "General Medicine", ward: "Ward B", status: "active" },
      { id: "s-admin", name: "Selam Bekele", role: "admin", dept: "Administration", status: "active" },
    ],
    patients: [
      { id: "p-1", name: "Amina Mohammed", age: 29, doctorId: "s-doc-1", ward: null, condition: "Follow-up" },
      { id: "p-2", name: "Yonas Hailu", age: 41, doctorId: "s-doc-2", ward: "Ward A", condition: "Cardiac monitoring" },
      { id: "p-3", name: "Hana Kebede", age: 8, doctorId: "s-doc-3", ward: "Ward B", condition: "Pediatric check" },
      { id: "p-4", name: "Mulugeta Assefa", age: 55, doctorId: "s-doc-1", ward: "Ward A", condition: "Diabetes review" },
    ],
    appointments: [
      { id: "a-1", patientId: "p-1", doctorId: "s-doc-1", date: "2026-10-24", time: "09:30", dept: "General Medicine", status: "confirmed" },
      { id: "a-2", patientId: "p-1", doctorId: "s-doc-2", date: "2026-10-28", time: "11:00", dept: "Cardiology", status: "requested" },
      { id: "a-3", patientId: "p-2", doctorId: "s-doc-2", date: "2026-10-23", time: "15:30", dept: "Cardiology", status: "confirmed" },
      { id: "a-4", patientId: "p-3", doctorId: "s-doc-3", date: "2026-10-25", time: "10:00", dept: "Pediatrics", status: "confirmed" },
      { id: "a-5", patientId: "p-4", doctorId: "s-doc-1", date: "2026-10-26", time: "14:00", dept: "General Medicine", status: "draft" },
      { id: "a-6", patientId: "p-2", doctorId: "s-doc-1", date: "2026-10-30", time: "08:45", dept: "General Medicine", status: "confirmed" },
    ],
    shifts: [
      { id: "sh-1", staffId: "s-doc-1", date: "2026-10-23", slot: "08:00–16:00", dept: "General Medicine", status: "published" },
      { id: "sh-2", staffId: "s-doc-1", date: "2026-10-24", slot: "08:00–16:00", dept: "General Medicine", status: "published" },
      { id: "sh-3", staffId: "s-doc-2", date: "2026-10-23", slot: "12:00–20:00", dept: "Cardiology", status: "published" },
      { id: "sh-4", staffId: "s-nurse-1", date: "2026-10-23", slot: "07:00–19:00", dept: "Maternity", status: "published" },
      { id: "sh-5", staffId: "s-nurse-1", date: "2026-10-24", slot: "19:00–07:00", dept: "Maternity", status: "draft" },
      { id: "sh-6", staffId: "s-nurse-2", date: "2026-10-23", slot: "07:00–19:00", dept: "General Medicine", status: "published" },
      { id: "sh-7", staffId: "s-doc-3", date: "2026-10-25", slot: "08:00–14:00", dept: "Pediatrics", status: "published" },
    ],
    exchanges: [
      { id: "ex-1", fromStaffId: "s-doc-1", toStaffId: "s-doc-2", date: "2026-10-27", status: "pending_admin" },
      { id: "ex-2", fromStaffId: "s-nurse-1", toStaffId: "s-nurse-2", date: "2026-10-26", status: "peer_accepted" },
    ],
    doctorsPublic: [
      { id: "s-doc-1", name: "Dr. Helen Tesfaye", specialty: "General Medicine", onDuty: true },
      { id: "s-doc-2", name: "Dr. Sara Mekonnen", specialty: "Cardiology", onDuty: true },
      { id: "s-doc-3", name: "Dr. Dawit Bekele", specialty: "Pediatrics", onDuty: false },
    ],
  };

  function readSession() {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function writeSession(session) {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }

  function clearSession() {
    sessionStorage.removeItem(SESSION_KEY);
  }

  function normalizeRole(value) {
    const r = String(value || "").trim().toLowerCase();
    if (r === "admin" || r === "doctor" || r === "nurse" || r === "patient") return r;
    return null;
  }

  function roleFromEmail(email) {
    const e = email.toLowerCase();
    if (e.includes("admin")) return "admin";
    if (e.includes("doctor") || e.includes("dr.")) return "doctor";
    if (e.includes("nurse")) return "nurse";
    if (e.includes("patient")) return "patient";
    return null;
  }

  function findUser(email, password) {
    return DB.users.find(
      (u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password,
    );
  }

  function login({ email, password, role }) {
    const found = findUser(email, password);
    if (found) {
      const session = {
        userId: found.id,
        role: found.role,
        name: found.name,
        email: found.email,
        staffId: found.staffId || null,
        patientId: found.patientId || null,
        ward: found.ward || null,
        dept: found.dept || null,
      };
      writeSession(session);
      return { ok: true, session };
    }

    // Demo fallback: any password + selected/inferred role
    const inferred = normalizeRole(role) || roleFromEmail(email) || "patient";
    const demoUser = DB.users.find((u) => u.role === inferred) || DB.users[4];
    const session = {
      userId: demoUser.id,
      role: inferred,
      name: demoUser.name,
      email: email.trim(),
      staffId: demoUser.staffId || null,
      patientId: demoUser.patientId || null,
      ward: demoUser.ward || null,
      dept: demoUser.dept || null,
      demo: true,
    };
    writeSession(session);
    return { ok: true, session, demo: true };
  }

  function signup({ first, last, email, role, password }) {
    const r = normalizeRole(role);
    if (!r) return { ok: false, error: "Choose a valid role." };
    // TODO: POST /api/auth/signup
    const name = `${first} ${last}`.trim();
    const base = DB.users.find((u) => u.role === r);
    const session = {
      userId: `u-new-${Date.now()}`,
      role: r,
      name,
      email: email.trim(),
      staffId: base?.staffId || null,
      patientId: r === "patient" ? base?.patientId || "p-1" : null,
      ward: base?.ward || null,
      dept: base?.dept || null,
      demo: true,
    };
    writeSession(session);
    return { ok: true, session };
  }

  function requireAuth(allowedRoles) {
    const session = readSession();
    if (!session) {
      location.href = "login.html";
      return null;
    }
    if (allowedRoles && !allowedRoles.includes(session.role)) {
      location.href = dashboardPath(session.role);
      return null;
    }
    return session;
  }

  function can(session, permission) {
    if (!session) return false;
    return (PERMISSIONS[session.role] || []).includes(permission);
  }

  function dashboardPath() {
    return "app.html";
  }

  function staffName(id) {
    return DB.staff.find((s) => s.id === id)?.name || id;
  }

  function patientName(id) {
    return DB.patients.find((p) => p.id === id)?.name || id;
  }

  /* —— RLS helpers: only rows the role may see —— */
  const rls = {
    appointments(session) {
      const rows = DB.appointments;
      if (can(session, "appointments:read_all")) return rows;
      if (session.role === "doctor") return rows.filter((a) => a.doctorId === session.staffId);
      if (session.role === "nurse") {
        const wardPatients = new Set(DB.patients.filter((p) => p.ward === session.ward).map((p) => p.id));
        return rows.filter((a) => wardPatients.has(a.patientId) || a.doctorId === "s-doc-1");
      }
      if (session.role === "patient") return rows.filter((a) => a.patientId === session.patientId);
      return [];
    },
    patients(session) {
      if (can(session, "patients:read_all")) return DB.patients;
      if (can(session, "patients:read_assigned")) {
        return DB.patients.filter((p) => p.doctorId === session.staffId);
      }
      if (can(session, "patients:read_ward")) {
        return DB.patients.filter((p) => p.ward === session.ward);
      }
      if (session.role === "patient") {
        return DB.patients.filter((p) => p.id === session.patientId);
      }
      return [];
    },
    shifts(session) {
      if (can(session, "schedule:read") || can(session, "schedule:write")) return DB.shifts;
      if (can(session, "schedule:read_own")) {
        return DB.shifts.filter((s) => s.staffId === session.staffId);
      }
      return [];
    },
    staff(session) {
      if (can(session, "staff:read")) return DB.staff;
      if (session.staffId) return DB.staff.filter((s) => s.id === session.staffId);
      return [];
    },
    exchanges(session) {
      if (can(session, "exchanges:approve")) return DB.exchanges;
      if (can(session, "exchanges:request")) {
        return DB.exchanges.filter(
          (e) => e.fromStaffId === session.staffId || e.toStaffId === session.staffId,
        );
      }
      return [];
    },
    doctorsPublic() {
      return DB.doctorsPublic;
    },
  };

  function statsFor(session) {
    const appts = rls.appointments(session);
    const shifts = rls.shifts(session);
    const patients = rls.patients(session);
    if (session.role === "admin") {
      return [
        { label: "Active staff", value: DB.staff.filter((s) => s.status === "active").length },
        { label: "Published shifts", value: DB.shifts.filter((s) => s.status === "published").length },
        { label: "Open appointments", value: DB.appointments.filter((a) => a.status !== "draft").length },
        { label: "Pending swaps", value: DB.exchanges.filter((e) => e.status !== "approved").length },
      ];
    }
    if (session.role === "doctor") {
      return [
        { label: "My patients", value: patients.length },
        { label: "Today’s shifts", value: shifts.filter((s) => s.date === "2026-10-23").length },
        { label: "Upcoming visits", value: appts.filter((a) => a.status === "confirmed").length },
        { label: "Swap requests", value: rls.exchanges(session).length },
      ];
    }
    if (session.role === "nurse") {
      return [
        { label: "Ward patients", value: patients.length },
        { label: "My shifts", value: shifts.length },
        { label: "Clinic list", value: appts.length },
        { label: "Swap requests", value: rls.exchanges(session).length },
      ];
    }
    return [
      { label: "My visits", value: appts.length },
      { label: "Confirmed", value: appts.filter((a) => a.status === "confirmed").length },
      { label: "Requested", value: appts.filter((a) => a.status === "requested").length },
      { label: "Doctors listed", value: DB.doctorsPublic.length },
    ];
  }

  global.FilfiluAuth = {
    PERMISSIONS,
    NAV,
    DB,
    login,
    signup,
    logout: clearSession,
    session: readSession,
    requireAuth,
    can,
    rls,
    statsFor,
    staffName,
    patientName,
    dashboardPath,
    demoAccounts: [
      { email: "admin@filfilu.com", role: "admin" },
      { email: "doctor@filfilu.com", role: "doctor" },
      { email: "nurse@filfilu.com", role: "nurse" },
      { email: "patient@filfilu.com", role: "patient" },
    ],
  };
})(window);
