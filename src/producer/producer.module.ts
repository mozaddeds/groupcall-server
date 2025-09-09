import { Module } from '@nestjs/common';
import { ProducerService } from './producer.service';
import { ProducerController } from './producer.controller';
import { MediasoupModule } from 'src/mediasoup/mediasoup.module';

@Module({
  imports: [MediasoupModule],
  controllers: [ProducerController],
  providers: [ProducerService],
})
export class ProducerModule {}
