import { Module } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { OrderPaymentsController } from './payment.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Payment, PaymentSchema } from './schemas/payment.schema';
import { SseModule } from '../sse/sse.module';
import { INJECTION_TOKEN } from 'src/common/constants/injection-token.constant';
import { PaymentRepository } from './repositories/payment.repository';
import { OrderRepository } from '../order/repositories/order.repository';
import { Order, OrderSchema } from '../order/schemas/order.schema.xxx';

@Module({
  controllers: [OrderPaymentsController],
  providers: [
    PaymentService,
    {
      provide: INJECTION_TOKEN.PAYMENT_REPOSITORY,
      useClass: PaymentRepository,
    },
    {
      provide: INJECTION_TOKEN.ORDER_REPOSITORY,
      useClass: OrderRepository,
    }
  ],
  imports: [
    MongooseModule.forFeature([
      { name: Payment.name, schema: PaymentSchema },
      { name: Order.name, schema: OrderSchema }
    ]),
    SseModule,
  ],
})
export class PaymentModule {}
