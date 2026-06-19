import { Injectable, Logger } from '@nestjs/common';
import { ApiException, PatchStrategy, RequestContext, ResponseContext } from '@kubernetes/client-node';
import { KubernetesClientProvider } from './kubernetes-client.provider';
import { buildShopIdentity } from './shop-identity.util';
import { mapK8sError } from './k8s-error.mapper';
import { GROUP, KIND, PLURAL, SHOP_ID_LABEL, VERSION } from './k8s.constants';
import { ShopManifest } from './shop-manifest.interface';
import { PromiseMiddlewareWrapper } from '@kubernetes/client-node/dist/gen/middleware';

@Injectable()
export class ShopResourceService {
  private readonly logger = new Logger(ShopResourceService.name);

  constructor(private readonly client: KubernetesClientProvider) {}

  async createShop(manifest: ShopManifest): Promise<void> {
    const { namespace, crName } = buildShopIdentity(manifest.id, manifest.name);
    await this.ensureNamespace(namespace);
    try {
      await this.client.customObjectsApi().createNamespacedCustomObject({
        group: GROUP,
        version: VERSION,
        namespace,
        plural: PLURAL,
        body: this.buildShopBody(crName, manifest),
      });
      this.logger.log(`Created Shop CR ${namespace}/${crName}`);
    } catch (error) {
      throw mapK8sError(error);
    }
  }

  async getShop(namespace: string, crName: string): Promise<unknown> {
    try {
      return await this.client.customObjectsApi().getNamespacedCustomObject({
        group: GROUP,
        version: VERSION,
        namespace,
        plural: PLURAL,
        name: crName,
      });
    } catch (error) {
      throw mapK8sError(error);
    }
  }

  async patchShop(namespace: string, crName: string, partialSpec: Record<string, unknown>): Promise<void> {
    const mergePatchMiddleware = new PromiseMiddlewareWrapper({
      pre: (context: RequestContext) => {
        context.setHeaderParam('Content-Type', PatchStrategy.MergePatch);
        return Promise.resolve(context);
      },
      post: (context: ResponseContext) => {
        return Promise.resolve(context);
      },
    });

    try {
      await this.client.customObjectsApi().patchNamespacedCustomObject(
        {
          group: GROUP,
          version: VERSION,
          namespace,
          plural: PLURAL,
          name: crName,
          body: { spec: partialSpec },
        },
        { middleware: [mergePatchMiddleware], middlewareMergeStrategy: 'append' },
      );
    } catch (error) {
      throw mapK8sError(error);
    }
  }

  async deleteShop(namespace: string, crName: string): Promise<void> {
    try {
      await this.client.customObjectsApi().deleteNamespacedCustomObject({
        group: GROUP,
        version: VERSION,
        namespace,
        plural: PLURAL,
        name: crName,
      });
    } catch (error) {
      throw mapK8sError(error);
    }
  }

  async deleteShopNamespace(namespace: string): Promise<void> {
    try {
      await this.client.coreV1Api().deleteNamespace({ name: namespace });
    } catch (error) {
      throw mapK8sError(error);
    }
  }

  private async ensureNamespace(name: string): Promise<void> {
    try {
      await this.client.coreV1Api().createNamespace({ body: { metadata: { name } } });
    } catch (error) {
      if (error instanceof ApiException && error.code === 409) return;
      throw mapK8sError(error);
    }
  }

  private buildShopBody(crName: string, m: ShopManifest): Record<string, unknown> {
    return {
      apiVersion: `${GROUP}/${VERSION}`,
      kind: KIND,
      metadata: {
        name: crName,
        labels: { [SHOP_ID_LABEL]: m.id },
      },
      spec: {
        name: m.name,
        availability: m.availability,
        database: { type: m.database },
        apiImage: m.apiImage,
        webImage: m.webImage,
        ...(m.walletAddress ? { walletAddress: m.walletAddress } : {}),
        ...(m.host ? { host: m.host } : {}),
        ...(m.discordChannelRef ? { discordChannelRef: m.discordChannelRef } : {}),
      },
    };
  }
}
