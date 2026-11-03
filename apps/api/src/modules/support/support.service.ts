import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

@Injectable()
export class SupportService {
  constructor(private readonly prisma: PrismaService) {}

  async createTicket(userId: string, subject: string, message: string) {
    return this.prisma.supportTicket.create({
      data: { userId, subject, message },
    });
  }

  async getTickets(userId: string) {
    return this.prisma.supportTicket.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getTicket(userId: string, id: string) {
    return this.prisma.supportTicket.findFirst({
      where: { id, userId },
    });
  }

  async updateTicketStatus(userId: string, id: string, status: string) {
    return this.prisma.supportTicket.updateMany({
      where: { id, userId },
      data: { status },
    });
  }
}
