import { io } from 'socket.io-client';

const SOCKET_URL =
  process.env.REACT_APP_SOCKET_URL ||
  (process.env.NODE_ENV === 'production' ? undefined : 'http://localhost:8000');

class SocketService {
  constructor() {
    this.socket = null;
  }

  connect(token, options = {}) {
    if (this.socket && this.socket.connected) {
      return this.socket;
    }

    this.socket = io(SOCKET_URL, {
      path: '/socket.io',
      transports: ['websocket'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      auth: token ? { token } : {},
      ...options,
    });

    this.socket.on('connect', () => {
      console.log('Socket.IO connecte', this.socket.id);
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Socket.IO deconnecte', reason);
    });

    this.socket.on('connect_error', (error) => {
      console.error('Erreur Socket.IO:', error.message);
    });

    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  getSocket() {
    return this.socket;
  }

  isConnected() {
    return !!this.socket?.connected;
  }
}

export const socketService = new SocketService();
export default socketService;
