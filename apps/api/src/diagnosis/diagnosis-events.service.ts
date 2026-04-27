import { Injectable } from '@nestjs/common';
import { EventEmitter } from 'node:events';

type Listener = (payload: unknown) => void;

@Injectable()
export class DiagnosisEventsService {
  private readonly emitter = new EventEmitter();

  emit(jobId: string, payload: unknown) {
    this.emitter.emit(jobId, payload);
  }

  subscribe(jobId: string, listener: Listener) {
    this.emitter.on(jobId, listener);
    return () => this.emitter.off(jobId, listener);
  }
}

