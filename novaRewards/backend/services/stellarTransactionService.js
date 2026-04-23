const {
  server,
  isValidStellarAddress,
} = require("../../blockchain/stellarService");
const {
  Networks,
  TransactionBuilder,
  Keypair,
  Transaction,
  FeeBumpTransaction,
} = require("stellar-sdk");
const { STELLAR_NETWORK } = require("./configService");
const { recordTransaction, updateTransaction } = require("../db/transactionRepository");

const NETWORK_PASSPHRASE =
  STELLAR_NETWORK === "mainnet"
    ? Networks.PUBLIC
    : Networks.TESTNET;

const BASE_FEE = 100;
const MAX_FEE_BUMP_ATTEMPTS = 3;
const POLLING_INTERVAL = 5000;
const POLLING_TIMEOUT = 60000; // 1 minute before considering fee bump

/**
 * TransactionService responsible for constructing, signing, and submitting Stellar transactions.
 * Handles sequence number management, fee bumping for stuck transactions, and result parsing.
 */
class TransactionService {
  /**
   * Builds and submits a Stellar transaction.
   * 
   * @param {Operation|Operation[]} operations - One or more Stellar operations
   * @param {string[]} signers - Array of secret keys to sign the transaction
   * @param {Object} metadata - Optional metadata for DB recording
   * @returns {Promise<Object>} The transaction result
   */
  async submit(operations, signers, metadata = {}) {
    if (!Array.isArray(operations)) {
      operations = [operations];
    }

    const sourceKeypair = Keypair.fromSecret(signers[0]);
    const sourcePublicKey = sourceKeypair.publicKey();

    // 1. Fetch fresh sequence number
    const account = await server.loadAccount(sourcePublicKey);
    
    // 2. Build the transaction
    const builder = new TransactionBuilder(account, {
      fee: String(BASE_FEE * operations.length),
      networkPassphrase: NETWORK_PASSPHRASE,
    });

    for (const op of operations) {
      builder.addOperation(op);
    }

    // Set a short timeout for the first attempt to allow fee bumping
    builder.setTimeout(30);
    
    let transaction = builder.build();

    // 3. Sign the transaction
    for (const secret of signers) {
      transaction.sign(Keypair.fromSecret(secret));
    }

    const txHash = transaction.hash().toString("hex");

    // 4. Initial record in DB
    await recordTransaction({
      txHash,
      txType: metadata.txType || "generic",
      amount: metadata.amount || "0",
      fromWallet: metadata.fromWallet || sourcePublicKey,
      toWallet: metadata.toWallet,
      merchantId: metadata.merchantId,
      campaignId: metadata.campaignId,
      userId: metadata.userId,
      status: "pending",
      metadata: { ...metadata, attempt: 1 },
    });

    try {
      // 5. Submit to Horizon
      let result = await this._submitWithRetry(transaction);
      
      // 6. Update DB with success
      await updateTransaction(txHash, {
        status: "completed",
        stellar_ledger: result.ledger,
        metadata: { ...metadata, result: "success" },
      });

      return result;
    } catch (error) {
      // 7. Handle stuck transaction or failure
      if (this._isStuck(error)) {
        return await this._handleStuckTransaction(transaction, signers, metadata);
      }

      // Record failure
      await updateTransaction(txHash, {
        status: "failed",
        metadata: { ...metadata, error: error.message },
      });
      throw error;
    }
  }

  /**
   * Submits a transaction and waits for result, with basic retry logic for network errors.
   */
  async _submitWithRetry(transaction) {
    try {
      return await server.submitTransaction(transaction);
    } catch (error) {
      // If error is timeout from Horizon, it might still be in the mempool
      if (error.response?.status === 504 || error.code === "ECONNABORTED") {
        return await this._waitForTransaction(transaction.hash().toString("hex"));
      }
      throw error;
    }
  }

  /**
   * Checks if the error indicates a stuck transaction (e.g. timeout or low fee).
   */
  _isStuck(error) {
    // Horizon error for timeout or transaction_status_unknown or insufficient fee
    const txError = error.response?.data?.extras?.result_codes?.transaction;
    return (
      error.response?.status === 504 ||
      txError === "tx_too_late" ||
      txError === "tx_insufficient_fee"
    );
  }

  /**
   * Polls Horizon to see if a transaction eventually made it into a ledger.
   */
  async _waitForTransaction(txHash) {
    const start = Date.now();
    while (Date.now() - start < POLLING_TIMEOUT) {
      try {
        const tx = await server.transactions().transaction(txHash).call();
        if (tx.successful) return tx;
      } catch (e) {
        // Continue polling
      }
      await new Promise(r => setTimeout(r, POLLING_INTERVAL));
    }
    throw new Error("Transaction timed out and is likely stuck");
  }

  /**
   * Handles stuck transactions by submitting a fee bump.
   */
  async _handleStuckTransaction(originalTx, signers, metadata, attempt = 1) {
    if (attempt > MAX_FEE_BUMP_ATTEMPTS) {
      throw new Error("Max fee bump attempts reached. Transaction still stuck.");
    }

    const feeSource = signers[0]; // Assuming first signer is also fee source
    const feeSourceKeypair = Keypair.fromSecret(feeSource);
    
    // Increase fee - doubling it for simplicity
    const newFee = String(BASE_FEE * 2 * (attempt + 1));

    const feeBumpTx = TransactionBuilder.buildFeeBumpTransaction(
      feeSourceKeypair.publicKey(),
      newFee,
      originalTx,
      NETWORK_PASSPHRASE
    );

    feeBumpTx.sign(feeSourceKeypair);

    const feeBumpHash = feeBumpTx.hash().toString("hex");

    // Update DB about fee bump
    await updateTransaction(originalTx.hash().toString("hex"), {
      status: "pending",
      metadata: { ...metadata, feeBumpHash, attempt: attempt + 1 },
    });

    try {
      let result = await server.submitTransaction(feeBumpTx);
      
      await updateTransaction(originalTx.hash().toString("hex"), {
        status: "completed",
        stellar_ledger: result.ledger,
        metadata: { ...metadata, feeBumpHash, result: "success_via_bump" },
      });

      return result;
    } catch (error) {
      if (this._isStuck(error)) {
        return await this._handleStuckTransaction(originalTx, signers, metadata, attempt + 1);
      }
      throw error;
    }
  }
}

module.exports = new TransactionService();
