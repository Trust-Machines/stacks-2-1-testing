import {
  makeContractDeploy,
  broadcastTransaction,
  AnchorMode,
  PostConditionMode,
  TxBroadcastResultOk,
  makeContractCall,
  SignedContractCallOptions,
} from "@stacks/transactions";
import { StacksNetwork, StacksTestnet } from "@stacks/network";
import { Accounts, Constants } from "../../constants";
import { principalCV } from "@stacks/transactions/dist/clarity/types/principalCV";
import {
  buildDevnetNetworkOrchestrator,
  waitForStacksChainUpdate,
  waitForStacksTransaction,
} from "../../helpers";
import { DevnetNetworkOrchestrator } from "@hirosystems/stacks-devnet-js";

describe("principal-destruct?", () => {
  let orchestrator: DevnetNetworkOrchestrator;
  let network: StacksNetwork;

  beforeAll(() => {
    orchestrator = buildDevnetNetworkOrchestrator();
    orchestrator.start();
    network = new StacksTestnet({ url: orchestrator.getStacksNodeUrl() });
  });

  afterAll(() => {
    orchestrator.stop();
  });

  test("is invalid in 2.05", async () => {
    // Wait for Stacks 2.05 to start
    waitForStacksChainUpdate(orchestrator, Constants.DEVNET_DEFAULT_EPOCH_2_05);

    // Build the transaction to deploy the contract
    let deployTxOptions = {
      senderKey: Accounts.DEPLOYER.secretKey,
      contractName: "test-2-05",
      codeBody: `(define-public (test-literal-1)
    (principal-destruct? 'STB44HYPYAT2BB2QE513NSP81HTMYWBJP02HPGK6)
)
(define-public (test-literal-2)
    (principal-destruct? 'STB44HYPYAT2BB2QE513NSP81HTMYWBJP02HPGK6.foo)
)
(define-public (test (p principal))
    (principal-destruct? p)
)`,
      fee: 2000,
      network,
      anchorMode: AnchorMode.OnChainOnly,
      postConditionMode: PostConditionMode.Allow,
    };

    let transaction = await makeContractDeploy(deployTxOptions);

    // Broadcast transaction
    let result = await broadcastTransaction(transaction, network);
    expect((<TxBroadcastResultOk>result).error).toBeUndefined();

    // Wait for the transaction to be processed
    let [block, tx] = waitForStacksTransaction(
      orchestrator,
      Accounts.DEPLOYER.stxAddress
    );
    expect(block.bitcoin_anchor_block_identifier.index).toBeLessThan(
      Constants.DEVNET_DEFAULT_EPOCH_2_1
    );
    expect(tx.description).toBe(
      `deployed: ${Accounts.DEPLOYER.stxAddress}.test-2-05`
    );
    expect(tx.success).toBeFalsy();
  });

  describe("in 2.1", () => {
    beforeAll(() => {
      // Wait for 2.1 to go live
      waitForStacksChainUpdate(
        orchestrator,
        Constants.DEVNET_DEFAULT_EPOCH_2_1
      );
    });

    test("is valid", async () => {
      // Build the transaction to deploy the contract
      let deployTxOptions = {
        senderKey: Accounts.DEPLOYER.secretKey,
        contractName: "test-2-1",
        codeBody: `(define-public (test-literal-1)
    (principal-destruct? 'STB44HYPYAT2BB2QE513NSP81HTMYWBJP02HPGK6)
)
(define-public (test-literal-2)
    (principal-destruct? 'STB44HYPYAT2BB2QE513NSP81HTMYWBJP02HPGK6.foo)
)
(define-public (test (p principal))
    (principal-destruct? p)
)`,
        fee: 2000,
        network,
        anchorMode: AnchorMode.OnChainOnly,
        postConditionMode: PostConditionMode.Allow,
      };

      let transaction = await makeContractDeploy(deployTxOptions);

      // Broadcast transaction
      let result = await broadcastTransaction(transaction, network);
      expect((<TxBroadcastResultOk>result).error).toBeUndefined();

      // Wait for the transaction to be processed
      let [block, tx] = waitForStacksTransaction(
        orchestrator,
        Accounts.DEPLOYER.stxAddress
      );
      expect(tx.description).toBe(
        `deployed: ${Accounts.DEPLOYER.stxAddress}.test-2-1`
      );
      expect(tx.success).toBeTruthy();
    });

    test("works for a literal standard principal", async () => {
      // Build a transaction to call the contract
      let callTxOptions: SignedContractCallOptions = {
        senderKey: Accounts.WALLET_1.secretKey,
        contractAddress: Accounts.DEPLOYER.stxAddress,
        contractName: "test-2-1",
        functionName: "test-literal-1",
        functionArgs: [],
        fee: 2000,
        network,
        anchorMode: AnchorMode.OnChainOnly,
        postConditionMode: PostConditionMode.Allow,
      };
      let transaction = await makeContractCall(callTxOptions);

      // Broadcast transaction
      let result = await broadcastTransaction(transaction, network);
      expect((<TxBroadcastResultOk>result).error).toBeUndefined();

      // Wait for the transaction to be processed
      let [block, tx] = waitForStacksTransaction(
        orchestrator,
        Accounts.WALLET_1.stxAddress
      );
      expect(tx.description).toBe(
        `invoked: ${Accounts.DEPLOYER.stxAddress}.test-2-1::test-literal-1()`
      );
      expect(tx.result).toBe(
        "(ok (tuple (hash-bytes 0x164247d6f2b425ac5771423ae6c80c754f7172b0) (name none) (version 0x1a)))"
      );
      expect(tx.success).toBeTruthy();
    });

    test("works for a literal contract principal", async () => {
      // Build a transaction to call the contract
      let callTxOptions = {
        senderKey: Accounts.WALLET_1.secretKey,
        contractAddress: Accounts.DEPLOYER.stxAddress,
        contractName: "test-2-1",
        functionName: "test-literal-2",
        functionArgs: [],
        fee: 2000,
        network,
        anchorMode: AnchorMode.OnChainOnly,
        postConditionMode: PostConditionMode.Allow,
      };
      let transaction = await makeContractCall(callTxOptions);

      // Broadcast transaction
      let result = await broadcastTransaction(transaction, network);
      expect((<TxBroadcastResultOk>result).error).toBeUndefined();

      // Wait for the transaction to be processed
      let [_, tx] = waitForStacksTransaction(
        orchestrator,
        Accounts.WALLET_1.stxAddress
      );
      expect(tx.description).toBe(
        `invoked: ${Accounts.DEPLOYER.stxAddress}.test-2-1::test-literal-2()`
      );
      expect(tx.result).toBe(
        '(ok (tuple (hash-bytes 0x164247d6f2b425ac5771423ae6c80c754f7172b0) (name (some "foo")) (version 0x1a)))'
      );
      expect(tx.success).toBeTruthy();
    });

    test("works for a standard principal", async () => {
      // Build a transaction to call the contract
      let callTxOptions: SignedContractCallOptions = {
        senderKey: Accounts.WALLET_1.secretKey,
        contractAddress: Accounts.DEPLOYER.stxAddress,
        contractName: "test-2-1",
        functionName: "test",
        functionArgs: [principalCV("STB44HYPYAT2BB2QE513NSP81HTMYWBJP02HPGK6")],
        fee: 2000,
        network,
        anchorMode: AnchorMode.OnChainOnly,
        postConditionMode: PostConditionMode.Allow,
      };
      let transaction = await makeContractCall(callTxOptions);

      // Broadcast transaction
      let result = await broadcastTransaction(transaction, network);
      expect((<TxBroadcastResultOk>result).error).toBeUndefined();

      // Wait for the transaction to be processed
      let [block, tx] = waitForStacksTransaction(
        orchestrator,
        Accounts.WALLET_1.stxAddress
      );
      expect(tx.description).toBe(
        `invoked: ${Accounts.DEPLOYER.stxAddress}.test-2-1::test(STB44HYPYAT2BB2QE513NSP81HTMYWBJP02HPGK6)`
      );
      expect(tx.result).toBe(
        "(ok (tuple (hash-bytes 0x164247d6f2b425ac5771423ae6c80c754f7172b0) (name none) (version 0x1a)))"
      );
      expect(tx.success).toBeTruthy();
    });

    test("works for a contract principal", async () => {
      // Build a transaction to call the contract
      let callTxOptions = {
        senderKey: Accounts.WALLET_1.secretKey,
        contractAddress: Accounts.DEPLOYER.stxAddress,
        contractName: "test-2-1",
        functionName: "test",
        functionArgs: [
          principalCV("STB44HYPYAT2BB2QE513NSP81HTMYWBJP02HPGK6.foo"),
        ],
        fee: 2000,
        network,
        anchorMode: AnchorMode.OnChainOnly,
        postConditionMode: PostConditionMode.Allow,
      };
      let transaction = await makeContractCall(callTxOptions);

      // Broadcast transaction
      let result = await broadcastTransaction(transaction, network);
      expect((<TxBroadcastResultOk>result).error).toBeUndefined();

      // Wait for the transaction to be processed
      let [_, tx] = waitForStacksTransaction(
        orchestrator,
        Accounts.WALLET_1.stxAddress
      );
      expect(tx.description).toBe(
        `invoked: ${Accounts.DEPLOYER.stxAddress}.test-2-1::test(STB44HYPYAT2BB2QE513NSP81HTMYWBJP02HPGK6.foo)`
      );
      expect(tx.result).toBe(
        '(ok (tuple (hash-bytes 0x164247d6f2b425ac5771423ae6c80c754f7172b0) (name (some "foo")) (version 0x1a)))'
      );
      expect(tx.success).toBeTruthy();
    });

    test("fails for an invalid principal", async () => {
      // Build a transaction to call the contract
      let callTxOptions = {
        senderKey: Accounts.WALLET_1.secretKey,
        contractAddress: Accounts.DEPLOYER.stxAddress,
        contractName: "test-2-1",
        functionName: "test",
        functionArgs: [
          principalCV("SP3X6QWWETNBZWGBK6DRGTR1KX50S74D3433WDGJY"),
        ],
        fee: 2000,
        network,
        anchorMode: AnchorMode.OnChainOnly,
        postConditionMode: PostConditionMode.Allow,
      };
      let transaction = await makeContractCall(callTxOptions);

      // Broadcast transaction
      let result = await broadcastTransaction(transaction, network);
      expect((<TxBroadcastResultOk>result).error).toBeUndefined();

      // Wait for the transaction to be processed
      let [_, tx] = waitForStacksTransaction(
        orchestrator,
        Accounts.WALLET_1.stxAddress
      );
      expect(tx.description).toBe(
        `invoked: ${Accounts.DEPLOYER.stxAddress}.test-2-1::test(SP3X6QWWETNBZWGBK6DRGTR1KX50S74D3433WDGJY)`
      );
      expect(tx.result).toBe(
        "(err (tuple (hash-bytes 0xfa6bf38ed557fe417333710d6033e9419391a320) (name none) (version 0x16)))"
      );
      expect(tx.success).toBeFalsy();
    });

    test("fails for an invalid contract principal", async () => {
      // Build a transaction to call the contract
      let callTxOptions = {
        senderKey: Accounts.WALLET_1.secretKey,
        contractAddress: Accounts.DEPLOYER.stxAddress,
        contractName: "test-2-1",
        functionName: "test",
        functionArgs: [
          principalCV("SP3X6QWWETNBZWGBK6DRGTR1KX50S74D3433WDGJY.foo"),
        ],
        fee: 2000,
        network,
        anchorMode: AnchorMode.OnChainOnly,
        postConditionMode: PostConditionMode.Allow,
      };
      let transaction = await makeContractCall(callTxOptions);

      // Broadcast transaction
      let result = await broadcastTransaction(transaction, network);
      expect((<TxBroadcastResultOk>result).error).toBeUndefined();

      // Wait for the transaction to be processed
      let [_, tx] = waitForStacksTransaction(
        orchestrator,
        Accounts.WALLET_1.stxAddress
      );
      expect(tx.description).toBe(
        `invoked: ${Accounts.DEPLOYER.stxAddress}.test-2-1::test(SP3X6QWWETNBZWGBK6DRGTR1KX50S74D3433WDGJY.foo)`
      );
      expect(tx.result).toBe(
        '(err (tuple (hash-bytes 0xfa6bf38ed557fe417333710d6033e9419391a320) (name (some "foo")) (version 0x16)))'
      );
      expect(tx.success).toBeFalsy();
    });
  });
});
