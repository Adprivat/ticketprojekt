import React, { createContext, useContext, useEffect, useState } from 'react';
import io from 'socket.io-client';

type SocketInstance = ReturnType<typeof io>;
import { useAuth } from './AuthContext';

interface SocketContextType {
  socket: SocketInstance | null;
  isConnected: boolean;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (context === undefined) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

interface SocketProviderProps {
  children: React.ReactNode;
}

export const SocketProvider: React.FC<SocketProviderProps> = ({ children }) => {
  const [socket, setSocket] = useState<SocketInstance | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const { isAuthenticated, user } = useAuth();

  useEffect(() => {
    if (isAuthenticated && user) {
      // Get token from localStorage
      const token = localStorage.getItem('token');
      
      if (token) {
        // Create socket connection
  const envWs = (import.meta.env as any).VITE_WS_URL as string | undefined;
  const wsUrl = envWs ?? `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}`;
        const newSocket = io(wsUrl, {
          auth: {
            token,
          },
          transports: ['websocket', 'polling'],
          path: '/socket.io',
        });

        // Connection event handlers
        newSocket.on('connect', () => {
          console.log('Socket connected:', newSocket.id);
          setIsConnected(true);
        });

  newSocket.on('disconnect', (reason: string) => {
          console.log('Socket disconnected:', reason);
          setIsConnected(false);
        });

  newSocket.on('connect_error', (error: Error) => {
          console.error('Socket connection error:', error);
          setIsConnected(false);
        });

        // Set up ping/pong for connection health
        const pingInterval = setInterval(() => {
          if (newSocket.connected) {
            newSocket.emit('ping');
          }
        }, 30000); // Ping every 30 seconds

  newSocket.on('pong', (data: unknown) => {
          console.log('Received pong:', data);
        });

        setSocket(newSocket);

        // Cleanup function
        return () => {
          clearInterval(pingInterval);
          newSocket.close();
          setSocket(null);
          setIsConnected(false);
        };
      }
    } else {
      // User is not authenticated, close socket if exists
      if (socket) {
        socket.close();
        setSocket(null);
        setIsConnected(false);
      }
    }
  }, [isAuthenticated, user]);

  const value: SocketContextType = {
    socket,
    isConnected,
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};