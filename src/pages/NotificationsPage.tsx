import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { useAuth } from '@/features/auth/AuthContext'
import { useStoreVersion } from '@/hooks/useStoreVersion'
import { notificationService } from '@/services/notificationService'
import { format } from 'date-fns'

export function NotificationsPage() {
  const { session } = useAuth()
  const { version, refresh } = useStoreVersion()
  void version

  if (!session) {
    return (
      <EmptyState
        title="Sign in to view notifications"
        description="Sign in to see your notifications."
      />
    )
  }

  const items = notificationService.listForUser(session.userId)

  return (
    <div>
      <PageHeader
        title="Notifications"
        description="In-app demonstration notifications stored in localStorage via typed services."
        actions={
          <Button
            variant="outline"
            onClick={() => {
              notificationService.markAllRead(session.userId)
              refresh()
            }}
          >
            Mark all read
          </Button>
        }
      />
      {items.length === 0 ? (
        <EmptyState title="Inbox empty" />
      ) : (
        <ul className="space-y-2">
          {items.map((n) => (
            <li
              key={n.id}
              className={`surface-panel flex flex-wrap items-start justify-between gap-3 p-4 ${n.read ? 'opacity-70' : ''}`}
            >
              <div>
                <p className="font-semibold text-navy-900">{n.title}</p>
                <p className="mt-1 text-sm text-ink-700">{n.body}</p>
                <p className="mt-2 text-xs text-ink-500">
                  {format(new Date(n.createdAt), 'MMM d, yyyy · HH:mm')}
                </p>
              </div>
              <div className="flex gap-2">
                {!n.read ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      notificationService.markRead(n.id)
                      refresh()
                    }}
                  >
                    Mark read
                  </Button>
                ) : null}
                {n.href ? (
                  <Link to={n.href}>
                    <Button size="sm" variant="outline">
                      Open
                    </Button>
                  </Link>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
