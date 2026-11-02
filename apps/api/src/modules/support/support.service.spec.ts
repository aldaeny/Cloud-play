import type { SupportTicket } from '@prisma/client';
import { Test } from '@nestjs/testing';
import { SupportService } from './support.service';
import { PrismaService } from '../../prisma.service';

describe('SupportService', () => {
  let service: SupportService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [SupportService, PrismaService],
    }).compile();

    service = moduleRef.get<SupportService>(SupportService);
    prisma = moduleRef.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createTicket', () => {
    it('should create support ticket', async () => {
      jest.spyOn(prisma.supportTicket, 'create').mockResolvedValue({
        id: 'ticket-1',
        subject: 'Issue',
        status: 'open',
      } as unknown as SupportTicket);

      const result = await service.createTicket('user-1', 'Issue', 'Message');
      expect(result.id).toBe('ticket-1');
    });
  });

  describe('getTickets', () => {
    it('should return user tickets', async () => {
      jest.spyOn(prisma.supportTicket, 'findMany').mockResolvedValue([
        { id: 'ticket-1' },
      ] as unknown as SupportTicket[]);

      const result = await service.getTickets('user-1');
      expect(result).toHaveLength(1);
    });
  });
});
