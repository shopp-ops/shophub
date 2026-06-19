import { Global, Module } from '@nestjs/common';
import { KubernetesClientProvider } from './kubernetes-client.provider';
import { ShopResourceService } from './shop-resource.service';

@Global()
@Module({
  providers: [KubernetesClientProvider, ShopResourceService],
  exports: [ShopResourceService],
})
export class KubernetesModule {}
