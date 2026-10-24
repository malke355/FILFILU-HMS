import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { RequireRole } from './RequireRole'
import { HomePage } from '@/pages/HomePage'
import { LoginPage } from '@/pages/LoginPage'
import { FindDoctorsPage } from '@/pages/doctors/FindDoctorsPage'
import { OnDutyPage } from '@/pages/doctors/OnDutyPage'
import { DoctorProfilePage } from '@/pages/doctors/DoctorProfilePage'
import { AdminDashboardPage } from '@/pages/admin/AdminDashboardPage'
import { StaffPage } from '@/pages/admin/StaffPage'
import { DepartmentsPage } from '@/pages/admin/DepartmentsPage'
import { SchedulePage } from '@/pages/admin/SchedulePage'
import { ReportsPage } from '@/pages/admin/ReportsPage'
import { ExchangesPage } from '@/pages/ExchangesPage'
import { NotificationsPage } from '@/pages/NotificationsPage'
import { DoctorDashboardPage, StaffSchedulePage } from '@/pages/dashboards/DoctorDashboardPage'
import { NurseDashboardPage } from '@/pages/dashboards/NurseDashboardPage'
import {
  PatientDashboardPage,
  PatientProfilePage,
  SavedDoctorsPage,
} from '@/pages/dashboards/PatientDashboardPage'

export function AppRouter() {
  return (
    <Routes>
      <Route path="login" element={<LoginPage />} />
      <Route element={<AppShell />}>
        <Route index element={<HomePage />} />
        <Route path="doctors" element={<FindDoctorsPage />} />
        <Route path="doctors/on-duty" element={<OnDutyPage />} />
        <Route path="doctors/:id" element={<DoctorProfilePage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="exchanges" element={<ExchangesPage />} />

        <Route
          path="admin"
          element={
            <RequireRole roles={['admin']}>
              <AdminDashboardPage />
            </RequireRole>
          }
        />
        <Route
          path="admin/staff"
          element={
            <RequireRole roles={['admin']}>
              <StaffPage />
            </RequireRole>
          }
        />
        <Route
          path="admin/departments"
          element={
            <RequireRole roles={['admin']}>
              <DepartmentsPage />
            </RequireRole>
          }
        />
        <Route
          path="admin/schedule"
          element={
            <RequireRole roles={['admin']}>
              <SchedulePage />
            </RequireRole>
          }
        />
        <Route
          path="admin/reports"
          element={
            <RequireRole roles={['admin']}>
              <ReportsPage />
            </RequireRole>
          }
        />

        <Route
          path="doctor"
          element={
            <RequireRole roles={['doctor']}>
              <DoctorDashboardPage />
            </RequireRole>
          }
        />
        <Route
          path="doctor/schedule"
          element={
            <RequireRole roles={['doctor']}>
              <StaffSchedulePage roleLabel="doctor" />
            </RequireRole>
          }
        />

        <Route
          path="nurse"
          element={
            <RequireRole roles={['nurse']}>
              <NurseDashboardPage />
            </RequireRole>
          }
        />
        <Route
          path="nurse/schedule"
          element={
            <RequireRole roles={['nurse']}>
              <StaffSchedulePage roleLabel="nurse" />
            </RequireRole>
          }
        />

        <Route
          path="patient"
          element={
            <RequireRole roles={['patient']}>
              <PatientDashboardPage />
            </RequireRole>
          }
        />
        <Route
          path="patient/saved"
          element={
            <RequireRole roles={['patient']}>
              <SavedDoctorsPage />
            </RequireRole>
          }
        />
        <Route
          path="patient/profile"
          element={
            <RequireRole roles={['patient']}>
              <PatientProfilePage />
            </RequireRole>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
