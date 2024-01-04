import { PublicClient, createPublicClient, http } from "viem";
import { deployedTo as deployedTo1 } from "./artifacts/PlaceVerifierInfo.json";
import * as dotenv from "dotenv";
dotenv.config();
import { foundry, sepolia } from "viem/chains";
export const PLACE_WASM: string = `./place.wasm`;
export const PLACE_ZKEY: string = `./place.zkey`;
export const CANCEL_WASM: string = `./cancel.wasm`;
export const CANCEL_ZKEY: string = `./cancel.zkey`;
export const FILL_WASM: string = `./fill.wasm`;
export const FILL_ZKEY: string = `./fill.zkey`;
export const SEPOLIA_RPC: string = `https://sepolia.infura.io/v3/${process.env.INFURA_API_KEY}`;
export const W1_PRIV_KEY: string = process.env.W1_PRIV_KEY || "";
export const W2_PRIV_KEY: string = process.env.W2_PRIV_KEY || "";
export const PLACE_CONTRACT: string = deployedTo1;
export const CANCEL_CONTRACT: string =
    "0x82068c5f51c8a45d96014b82dfa95aa0fbfb6e55";
export const FILL_CONTRACT: string =
    "0x0f6c0bd5d8756e1a635b252f0cad87509d90f526";
export const MAIN_CONTRACT: string = "3C3EF8652c104f57acd42D077F060cf00cFc53B5";

export const publicClient: PublicClient = createPublicClient({
    chain: sepolia,
    transport: http(SEPOLIA_RPC),
});
