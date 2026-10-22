import type { Notification } from '@/types'
import { loadStore, uid, updateStore } from './storage'

export const notificationService = {
  listForUser(userId: string): Notification[] {
    return loadStore()
      .notifications.filter((n) => n.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  },

  unreadCount(userId: string): number {
    return this.listForUser(userId).filter((n) => !n.read).length
  },

  create(input: Omit<Notification, 'id' | 'read' | 'createdAt'> & { read?: boolean }): Notification {
    const notification: Notification = {
      id: uid('ntf'),
      read: input.read ?? false,
      createdAt: new Date().toISOString(),
      userId: input.userId,
      title: input.title,
      body: input.body,
      href: input.href,
    }
    updateStore((store) => {
      store.notifications.push(notification)
    })
    return notification
  },

  markRead(id: string): void {
    updateStore((store) => {
      const n = store.notifications.find((x) => x.id === id)
      if (n) n.read = true
    })
  },

  markAllRead(userId: string): void {
    updateStore((store) => {
      for (const n of store.notifications) {
        if (n.userId === userId) n.read = true
      }
    })
  },
}
