import { useState, useEffect } from 'react';
import { useSocket } from '../contexts/SocketContext';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
}

export const useNotifications = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const { socket, isConnected } = useSocket();

  useEffect(() => {
    if (socket && isConnected) {
      // Listen for new notifications
      socket.on('notification', (data: any) => {
        const notification: Notification = {
          id: data.data.id,
          type: data.data.type,
          title: data.data.title,
          message: data.data.message,
          timestamp: data.data.createdAt,
          read: data.data.read,
        };

        setNotifications(prev => [notification, ...prev]);
        if (!notification.read) {
          setUnreadCount(prev => prev + 1);
        }
      });

      // Listen for notification count updates
      socket.on('notification_count', (data: any) => {
        setUnreadCount(data.unreadCount);
      });

      // Listen for notifications list
      socket.on('notifications_list', (data: any) => {
        const formattedNotifications: Notification[] = data.notifications.map((n: any) => ({
          id: n.id,
          type: n.type,
          title: n.title,
          message: n.message,
          timestamp: n.createdAt,
          read: n.read,
        }));
        setNotifications(formattedNotifications);
      });

      // Request initial notifications
      socket.emit('get_notifications', { limit: 20, offset: 0 });

      // Cleanup listeners
      return () => {
        socket.off('notification');
        socket.off('notification_count');
        socket.off('notifications_list');
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

  return {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
  };
};