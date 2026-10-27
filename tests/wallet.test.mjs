import test from 'node:test';
import assert from 'node:assert/strict';
import { Wallet } from '../frontend/wallet.js';

test('multiple-contract queries and signing preserve separate receiver IDs', async () => {
  const queries = [];
  const batches = [];
  const results = [{ status: 'hello' }, { status: 'guest' }];
  const wallet = new Wallet({
    provider: { callFunction: async (params) => { queries.push(params); return params.contractId; } },
    connector: { wallet: async () => ({ signAndSendTransactions: async (batch) => { batches.push(batch); return results; } }) },
  });
  assert.equal(await wallet.viewMethod({ contractId: 'hello.testnet', method: 'get_greeting' }), 'hello.testnet');
  assert.equal(await wallet.viewMethod({ contractId: 'guest.testnet', method: 'get_messages' }), 'guest.testnet');
  const transactions = [{ receiverId: 'hello.testnet', actions: [] }, { receiverId: 'guest.testnet', actions: [] }];
  assert.equal(await wallet.signAndSendTransactions({ transactions }), results);
  assert.deepEqual(batches, [{ transactions }]);
  assert.deepEqual(queries.map((q) => q.contractId), ['hello.testnet', 'guest.testnet']);
});

test('startup restores a session and replaces old account subscriptions', async () => {
  const listeners = new Map();
  const connector = {
    on: (name, callback) => listeners.set(name, callback),
    off: (name, callback) => { if (listeners.get(name) === callback) listeners.delete(name); },
    getConnectedWallet: async () => ({ accounts: [{ accountId: 'alice.testnet' }] }),
  };
  const wallet = new Wallet({ connector, provider: {} });
  const accounts = [];
  await wallet.startUp((account) => accounts.push(account));
  await wallet.startUp((account) => accounts.push(account));
  assert.equal(listeners.size, 2);
  listeners.get('wallet:signIn')({ accounts: [{ accountId: 'bob.testnet' }] });
  listeners.get('wallet:signOut')();
  assert.deepEqual(accounts, ['alice.testnet', 'alice.testnet', 'bob.testnet', '']);
  wallet.cleanup();
  assert.equal(listeners.size, 0);
});
