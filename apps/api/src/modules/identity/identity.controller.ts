import { Controller, Post, Body, HttpStatus, Res, Req } from '@nestjs/common';
import { Response, Request } from 'express';
import { IdentityService } from './identity.service';
import { RegisterDto, LoginDto, LoginPhoneDto } from './identity.dto';

@Controller('auth')
export class IdentityController {
  constructor(private readonly identityService: IdentityService) {}

  @Post('register')
  async register(@Body() dto: RegisterDto, @Res() res: Response, @Req() req: Request) {
    const deviceId = req.headers['x-device-id'] as string;
    const user = await this.identityService.register(dto);
    return res.status(HttpStatus.CREATED).json(user);
  }

  @Post('login')
  async login(@Body() dto: LoginDto, @Res() res: Response, @Req() req: Request) {
    const deviceId = req.headers['x-device-id'] as string;
    const tokens = await this.identityService.login(dto, deviceId);
    return res.status(HttpStatus.OK).json(tokens);
  }

  @Post('login/phone')
  async loginWithPhone(@Body() dto: LoginPhoneDto, @Res() res: Response, @Req() req: Request) {
    const deviceId = req.headers['x-device-id'] as string;
    const tokens = await this.identityService.loginWithPhone(dto, deviceId);
    return res.status(HttpStatus.OK).json(tokens);
  }

  @Post('admin/login')
  async adminLogin(@Body() dto: LoginDto, @Res() res: Response) {
    const result = await this.identityService.adminLogin(dto);
    return res.status(HttpStatus.OK).json(result);
  }

  @Post('refresh')
  async refresh(@Body('refresh_token') refreshToken: string, @Res() res: Response, @Req() req: Request) {
    const deviceId = req.headers['x-device-id'] as string;
    const tokens = await this.identityService.refresh(refreshToken, deviceId);
    return res.status(HttpStatus.OK).json(tokens);
  }

  @Post('logout')
  async logout(@Body('refresh_token') refreshToken: string, @Res() res: Response) {
    await this.identityService.logout(refreshToken);
    return res.status(HttpStatus.OK).json({ message: 'Logged out' });
  }

  @Post('revoke-all')
  async revokeAll(@Body('user_id') userId: string, @Res() res: Response) {
    const result = await this.identityService.revokeAllUserTokens(userId);
    return res.status(HttpStatus.OK).json(result);
  }
}
