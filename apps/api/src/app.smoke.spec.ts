import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './app.module';
import { PrismaService } from './prisma.service';

/** Real Nest module graph + HTTP adapter; deliberately NOT a live database test. */
describe('Hybrid application composition (isolated database)', () => {
  let app: INestApplication;
  const database = {
    onModuleInit: jest.fn(),
    onModuleDestroy: jest.fn(),
  };

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(database)
      .compile();
    app = mod.createNestApplication();
    await app.init();
  });

  afterAll(async () => { await app?.close(); });

  it.each([
    'CatalogService', 'IdentityService', 'ProfilesService', 'RightsService',
    'PlaybackService', 'MediaService', 'EntitlementService', 'BillingService',
    'EditorialService', 'AdminService', 'NotificationsService', 'SupportService',
    'AnalyticsService',
  ])('resolves %s from the real module graph', async (name) => {
    const folder = name.replace(/Service$/, '').toLowerCase();
    const exports = await import(`./modules/${folder}/${folder}.service`);
    expect(app.get(exports[name])).toBeDefined();
  });

  it('runs provider lifecycle with only the database replaced', () => {
    expect(database.onModuleInit).toHaveBeenCalledTimes(1);
  });

  it('serves HTTP requests through the real adapter', async () => {
    await request(app.getHttpServer()).get('/__composition_probe__').expect(404);
  });
});
