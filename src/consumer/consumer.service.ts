import { Injectable } from '@nestjs/common';
import { MediasoupService } from 'src/mediasoup/mediasoup.service';

@Injectable()
export class ConsumerService {
  constructor(private readonly mediasoupService: MediasoupService) {}

  async consume(roomId: string, transportId: string, producerId: string, rtpCapabilities: any) {
    const router = this.mediasoupService.getRouter(roomId);
    if (!router) throw new Error(`Router not found for room: ${roomId}`);

    const transport = this.mediasoupService.getTransport(roomId, transportId);
    if (!transport) throw new Error(`Transport not found: ${transportId}`);

    // Use type assertion for canConsume check
    const canConsume = (router as any).canConsume({
      producerId,
      rtpCapabilities
    });

    if (!canConsume) {
      throw new Error('Cannot consume this producer');
    }

    const consumer = await transport.consume({
      producerId,
      rtpCapabilities,
      paused: false,
    });

    return {
      id: consumer.id,
      producerId: consumer.producerId,
      kind: consumer.kind,
      rtpParameters: consumer.rtpParameters,
      type: consumer.type,
    };
  }
}