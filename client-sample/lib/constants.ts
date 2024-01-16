import * as dotenv from "dotenv";
dotenv.config();

import { deployedTo } from "../artifacts/UnyfyDevInfo.json";

export const PLACE_WASM: string = `../circuits-sample/place/place.wasm`;
export const PLACE_ZKEY: string = `../circuits-sample/place/place.zkey`;
export const CANCEL_WASM: string = `../circuits-sample/cancel/cancel.wasm`;
export const CANCEL_ZKEY: string = `../circuits-sample/cancel/cancel.zkey`;
export const FILL_WASM: string = `../circuits-sample/fill/fill.wasm`;
export const FILL_ZKEY: string = `../circuits-sample/fill/fill.zkey`;
export const SEPOLIA_RPC: string = `https://sepolia.infura.io/v3/${process.env.INFURA_API_KEY}`;
export const W1_PRIV_KEY: string = process.env.W1_PRIV_KEY || "";
export const W2_PRIV_KEY: string = process.env.W2_PRIV_KEY || "";
export const MAIN_CONTRACT: string = deployedTo.slice(2);
