import { Injectable, type MessageEvent } from '@nestjs/common';
import { filter, finalize, map, Subject } from 'rxjs';
import { SseEvent } from './dto/sse-event.dto';

@Injectable()
export class SseService {
  // Có vấn đề Subject -> User A, B,... -> Filter
  private eventsStreams = new Subject<SseEvent>();

  sendEventToUser(event: SseEvent) {
    this.eventsStreams.next(event);
  }

  subscribeToEvents(userId: string) {
    return this.eventsStreams.asObservable().pipe(
      filter((e: SseEvent) => e.userId === userId),
      map((e: SseEvent): MessageEvent => ({ data: e.data, type: e.type })),

      finalize(() =>
        console.log(`User ${userId} unsubscribed from SSE events`),
      ),
    );
  }
}
