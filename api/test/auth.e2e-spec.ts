import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;
  let container: StartedPostgreSqlContainer;

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
  }, 60_000);

  afterAll(async () => {
    await app.close();
    await container.stop();
  });

  describe('POST /auth/register', () => {
    it('returns 201 with id and email', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'register@example.com', password: 'password123' })
        .expect(201);

      expect(res.body).toMatchObject({
        id: expect.any(String),
        email: 'register@example.com',
      });
    });

    it('returns 400 for invalid email', () => {
      return request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'not-an-email', password: 'password123' })
        .expect(400);
    });

    it('returns 400 for password shorter than 8 characters', () => {
      return request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'short@example.com', password: 'short' })
        .expect(400);
    });

    it('returns 409 for duplicate email', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'dupe@example.com', password: 'password123' });

      return request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'dupe@example.com', password: 'password123' })
        .expect(409);
    });
  });

  describe('POST /auth/login', () => {
    beforeAll(async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'login@example.com', password: 'password123' });
    });

    it('returns 200 with accessToken for valid credentials', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'login@example.com', password: 'password123' })
        .expect(200);

      expect(res.body).toMatchObject({ accessToken: expect.any(String) });
    });

    it('returns 401 for wrong password', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'login@example.com', password: 'wrongpassword' })
        .expect(401);
    });

    it('returns 401 for unknown email', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'nobody@example.com', password: 'password123' })
        .expect(401);
    });
  });

  describe('GET /auth/me', () => {
    let accessToken: string;

    beforeAll(async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'me@example.com', password: 'password123' });

      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'me@example.com', password: 'password123' });

      accessToken = res.body.accessToken;
    });

    it('returns 401 without a token', () => {
      return request(app.getHttpServer()).get('/auth/me').expect(401);
    });

    it('returns 200 with userId and email for a valid token', () => {
      return request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toMatchObject({
            userId: expect.any(String),
            email: 'me@example.com',
          });
        });
    });
  });
});
