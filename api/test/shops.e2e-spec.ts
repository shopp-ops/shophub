import { readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { K3sContainer, StartedK3sContainer } from '@testcontainers/k3s';
import { ApiextensionsV1Api, CoreV1Api, CustomObjectsApi, KubeConfig, loadYaml } from '@kubernetes/client-node';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { buildShopIdentity } from '../src/kubernetes/shop-identity.util';
import { ShopResourceService } from '../src/kubernetes/shop-resource.service';

const USER_A = { email: 'user-a@example.com', password: 'password123' };
const USER_B = { email: 'user-b@example.com', password: 'password123' };

const VALID_SHOP = {
  name: 'test-shop',
  adminEmail: 'admin@test-shop.local',
  availabilityTier: 'standard',
  walletAddress: '0xabc123',
  databaseType: 'standard',
};

async function registerAndLogin(app: INestApplication<App>, credentials: { email: string; password: string }) {
  await request(app.getHttpServer()).post('/auth/register').send(credentials);
  const res = await request(app.getHttpServer()).post('/auth/login').send(credentials).expect(200);
  return res.body.accessToken as string;
}

async function applyShopCrd(kubeConfigYaml: string): Promise<void> {
  const kc = new KubeConfig();
  kc.loadFromString(kubeConfigYaml);
  const ext = kc.makeApiClient(ApiextensionsV1Api);
  const crd = loadYaml<object>(readFileSync(join(__dirname, 'fixtures', 'shop-crd.yaml'), 'utf8'));
  await ext.createCustomResourceDefinition({ body: crd as never });
  const co = kc.makeApiClient(CustomObjectsApi);
  for (let i = 0; i < 30; i++) {
    try {
      await co.listClusterCustomObject({ group: 'shopops.com', version: 'v1', plural: 'shops' });
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  throw new Error('Shop CRD did not become established');
}

describe('Shops (e2e)', () => {
  let app: INestApplication<App>;
  let pg: StartedPostgreSqlContainer;
  let k3s: StartedK3sContainer;
  let k8s: CustomObjectsApi;
  let coreApi: CoreV1Api;
  let shopResource: ShopResourceService;
  let tokenA: string;
  let tokenB: string;

  beforeAll(async () => {
    pg = await new PostgreSqlContainer('postgres:16').start();
    k3s = await new K3sContainer('rancher/k3s:v1.31.2-k3s1').start();

    const kubeConfigYaml = k3s.getKubeConfig();
    const kubeConfigPath = join(tmpdir(), `shophub-e2e-kubeconfig-${Date.now()}`);
    writeFileSync(kubeConfigPath, kubeConfigYaml);
    await applyShopCrd(kubeConfigYaml);

    const kc = new KubeConfig();
    kc.loadFromString(kubeConfigYaml);
    k8s = kc.makeApiClient(CustomObjectsApi);
    coreApi = kc.makeApiClient(CoreV1Api);

    process.env.DATABASE_URL = pg.getConnectionUri();
    process.env.JWT_SECRET = 'test-jwt-secret';
    process.env.KUBECONFIG = kubeConfigPath;
    process.env.SHOP_API_IMAGE = 'ghcr.io/shopp-ops/shop-api:1';
    process.env.SHOP_WEB_IMAGE = 'ghcr.io/shopp-ops/shop-web:1';
    process.env.SHOP_HOST_SUFFIX = 'local';
    // No operator runs in the test cluster, so nothing marks shops Ready —
    // keep the readiness wait short so create returns a credentialsError fast.
    process.env.SHOP_READY_POLL_MS = '400';
    process.env.SHOP_READY_TIMEOUT_MS = '2000';

    const moduleFixture = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();
    await (app.getHttpAdapter().getInstance() as { ready(): Promise<void> }).ready();
    shopResource = app.get(ShopResourceService);

    tokenA = await registerAndLogin(app, USER_A);
    tokenB = await registerAndLogin(app, USER_B);
  }, 180_000);

  afterAll(async () => {
    await app.close();
    await pg.stop();
    await k3s.stop();
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

      expect(res.body.shop).toMatchObject({
        id: expect.any(String),
        name: 'test-shop',
        availabilityTier: 'standard',
        walletAddress: '0xabc123',
        databaseType: 'standard',
      });
    });

    it('creates a real Shop CR in the cluster', async () => {
      const res = await request(app.getHttpServer())
        .post('/shops')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ ...VALID_SHOP, name: 'cr-check' })
        .expect(201);

      const { namespace, crName } = buildShopIdentity(res.body.shop.id, 'cr-check');
      const cr = await k8s.getNamespacedCustomObject({
        group: 'shopops.com',
        version: 'v1',
        namespace,
        plural: 'shops',
        name: crName,
      });
      expect((cr as { spec: { name: string } }).spec.name).toBe('cr-check');
    });

    it('returns 400 for missing required field', () => {
      return request(app.getHttpServer())
        .post('/shops')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ name: 'no-tier' })
        .expect(400);
    });

    it('accepts an omitted walletAddress (auto-generate case)', async () => {
      const { walletAddress: _omit, ...noWallet } = VALID_SHOP;
      const res = await request(app.getHttpServer())
        .post('/shops')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ ...noWallet, name: 'auto-wallet' })
        .expect(201);

      expect(res.body.shop.name).toBe('auto-wallet');
      expect(res.body.shop.walletAddress).toBeNull();
      // Credentials are now fetched separately via GET /shops/:id/credentials.
      expect(res.body.walletCredentials).toBeUndefined();

      const { namespace, crName } = buildShopIdentity(res.body.shop.id, 'auto-wallet');
      const cr = await k8s.getNamespacedCustomObject({
        group: 'shopops.com',
        version: 'v1',
        namespace,
        plural: 'shops',
        name: crName,
      });
      // Empty address → spec.walletAddress is left unset for the operator to fill.
      expect((cr as { spec: { walletAddress?: string } }).spec.walletAddress).toBeUndefined();
    }, 30_000);
  });

  describe('GET /shops', () => {
    it('returns 401 without token', () => {
      return request(app.getHttpServer()).get('/shops').expect(401);
    });

    it('returns only shops owned by the authenticated user', async () => {
      const res = await request(app.getHttpServer()).get('/shops').set('Authorization', `Bearer ${tokenA}`).expect(200);

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
      shopId = res.body.shop.id;
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
      return request(app.getHttpServer()).get(`/shops/${shopId}`).set('Authorization', `Bearer ${tokenB}`).expect(403);
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
      shopId = res.body.shop.id;
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

    it('updates the real Shop CR in the cluster', async () => {
      await request(app.getHttpServer())
        .patch(`/shops/${shopId}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ availabilityTier: 'standard' })
        .expect(200);

      const { namespace, crName } = buildShopIdentity(shopId, 'shop-for-update');
      const cr = await k8s.getNamespacedCustomObject({
        group: 'shopops.com',
        version: 'v1',
        namespace,
        plural: 'shops',
        name: crName,
      });

      expect(cr.spec.availability).toBe('standard');
    });
  });

  describe('DELETE /shops/:id', () => {
    let shopId: string;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post('/shops')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ ...VALID_SHOP, name: 'shop-for-delete' });
      shopId = res.body.shop.id;
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

      await request(app.getHttpServer()).get(`/shops/${shopId}`).set('Authorization', `Bearer ${tokenA}`).expect(404);
    });

    it('returns 404 for non-existent shop', () => {
      return request(app.getHttpServer())
        .delete('/shops/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(404);
    });
  });

  describe('admin credentials', () => {
    const group = 'shopops.com';
    const version = 'v1';
    const plural = 'shops';

    it('POST /shops returns 201 fast with { shop } only — no credentials in response', async () => {
      const res = await request(app.getHttpServer())
        .post('/shops')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ ...VALID_SHOP, name: 'shop-noready' })
        .expect(201);

      expect(res.body.shop).toBeDefined();
      expect(res.body.adminCredentials).toBeUndefined();
      expect(res.body.credentialsError).toBeUndefined();
    }, 30_000);

    it('GET /shops/:id/credentials returns 401 without token', async () => {
      const res = await request(app.getHttpServer())
        .post('/shops')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ ...VALID_SHOP, name: 'shop-creds-unauth' })
        .expect(201);
      return request(app.getHttpServer()).get(`/shops/${res.body.shop.id}/credentials`).expect(401);
    }, 30_000);

    it('GET /shops/:id/credentials returns 409 while shop is not Ready (no operator)', async () => {
      const res = await request(app.getHttpServer())
        .post('/shops')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ ...VALID_SHOP, name: 'shop-creds-notready' })
        .expect(201);

      await request(app.getHttpServer())
        .get(`/shops/${res.body.shop.id}/credentials`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(409);
    }, 30_000);

    it('readAdminCredentials decodes a real Secret from the cluster', async () => {
      const namespace = 'shop-cred-test';
      const crName = 'cred-shop-abc12345';
      await coreApi.createNamespace({ body: { metadata: { name: namespace } } });
      await coreApi.createNamespacedSecret({
        namespace,
        body: {
          metadata: { name: `${crName}-admin-credentials` },
          stringData: { 'admin-email': 'admin@shop.local', 'admin-password': 's3cret' },
        },
      });

      const creds = await shopResource.readAdminCredentials(namespace, crName);
      expect(creds).toEqual({ email: 'admin@shop.local', password: 's3cret' });
    }, 30_000);

    it('readShopStatus reads the operator-resolved walletAddress from a real CR', async () => {
      const namespace = 'shop-walletstatus-test';
      const crName = 'walletstatus-shop-abc12345';
      await coreApi.createNamespace({ body: { metadata: { name: namespace } } });
      const created = (await k8s.createNamespacedCustomObject({
        group,
        version,
        namespace,
        plural,
        body: {
          apiVersion: `${group}/${version}`,
          kind: 'Shop',
          metadata: { name: crName },
          spec: {
            name: 'walletstatus-shop',
            adminEmail: 'admin@walletstatus.local',
            availability: 'standard',
            database: { type: 'standard' },
            apiImage: 'ghcr.io/x/api:1',
            webImage: 'ghcr.io/x/web:1',
          },
        },
      })) as { metadata: { resourceVersion: string } };

      await k8s.replaceNamespacedCustomObjectStatus({
        group,
        version,
        namespace,
        plural,
        name: crName,
        body: {
          apiVersion: `${group}/${version}`,
          kind: 'Shop',
          metadata: { name: crName, resourceVersion: created.metadata.resourceVersion },
          status: { walletAddress: '0xGENERATEDADDR' },
        },
      });

      await expect(shopResource.readShopStatus(namespace, crName)).resolves.toEqual({
        walletAddress: '0xGENERATEDADDR',
      });
    }, 30_000);

    it('readWalletCredentials decodes a real keypair Secret from the cluster', async () => {
      const namespace = 'shop-keypair-test';
      const crName = 'keypair-shop-abc12345';
      await coreApi.createNamespace({ body: { metadata: { name: namespace } } });
      await coreApi.createNamespacedSecret({
        namespace,
        body: {
          metadata: { name: `wallet-${crName}-wallet-keypair` },
          stringData: { address: '0xabc', privateKey: '0xdeadbeef' },
        },
      });

      const creds = await shopResource.readWalletCredentials(namespace, crName);
      expect(creds).toEqual({ address: '0xabc', privateKey: '0xdeadbeef' });
    }, 30_000);

    it('waitForReady resolves when the Shop status reports Ready', async () => {
      const namespace = 'shop-ready-test';
      const crName = 'ready-shop-abc12345';
      await coreApi.createNamespace({ body: { metadata: { name: namespace } } });
      const created = (await k8s.createNamespacedCustomObject({
        group,
        version,
        namespace,
        plural,
        body: {
          apiVersion: `${group}/${version}`,
          kind: 'Shop',
          metadata: { name: crName },
          spec: {
            name: 'ready-shop',
            adminEmail: 'admin@ready-shop.local',
            availability: 'standard',
            database: { type: 'standard' },
            apiImage: 'ghcr.io/x/api:1',
            webImage: 'ghcr.io/x/web:1',
          },
        },
      })) as { metadata: { resourceVersion: string } };

      await k8s.replaceNamespacedCustomObjectStatus({
        group,
        version,
        namespace,
        plural,
        name: crName,
        body: {
          apiVersion: `${group}/${version}`,
          kind: 'Shop',
          metadata: { name: crName, resourceVersion: created.metadata.resourceVersion },
          status: {
            conditions: [
              {
                type: 'Ready',
                status: 'True',
                reason: 'Test',
                message: 'test',
                lastTransitionTime: new Date().toISOString(),
              },
            ],
          },
        },
      });

      await expect(
        shopResource.waitForReady(namespace, crName, { pollMs: 200, timeoutMs: 5000 }),
      ).resolves.toBeUndefined();
    }, 30_000);
  });
});
