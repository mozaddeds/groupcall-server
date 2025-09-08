import { Injectable } from '@nestjs/common';
import { MediasoupService } from 'src/mediasoup/mediasoup.service';


@Injectable()
export class RoomService {
  constructor(private readonly mediasoupService: MediasoupService) {}

  async createRoom(roomId: string) {
    const router = await this.mediasoupService.createRouter(roomId);
    return { roomId, routerId: router.id };
  }

  async deleteRoom(roomId: string) {
    this.mediasoupService.removeRouter(roomId);
    return { success: true };
  }

  getRoomInfo(roomId: string) {
    const router = this.mediasoupService.getRouter(roomId);
    return { roomId, exists: !!router };
  }
}