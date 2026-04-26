import {
  getLedgerSnapshot,
  getRealBalance,
  initLedger,
  payAgent,
} from "./lightning";

async function main() {
  console.log("Initializing ledger...");
  console.log(initLedger());

  console.log("Checking real wallet balance...");
  const realBalance = await getRealBalance();
  console.log({ realBalance });

  console.log("Running test payments...");
  console.log(await payAgent("maestro", "script-agent", 15, "test payment 1"));
  console.log(await payAgent("maestro", "voice-agent", 8, "test payment 2"));
  console.log(await payAgent("maestro", "visual-agent", 45, "test payment 3"));

  console.log("Ledger snapshot:");
  console.log(getLedgerSnapshot());
}

main().catch((error) => {
  console.error("[lightning-test] failed", error);
  process.exitCode = 1;
});
