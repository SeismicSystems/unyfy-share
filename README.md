# Unyfy Demo Client

## Running the Client
Showcase how Unyfy's client should interact with Seismic's matching engine. Documentation included in-line at `client-sample/client.ts`. 

We wrote this client so it may have minimal dependencies / setup steps. Running the below commands is all you need to execute the full order flow from constructing -> submitting -> crossing -> filling.

We have two modes in running the client depending on whether the backend runs on Seismic's AWS server or locally. We outline them below

Running the client when the backend is on the Seismic server:

```
cd client-sample/
pnpm install
pnpm run dev:local
```
Running the client when the backend is run locally (you can find the backend code to run locally [here](https://github.com/elliptic-labs/unyfy-matching-engine)):

```
cd client-sample/
pnpm install
pnpm run dev:local
```

## Compiling circuits and deploying contracts
We provide dummy circuits in the `circuit-samples` folder. The scripts for the automated workflow of compiling the circuits ---> getting the relevant files for proof generation and verification (`.wasm` and `.zkey`) ---> deploying the Solidity verifier on-chain on the Sepolia testnet are provided in `circuit-samples/scripts`. They are abstracted away and one only has to run the following commands for end-to-end compiling of circuits and deployment of contracts:

Installing dependencies: 
```
cd circuit-samples
pnpm install
```

Compiling and deploying the verifier for the `place.circom` circuit:
```
pnpm run dev:place
```

Compiling and deploying the verifier for the `cancel.circom` circuit:
```
pnpm run dev:cancel
```

Compiling and deploying the verifier for the `fill.circom` circuit:
```
pnpm run dev:fill
```

Now that all three circuits are compiled, relevant files for proof generation and verification have been obtained and the three contracts have been deployed, we deploy the main contract we use for proof verification: `contracts/UnyfyDev.sol`, using the following command:
```
pnpm run dev:main
```

This deploys the `UnyfyDev.sol` contract to Sepolia. Deployment information about all four contracts can be found in the `artifacts` folder (with the file names `PlaceVerifierInfo.json` `CancelVerifierInfo.json`, `FillVerifierInfo.json` and `UnyfyDevInfo.json`). 

## Environment Variables
There are three variables, `W1_PRIV_KEY`, `W2_PRIV_KEY` and `INFURA_API_KEY` that need to be set in the `.env` file of the root directory. `W1_PRIV_KEY` and `W2_PRIV_KEY` are private keys for the wallets that will be used for interacting with the backend and on-chain, while `INFURA_API_KEY` will be used in the RPC URL to interact with the Sepolia network.