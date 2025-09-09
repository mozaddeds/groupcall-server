import { Module } from '@nestjs/common';
import { TransportService } from './transport.service';
import { TransportController } from './transport.controller';
import { MediasoupModule } from 'src/mediasoup/mediasoup.module';

@Module({
  imports: [MediasoupModule],
  controllers: [TransportController],
  providers: [TransportService],
})
export class TransportModule {}
