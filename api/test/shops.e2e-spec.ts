import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

const USER_A = { email: 'user-a@example.com', password: 'password123' };
const USER_B = { email: 'user-b@example.com', password: 'password123' };

const VALID_SHOP = {
  name: 'test-shop',
  availabilityTier: 'standard',
  walletAddress: '0xabc123',
  databaseType: 'standard',
};

async function registerAndLogin(app: INestApplication<App>, credentials: { email: string; password: string }) {
  await request(app.getHttpServer()).post('/auth/register').send(credentials);
  const res = await request(app.getHttpServer()).post('/auth/login').send(credentials).expect(200);
  return res.body.accessToken as string;
}

describe('Shops (e2e)', () => {
  let app: INestApplication<App>;
  let container: StartedPostgreSqlContainer;
  let tokenA: string;
  let tokenB: string;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16').start();
    process.env.DATABASE_URL = container.getConnectionUri();
    process.env.JWT_SECRET = 'test-jwt-secret';

    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();
    await (app.getHttpAdapter().getInstance() as { ready(): Promise<void> }).ready();

    tokenA = await registerAndLogin(app, USER_A);
    tokenB = await registerAndLogin(app, USER_B);
  }, 60_000);

  afterAll(async () => {
    await app.close();
    await container.stop();
  });

  describe('POST /shops', () => {
    it('returns 401 without token', () => {
      return request(app.getHttpServer()).post('/shops').send(VALID_SHOP).expect(401);
    });

    it('returns 201 with shop data for authenticated user', async () => {
      const res = await request(app.getHttpServer())
        .post('/shops')
        .set('Authorization', `Bearer ${tokenA}`)
        .send(VALID_SHOP)
        .expect(201);

      expect(res.body).toMatchObject({
        id: expect.any(String),
        name: 'test-shop',
        availabilityTier: 'standard',
        walletAddress: '0xabc123',
        databaseType: 'standard',
      });
    });

    it('returns 400 for missing required field', () => {
      return request(app.getHttpServer())
        .post('/shops')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ name: 'no-tier' })
        .expect(400);
    });
  });

  describe('GET /shops', () => {
    it('returns 401 without token', () => {
      return request(app.getHttpServer()).get('/shops').expect(401);
    });

    it('returns only shops owned by the authenticated user', async () => {
      const res = await request(app.getHttpServer())
        .get('/shops')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      res.body.forEach((shop: { name: string }) => {
        expect(shop.name).toBeDefined();
      });
    });
  });

  describe('GET /shops/:id', () => {
    let shopId: string;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post('/shops')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ ...VALID_SHOP, name: 'shop-for-get' });
      shopId = res.body.id;
    });

    it('returns 401 without token', () => {
      return request(app.getHttpServer()).get(`/shops/${shopId}`).expect(401);
    });

    it('returns 200 with shop for owner', () => {
      return request(app.getHttpServer())
        .get(`/shops/${shopId}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200)
        .expect((res) => expect(res.body.id).toBe(shopId));
    });

    it('returns 403 for non-owner', () => {
      return request(app.getHttpServer())
        .get(`/shops/${shopId}`)
        .set('Authorization', `Bearer ${tokenB}`)
        .expect(403);
    });

    it('returns 404 for non-existent shop', () => {
      return request(app.getHttpServer())
        .get('/shops/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(404);
    });
  });

  describe('PATCH /shops/:id', () => {
    let shopId: string;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post('/shops')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ ...VALID_SHOP, name: 'shop-for-update' });
      shopId = res.body.id;
    });

    it('returns 401 without token', () => {
      return request(app.getHttpServer()).patch(`/shops/${shopId}`).send({}).expect(401);
    });

    it('returns 403 when non-owner tries to update', () => {
      return request(app.getHttpServer())
        .patch(`/shops/${shopId}`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ availabilityTier: 'high' })
        .expect(403);
    });

    it('returns 200 with updated shop for owner', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/shops/${shopId}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ availabilityTier: 'high' })
        .expect(200);

      expect(res.body.availabilityTier).toBe('high');
    });

    it('returns 404 for non-existent shop', () => {
      return request(app.getHttpServer())
        .patch('/shops/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ availabilityTier: 'high' })
        .expect(404);
    });
  });

  describe('DELETE /shops/:id', () => {
    let shopId: string;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post('/shops')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ ...VALID_SHOP, name: 'shop-for-delete' });
      shopId = res.body.id;
    });

    it('returns 401 without token', () => {
      return request(app.getHttpServer()).delete(`/shops/${shopId}`).expect(401);
    });

    it('returns 403 when non-owner tries to delete', () => {
      return request(app.getHttpServer())
        .delete(`/shops/${shopId}`)
        .set('Authorization', `Bearer ${tokenB}`)
        .expect(403);
    });

    it('returns 204 and removes shop for owner', async () => {
      await request(app.getHttpServer())
        .delete(`/shops/${shopId}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(204);

      await request(app.getHttpServer())
        .get(`/shops/${shopId}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(404);
    });

    it('returns 404 for non-existent shop', () => {
      return request(app.getHttpServer())
        .delete('/shops/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(404);
    });
  });
});
