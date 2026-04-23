const TransactionService = require('../services/stellarTransactionService');
const { server } = require('../../blockchain/stellarService');
const { recordTransaction, updateTransaction } = require('../db/transactionRepository');
const { Operation, Keypair, Networks, Asset } = require('stellar-sdk');

jest.mock('../../blockchain/stellarService', () => ({
  server: {
    loadAccount: jest.fn(),
    submitTransaction: jest.fn(),
    transactions: jest.fn(() => ({
      transaction: jest.fn(() => ({
        call: jest.fn()
      }))
    }))
  },
  isValidStellarAddress: jest.fn(() => true)
}));

jest.mock('../db/transactionRepository', () => ({
  recordTransaction: jest.fn(),
  updateTransaction: jest.fn()
}));

jest.mock('../services/configService', () => ({
  getConfig: jest.fn((key, def) => {
    if (key === 'STELLAR_NETWORK') return 'TESTNET';
    return def;
  }),
  getRequiredConfig: jest.fn((key) => 'dummy')
}));

describe('TransactionService', () => {
  const sourceSecret = Keypair.random().secret();
  const sourcePublicKey = Keypair.fromSecret(sourceSecret).publicKey();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('submit should build, sign, record and submit a transaction', async () => {
    const mockAccount = {
      sequenceNumber: () => '100',
      sequence: '100',
      accountId: () => sourcePublicKey
    };
    server.loadAccount.mockResolvedValue(mockAccount);
    server.submitTransaction.mockResolvedValue({
      hash: 'mock-hash',
      ledger: 12345
    });

    const op = Operation.payment({
      destination: Keypair.random().publicKey(),
      asset: Asset.native(),
      amount: '10'
    });


    const result = await TransactionService.submit(op, [sourceSecret], { txType: 'transfer' });

    expect(server.loadAccount).toHaveBeenCalledWith(sourcePublicKey);
    expect(recordTransaction).toHaveBeenCalledWith(expect.objectContaining({
      status: 'pending',
      txType: 'transfer'
    }));
    expect(server.submitTransaction).toHaveBeenCalled();
    expect(updateTransaction).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
      status: 'completed',
      stellar_ledger: 12345
    }));
    expect(result.hash).toBe('mock-hash');
  });

  test('should handle stuck transaction and perform fee bump', async () => {
    const mockAccount = {
      sequenceNumber: () => '100',
      sequence: '100',
      accountId: () => sourcePublicKey
    };
    server.loadAccount.mockResolvedValue(mockAccount);
    
    // First attempt fails with timeout
    server.submitTransaction
      .mockRejectedValueOnce({
        response: { status: 504 }
      })
      // Second attempt (fee bump) succeeds
      .mockResolvedValueOnce({
        hash: 'bumped-hash',
        ledger: 12346
      });

    const op = Operation.payment({
      destination: Keypair.random().publicKey(),
      asset: Asset.native(),
      amount: '10'
    });

    const result = await TransactionService.submit(op, [sourceSecret]);

    expect(server.submitTransaction).toHaveBeenCalledTimes(2);
    expect(updateTransaction).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
      status: 'completed',
      metadata: expect.objectContaining({ result: 'success_via_bump' })
    }));
    expect(result.hash).toBe('bumped-hash');
  });

  test('should handle tx_insufficient_fee and perform fee bump', async () => {
     const mockAccount = {
      sequenceNumber: () => '100',
      sequence: '100',
      accountId: () => sourcePublicKey
    };
    server.loadAccount.mockResolvedValue(mockAccount);
    
    // First attempt fails with insufficient fee
    server.submitTransaction
      .mockRejectedValueOnce({
        response: { 
          status: 400,
          data: {
            extras: {
              result_codes: {
                transaction: 'tx_insufficient_fee'
              }
            }
          }
        }
      })
      .mockResolvedValueOnce({
        hash: 'bumped-hash',
        ledger: 12347
      });

    const op = Operation.payment({
      destination: Keypair.random().publicKey(),
      asset: Asset.native(),
      amount: '10'
    });

    const result = await TransactionService.submit(op, [sourceSecret]);

    expect(server.submitTransaction).toHaveBeenCalledTimes(2);
    expect(result.hash).toBe('bumped-hash');
  });
});
