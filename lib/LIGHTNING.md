# Lightning integration

For hackathon speed, this project uses one self-hosted Alby Hub wallet for the foreman, sub-agents, and consumer flows. That keeps the setup small, avoids wallet provisioning per agent, and still gives the demo real Lightning activity through a single always-on hub.

The app shows two different balance concepts. The real wallet balance comes from Alby Hub through Nostr Wallet Connect. The agent cards use a virtual in-memory ledger so each agent can appear to earn and spend sats independently even though all real invoice creation and settlement happens against the same wallet.

Set `USE_STUB_LIGHTNING=true` to develop offline or to keep the app demoable when the hub is unreachable. In stub mode, Lightning calls return realistic mock responses after short randomized delays, and the internal ledger still updates so the multi-agent flow keeps working.

In production, each agent would have its own NWC connection with separate budgets, scopes, and permissions instead of sharing one wallet. That would let the foreman enforce real spending limits and isolate payment authority per agent.
