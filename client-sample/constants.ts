import * as dotenv from "dotenv";
import { deployedTo } from "./artifacts/UnyfyDevInfo.json";

dotenv.config();
export const PLACE_WASM: string = `./circuit-samples/place.wasm`;
export const PLACE_ZKEY: string = `./circuit-samples/place.zkey`;
export const CANCEL_WASM: string = `./circuit-samples/cancel.wasm`;
export const CANCEL_ZKEY: string = `./circuit-samples/cancel.zkey`;
export const FILL_WASM: string = `./circuit-samples/fill.wasm`;
export const FILL_ZKEY: string = `./circuit-samples/fill.zkey`;
export const SEPOLIA_RPC: string = `https://sepolia.infura.io/v3/${process.env.INFURA_API_KEY}`;
export const W1_PRIV_KEY: string = process.env.W1_PRIV_KEY || "";
export const W2_PRIV_KEY: string = process.env.W2_PRIV_KEY || "";
export const MAIN_CONTRACT: string = deployedTo.slice(2);
