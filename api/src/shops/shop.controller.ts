import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { CreateShopDto } from './dto/create-shop.dto';
import { UpdateShopDto } from './dto/update-shop.dto';
import { CreateShopResult } from './create-shop-result.interface';
import { ShopService } from './shop.service';

@Controller('shops')
@UseGuards(JwtAuthGuard)
export class ShopController {
  constructor(private shopService: ShopService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Request() req: { user: AuthenticatedUser }, @Body() dto: CreateShopDto): Promise<CreateShopResult> {
    return this.shopService.create(req.user.userId, dto);
  }

  @Get()
  findAll(@Request() req: { user: AuthenticatedUser }) {
    return this.shopService.findAllByUser(req.user.userId);
  }

  @Get(':id')
  findOne(@Request() req: { user: AuthenticatedUser }, @Param('id') id: string) {
    return this.shopService.findByIdForUser(id, req.user.userId);
  }

  @Patch(':id')
  update(@Request() req: { user: AuthenticatedUser }, @Param('id') id: string, @Body() dto: UpdateShopDto) {
    return this.shopService.update(id, req.user.userId, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Request() req: { user: AuthenticatedUser }, @Param('id') id: string) {
    return this.shopService.remove(id, req.user.userId);
  }
}
