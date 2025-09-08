import { Controller, Post, Delete, Param, Body } from '@nestjs/common';
import { RoomService } from './room.service';
import { CreateRoomDto } from './dto/create-room.dto';

@Controller('room')
export class RoomController {
  constructor(private readonly roomService: RoomService) {}

  @Post()
  async createRoom(@Body() createRoomDto: CreateRoomDto) {
    return this.roomService.createRoom(createRoomDto.roomId);
  }

  @Delete(':roomId')
  async deleteRoom(@Param('roomId') roomId: string) {
    return this.roomService.deleteRoom(roomId);
  }

  @Post(':roomId/status')
  getRoomStatus(@Param('roomId') roomId: string) {
    return this.roomService.getRoomInfo(roomId);
  }
}