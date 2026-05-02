import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { PaymentService } from './payment.service';
import {
  CreatePaymentByCashDto,
  CreatePaymentDto,
  RefundPaymentDto,
} from './dto/create-payment.dto';
import { RequirePermission, RequireRestaurant, Roles } from 'src/common/decorators';
import { ROLE } from 'src/common/constants/role.constant';
import { PaymentMethod } from './schemas/payment.schema';
import { StaffPermissionKey } from '../restaurant/schemas/staff.schema.xxx';
import { CurrentActor } from 'src/common/decorators/user/current-actor.decorator';

/**
 * Routes for payments scoped to a restaurant and order
 * e.g. POST /restaurants/:restaurantId/orders/:orderId/payments
 */
@Controller('restaurants/:id/orders/:orderId/payments')
export class OrderPaymentsController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post('cash')
  @RequireRestaurant()
  @RequirePermission(StaffPermissionKey.CAN_PROCESS_PAYMENT)
  async createCashPayment(
    @Param('id') restaurantId: string,
    @Param('orderId') orderId: string,
    @CurrentActor('staff_id') actorId: string | null,
    @Body() body: CreatePaymentByCashDto,
  ) {
    return this.paymentService.paymentByCash(body, restaurantId, orderId, actorId);
  }

  @Post()
  @RequireRestaurant()
  @RequirePermission(StaffPermissionKey.CAN_PROCESS_PAYMENT)
  async createPayment(
    @Param('id') restaurantId: string,
    @Param('orderId') orderId: string,
    @CurrentActor('staff_id') actorId: string | null,
    @Body() body: CreatePaymentDto,
  ) {
    return this.paymentService.createNonCashPayment(body, restaurantId, orderId, actorId);
  }

  @Get()
  @RequireRestaurant()
  async listPayments(
    @Param('id') restaurantId: string,
    @Param('orderId') orderId: string,
  ) {
    return this.paymentService.listPayments(restaurantId, orderId);
  }

  @Get(':paymentId')
  @RequireRestaurant()
  async getPayment(
    @Param('id') restaurantId: string,
    @Param('orderId') orderId: string,
    @Param('paymentId') paymentId: string,
    @Query('includeGatewayResponse') includeGatewayResponse?: string,
  ) {
    const include = includeGatewayResponse === '1' || includeGatewayResponse === 'true';
    return this.paymentService.getPaymentById(
      restaurantId,
      orderId,
      paymentId,
      include,
    );
  }

  @Post(':paymentId/refund')
  @RequirePermission(StaffPermissionKey.CAN_PROCESS_PAYMENT)
  async refundPayment(
    @Param('id') restaurantId: string,
    @Param('orderId') orderId: string,
    @Param('paymentId') paymentId: string,
    @Body() body: RefundPaymentDto,
  ) {

    return this.paymentService.refundPayment(restaurantId, orderId, paymentId, body);
  }
}