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
import {
  buildDevnetNetworkOrchestrator,
  getBitcoinBlockHeight,
  waitForStacksChainUpdate,
  waitForStacksTransaction,
} from "../../helpers";
import { DevnetNetworkOrchestrator } from "@hirosystems/stacks-devnet-js";

const STACKS_2_1_EPOCH = 109;

describe("use transitive trait alias", () => {
  let orchestrator: DevnetNetworkOrchestrator;
  let network: StacksNetwork;

  beforeAll(() => {
    orchestrator = buildDevnetNetworkOrchestrator(
      {
        epoch_2_0: 100,
        epoch_2_05: 102,
        epoch_2_1: STACKS_2_1_EPOCH,
        pox_2_activation: 112,
      },
      false
    );
    orchestrator.start();
    network = new StacksTestnet({ url: orchestrator.getStacksNodeUrl() });

    // Wait for Stacks 2.05 to start
    waitForStacksChainUpdate(orchestrator, Constants.DEVNET_DEFAULT_EPOCH_2_05);
  });

  afterAll(() => {
    orchestrator.stop();
  });

  const mathTrait = `(define-trait math (
    (add (uint uint) (response uint uint))
    (sub (uint uint) (response uint uint))
  ))`;
  const useMathTrait = `(use-trait math-alias .math-trait.math)

  (define-public (add-call (math-contract <math-alias>) (x uint) (y uint))
    (contract-call? math-contract add x y)
  )
  
  (define-public (sub-call (math-contract <math-alias>) (x uint) (y uint))
    (contract-call? math-contract sub x y)
  )`;
  const useMathTraitAlias = `(use-trait math-alias .use-math-trait.math-alias)

  (define-public (add-call (math-contract <math-alias>) (x uint) (y uint))
    (contract-call? math-contract add x y)
  )
  
  (define-public (sub-call (math-contract <math-alias>) (x uint) (y uint))
    (contract-call? math-contract sub x y)
  )`;

  test("in 2.05", async () => {
    // Build the transaction to deploy the contract
    let deployTxOptions = {
      senderKey: Accounts.DEPLOYER.secretKey,
      contractName: "math-trait",
      codeBody: mathTrait,
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
    waitForStacksTransaction(orchestrator, Accounts.DEPLOYER.stxAddress);

    // Build the transaction to deploy the contract
    deployTxOptions = {
      senderKey: Accounts.DEPLOYER.secretKey,
      contractName: "use-math-trait",
      codeBody: useMathTrait,
      fee: 2000,
      network,
      anchorMode: AnchorMode.OnChainOnly,
      postConditionMode: PostConditionMode.Allow,
    };

    transaction = await makeContractDeploy(deployTxOptions);

    // Broadcast transaction
    result = await broadcastTransaction(transaction, network);
    expect((<TxBroadcastResultOk>result).error).toBeUndefined();

    // Wait for the transaction to be processed
    waitForStacksTransaction(orchestrator, Accounts.DEPLOYER.stxAddress);

    // Build the transaction to deploy the contract
    deployTxOptions = {
      senderKey: Accounts.DEPLOYER.secretKey,
      contractName: "use-math-trait-transitive-alias",
      codeBody: useMathTraitAlias,
      fee: 2000,
      network,
      anchorMode: AnchorMode.OnChainOnly,
      postConditionMode: PostConditionMode.Allow,
    };

    transaction = await makeContractDeploy(deployTxOptions);

    // Broadcast transaction
    result = await broadcastTransaction(transaction, network);
    expect((<TxBroadcastResultOk>result).error).toBeUndefined();

    // Wait for the transaction to be processed
    let [_, tx] = waitForStacksTransaction(
      orchestrator,
      Accounts.DEPLOYER.stxAddress
    );
    expect(tx.description).toBe(
      `deployed: ${Accounts.DEPLOYER.stxAddress}.use-math-trait-transitive-alias`
    );
    expect(tx.success).toBeFalsy();

    // Make sure we stayed in 2.05
    let chainUpdate = orchestrator.waitForStacksBlock();
    expect(getBitcoinBlockHeight(chainUpdate)).toBeLessThanOrEqual(
      STACKS_2_1_EPOCH
    );
  });

  describe("in 2.1", () => {
    beforeAll(() => {
      // Wait for 2.1 to go live
      waitForStacksChainUpdate(orchestrator, STACKS_2_1_EPOCH);
    });

    test("Clarity1", async () => {
      // Build the transaction to deploy the contract
      let deployTxOptions = {
        clarityVersion: 1,
        senderKey: Accounts.DEPLOYER.secretKey,
        contractName: "use-math-trait-transitive-alias-c1",
        codeBody: useMathTraitAlias,
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
      let [_, tx] = waitForStacksTransaction(
        orchestrator,
        Accounts.DEPLOYER.stxAddress
      );
      expect(tx.description).toBe(
        `deployed: ${Accounts.DEPLOYER.stxAddress}.use-math-trait-transitive-alias-c1`
      );
      expect(tx.success).toBeFalsy();
    });

    describe("Clarity2", () => {
      test("using Clarity1 trait", async () => {
        // Build the transaction to deploy the contract
        let deployTxOptions = {
          clarityVersion: 2,
          senderKey: Accounts.DEPLOYER.secretKey,
          contractName: "use-math-trait-transitive-alias-c2",
          codeBody: useMathTraitAlias,
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
        let [_, tx] = waitForStacksTransaction(
          orchestrator,
          Accounts.DEPLOYER.stxAddress
        );
        expect(tx.description).toBe(
          `deployed: ${Accounts.DEPLOYER.stxAddress}.use-math-trait-transitive-alias-c2`
        );
        expect(tx.success).toBeFalsy();
      });

      test("using Clarity2 trait", async () => {
        // Build the transaction to deploy the contract
        let deployTxOptions = {
          clarityVersion: 2,
          senderKey: Accounts.WALLET_1.secretKey,
          contractName: "math-trait",
          codeBody: mathTrait,
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
        waitForStacksTransaction(orchestrator, Accounts.WALLET_1.stxAddress);

        // Build the transaction to deploy the contract
        deployTxOptions = {
          clarityVersion: 2,
          senderKey: Accounts.WALLET_1.secretKey,
          contractName: "use-math-trait",
          codeBody: useMathTrait,
          fee: 2000,
          network,
          anchorMode: AnchorMode.OnChainOnly,
          postConditionMode: PostConditionMode.Allow,
        };

        transaction = await makeContractDeploy(deployTxOptions);

        // Broadcast transaction
        result = await broadcastTransaction(transaction, network);
        expect((<TxBroadcastResultOk>result).error).toBeUndefined();

        // Wait for the transaction to be processed
        waitForStacksTransaction(orchestrator, Accounts.WALLET_1.stxAddress);

        // Build the transaction to deploy the contract
        deployTxOptions = {
          clarityVersion: 2,
          senderKey: Accounts.WALLET_1.secretKey,
          contractName: "use-math-trait-transitive-alias",
          codeBody: useMathTraitAlias,
          fee: 2000,
          network,
          anchorMode: AnchorMode.OnChainOnly,
          postConditionMode: PostConditionMode.Allow,
        };

        transaction = await makeContractDeploy(deployTxOptions);

        // Broadcast transaction
        result = await broadcastTransaction(transaction, network);
        expect((<TxBroadcastResultOk>result).error).toBeUndefined();

        // Wait for the transaction to be processed
        let [_, tx] = waitForStacksTransaction(
          orchestrator,
          Accounts.WALLET_1.stxAddress
        );
        expect(tx.description).toBe(
          `deployed: ${Accounts.WALLET_1.stxAddress}.use-math-trait-transitive-alias`
        );
        expect(tx.success).toBeFalsy();
      });
    });
  });
});
