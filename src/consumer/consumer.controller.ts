import { Controller, Post, Body } from '@nestjs/common';
import { ConsumerService } from './consumer.service';

@Controller('consumer')
export class ConsumerController {
  constructor(private readonly consumerService: ConsumerService) {}

  @Post('connect')
  async connectTransport(
    @Body() body: { roomId: string; transportId: string; dtlsParameters: any },
  ) {
    return this.consumerService.connectTransport(
      body.roomId,
      body.transportId,
      body.dtlsParameters,
    );
  }

  @Post()
  async consume(
    @Body()
    body: {
      roomId: string;
      transportId: string;
      producerId: string;
      rtpCapabilities: any;
    },
  ) {
    return this.consumerService.consume(
      body.roomId,
      body.transportId,
      body.producerId,
      body.rtpCapabilities,
    );
  }
}
