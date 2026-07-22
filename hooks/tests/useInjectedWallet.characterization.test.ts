/// <reference types="node" />
/**
 * Characterization tests for useInjectedWallet (wagmi-backed).
 * Locks connect / Polygon-switch / disconnected return shape before Web3 lazy boundary.
 */
import { mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { POLYGON_CHAIN_ID } from '../../constants/swapContracts.ts';
import { ensureDom, renderHook } from './renderHook.ts';

ensureDom();

const NO_INJECTED_WALLET_MESSAGE =
  'No injected wallet was found. Please install MetaMask, Rabby, or another browser wallet.';

type ConnectorStub = {
  id: string;
  getProvider: () => Promise<unknown>;
};

// Mutable stubs — each test reassigns before rendering the hook.
let connectorsStub: ConnectorStub[] = [];
let connectPending = false;
let connectMutateAsync: (args: { connector: ConnectorStub }) => Promise<unknown> = async () => ({});
let disconnectMutate = () => {};
let switchMutateAsync: (args: { chainId: number }) => Promise<unknown> = async () => ({});
let connectionStub: {
  address?: `0x${string}`;
  chainId?: number;
  isConnected: boolean;
} = { isConnected: false };

class ProviderNotFoundError extends Error {
  name = 'ProviderNotFoundError';
  constructor() {
    super('ProviderNotFoundError');
  }
}

mock.module('wagmi', {
  namedExports: {
    useConnect: () => ({
      mutateAsync: connectMutateAsync,
      isPending: connectPending,
    }),
    useDisconnect: () => ({ mutate: disconnectMutate }),
    useConnectors: () => connectorsStub,
    useSwitchChain: () => ({ mutateAsync: switchMutateAsync }),
    useConnection: () => connectionStub,
    ProviderNotFoundError,
  },
});

test('useInjectedWallet disconnected shape', async () => {
  connectorsStub = [];
  connectionStub = { isConnected: false };
  connectPending = false;

  const { useInjectedWallet } = await import('../useInjectedWallet.ts');
  const { result, unmount } = await renderHook(() => useInjectedWallet());

  assert.equal(result.current.address, undefined);
  assert.equal(result.current.chainId, undefined);
  assert.equal(result.current.isConnected, false);
  assert.equal(result.current.isConnecting, false);
  assert.equal(result.current.isPolygon, false);
  assert.equal(typeof result.current.connectWallet, 'function');
  assert.equal(typeof result.current.disconnectWallet, 'function');
  assert.equal(typeof result.current.ensurePolygon, 'function');

  await unmount();
});

test('useInjectedWallet marks Polygon when chainId matches', async () => {
  connectionStub = {
    address: '0x1234567890abcdef1234567890abcdef12345678',
    chainId: POLYGON_CHAIN_ID,
    isConnected: true,
  };

  const { useInjectedWallet } = await import('../useInjectedWallet.ts');
  const { result, unmount } = await renderHook(() => useInjectedWallet());

  assert.equal(result.current.isConnected, true);
  assert.equal(result.current.isPolygon, true);
  assert.equal(result.current.chainId, POLYGON_CHAIN_ID);
  assert.equal(result.current.address, connectionStub.address);

  await unmount();
});

test('useInjectedWallet.ensurePolygon no-ops on Polygon and switches otherwise', async () => {
  const switchCalls: number[] = [];
  switchMutateAsync = async ({ chainId }) => {
    switchCalls.push(chainId);
    return {};
  };

  connectionStub = {
    address: '0x1234567890abcdef1234567890abcdef12345678',
    chainId: POLYGON_CHAIN_ID,
    isConnected: true,
  };

  const { useInjectedWallet } = await import('../useInjectedWallet.ts');
  const onPolygon = await renderHook(() => useInjectedWallet());
  assert.equal(await onPolygon.result.current.ensurePolygon(), true);
  assert.deepEqual(switchCalls, []);
  await onPolygon.unmount();

  connectionStub = {
    address: '0x1234567890abcdef1234567890abcdef12345678',
    chainId: 1,
    isConnected: true,
  };

  const offPolygon = await renderHook(() => useInjectedWallet());
  assert.equal(offPolygon.result.current.isPolygon, false);
  assert.equal(await offPolygon.result.current.ensurePolygon(), true);
  assert.deepEqual(switchCalls, [POLYGON_CHAIN_ID]);
  await offPolygon.unmount();
});

test('useInjectedWallet.connectWallet prefers injected connector with a provider', async () => {
  const connected: string[] = [];
  connectorsStub = [
    {
      id: 'metaMask',
      getProvider: async () => ({ ok: true }),
    },
    {
      id: 'injected',
      getProvider: async () => ({ ok: true }),
    },
  ];
  connectMutateAsync = async ({ connector }) => {
    connected.push(connector.id);
    return {};
  };
  connectionStub = { isConnected: false };

  const { useInjectedWallet } = await import('../useInjectedWallet.ts');
  const { result, unmount } = await renderHook(() => useInjectedWallet());

  await result.current.connectWallet();
  assert.deepEqual(connected, ['injected']);

  await unmount();
});

test('useInjectedWallet.connectWallet throws when no wallet provider exists', async () => {
  connectorsStub = [
    {
      id: 'injected',
      getProvider: async () => {
        throw new Error('missing');
      },
    },
  ];
  connectionStub = { isConnected: false };

  const { useInjectedWallet } = await import('../useInjectedWallet.ts');
  const { result, unmount } = await renderHook(() => useInjectedWallet());

  await assert.rejects(() => result.current.connectWallet(), (error: unknown) => {
    assert.ok(error instanceof Error);
    assert.equal(error.message, NO_INJECTED_WALLET_MESSAGE);
    return true;
  });

  await unmount();
});

test('useInjectedWallet.connectWallet maps ProviderNotFoundError to the same message', async () => {
  connectorsStub = [
    {
      id: 'injected',
      getProvider: async () => ({ ok: true }),
    },
  ];
  connectMutateAsync = async () => {
    throw new ProviderNotFoundError();
  };
  connectionStub = { isConnected: false };

  const { useInjectedWallet } = await import('../useInjectedWallet.ts');
  const { result, unmount } = await renderHook(() => useInjectedWallet());

  await assert.rejects(() => result.current.connectWallet(), (error: unknown) => {
    assert.ok(error instanceof Error);
    assert.equal(error.message, NO_INJECTED_WALLET_MESSAGE);
    return true;
  });

  await unmount();
});

test('useInjectedWallet.disconnectWallet calls wagmi disconnect.mutate', async () => {
  let disconnected = 0;
  disconnectMutate = () => {
    disconnected += 1;
  };
  connectionStub = {
    address: '0x1234567890abcdef1234567890abcdef12345678',
    chainId: POLYGON_CHAIN_ID,
    isConnected: true,
  };

  const { useInjectedWallet } = await import('../useInjectedWallet.ts');
  const { result, unmount } = await renderHook(() => useInjectedWallet());

  result.current.disconnectWallet();
  assert.equal(disconnected, 1);

  await unmount();
});
