import { Controller, Post, Body } from '@nestjs/common';
import { ProducerService } from './producer.service';

@Controller('producer')
export class ProducerController {
  constructor(private readonly producerService: ProducerService) {}

  @Post('connect')
  async connectTransport(
    @Body() body: { roomId: string; transportId: string; dtlsParameters: any },
  ) {
    return this.producerService.connectTransport(
      body.roomId,
      body.transportId,
      body.dtlsParameters,
    );
  }

  @Post()
  async produce(
    @Body()
    body: {
      roomId: string;
      transportId: string;
      kind: 'audio' | 'video';
      rtpParameters: any;
    },
  ) {
    return this.producerService.produce(
      body.roomId,
      body.transportId,
      body.kind,
      body.rtpParameters,
    );
  }
}
