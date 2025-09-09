import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: ['http://localhost:3000', 'http://localhost:3001'],
    credentials: true,
  },
})
export class WebsocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private rooms: Map<string, Set<string>> = new Map(); // roomId -> participant socket IDs
  private participants: Map<string, { roomId: string; username: string }> = new Map(); // socketId -> participant info

  handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
    
    const participant = this.participants.get(client.id);
    if (participant) {
      this.leaveRoom(client, participant.roomId);
    }
  }

  @SubscribeMessage('join-room')
  handleJoinRoom(client: Socket, data: { roomId: string; username: string }) {
    const { roomId, username } = data;
    
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
    this.participants.set(client.id, { roomId, username });

    client.join(roomId);
    
    // Notify others in the room
    client.to(roomId).emit('user-joined', {
      socketId: client.id,
      username,
    });

    // Send current participants to the new user
    const currentParticipants = Array.from(room)
      .filter(socketId => socketId !== client.id)
      .map(socketId => ({
        socketId,
        username: this.participants.get(socketId)?.username || 'Unknown',
      }));

    client.emit('current-participants', currentParticipants);
    
    console.log(`User ${username} joined room ${roomId}`);
    return { success: true };
  }

  @SubscribeMessage('leave-room')
  handleLeaveRoom(client: Socket, roomId: string) {
    this.leaveRoom(client, roomId);
    return { success: true };
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

  private leaveRoom(client: Socket, roomId: string) {
    const participant = this.participants.get(client.id);
    if (participant && participant.roomId === roomId) {
      client.leave(roomId);
      this.participants.delete(client.id);
      
      const roomParticipants = this.rooms.get(roomId);
      if (roomParticipants) {
        roomParticipants.delete(client.id);
        
        // Notify others
        client.to(roomId).emit('user-left', {
          socketId: client.id,
          username: participant.username,
        });

        // Clean up empty room
        if (roomParticipants.size === 0) {
          this.rooms.delete(roomId);
        }
      }
      
      console.log(`User ${participant.username} left room ${roomId}`);
    }
  }
}