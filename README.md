# Unyfy Demo Client

## Organization

The demo has three main folders - `client-sample`, `circuits-sample` and `contracts-sample`.

### `circuits-sample`

`circuits-sample` contains the circuits and other relevant files (`.wasm`s and `.zkey`s) for the circuit, which are located in the corresponding folders (`place/`, `cancel/` and `fill/`).

### `contracts-sample`

The `contracts-sample` contains the verifier contract(s) for the circuits which are deployed on-chain, and are generated automatically (see next section), along with the main contract (`UnyfyDev.sol`) which the client interacts with. These are located in `src/`.

### `client-sample`

Lastly, the client is located in `client-sample`, and contains the required artifacts in `artifacts/` and the utils and other required functionality in `lib/`. It contains `client.ts`, which is the main client script, and `listen.ts`, a listener script to listen for on-chain events.

The flow for running the demo end-to-end consists of compiling circuits and deploying contracts, setting the required environment and other variables, and finally running the client.

## Compiling circuits and deploying contracts

We provide dummy circuits in the `circuits-sample` folder. The scripts for the automated workflow of compiling the circuits ---> getting the relevant files for proof generation and verification (`.wasm` and `.zkey`) ---> deploying the Solidity verifier on-chain on the Sepolia testnet are provided in `circuits-sample/scripts`. They are abstracted away and one only has to run the following commands for end-to-end compiling of circuits and deployment of contracts:

Installing dependencies:

```
cd circuits-sample
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

This deploys the `UnyfyDev.sol` contract to Sepolia. All the above contracts are stored in `contracts-sample/src`. Deployment information about all four contracts can be found in `client-sample/artifacts` (with the file names `PlaceVerifierInfo.json` `CancelVerifierInfo.json`, `FillVerifierInfo.json` and `UnyfyDevInfo.json`).

## Running the Client

We now run the main client to interact with the matching engine. Documentation included in-line at `client-sample/client.ts`.

We wrote this client so it may have minimal dependencies / setup steps. Running the below commands is all you need to execute the full order flow from constructing -> submitting -> crossing -> filling.

You need to first set the environment and other variables in order to run the client.

### Environment Variables

There are three variables, `W1_PRIV_KEY`, `W2_PRIV_KEY` and `INFURA_API_KEY` that need to be set in the `.env` file of the `client-sample` directory. `W1_PRIV_KEY` and `W2_PRIV_KEY` are private keys for the wallets that will be used for interacting with the backend and on-chain, while `INFURA_API_KEY` will be used in the RPC URL to interact with the Sepolia network.

### Other Variables

In the `client-sample/artifacts` directory, you can find `wallet1_orders.json` and `wallet2_orders.json`, where you can enter the orders for wallet 1 and 2 respectively where an item in the file is a tuple of price, volume and side (`bid` (0) or `ask` (1)). You can set a custom `gasPrice` for all transactions by changing the `price` field in `gas_price.json`.

We have two modes in running the client depending on whether the backend runs on Seismic's sequencer or locally. We outline them below

Running the client when the backend is on the Seismic sequencer:

```
cd client-sample/
pnpm install
pnpm run dev:seismic
```

Running the client when the backend is run locally (you can find the backend code to run locally [here](https://github.com/SeismicSystems/unyfy-matching-engine)):

```
cd client-sample/
pnpm install
pnpm run dev:local
```

## Listening to the contract

You can observe what's happening on-chain, more specifically, the events that are being emitted by the deployed `UnyfyDev.sol` contract, by running

```
pnpm run dev:listen
```

The listener code is in `client-sample/listen.ts`.
