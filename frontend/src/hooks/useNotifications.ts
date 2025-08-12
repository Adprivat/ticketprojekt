import { useState, useEffect } from 'react';
import { useSocket } from '../contexts/SocketContext';

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  timestamp: string; // ISO string
  read: boolean;
  ticketId?: string;
}

export const useNotifications = () => {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const { socket, isConnected } = useSocket();

  useEffect(() => {
    if (socket && isConnected) {
      // Listen for new notifications
      socket.on('notification', (data: any) => {
        const raw = data.data || data; // tolerate different payloads
        const notification: AppNotification = {
          id: raw.id,
          type: raw.type,
            title: raw.title,
            message: raw.message,
            timestamp: raw.createdAt,
            read: raw.read,
            ticketId: raw.ticketId,
        };
        setNotifications(prev => {
          if (prev.find(n => n.id === notification.id)) return prev; // avoid dupes
          return [notification, ...prev].slice(0, 50);
        });
        if (!notification.read) setUnreadCount(prev => prev + 1);
      });

      // Listen for notification count updates
      socket.on('notification_count', (data: any) => {
        if (typeof data.unreadCount === 'number') setUnreadCount(data.unreadCount);
      });

      // Listen for notifications list
      const handleListPayload = (data: any) => {
        if (!data || !Array.isArray(data.notifications)) return;
        const formatted: AppNotification[] = data.notifications.map((n: any) => ({
          id: n.id,
          type: n.type,
          title: n.title,
          message: n.message,
          timestamp: n.createdAt || n.timestamp || new Date().toISOString(),
          read: n.read,
          ticketId: n.ticketId,
        }));
  setNotifications(formatted);
        if (typeof data.unreadCount === 'number') {
          setUnreadCount(data.unreadCount);
        } else {
          // Fallback berechnen
            const count = formatted.filter(n => !n.read).length;
            setUnreadCount(count);
        }
      };

      socket.on('notifications_history', handleListPayload); // legacy name
      socket.on('notifications_list', handleListPayload); // broadcaster name

      // Listen for mark-all events (two naming variants)
      const handleMarkAll = () => {
        setUnreadCount(0);
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      };
      socket.on('notifications_marked_read', handleMarkAll); // legacy
      socket.on('all_notifications_read', handleMarkAll); // broadcaster name

      // Request initial notifications
      socket.emit('get_notifications', { limit: 20, offset: 0 });

      // Cleanup listeners
      return () => {
        socket.off('notification');
        socket.off('notification_count');
        socket.off('notifications_history');
        socket.off('notifications_list');
        socket.off('notifications_marked_read');
        socket.off('all_notifications_read');
      };
    }
  }, [socket, isConnected]);

  const markAsRead = (notificationId: string) => {
    if (socket) {
      socket.emit('notification_ack', { notificationId });
      
      // Optimistically update local state
      setNotifications(prev =>
        prev.map(n =>
          n.id === notificationId ? { ...n, read: true } : n
        )
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
  };

  const markAllAsRead = () => {
    if (socket) {
      socket.emit('mark_all_read');
      
      // Optimistically update local state
      setNotifications(prev =>
        prev.map(n => ({ ...n, read: true }))
      );
      setUnreadCount(0);
    }
  };

  return { notifications, unreadCount, markAsRead, markAllAsRead };
};