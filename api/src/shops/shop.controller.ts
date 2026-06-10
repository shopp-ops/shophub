import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Delete,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { ShopService } from './shop.service';
import { AuthenticatedUser } from 'src/auth/strategies/jwt.strategy';
import { CreateShopDto } from './dto/create-shop.dto';
import { UpdateShopDto } from './dto/update-shop.dto';

@Controller('shops')
@UseGuards(JwtAuthGuard)
export class ShopController {
  constructor(private shopService: ShopService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Request() req: { user: AuthenticatedUser }, @Body() dto: CreateShopDto) {
    return this.shopService.create(req.user.id, dto);
  }

  @Get()
  findAll(@Request() req: { user: AuthenticatedUser }) {
    return this.shopService.findAllByUser(req.user.id);
  }

  @Get(':id')
  findOneForUser(@Request() req: { user: AuthenticatedUser }, @Param('id') id: string) {
    return this.shopService.findByIdForUser(id, req.user.id);
  }

  @Put(':id')
  update(@Request() req: { user: AuthenticatedUser }, @Param('id') id: string, @Body() dto: UpdateShopDto) {
    return this.shopService.update(id, req.user.id, dto);
  }

  @Delete(':id')
  remove(@Request() req: { user: AuthenticatedUser }, @Param('id') id: string) {
    return this.shopService.remove(id, req.user.id);
  }
}
