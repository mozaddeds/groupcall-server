import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

interface User {
  socketId: string;
  username: string;
  roomId: string | null;
  status: 'available' | 'in-call' | 'ringing';
}

@WebSocketGateway({
  cors: {
    origin: ['http://localhost:3000'],
    credentials: true,
  },
})
export class WebsocketGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private rooms: Map<string, Set<string>> = new Map();
  private participants: Map<string, User> = new Map();
  private userLookup: Map<string, string> = new Map();
  private userSessions: Map<string, string> = new Map();

  handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
    // Generate a unique session ID for this client
    const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    client.data.sessionId = sessionId;
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);

    const participant = this.participants.get(client.id);
    if (participant) {
      this.leaveRoom(client, participant.roomId);

      // Remove from user lookup
      if (participant.username) {
        // Only remove if this socket is the one registered for this username
        if (this.userLookup.get(participant.username) === client.id) {
          this.userLookup.delete(participant.username);
        }
      }
    }

    // Remove session
    if (client.data.sessionId) {
      this.userSessions.delete(client.data.sessionId);
    }

    this.participants.delete(client.id);
  }

  @SubscribeMessage('set-username')
  handleSetUsername(client: Socket, username: string) {
    // Validate username
    if (!username || username.trim().length === 0) {
      client.emit('username-error', { message: 'Username cannot be empty' });
      return { success: false, error: 'Username cannot be empty' };
    }

    if (username.length > 20) {
      client.emit('username-error', {
        message: 'Username must be less than 20 characters',
      });
      return {
        success: false,
        error: 'Username must be less than 20 characters',
      };
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      client.emit('username-error', {
        message:
          'Username can only contain letters, numbers, underscores, and hyphens',
      });
      return {
        success: false,
        error:
          'Username can only contain letters, numbers, underscores, and hyphens',
      };
    }

    // Check if username is already in use
    const existingSocketId = this.userLookup.get(username);
    if (existingSocketId && existingSocketId !== client.id) {
      // Check if the existing user is still connected
      const existingSocket = this.server.sockets.sockets.get(existingSocketId);
      if (existingSocket && existingSocket.connected) {
        client.emit('username-error', { message: 'Username already in use' });
        return { success: false, error: 'Username already in use' };
      } else {
        // Clean up stale entry
        this.userLookup.delete(username);
        this.participants.delete(existingSocketId);
      }
    }

    // Store username with session
    if (client.data.sessionId) {
      this.userSessions.set(client.data.sessionId, username);
    }

    // Update user lookup
    this.userLookup.set(username, client.id);

    // Update participant record if it exists
    const existingParticipant = this.participants.get(client.id);
    if (existingParticipant) {
      existingParticipant.username = username;
      this.participants.set(client.id, existingParticipant);
    } else {
      this.participants.set(client.id, {
        socketId: client.id,
        username,
        roomId: null,
        status: 'available',
      });
    }

    client.emit('username-set', { username });
    return { success: true, username };
  }

  @SubscribeMessage('get-username')
  handleGetUsername(client: Socket) {
    if (client.data.sessionId) {
      const username = this.userSessions.get(client.data.sessionId);
      return { success: true, username: username || null };
    }
    return { success: false, username: null };
  }

  @SubscribeMessage('join-room')
  handleJoinRoom(client: Socket, data: { roomId: string }) {
    // Get username from session
    let username = '';
    if (client.data.sessionId) {
      username = this.userSessions.get(client.data.sessionId) || '';
    }

    if (!username) {
      client.emit('error', {
        message: 'Username not set. Please set a username first.',
      });
      return { success: false, error: 'Username not set' };
    }

    const { roomId } = data;

    // Leave any previous room
    const previousParticipant = this.participants.get(client.id);
    if (previousParticipant && previousParticipant.roomId !== roomId) {
      this.leaveRoom(client, previousParticipant.roomId);
    }

    // Join new room - ensure room exists
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, new Set());
    }

    const room = this.rooms.get(roomId);
    if (!room) {
      console.error(`Room ${roomId} not found after creation`);
      return { success: false, error: 'Room not found' };
    }

    room.add(client.id);

    const userData: User = {
      socketId: client.id,
      username,
      roomId,
      status: 'available',
    };

    this.participants.set(client.id, userData);

    client.join(roomId);

    // Notify others in the room
    client.to(roomId).emit('user-joined', {
      socketId: client.id,
      username,
      status: 'available',
    });

    // Send current participants to the new user
    const currentParticipants = Array.from(room)
      .filter((socketId) => socketId !== client.id)
      .map((socketId) => {
        const user = this.participants.get(socketId);
        return {
          socketId: socketId,
          username: user?.username || 'Unknown',
          status: user?.status || 'available',
        };
      });

    client.emit('current-participants', currentParticipants);

    console.log(`User ${username} joined room ${roomId}`);
    return { success: true };
  }

  @SubscribeMessage('leave-room')
  handleLeaveRoom(client: Socket, roomId: string) {
    this.leaveRoom(client, roomId);
    return { success: true };
  }

  @SubscribeMessage('call-user')
  handleCallUser(
    client: Socket,
    data: {
      targetUsername: string;
      callType: 'audio' | 'video';
    },
  ) {
    const caller = this.participants.get(client.id);
    if (!caller) {
      client.emit('error', { message: 'You are not registered' });
      return;
    }

    // Check if target user exists
    const targetSocketId = this.userLookup.get(data.targetUsername);
    if (!targetSocketId) {
      client.emit('call-failed', { message: 'User not found' });
      return;
    }

    const targetUser = this.participants.get(targetSocketId);
    if (!targetUser) {
      client.emit('call-failed', { message: 'User not found' });
      return;
    }

    // Check if target is already in a call
    if (targetUser.status === 'in-call') {
      client.emit('call-failed', { message: 'User is already in a call' });
      return;
    }

    // Create a unique room ID for the call
    const callRoomId = `call-${Date.now()}-${caller.username}-${data.targetUsername}`;

    // Update caller status to ringing and set room
    caller.status = 'ringing';
    caller.roomId = callRoomId;
    this.participants.set(client.id, caller);

    // Update target status to ringing
    targetUser.status = 'ringing';
    this.participants.set(targetSocketId, targetUser);

    // Create the room if it doesn't exist
    if (!this.rooms.has(callRoomId)) {
      this.rooms.set(callRoomId, new Set());
    }

    // Send call invitation to target with the same room ID
    this.server.to(targetSocketId).emit('incoming-call', {
      from: caller.username,
      callType: data.callType,
      roomId: callRoomId, // Use the same room ID
    });

    client.emit('calling', {
      target: data.targetUsername,
      roomId: callRoomId,
      callType: data.callType,
    });
  }

  @SubscribeMessage('call-response')
  handleCallResponse(
    client: Socket,
    data: { accepted: boolean; roomId: string; from: string },
  ) {
    const respondent = this.participants.get(client.id);
    if (!respondent) {
      return;
    }

    const callerSocketId = this.userLookup.get(data.from);
    if (!callerSocketId) {
      client.emit('error', { message: 'Caller not found' });
      return;
    }

    if (data.accepted) {
      // Update respondent status
      respondent.status = 'in-call';
      respondent.roomId = data.roomId;
      this.participants.set(client.id, respondent);

      // Join the call room
      if (!this.rooms.has(data.roomId)) {
        this.rooms.set(data.roomId, new Set());
      }
      const room = this.rooms.get(data.roomId);
      if (room) {
        room.add(client.id);
        client.join(data.roomId);

        // Update caller status
        const caller = this.participants.get(callerSocketId);
        if (caller) {
          caller.status = 'in-call';
          this.participants.set(callerSocketId, caller);

          // Join caller to room if not already
          if (!room.has(callerSocketId)) {
            room.add(callerSocketId);
            this.server.sockets.sockets.get(callerSocketId)?.join(data.roomId);
          }
        }

        // Notify both parties
        this.server.to(callerSocketId).emit('call-accepted', {
          roomId: data.roomId,
          respondent: respondent.username,
        });

        // Send participant list to both users
        const participants = Array.from(room).map((socketId) => {
          const user = this.participants.get(socketId);
          return {
            socketId,
            username: user?.username,
            status: user?.status,
          };
        });

        this.server.to(data.roomId).emit('current-participants', participants);
      }
    } else {
      // Reset respondent status
      respondent.status = 'available';
      this.participants.set(client.id, respondent);

      // Reset caller status
      const caller = this.participants.get(callerSocketId);
      if (caller) {
        caller.status = 'available';
        this.participants.set(callerSocketId, caller);
      }

      // Notify caller of rejection
      this.server.to(callerSocketId).emit('call-rejected', {
        from: respondent.username,
      });
    }
  }

  @SubscribeMessage('add-participant')
  handleAddParticipant(client: Socket, data: { username: string }) {
    const caller = this.participants.get(client.id);
    if (!caller || caller.status !== 'in-call' || !caller.roomId) {
      client.emit('error', { message: 'You are not in a call' });
      return;
    }

    // Check if target user exists
    const targetSocketId = this.userLookup.get(data.username);
    if (!targetSocketId) {
      client.emit('error', { message: 'User not found' });
      return;
    }

    const targetUser = this.participants.get(targetSocketId);
    if (!targetUser) {
      client.emit('error', { message: 'User not found' });
      return;
    }

    // Check if target is already in a call
    if (targetUser.status === 'in-call') {
      client.emit('error', { message: 'User is already in a call' });
      return;
    }

    // Send call invitation to target
    this.server.to(targetSocketId).emit('incoming-call', {
      from: caller.username,
      callType: 'video',
      roomId: caller.roomId,
    });

    client.emit('participant-invited', { username: data.username });
  }

  @SubscribeMessage('toggle-media')
  handleToggleMedia(
    client: Socket,
    data: { mediaType: 'video' | 'audio'; enabled: boolean },
  ) {
    const user = this.participants.get(client.id);
    if (!user || !user.roomId) {
      return;
    }

    // Notify others in the room
    client.to(user.roomId).emit('media-toggled', {
      socketId: client.id,
      username: user.username,
      mediaType: data.mediaType,
      enabled: data.enabled,
    });
  }

  @SubscribeMessage('end-call')
  handleEndCall(client: Socket) {
    const user = this.participants.get(client.id);
    if (!user || !user.roomId) {
      return;
    }

    const room = this.rooms.get(user.roomId);
    if (room) {
      // Notify all participants
      client.to(user.roomId).emit('call-ended', {
        endedBy: user.username,
      });

      // Reset status for all participants
      const participantsToUpdate = Array.from(room);
      participantsToUpdate.forEach((socketId) => {
        const participant = this.participants.get(socketId);
        if (participant) {
          participant.status = 'available';
          participant.roomId = null;
          this.participants.set(socketId, participant);

          // Leave the room
          this.server.sockets.sockets
            .get(socketId)
            ?.leave(user.roomId as string);
        }
      });

      // Clean up room if it's a call room
      if (user.roomId.startsWith('call-')) {
        this.rooms.delete(user.roomId);
      }
    }

    // Reset current user status
    user.status = 'available';
    user.roomId = null;
    this.participants.set(client.id, user);

    client.emit('call-ended', { endedBy: user.username });
  }

  @SubscribeMessage('webrtc-offer')
  handleWebRTCOffer(client: Socket, data: { to: string; offer: any }) {
    client.to(data.to).emit('webrtc-offer', {
      from: client.id,
      offer: data.offer,
    });
  }

  @SubscribeMessage('webrtc-answer')
  handleWebRTCAnswer(client: Socket, data: { to: string; answer: any }) {
    client.to(data.to).emit('webrtc-answer', {
      from: client.id,
      answer: data.answer,
    });
  }

  @SubscribeMessage('ice-candidate')
  handleIceCandidate(client: Socket, data: { to: string; candidate: any }) {
    client.to(data.to).emit('ice-candidate', {
      from: client.id,
      candidate: data.candidate,
    });
  }

  private leaveRoom(client: Socket, roomId: string | null) {
    if (!roomId) return;

    const participant = this.participants.get(client.id);
    if (participant && participant.roomId === roomId) {
      client.leave(roomId);

      const roomParticipants = this.rooms.get(roomId);
      if (roomParticipants) {
        roomParticipants.delete(client.id);

        // Notify others
        client.to(roomId).emit('user-left', {
          socketId: client.id,
          username: participant.username,
        });

        // Clean up empty room
        if (roomParticipants.size === 0 && roomId.startsWith('call-')) {
          this.rooms.delete(roomId);
        }
      }

      // Reset status if leaving a call room
      if (roomId.startsWith('call-')) {
        participant.status = 'available';
        participant.roomId = null;
        this.participants.set(client.id, participant);
      }

      console.log(`User ${participant.username} left room ${roomId}`);
    }
  }
}
