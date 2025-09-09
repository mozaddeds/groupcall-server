import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MediasoupModule } from './mediasoup/mediasoup.module';
import { RoomModule } from './room/room.module';
import { TransportModule } from './transport/transport.module';
import { ProducerModule } from './producer/producer.module';
import { ConsumerModule } from './consumer/consumer.module';
import { WebsocketGateway } from './websocket/websocket.gateway';

@Module({
  imports: [
    MediasoupModule, 
    RoomModule, 
    TransportModule, 
    ProducerModule, 
    ConsumerModule
  ],
  controllers: [AppController],
  providers: [AppService, WebsocketGateway],
})
export class AppModule {}
