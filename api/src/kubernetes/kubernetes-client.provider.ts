import { Injectable, Logger } from '@nestjs/common';
import { CoreV1Api, CustomObjectsApi, KubeConfig } from '@kubernetes/client-node';

@Injectable()
export class KubernetesClientProvider {
  private readonly logger = new Logger(KubernetesClientProvider.name);
  private kubeConfig?: KubeConfig;
  private customObjects?: CustomObjectsApi;
  private core?: CoreV1Api;

  private init(): void {
    if (this.kubeConfig) return;
    const kc = new KubeConfig();
    kc.loadFromDefault();
    this.customObjects = kc.makeApiClient(CustomObjectsApi);
    this.core = kc.makeApiClient(CoreV1Api);
    this.kubeConfig = kc;
    this.logger.log(`Kubernetes client initialised (context: ${kc.getCurrentContext()})`);
  }

  customObjectsApi(): CustomObjectsApi {
    this.init();
    return this.customObjects as CustomObjectsApi;
  }

  coreV1Api(): CoreV1Api {
    this.init();
    return this.core as CoreV1Api;
  }
}
