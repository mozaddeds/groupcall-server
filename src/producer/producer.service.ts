import { Injectable } from '@nestjs/common';
import { MediasoupService } from 'src/mediasoup/mediasoup.service';

@Injectable()
export class ProducerService {
  constructor(private readonly mediasoupService: MediasoupService) {}

  async connectTransport(roomId: string, transportId: string, dtlsParameters: any) {
    const transport = this.mediasoupService.getTransport(roomId, transportId);
    if (!transport) throw new Error(`Transport not found: ${transportId}`);

    await transport.connect({ dtlsParameters });
    return { connected: true };
  }

  async produce(roomId: string, transportId: string, kind: 'audio' | 'video', rtpParameters: any) {
    const transport = this.mediasoupService.getTransport(roomId, transportId);
    if (!transport) throw new Error(`Transport not found: ${transportId}`);

    const producer = await transport.produce({
      kind,
      rtpParameters,
    });

    return { 
      id: producer.id,
      kind: producer.kind,
      rtpParameters: producer.rtpParameters
    };
  }
}