import { NearConnector } from '@hot-labs/near-connect';
import { JsonRpcProvider, getTransactionLastResult } from 'near-api-js';

const RPC_URLS = {
  mainnet: 'https://free.rpc.fastnear.com',
  testnet: 'https://test.rpc.fastnear.com',
};

export class Wallet {
  constructor({ networkId = 'testnet', connector, provider } = {}) {
    this.connector = connector ?? new NearConnector({
      network: networkId,
      providers: { [networkId]: [RPC_URLS[networkId]] },
    });
    this.provider = provider ?? new JsonRpcProvider({ url: RPC_URLS[networkId] });
  }

  startUp = async (onAccountChange) => {
    this.cleanup?.();
    const signedIn = ({ accounts }) => onAccountChange(accounts[0]?.accountId ?? '');
    const signedOut = () => onAccountChange('');
    this.connector.on('wallet:signIn', signedIn);
    this.connector.on('wallet:signOut', signedOut);
    this.cleanup = () => {
      this.connector.off('wallet:signIn', signedIn);
      this.connector.off('wallet:signOut', signedOut);
    };
    const connected = await this.connector.getConnectedWallet().catch(() => null);
    const accountId = connected?.accounts[0]?.accountId ?? '';
    onAccountChange(accountId);
    return accountId;
  };

  signIn = () => this.connector.connect();

  signOut = async () => {
    const connected = await this.connector.getConnectedWallet();
    if (connected) await this.connector.disconnect(connected.wallet);
  };

  viewMethod = ({ contractId, method, args = {} }) =>
    this.provider.callFunction({ contractId, method, args });

  callMethod = async ({ contractId, method, args = {}, gas = '30000000000000', deposit = '0' }) => {
    const wallet = await this.connector.wallet();
    const result = await wallet.signAndSendTransaction({
      receiverId: contractId,
      actions: [{ type: 'FunctionCall', params: { methodName: method, args, gas, deposit } }],
    });
    return getTransactionLastResult(result);
  };

  getTransactionResult = async (txHash) => {
    const wallet = await this.connector.wallet();
    const accounts = await wallet.getAccounts();
    const transaction = await this.provider.viewTransactionStatus({ txHash, accountId: accounts[0].accountId });
    return getTransactionLastResult(transaction);
  };

  signAndSendTransactions = async ({ transactions }) => {
    const wallet = await this.connector.wallet();
    return wallet.signAndSendTransactions({ transactions });
  };
}
