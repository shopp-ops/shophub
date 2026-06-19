jest.mock('@kubernetes/client-node', () => ({
  ApiException: class ApiException extends Error {},
  KubeConfig: jest.fn(),
  CustomObjectsApi: class CustomObjectsApi {},
  CoreV1Api: class CoreV1Api {},
}));

import { CoreV1Api, CustomObjectsApi, KubeConfig } from '@kubernetes/client-node';
import { KubernetesClientProvider } from './kubernetes-client.provider';

describe('KubernetesClientProvider', () => {
  let loadFromDefault: jest.Mock;
  let makeApiClient: jest.Mock;
  const customObjects = {} as CustomObjectsApi;
  const core = {} as CoreV1Api;

  beforeEach(() => {
    jest.clearAllMocks();
    loadFromDefault = jest.fn();
    makeApiClient = jest.fn((api) => (api === CustomObjectsApi ? customObjects : core));
    (KubeConfig as unknown as jest.Mock).mockImplementation(() => ({
      loadFromDefault,
      makeApiClient,
      getCurrentContext: () => 'kind',
    }));
  });

  it('does not initialise the config in the constructor', () => {
    new KubernetesClientProvider();
    expect(loadFromDefault).not.toHaveBeenCalled();
  });

  it('loads config lazily on first accessor and returns the CustomObjectsApi', () => {
    const provider = new KubernetesClientProvider();
    const api = provider.customObjectsApi();
    expect(loadFromDefault).toHaveBeenCalledTimes(1);
    expect(api).toBe(customObjects);
  });

  it('returns the CoreV1Api and memoises initialisation across calls', () => {
    const provider = new KubernetesClientProvider();
    provider.customObjectsApi();
    const api = provider.coreV1Api();
    expect(api).toBe(core);
    expect(loadFromDefault).toHaveBeenCalledTimes(1);
  });
});
