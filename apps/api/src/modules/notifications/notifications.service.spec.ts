import type { Notification } from '@prisma/client';
import { Test } from '@nestjs/testing';
import { NotificationsService } from './notifications.service';
import { PrismaService } from '../../prisma.service';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [NotificationsService, PrismaService],
    }).compile();

    service = moduleRef.get<NotificationsService>(NotificationsService);
    prisma = moduleRef.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getNotifications', () => {
    it('should return user notifications', async () => {
      jest.spyOn(prisma.notification, 'findMany').mockResolvedValue([
        { id: '1', title: 'Welcome', read: false },
      ] as unknown as Notification[]);

      const result = await service.getNotifications('user-1');
      expect(result).toHaveLength(1);
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all notifications as read', async () => {
      jest.spyOn(prisma.notification, 'updateMany').mockResolvedValue({ count: 5 });
      const result = await service.markAllAsRead('user-1');
      expect(result.count).toBe(5);
    });
  });

  describe('getUnreadCount', () => {
    it('should return unread count', async () => {
      jest.spyOn(prisma.notification, 'count').mockResolvedValue(3);
      const result = await service.getUnreadCount('user-1');
      expect(result).toBe(3);
    });
  });
});
