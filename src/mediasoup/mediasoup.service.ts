import { Injectable, OnModuleInit } from '@nestjs/common';
import * as mediasoup from 'mediasoup';

// Define proper interfaces for appData
interface RouterAppData {
  transports: Set<mediasoup.types.WebRtcTransport>;
}

// Extend the default Router type to include our appData
type CustomRouter = mediasoup.types.Router & { appData: RouterAppData };

@Injectable()
export class MediasoupService implements OnModuleInit {
  private worker: mediasoup.types.Worker;
  private routers: Map<string, CustomRouter> = new Map();

  async onModuleInit() {
    this.worker = await mediasoup.createWorker({
      logLevel: 'warn',
      rtcMinPort: 40000,
      rtcMaxPort: 49999,
    });
    console.log('Mediasoup worker created');
  }

  async createRouter(roomId: string): Promise<CustomRouter> {
    const router = (await this.worker.createRouter({
      mediaCodecs: [
        {
          kind: 'audio',
          mimeType: 'audio/opus',
          clockRate: 48000,
          channels: 2,
        },
        {
          kind: 'video',
          mimeType: 'video/VP8',
          clockRate: 90000,
          parameters: {
            'x-google-start-bitrate': 1000,
          },
        },
      ],
    })) as CustomRouter;

    // Initialize appData for tracking transports
    router.appData = {
      transports: new Set<mediasoup.types.WebRtcTransport>(),
    };

    this.routers.set(roomId, router);
    return router;
  }

  async createWebRtcTransport(roomId: string, options: mediasoup.types.WebRtcTransportOptions) {
    const router = this.routers.get(roomId);
    if (!router) {
      throw new Error(`Router not found for room: ${roomId}`);
    }

    const transport = await router.createWebRtcTransport(options);
    
    // Store the transport in appData
    router.appData.transports.add(transport);
    
    // Remove transport when it closes
    transport.on('dtlsstatechange', (dtlsState) => {
      if (dtlsState === 'closed') {
        router.appData.transports.delete(transport);
      }
    });

    transport.on('@close', () => {
      router.appData.transports.delete(transport);
    });

    return transport;
  }

  getRouter(roomId: string): CustomRouter | undefined {
    return this.routers.get(roomId);
  }

  removeRouter(roomId: string) {
    this.routers.delete(roomId);
  }

  // Helper method to get transport by ID
  getTransport(roomId: string, transportId: string): mediasoup.types.WebRtcTransport | null {
    const router = this.routers.get(roomId);
    if (!router) return null;

    return Array.from(router.appData.transports).find(transport => transport.id === transportId) || null;
  }
}