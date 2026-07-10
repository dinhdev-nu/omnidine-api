import type { MessageEvent } from '@nestjs/common';

export interface SseEvent {
  userId: string;
  data: MessageEvent['data'];
  type: string;
}
