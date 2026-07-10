import { Controller, Sse } from '@nestjs/common';
import { SseService } from './sse.service';
import { BypassInterceptors, CurrentUser } from 'src/common/decorators';
import { Types } from 'mongoose';

@Controller('events')
export class SseController {
  constructor(private readonly sseService: SseService) {}

  @Sse('stream')
  @BypassInterceptors()
  streamEvents(@CurrentUser('sub') id: Types.ObjectId) {
    const userId = id.toString();
    console.log(`User ${userId} connected to SSE stream`);
    return this.sseService.subscribeToEvents(userId);
  }
}
