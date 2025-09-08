import { Controller } from '@nestjs/common';
import { MediasoupService } from './mediasoup.service';

@Controller('mediasoup')
export class MediasoupController {
  constructor(private readonly mediasoupService: MediasoupService) {}
}
