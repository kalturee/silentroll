# SilentRoll

SilentRoll is a privacy-preserving on-chain dice game powered by Zama FHEVM.
Players join once, start a round, submit an encrypted big/small guess, and earn
encrypted points when their guess matches the encrypted dice sum.

## Project Overview

SilentRoll demonstrates how Fully Homomorphic Encryption (FHE) enables fair,
transparent games without revealing player guesses or outcomes on-chain. Both
the dice roll and the guess remain encrypted while the contract compares them.

The project is designed to be simple to understand but strict about privacy:
no plaintext guesses, no plaintext scores, and no reliance on off-chain trust.

## Game Rules

1. A player joins the game and receives encrypted points (starting at 0).
2. The player starts a round, and the contract rolls two encrypted dice
   (1-6 each) and stores the encrypted sum.
3. The player submits an encrypted guess:
   - `true` means "big" (sum >= 7)
   - `false` means "small" (sum < 7)
4. If the guess is correct, the player receives 10,000 encrypted points.
   Otherwise, the reward is 0. The round ends after the guess is submitted.

## Why This Matters

Traditional on-chain games leak information:
- Public state exposes player guesses, outcomes, and strategies.
- Miners and bots can observe and exploit data before it is finalized.
- Randomness and fairness are hard to guarantee without trusted parties.

SilentRoll addresses these issues by keeping sensitive game data encrypted and
relying on Zama FHEVM randomness for on-chain dice rolls.

## Key Advantages

- **Privacy by default**: guesses, dice sums, and scores stay encrypted.
- **On-chain fairness**: dice randomness is generated inside the contract.
- **No trusted server**: logic and payouts are enforced by the contract.
- **Deterministic rules**: all players follow the same verifiable rules.
- **Composable design**: can be extended with new rounds, rewards, or modes.

## Architecture

- **Smart Contract**: `contracts/SilentRoll.sol`
  - Handles encrypted dice rolls, encrypted guesses, and encrypted scoring.
  - Uses Zama FHEVM primitives for encryption and randomness.
- **Frontend**: `app/`
  - React + Vite interface for players.
  - Reads encrypted data with `viem`.
  - Submits encrypted writes with `ethers`.
  - Uses RainbowKit for wallet connection.
  - No Tailwind CSS.
  - No environment variables in the frontend.
  - No localstorage and no localhost network configuration.
- **Deployment Artifacts**: `deployments/sepolia/`
  - Source of truth for the ABI used by the frontend.

## Tech Stack

- **Smart Contracts**: Solidity, Hardhat
- **FHE**: Zama FHEVM (`@fhevm/solidity`)
- **Frontend**: React, Vite, TypeScript
- **Wallet + RPC**: RainbowKit, `viem` (read), `ethers` (write)
- **Testing**: Hardhat test runner

## What Problem This Solves

- **Fair gameplay**: Players cannot read each other’s guesses or scores.
- **Anti-front-running**: Encrypted guesses remove strategic leakage.
- **Privacy-preserving scoring**: Points accumulate without public exposure.
- **On-chain trust**: The contract is the single source of truth.

## Repository Layout

```
silentroll/
├── app/                 # React frontend (no Tailwind, no env vars)
├── contracts/           # Solidity contracts
├── deploy/              # Deployment scripts
├── deployments/         # Network deployment artifacts (ABI source)
├── docs/                # Zama integration references
├── tasks/               # Hardhat custom tasks
├── test/                # Contract tests
├── hardhat.config.ts    # Hardhat configuration
└── README.md            # Project documentation
```

## Requirements

- **Node.js**: 20+
- **npm**: package manager

## Installation

```bash
npm install
```

## Environment Setup (Contracts Only)

The frontend does not use environment variables. Hardhat deployment and
verification require the following `.env` entries:

```bash
INFURA_API_KEY=your_infura_key
PRIVATE_KEY=your_private_key
ETHERSCAN_API_KEY=your_etherscan_key
```

Note: Deployment uses a private key directly. Mnemonics are not used.

## Build and Test

```bash
npm run compile
npm run test
```

## Deploy

### Local Node (for contract testing only)

```bash
npx hardhat node
npx hardhat deploy --network localhost
```

### Sepolia

```bash
npx hardhat deploy --network sepolia
npx hardhat verify --network sepolia <CONTRACT_ADDRESS>
```

## Frontend Usage

1. Ensure the Sepolia contract is deployed.
2. Copy the generated ABI from `deployments/sepolia/` into the frontend.
3. Start the frontend (see `app/` for its scripts).
4. Connect a wallet and join the game.
5. Start a round and submit an encrypted guess.
6. View encrypted points and outcomes as allowed by FHE permissions.

## Security and Privacy Notes

- Encrypted values require explicit permission to decrypt.
- The contract stores only encrypted guesses, roll sums, and points.
- The project is a demo and has not been audited.

## Limitations

- FHE operations are more expensive than plaintext operations.
- Gameplay depends on FHEVM availability and network performance.
- Points are not transferable and are purely for in-game scoring.

## Roadmap

- Multi-round sessions with optional streak rewards.
- Additional game modes (e.g., exact sum, doubles, or ranges).
- UI improvements and clearer encrypted data explanations.
- Gas and performance optimizations for FHE operations.
- Optional leaderboard with privacy-preserving aggregation.

## License

BSD-3-Clause-Clear. See `LICENSE` for details.
