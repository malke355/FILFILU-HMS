/**
 * Filfilu auth + RBAC + RLS.
 * Prefers the Phase-2 API (JWT); falls back to in-browser demo data if the API is offline.
 */
(function (global) {
  const SESSION_KEY = "filfilu.session";
  const API_BASE = (
    global.FILFILU_API_BASE ||
    (typeof location !== "undefined" && location.origin && location.protocol !== "file:"
      ? `${location.origin}/api`
      : "http://127.0.0.1:8080/api")
  ).replace(/\/$/, "");

  /** @typedef {"admin"|"doctor"|"nurse"|"patient"} Role */

  const ROLE_META = {
    admin: {
      label: "Administrator",
      short: "Admin",
      accent: "#1D6FE0",
      greeting: "Hospital operations command center",
      blurb: "Set up users and roles, publish rosters, oversee appointments, and keep the system safe — not clinical charting.",
    },
    doctor: {
      label: "Doctor",
      short: "Doctor",
      accent: "#0F766E",
      greeting: "Clinical workspace",
      blurb: "Review your roster, assigned patients, today’s visits, and shift-swap requests.",
    },
    nurse: {
      label: "Nurse",
      short: "Nurse",
      accent: "#7C3AED",
      greeting: "Ward care workspace",
      blurb: "Track ward patients, clinic lists, nursing shifts, and handoff notes.",
    },
    patient: {
      label: "Patient",
      short: "Patient",
      accent: "#0369A1",
      greeting: "Personal care portal",
      blurb: "View upcoming visits, request appointments, and find doctors on duty.",
    },
  };

  const PERMISSIONS = {
    admin: [
      "dashboard:admin", "staff:read", "staff:write", "departments:read", "departments:write",
      "schedule:read", "schedule:write", "schedule:publish", "patients:read_all",
      "appointments:read_all", "appointments:manage", "reports:read", "exchanges:approve",
      "notifications:read_own", "roles:assign",
    ],
    doctor: [
      "dashboard:doctor", "schedule:read_own", "patients:read_assigned", "appointments:read_own",
      "appointments:write_own", "exchanges:request", "notifications:read_own", "notes:write_own",
    ],
    nurse: [
      "dashboard:nurse", "schedule:read_own", "patients:read_ward", "appointments:read_ward",
      "exchanges:request", "notifications:read_own", "vitals:write_ward",
    ],
    patient: [
      "dashboard:patient", "appointments:read_own", "appointments:request", "doctors:read_public",
      "schedule:read_public", "profile:read_own", "profile:write_own", "notifications:read_own",
    ],
  };

  const NAV = {
    admin: [
      { id: "overview", label: "Command center", icon: "grid" },
      { id: "staff", label: "Staff & roles", icon: "users" },
      { id: "schedule", label: "Duty schedule", icon: "calendar" },
      { id: "appointments", label: "Appointments", icon: "clipboard" },
      { id: "exchanges", label: "Approvals", icon: "swap" },
      { id: "reports", label: "Analytics", icon: "chart" },
    ],
    doctor: [
      { id: "overview", label: "Today", icon: "grid" },
      { id: "schedule", label: "My roster", icon: "calendar" },
      { id: "patients", label: "My patients", icon: "heart" },
      { id: "appointments", label: "Clinic visits", icon: "clipboard" },
      { id: "exchanges", label: "Shift swaps", icon: "swap" },
      { id: "notifications", label: "Alerts", icon: "bell" },
    ],
    nurse: [
      { id: "overview", label: "Ward overview", icon: "grid" },
      { id: "ward", label: "Patient board", icon: "bed" },
      { id: "schedule", label: "My shifts", icon: "calendar" },
      { id: "appointments", label: "Clinic list", icon: "clipboard" },
      { id: "exchanges", label: "Shift swaps", icon: "swap" },
      { id: "notifications", label: "Handoffs", icon: "bell" },
    ],
    patient: [
      { id: "overview", label: "Home", icon: "grid" },
      { id: "appointments", label: "My visits", icon: "clipboard" },
      { id: "doctors", label: "Find a doctor", icon: "stethoscope" },
      { id: "availability", label: "Doctor schedules", icon: "calendar" },
      { id: "notifications", label: "Updates", icon: "bell" },
      { id: "profile", label: "My profile", icon: "user" },
    ],
  };

  function t(key, vars) {
    const I = global.FilfiluI18n;
    if (!I || !I.t) return key;
    return I.t(key, vars);
  }

  function roleMeta(role) {
    const base = ROLE_META[role];
    if (!base) return base;
    if (!global.FilfiluI18n) return { ...base };
    return {
      ...base,
      label: t("role." + role),
      short: t("role." + role + ".short"),
      greeting: t("role." + role + ".greeting"),
      blurb: t("role." + role + ".blurb"),
    };
  }

  function navFor(role) {
    return (NAV[role] || []).map((item) => ({
      ...item,
      label: global.FilfiluI18n ? t("nav." + role + "." + item.id) : item.label,
    }));
  }

    const DB = {
    users: [
      { id: "u-admin", role: "admin", name: "Selam Bekele", email: "admin@filfilu.com", password: "filfilu", title: "Hospital Administrator" },
      { id: "u-doc-1", role: "doctor", name: "Dr. Helen Tesfaye", email: "doctor@filfilu.com", password: "filfilu", staffId: "s-doc-1", dept: "General Medicine", title: "Consultant Physician" },
      { id: "u-doc-2", role: "doctor", name: "Dr. Sara Mekonnen", email: "sara@filfilu.com", password: "filfilu", staffId: "s-doc-2", dept: "Cardiology", title: "Cardiologist" },
      { id: "u-nurse-1", role: "nurse", name: "Rahel Abebe", email: "nurse@filfilu.com", password: "filfilu", staffId: "s-nurse-1", ward: "Ward A", dept: "Maternity", title: "Senior Nurse" },
      { id: "u-pat-1", role: "patient", name: "Amina Mohammed", email: "patient@filfilu.com", password: "filfilu", patientId: "p-1", title: "Patient" },
      { id: "u-pat-2", role: "patient", name: "Yonas Hailu", email: "yonas@filfilu.com", password: "filfilu", patientId: "p-2", title: "Patient" },
    ],
    staff: [
      { id: "s-doc-1", name: "Dr. Helen Tesfaye", role: "doctor", dept: "General Medicine", status: "active", phone: "+251 911 100 001" },
      { id: "s-doc-2", name: "Dr. Sara Mekonnen", role: "doctor", dept: "Cardiology", status: "active", phone: "+251 911 100 002" },
      { id: "s-doc-3", name: "Dr. Dawit Bekele", role: "doctor", dept: "Pediatrics", status: "active", phone: "+251 911 100 003" },
      { id: "s-doc-4", name: "Dr. Rahel Desta", role: "doctor", dept: "Maternity", status: "active", phone: "+251 911 100 004" },
      { id: "s-doc-5", name: "Dr. Bemnet Girma", role: "doctor", dept: "Orthopedics", status: "active", phone: "+251 911 100 005" },
      { id: "s-doc-6", name: "Dr. Kidist Alemu", role: "doctor", dept: "Neurology", status: "active", phone: "+251 911 100 006" },
      { id: "s-doc-7", name: "Dr. Yared Negash", role: "doctor", dept: "Dermatology", status: "active", phone: "+251 911 100 007" },
      { id: "s-doc-8", name: "Dr. Meron Tadesse", role: "doctor", dept: "Ophthalmology", status: "active", phone: "+251 911 100 008" },
      { id: "s-nurse-1", name: "Rahel Abebe", role: "nurse", dept: "Maternity", ward: "Ward A", status: "active", phone: "+251 911 100 011" },
      { id: "s-nurse-2", name: "Lidya Tadesse", role: "nurse", dept: "General Medicine", ward: "Ward B", status: "active", phone: "+251 911 100 012" },
      { id: "s-admin", name: "Selam Bekele", role: "admin", dept: "Administration", status: "active", phone: "+251 911 100 099" },
    ],
    patients: [
      { id: "p-1", name: "Amina Mohammed", age: 29, sex: "F", doctorId: "s-doc-1", ward: null, bed: null, condition: "Hypertension follow-up", blood: "O+", phone: "+251 911 200 001" },
      { id: "p-2", name: "Yonas Hailu", age: 41, sex: "M", doctorId: "s-doc-2", ward: "Ward A", bed: "A-12", condition: "Cardiac monitoring", blood: "A+", phone: "+251 911 200 002" },
      { id: "p-3", name: "Hana Kebede", age: 8, sex: "F", doctorId: "s-doc-3", ward: "Ward B", bed: "B-03", condition: "Pediatric fever review", blood: "B+", phone: "+251 911 200 003" },
      { id: "p-4", name: "Mulugeta Assefa", age: 55, sex: "M", doctorId: "s-doc-1", ward: "Ward A", bed: "A-07", condition: "Diabetes review", blood: "AB+", phone: "+251 911 200 004" },
      { id: "p-5", name: "Kidist Alemu", age: 33, sex: "F", doctorId: "s-doc-2", ward: null, bed: null, condition: "ECG screening", blood: "O-", phone: "+251 911 200 005" },
    ],
    appointments: [
      { id: "a-1", patientId: "p-1", doctorId: "s-doc-1", date: "2026-10-24", time: "09:30", dept: "General Medicine", status: "confirmed", reason: "BP check" },
      { id: "a-2", patientId: "p-1", doctorId: "s-doc-2", date: "2026-10-28", time: "11:00", dept: "Cardiology", status: "requested", reason: "Chest discomfort" },
      { id: "a-3", patientId: "p-2", doctorId: "s-doc-2", date: "2026-10-23", time: "15:30", dept: "Cardiology", status: "confirmed", reason: "Post-op review" },
      { id: "a-4", patientId: "p-3", doctorId: "s-doc-3", date: "2026-10-25", time: "10:00", dept: "Pediatrics", status: "confirmed", reason: "Fever follow-up" },
      { id: "a-5", patientId: "p-4", doctorId: "s-doc-1", date: "2026-10-26", time: "14:00", dept: "General Medicine", status: "draft", reason: "HbA1c review" },
      { id: "a-6", patientId: "p-2", doctorId: "s-doc-1", date: "2026-10-30", time: "08:45", dept: "General Medicine", status: "confirmed", reason: "Meds adjust" },
      { id: "a-7", patientId: "p-5", doctorId: "s-doc-2", date: "2026-10-24", time: "13:15", dept: "Cardiology", status: "confirmed", reason: "ECG" },
    ],
    shifts: [
      { id: "sh-1", staffId: "s-doc-1", date: "2026-10-23", slot: "08:00–16:00", dept: "General Medicine", status: "published", unit: "OPD 2" },
      { id: "sh-2", staffId: "s-doc-1", date: "2026-10-24", slot: "08:00–16:00", dept: "General Medicine", status: "published", unit: "OPD 2" },
      { id: "sh-3", staffId: "s-doc-2", date: "2026-10-23", slot: "12:00–20:00", dept: "Cardiology", status: "published", unit: "Cardio Bay" },
      { id: "sh-4", staffId: "s-nurse-1", date: "2026-10-23", slot: "07:00–19:00", dept: "Maternity", status: "published", unit: "Ward A" },
      { id: "sh-5", staffId: "s-nurse-1", date: "2026-10-24", slot: "19:00–07:00", dept: "Maternity", status: "draft", unit: "Ward A" },
      { id: "sh-6", staffId: "s-nurse-2", date: "2026-10-23", slot: "07:00–19:00", dept: "General Medicine", status: "published", unit: "Ward B" },
      { id: "sh-7", staffId: "s-doc-3", date: "2026-10-25", slot: "08:00–14:00", dept: "Pediatrics", status: "published", unit: "Peds Clinic" },
    ],
    exchanges: [
      { id: "ex-1", fromStaffId: "s-doc-1", toStaffId: "s-doc-2", date: "2026-10-27", status: "pending_admin", reason: "CME conference" },
      { id: "ex-2", fromStaffId: "s-nurse-1", toStaffId: "s-nurse-2", date: "2026-10-26", status: "peer_accepted", reason: "Family emergency" },
    ],
    doctorsPublic: [
      { id: "s-doc-1", name: "Dr. Helen Tesfaye", specialty: "General Medicine", onDuty: true, nextSlot: "Today, 3:30 PM", rating: 4.9 },
      { id: "s-doc-2", name: "Dr. Sara Mekonnen", specialty: "Cardiology", onDuty: true, nextSlot: "Tomorrow, 11:00 AM", rating: 4.8 },
      { id: "s-doc-3", name: "Dr. Dawit Bekele", specialty: "Pediatrics", onDuty: false, nextSlot: "Fri, 10:00 AM", rating: 4.7 },
      { id: "s-doc-4", name: "Dr. Rahel Desta", specialty: "Maternity", onDuty: true, nextSlot: "Today, 2:00 PM", rating: 4.8 },
      { id: "s-doc-5", name: "Dr. Bemnet Girma", specialty: "Orthopedics", onDuty: true, nextSlot: "Thu, 9:00 AM", rating: 4.6 },
      { id: "s-doc-6", name: "Dr. Kidist Alemu", specialty: "Neurology", onDuty: false, nextSlot: "Wed, 1:30 PM", rating: 4.7 },
      { id: "s-doc-7", name: "Dr. Yared Negash", specialty: "Dermatology", onDuty: true, nextSlot: "Today, 4:15 PM", rating: 4.5 },
      { id: "s-doc-8", name: "Dr. Meron Tadesse", specialty: "Ophthalmology", onDuty: false, nextSlot: "Sat, 10:30 AM", rating: 4.6 },
    ],
    /* SAMPLE: public doctor clinic availability by specialty (patients can read all) */
    doctorSchedules: [
      { id: "ds-1", doctorId: "s-doc-1", specialty: "General Medicine", day: "Monday", date: "2026-10-27", slots: ["09:00", "09:30", "10:00", "11:30", "14:00", "15:30"], room: "OPD 2", status: "open" },
      { id: "ds-2", doctorId: "s-doc-1", specialty: "General Medicine", day: "Tuesday", date: "2026-10-28", slots: ["08:30", "09:00", "10:30", "13:00", "16:00"], room: "OPD 2", status: "open" },
      { id: "ds-3", doctorId: "s-doc-1", specialty: "General Medicine", day: "Thursday", date: "2026-10-30", slots: ["09:00", "10:00", "11:00", "14:30"], room: "OPD 2", status: "limited" },
      { id: "ds-4", doctorId: "s-doc-2", specialty: "Cardiology", day: "Monday", date: "2026-10-27", slots: ["11:00", "11:30", "12:00", "15:00", "15:30"], room: "Cardio Bay", status: "open" },
      { id: "ds-5", doctorId: "s-doc-2", specialty: "Cardiology", day: "Wednesday", date: "2026-10-29", slots: ["09:30", "10:00", "13:15", "14:00"], room: "Cardio Bay", status: "open" },
      { id: "ds-6", doctorId: "s-doc-2", specialty: "Cardiology", day: "Friday", date: "2026-10-31", slots: ["10:00", "10:30", "11:00"], room: "Cardio Bay", status: "limited" },
      { id: "ds-7", doctorId: "s-doc-3", specialty: "Pediatrics", day: "Tuesday", date: "2026-10-28", slots: ["08:00", "08:30", "09:00", "09:30", "10:00"], room: "Peds Clinic", status: "open" },
      { id: "ds-8", doctorId: "s-doc-3", specialty: "Pediatrics", day: "Friday", date: "2026-10-31", slots: ["09:00", "09:45", "10:30", "11:15"], room: "Peds Clinic", status: "open" },
      { id: "ds-9", doctorId: "s-doc-4", specialty: "Maternity", day: "Monday", date: "2026-10-27", slots: ["08:00", "09:00", "10:00", "14:00", "15:00"], room: "Maternity Wing", status: "open" },
      { id: "ds-10", doctorId: "s-doc-4", specialty: "Maternity", day: "Wednesday", date: "2026-10-29", slots: ["08:30", "09:30", "11:00", "13:30"], room: "Maternity Wing", status: "open" },
      { id: "ds-11", doctorId: "s-doc-4", specialty: "Maternity", day: "Saturday", date: "2026-11-01", slots: ["09:00", "10:00", "11:00"], room: "Maternity Wing", status: "limited" },
      { id: "ds-12", doctorId: "s-doc-5", specialty: "Orthopedics", day: "Tuesday", date: "2026-10-28", slots: ["09:00", "09:40", "10:20", "14:00"], room: "Ortho 1", status: "open" },
      { id: "ds-13", doctorId: "s-doc-5", specialty: "Orthopedics", day: "Thursday", date: "2026-10-30", slots: ["08:30", "09:10", "09:50", "15:00", "15:40"], room: "Ortho 1", status: "open" },
      { id: "ds-14", doctorId: "s-doc-6", specialty: "Neurology", day: "Wednesday", date: "2026-10-29", slots: ["13:00", "13:30", "14:00", "14:30"], room: "Neuro Suite", status: "open" },
      { id: "ds-15", doctorId: "s-doc-6", specialty: "Neurology", day: "Friday", date: "2026-10-31", slots: ["10:00", "11:00", "12:00"], room: "Neuro Suite", status: "limited" },
      { id: "ds-16", doctorId: "s-doc-7", specialty: "Dermatology", day: "Monday", date: "2026-10-27", slots: ["14:00", "14:20", "14:40", "15:00", "16:00"], room: "Derm Clinic", status: "open" },
      { id: "ds-17", doctorId: "s-doc-7", specialty: "Dermatology", day: "Thursday", date: "2026-10-30", slots: ["09:00", "09:30", "10:00", "10:30"], room: "Derm Clinic", status: "open" },
      { id: "ds-18", doctorId: "s-doc-8", specialty: "Ophthalmology", day: "Tuesday", date: "2026-10-28", slots: ["10:00", "10:30", "11:00"], room: "Eye Unit", status: "limited" },
      { id: "ds-19", doctorId: "s-doc-8", specialty: "Ophthalmology", day: "Saturday", date: "2026-11-01", slots: ["09:00", "09:30", "10:00", "10:30", "11:00"], room: "Eye Unit", status: "open" },
      { id: "ds-20", doctorId: "s-doc-2", specialty: "Cardiology", day: "Saturday", date: "2026-11-01", slots: ["09:00", "09:30"], room: "Cardio Bay", status: "full" },
    ],
    notifications: [
      { id: "n-1", role: "admin", text: "2 shift swaps await your approval", time: "12m ago", level: "warn" },
      { id: "n-2", role: "admin", text: "Duty schedule draft for Mon needs publish", time: "1h ago", level: "info" },
      { id: "n-3", role: "doctor", text: "New visit request from Amina Mohammed", time: "18m ago", level: "warn" },
      { id: "n-4", role: "doctor", text: "Lab result ready for Mulugeta Assefa", time: "40m ago", level: "ok" },
      { id: "n-5", role: "nurse", text: "Ward A bed A-12 vitals due", time: "8m ago", level: "warn" },
      { id: "n-6", role: "nurse", text: "Handoff note posted for night shift", time: "2h ago", level: "info" },
      { id: "n-7", role: "patient", text: "Your Cardiology visit is requested", time: "25m ago", level: "info" },
      { id: "n-8", role: "patient", text: "Reminder: General Medicine visit tomorrow 09:30", time: "3h ago", level: "ok" },
    ],
    activity: [
      { role: "admin", text: "Published 14 shifts for General Medicine", time: "09:12" },
      { role: "admin", text: "Added Dr. Dawit Bekele to Pediatrics", time: "08:40" },
      { role: "doctor", text: "Confirmed visit a-3 for Yonas Hailu", time: "10:05" },
      { role: "doctor", text: "Requested swap with Dr. Sara for Oct 27", time: "09:50" },
      { role: "nurse", text: "Recorded vitals for bed A-12", time: "10:22" },
      { role: "nurse", text: "Accepted peer swap for Oct 26", time: "07:15" },
      { role: "patient", text: "Requested Cardiology appointment", time: "Yesterday" },
      { role: "patient", text: "Saved Dr. Helen Tesfaye", time: "Mon" },
    ],
  };

  function normalizeRole(value) {
    const r = String(value || "").trim().toLowerCase();
    return ROLE_META[r] ? r : null;
  }

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

  function toSession(user, token) {
    const role = normalizeRole(user.role);
    const userId = user.userId || user.id;
    return {
      userId,
      role,
      name: user.name,
      email: user.email,
      title: user.title || roleMeta(role).label,
      staffId: user.staffId || null,
      patientId: user.patientId || null,
      ward: user.ward || null,
      dept: user.dept || null,
      meta: roleMeta(role),
      permissions: (user.permissions && user.permissions.length ? user.permissions : PERMISSIONS[role]).slice(),
      token: token || null,
      source: token ? "api" : "local",
      loggedInAt: new Date().toISOString(),
    };
  }

  async function api(path, options = {}) {
    const headers = { ...(options.headers || {}) };
    if (options.body != null && !headers["Content-Type"]) {
      headers["Content-Type"] = "application/json";
    }
    const session = readSession();
    if (session?.token && session.token !== "cookie" && !headers.Authorization) {
      headers.Authorization = `Bearer ${session.token}`;
    }
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
      credentials: "include",
    });
    let body = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    if (!res.ok) {
      const err = new Error((body && body.error) || `HTTP ${res.status}`);
      err.status = res.status;
      err.body = body;
      throw err;
    }
    return body;
  }

  let cachedStats = null;
  let cachedActivity = [];

  async function restoreSessionFromCookie() {
    try {
      const body = await api("/auth/me");
      if (!body?.user) return null;
      const session = toSession(body.user, "cookie");
      session.cookieAuth = true;
      writeSession(session);
      return session;
    } catch {
      return null;
    }
  }

  /**
   * Start Google OAuth.
   * @param {{ intent?: "login"|"signup", role?: string }} [opts]
   * - login: only existing Filfilu accounts
   * - signup: create account for new Google email (role defaults to patient)
   */
  function beginGoogleSignIn(opts = {}) {
    const intent = opts.intent === "signup" ? "signup" : "login";
    const params = new URLSearchParams({ intent });
    if (intent === "signup" && opts.role) params.set("role", opts.role);
    location.href = `${API_BASE}/auth/google?${params}`;
  }

  async function logout() {
    try {
      await api("/auth/logout", { method: "POST", body: "{}" });
    } catch {
      /* ignore network errors — still clear local session */
    }
    clearSession();
  }

  async function hydrateFromApi(session) {
    if (!session?.token && !session?.cookieAuth) return session;
    const [staff, patients, appointments, shifts, exchanges, notifications, doctors, schedules, stats, activity] =
      await Promise.all([
        api("/staff").catch(() => null),
        api("/patients").catch(() => null),
        api("/appointments").catch(() => null),
        api("/shifts").catch(() => null),
        api("/exchanges").catch(() => null),
        api("/notifications").catch(() => null),
        api("/doctors").catch(() => null),
        api("/doctor-schedules").catch(() => null),
        api("/dashboard/stats").catch(() => null),
        api("/activity").catch(() => null),
      ]);
    if (staff?.data) DB.staff = staff.data;
    if (patients?.data) {
      DB.patients = patients.data.map((p) => ({
        ...p,
        doctorId: p.doctorId || p.doctor?.id || null,
      }));
    }
    if (appointments?.data) DB.appointments = appointments.data;
    if (shifts?.data) DB.shifts = shifts.data;
    if (exchanges?.data) DB.exchanges = exchanges.data;
    if (notifications?.data) {
      DB.notifications = notifications.data.map((n) => ({
        id: n.id,
        role: n.role || session.role,
        text: n.text,
        level: n.level,
        time: n.createdAt ? new Date(n.createdAt).toLocaleString() : "just now",
      }));
    }
    if (doctors?.data) DB.doctorsPublic = doctors.data;
    if (schedules?.data) {
      DB.doctorSchedules = schedules.data.map((s) => ({
        ...s,
        slots: Array.isArray(s.slots) ? s.slots : [],
      }));
    }
    if (stats?.data) cachedStats = stats.data;
    if (activity?.data) {
      cachedActivity = activity.data.map((a) => ({
        role: session.role,
        text: a.text,
        time: a.time ? new Date(a.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—",
      }));
      DB.activity = cachedActivity;
    }
    session.source = "api";
    writeSession(session);
    return session;
  }

  async function requestAppointment({ doctorId, date, time, dept, reason }) {
    const body = await api("/appointments", {
      method: "POST",
      body: JSON.stringify({ doctorId, date, time, dept, reason }),
    });
    await hydrateFromApi(readSession());
    return body;
  }

  async function requestVisitFromSchedule() {
    const session = readSession();
    const open = (DB.doctorSchedules || []).find((s) => s.status !== "full" && (s.slots || []).length);
    if (!open) throw new Error("No open clinic slots available.");
    return requestAppointment({
      doctorId: open.doctorId,
      date: open.date,
      time: open.slots[0],
      dept: open.specialty,
      reason: "Patient visit request",
    });
  }

  async function approvePendingExchanges() {
    const body = await api("/exchanges/approve-pending", { method: "POST", body: "{}" });
    await hydrateFromApi(readSession());
    return body;
  }

  async function publishDraftShifts() {
    const body = await api("/shifts/publish-drafts", { method: "POST", body: "{}" });
    await hydrateFromApi(readSession());
    return body;
  }

  async function requestExchange({ toStaffId, date, reason }) {
    const body = await api("/exchanges", {
      method: "POST",
      body: JSON.stringify({ toStaffId, date, reason }),
    });
    await hydrateFromApi(readSession());
    return body;
  }

  async function updateAppointmentStatus(id, patch) {
    const payload = typeof patch === "string" ? { status: patch } : patch;
    const body = await api(`/appointments/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
    await hydrateFromApi(readSession());
    return body;
  }

  async function respondToExchange(id, status) {
    const body = await api(`/exchanges/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    await hydrateFromApi(readSession());
    return body;
  }

  async function updateStaff(id, patch) {
    const body = await api(`/staff/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
    await hydrateFromApi(readSession());
    return body;
  }

  async function cleanupDuplicateAppointments() {
    const body = await api("/appointments/cleanup-duplicates", {
      method: "POST",
      body: "{}",
    });
    await hydrateFromApi(readSession());
    return body;
  }

  function findDuplicateAppointmentGroups(session) {
    const rows = rls.appointments(session).filter((a) => a.status === "requested" || a.status === "confirmed");
    const groups = new Map();
    for (const a of rows) {
      const key = [a.patientId, a.doctorId, a.date, a.time, a.reason || "", a.status].join("|");
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(a);
    }
    return [...groups.values()].filter((g) => g.length > 1);
  }

  function loginLocal({ email, password, role }) {
    const wanted = normalizeRole(role);
    const found = DB.users.find(
      (u) => u.email.toLowerCase() === String(email || "").trim().toLowerCase(),
    );

    if (found) {
      if (found.password !== password) {
        return { ok: false, error: "Incorrect password for this account." };
      }
      if (wanted && wanted !== found.role) {
        return {
          ok: false,
          error: `This account is assigned the ${roleMeta(found.role).label} role. Choose “${roleMeta(found.role).short}” or use another demo account.`,
        };
      }
      const session = toSession(found, null);
      writeSession(session);
      return { ok: true, session, offline: true };
    }

    if (!wanted) return { ok: false, error: "Select a workspace role before signing in." };
    if (!password) return { ok: false, error: "Enter your password." };
    const template = DB.users.find((u) => u.role === wanted);
    const session = toSession({
      ...template,
      id: `u-demo-${wanted}-${Date.now()}`,
      name: template.name,
      email: String(email).trim(),
      role: wanted,
    }, null);
    session.demo = true;
    writeSession(session);
    return { ok: true, session, demo: true, offline: true };
  }

  /** Perfect role assignment: account role always wins when email matches. */
  async function login({ email, password, role }) {
    try {
      const body = await api("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password, role: role || undefined }),
      });
      const session = toSession(body.user, body.token);
      writeSession(session);
      await hydrateFromApi(session);
      return { ok: true, session };
    } catch (err) {
      if (err.status === 401 || err.status === 403) {
        return { ok: false, error: err.message || "Login failed." };
      }
      // Full-stack product: API must be reachable (no silent offline login).
      return {
        ok: false,
        error: err.message || "Cannot reach the Filfilu API on this site. Start the app, then try again.",
      };
    }
  }

  function signupLocal({ first, last, email, role, password }) {
    const r = normalizeRole(role);
    if (!r) return { ok: false, error: "Choose a valid role to assign." };
    if (!password || password.length < 6) return { ok: false, error: "Password must be at least 6 characters." };
    const exists = DB.users.some((u) => u.email.toLowerCase() === String(email).trim().toLowerCase());
    if (exists) return { ok: false, error: "An account with this email already exists. Please login." };

    const template = DB.users.find((u) => u.role === r);
    const session = toSession({
      id: `u-new-${Date.now()}`,
      role: r,
      name: `${first} ${last}`.trim(),
      email: String(email).trim(),
      title: roleMeta(r).label,
      staffId: template.staffId || null,
      patientId: r === "patient" ? template.patientId || "p-1" : null,
      ward: template.ward || null,
      dept: template.dept || null,
    }, null);
    session.demo = true;
    writeSession(session);
    return { ok: true, session, offline: true };
  }

  async function signup({ first, last, email, role, password }) {
    const r = normalizeRole(role);
    if (!r) return { ok: false, error: "Choose a valid role to assign." };
    if (!password || password.length < 6) return { ok: false, error: "Password must be at least 6 characters." };
    try {
      const body = await api("/auth/signup", {
        method: "POST",
        body: JSON.stringify({ first, last, email, password, role: r }),
      });
      const session = toSession(body.user, body.token);
      writeSession(session);
      await hydrateFromApi(session);
      return { ok: true, session };
    } catch (err) {
      if (err.status === 409 || err.status === 400) {
        return { ok: false, error: err.message || "Sign up failed." };
      }
      return {
        ok: false,
        error: err.message || "Cannot reach the Filfilu API on this site. Start the app, then try again.",
      };
    }
  }

  async function postContact(payload) {
    return api("/contact", { method: "POST", body: JSON.stringify(payload) });
  }

  async function postBooking(payload) {
    return api("/bookings", { method: "POST", body: JSON.stringify(payload) });
  }

  function requireAuth() {
    const session = readSession();
    const hasAuth = session && normalizeRole(session.role) && (session.token || session.cookieAuth);
    if (!hasAuth) {
      clearSession();
      location.href = "login.html";
      return null;
    }
    session.meta = roleMeta(session.role);
    session.permissions = (session.permissions && session.permissions.length
      ? session.permissions
      : PERMISSIONS[session.role]
    ).slice();
    return session;
  }

  async function bootWorkspace() {
    let session = readSession();
    if (!session?.token && !session?.cookieAuth) {
      session = await restoreSessionFromCookie();
    }
    if (!session || !normalizeRole(session.role)) {
      clearSession();
      location.href = "login.html";
      return null;
    }
    session.meta = ROLE_META[session.role];
    session.permissions = (session.permissions && session.permissions.length
      ? session.permissions
      : PERMISSIONS[session.role]
    ).slice();
    writeSession(session);
    try {
      await hydrateFromApi(session);
      return readSession();
    } catch (err) {
      clearSession();
      location.href = "login.html";
      return null;
    }
  }

  function can(session, permission) {
    return Boolean(session && (PERMISSIONS[session.role] || []).includes(permission));
  }

  function staffName(id) {
    return DB.staff.find((s) => s.id === id)?.name || id;
  }

  function patientName(id) {
    return DB.patients.find((p) => p.id === id)?.name || id;
  }

  function initials(name) {
    return String(name || "?")
      .replace(/^Dr\.\s*/i, "")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() || "")
      .join("");
  }

  const rls = {
    appointments(session) {
      const rows = DB.appointments;
      if (can(session, "appointments:read_all")) return rows;
      if (session.role === "doctor") return rows.filter((a) => a.doctorId === session.staffId);
      if (session.role === "nurse") {
        const wardIds = new Set(DB.patients.filter((p) => p.ward === session.ward).map((p) => p.id));
        return rows.filter((a) => wardIds.has(a.patientId));
      }
      if (session.role === "patient") return rows.filter((a) => a.patientId === session.patientId);
      return [];
    },
    patients(session) {
      if (can(session, "patients:read_all")) return DB.patients;
      if (can(session, "patients:read_assigned")) return DB.patients.filter((p) => p.doctorId === session.staffId);
      if (can(session, "patients:read_ward")) return DB.patients.filter((p) => p.ward === session.ward);
      if (session.role === "patient") return DB.patients.filter((p) => p.id === session.patientId);
      return [];
    },
    shifts(session) {
      if (can(session, "schedule:read") || can(session, "schedule:write")) return DB.shifts;
      if (can(session, "schedule:read_own")) {
        // Own roster only — drafts stay hidden until published.
        return DB.shifts.filter((s) => s.staffId === session.staffId && s.status === "published");
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
        return DB.exchanges.filter((e) => e.fromStaffId === session.staffId || e.toStaffId === session.staffId);
      }
      return [];
    },
    notifications(session) {
      return DB.notifications.filter((n) => n.role === session.role);
    },
    activity(session) {
      if (cachedActivity.length) return cachedActivity;
      return DB.activity.filter((a) => a.role === session.role);
    },
    doctorsPublic() {
      return DB.doctorsPublic;
    },
    doctorSchedules(session) {
      if (can(session, "schedule:read_public") || can(session, "appointments:read_all")) {
        return DB.doctorSchedules.slice();
      }
      return [];
    },
    specialties() {
      return [...new Set(DB.doctorSchedules.map((s) => s.specialty))].sort();
    },
  };

  function statsFor(session) {
    if (cachedStats && cachedStats.length) return cachedStats;
    const appts = rls.appointments(session);
    const shifts = rls.shifts(session);
    const patients = rls.patients(session);
    const notes = rls.notifications(session);
    if (session.role === "admin") {
      return [
        { label: "Active staff", value: DB.staff.filter((s) => s.status === "active").length, hint: "Across all units" },
        { label: "Published shifts", value: DB.shifts.filter((s) => s.status === "published").length, hint: "This roster cycle" },
        { label: "Open visits", value: DB.appointments.filter((a) => a.status !== "draft").length, hint: "Hospital-wide" },
        { label: "Pending approvals", value: DB.exchanges.filter((e) => e.status !== "approved").length, hint: "Needs admin action" },
      ];
    }
    if (session.role === "doctor") {
      return [
        { label: "Assigned patients", value: patients.length, hint: "Under your care" },
        { label: "Shifts this week", value: shifts.length, hint: "Your roster" },
        { label: "Confirmed visits", value: appts.filter((a) => a.status === "confirmed").length, hint: "Clinic load" },
        { label: "Unread alerts", value: notes.length, hint: "Action items" },
      ];
    }
    if (session.role === "nurse") {
      return [
        { label: "Ward patients", value: patients.length, hint: session.ward || "Your ward" },
        { label: "My shifts", value: shifts.length, hint: "Published + draft" },
        { label: "Clinic list", value: appts.length, hint: "Ward-linked visits" },
        { label: "Handoffs", value: notes.length, hint: "Nursing alerts" },
      ];
    }
    const openSlots = DB.doctorSchedules
      .filter((s) => s.status !== "full")
      .reduce((n, s) => n + s.slots.length, 0);
    return [
      { label: "My visits", value: appts.length, hint: "All statuses" },
      { label: "Confirmed", value: appts.filter((a) => a.status === "confirmed").length, hint: "Ready to attend" },
      { label: "Specialties", value: rls.specialties().length, hint: "With open clinics" },
      { label: "Open slots", value: openSlots, hint: "Bookable this week" },
    ];
  }

  function quickActions(session) {
    if (session.role === "admin") {
      return [
        { label: "Publish schedule", view: "schedule" },
        { label: "Review approvals", view: "exchanges" },
        { label: "Manage staff roles", view: "staff" },
        { label: "Open analytics", view: "reports" },
      ];
    }
    if (session.role === "doctor") {
      return [
        { label: "Open clinic list", view: "appointments" },
        { label: "Review patients", view: "patients" },
        { label: "Request swap", view: "exchanges" },
        { label: "Check alerts", view: "notifications" },
      ];
    }
    if (session.role === "nurse") {
      return [
        { label: "Open ward board", view: "ward" },
        { label: "Today’s shifts", view: "schedule" },
        { label: "Clinic list", view: "appointments" },
        { label: "Handoff notes", view: "notifications" },
      ];
    }
    return [
      { label: "Doctor schedules", view: "availability" },
      { label: "Find a doctor", view: "doctors" },
      { label: "Book a visit", view: "appointments" },
      { label: "Care updates", view: "notifications" },
    ];
  }

  global.FilfiluAuth = {
    ROLE_META,
    roleMeta,
    navFor,
    PERMISSIONS,
    NAV,
    DB,
    API_BASE,
    api,
    login,
    signup,
    beginGoogleSignIn,
    restoreSessionFromCookie,
    postContact,
    postBooking,
    hydrateFromApi,
    bootWorkspace,
    requestAppointment,
    requestVisitFromSchedule,
    approvePendingExchanges,
    publishDraftShifts,
    requestExchange,
    updateAppointmentStatus,
    respondToExchange,
    updateStaff,
    cleanupDuplicateAppointments,
    findDuplicateAppointmentGroups,
    logout,
    session: readSession,
    requireAuth,
    can,
    rls,
    statsFor,
    quickActions,
    staffName,
    patientName,
    initials,
    normalizeRole,
    dashboardPath: () => "app.html",
    demoAccounts: [
      { email: "admin@filfilu.com", role: "admin", name: "Selam Bekele" },
      { email: "doctor@filfilu.com", role: "doctor", name: "Dr. Helen Tesfaye" },
      { email: "nurse@filfilu.com", role: "nurse", name: "Rahel Abebe" },
      { email: "patient@filfilu.com", role: "patient", name: "Amina Mohammed" },
    ],
  };
})(window);
