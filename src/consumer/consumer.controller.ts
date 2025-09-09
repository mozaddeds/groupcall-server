import { Controller, Post, Body } from '@nestjs/common';
import { ConsumerService } from './consumer.service';

@Controller('consumer')
export class ConsumerController {
  constructor(private readonly consumerService: ConsumerService) {}

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
