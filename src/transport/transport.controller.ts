import { Controller, Post, Body } from '@nestjs/common';
import { TransportService } from './transport.service';
import { CreateTransportDto } from './dto/create-transport.dto';

@Controller('transport')
export class TransportController {
  constructor(private readonly transportService: TransportService) {}

  @Post()
  async createTransport(@Body() createTransportDto: CreateTransportDto) {
    return this.transportService.createTransport(
      createTransportDto.roomId,
      createTransportDto.direction,
    );
  }
}
