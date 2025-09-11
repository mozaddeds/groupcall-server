import { Injectable } from '@nestjs/common';
import { MediasoupService } from 'src/mediasoup/mediasoup.service';

@Injectable()
export class ConsumerService {
  constructor(private readonly mediasoupService: MediasoupService) {}

  async connectTransport(
    roomId: string,
    transportId: string,
    dtlsParameters: any,
  ) {
    const transport = this.mediasoupService.getTransport(roomId, transportId);
    if (!transport) throw new Error(`Transport not found: ${transportId}`);

    await transport.connect({ dtlsParameters });
    return { connected: true };
  }

  async consume(
    roomId: string,
    transportId: string,
    producerId: string,
    rtpCapabilities: any,
  ) {
    const transport = this.mediasoupService.getTransport(roomId, transportId);
    if (!transport) throw new Error(`Transport not found: ${transportId}`);

    const router = this.mediasoupService.getRouter(roomId);
    if (!router) throw new Error(`Router not found for room: ${roomId}`);

    // Check if the router can consume the specified producer
    if (!router.canConsume({ producerId, rtpCapabilities })) {
      throw new Error('Cannot consume this producer');
    }

    const consumer = await transport.consume({
      producerId,
      rtpCapabilities,
      paused: true,
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
