import { Injectable } from '@nestjs/common';
import { MediasoupService } from 'src/mediasoup/mediasoup.service';


@Injectable()
export class TransportService {
  constructor(private readonly mediasoupService: MediasoupService) {}

  async createTransport(roomId: string, direction: 'send' | 'recv') {
    const transport = await this.mediasoupService.createWebRtcTransport(roomId, {
      listenIps: [
        { ip: '0.0.0.0', announcedIp: process.env.SERVER_IP || '127.0.0.1' },
      ],
      enableUdp: true,
      enableTcp: true,
      preferUdp: true,
    });

    return {
      id: transport.id,
      iceParameters: transport.iceParameters,
      iceCandidates: transport.iceCandidates,
      dtlsParameters: transport.dtlsParameters,
      sctpParameters: transport.sctpParameters,
    };
  }
}