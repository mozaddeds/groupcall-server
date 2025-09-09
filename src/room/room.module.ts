import { Module } from '@nestjs/common';
import { RoomService } from './room.service';
import { RoomController } from './room.controller';
import { MediasoupModule } from 'src/mediasoup/mediasoup.module';

@Module({
  imports: [MediasoupModule],
  controllers: [RoomController],
  providers: [RoomService],
})
export class RoomModule {}
