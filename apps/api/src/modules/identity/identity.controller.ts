import { Controller, Post, Body, HttpStatus, Res } from '@nestjs/common';
import { Response } from 'express';
import { IdentityService } from './identity.service';
import { RegisterDto, LoginDto } from './identity.dto';

@Controller('auth')
export class IdentityController {
  constructor(private readonly identityService: IdentityService) {}

  @Post('register')
  async register(@Body() dto: RegisterDto, @Res() res: Response) {
    const user = await this.identityService.register(dto);
    return res.status(HttpStatus.CREATED).json(user);
  }

  @Post('login')
  async login(@Body() dto: LoginDto, @Res() res: Response) {
    const tokens = await this.identityService.login(dto);
    return res.status(HttpStatus.OK).json(tokens);
  }

  @Post('admin/login')
  async adminLogin(@Body() dto: LoginDto, @Res() res: Response) {
    const result = await this.identityService.adminLogin(dto);
    return res.status(HttpStatus.OK).json(result);
  }

  @Post('refresh')
  async refresh(@Body('refresh_token') refreshToken: string, @Res() res: Response) {
    const tokens = await this.identityService.refresh(refreshToken);
    return res.status(HttpStatus.OK).json(tokens);
  }

  @Post('logout')
  async logout(@Res() res: Response) {
    await this.identityService.logout();
    return res.status(HttpStatus.OK).json({ message: 'Logged out' });
  }
}
