import gasPrice from '../artifacts/gas_price.json';

/*
 * Config(s) for dev endpoint. Two modes -- Seismic sequencer and local.
 */
export const SEISMIC_CONFIG = {
    serverUrl: "35.153.255.21:8000",
    localUrl: "127.0.0.1:8000",
    enclavePubaddr: "0xa2c03BbE8Ce76d0c93D428A0f913F10b7acCfa9F",
};

/*
 * Order details for the two wallets, along with gas price to send orders on-chain.
 */
export const w1_orders = "artifacts/wallet1_orders.json";
export const w2_orders = "artifacts/wallet2_orders.json";
export const gas_price = String(gasPrice.price)

/*
 * Details for the token.
 */
export const default_token =
    "92bf259f558808106e4840e2642352b156a31bc41e5b4283df2937278f0a7a65";
export const eth_denomination = "0x1";

