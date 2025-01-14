import { StacksNetwork, StacksTestnet } from "@stacks/network";
import { Accounts, Constants } from "../../constants";
import {
  buildDevnetNetworkOrchestrator,
  getBitcoinBlockHeight,
  waitForStacksChainUpdate,
} from "../../helpers";
import { DevnetNetworkOrchestrator } from "@hirosystems/stacks-devnet-js";
import { load_versioned } from "./helper";

const STACKS_2_1_EPOCH = 109;

describe("use redefined trait from contract that redefines it", () => {
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

  test("in 2.05", async () => {
    await load_versioned(Accounts.DEPLOYER, "a-trait", network, orchestrator);
    await load_versioned(
      Accounts.DEPLOYER,
      "use-and-define-a-trait",
      network,
      orchestrator
    );
    let res = await load_versioned(
      Accounts.DEPLOYER,
      "use-a-trait-transitive-redefined",
      network,
      orchestrator
    );
    expect(res.ok).toBeTruthy();

    // Make sure this we stayed in 2.05
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

    describe("define a trait with duplicate method names", () => {
      test("Clarity1", async () => {
        await load_versioned(
          Accounts.WALLET_1,
          "a-trait",
          network,
          orchestrator
        );
        await load_versioned(
          Accounts.WALLET_1,
          "use-and-define-a-trait",
          network,
          orchestrator
        );
        let res = await load_versioned(
          Accounts.WALLET_1,
          "use-a-trait-transitive-redefined",
          network,
          orchestrator,
          1,
          "1"
        );
        expect(res.ok).toBeTruthy();
      });

      test("Clarity2", async () => {
        await load_versioned(
          Accounts.WALLET_2,
          "a-trait",
          network,
          orchestrator
        );
        await load_versioned(
          Accounts.WALLET_2,
          "use-and-define-a-trait",
          network,
          orchestrator
        );
        let res = await load_versioned(
          Accounts.WALLET_2,
          "use-a-trait-transitive-redefined",
          network,
          orchestrator,
          2,
          "2"
        );
        expect(res.ok).toBeTruthy();
      });
    });
  });
});
