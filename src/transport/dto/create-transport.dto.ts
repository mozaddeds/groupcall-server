export class CreateTransportDto {
  roomId: string;
  direction: 'send' | 'recv'; // For producer or consumer
}