/*
 * A sample client for Unyfy that interfaces with Seismic's dev endpoint. Runs
 * through submitting, crossing, and filling orders. Uses two separate wallets
 * and sockets to emulate a trader and their counterparty.
 *
 * We haven't turned on the light client yet for this version, so all claimed
 * moves submitted to Seismic are assumed to be instantly finalized on-chain.
 * The next update will include a dev chain that we will host for Unyfy so
 * everyone can test the contract interaction as well.
 */
import axios from "axios";
import fs from "fs";
import WebSocket from "ws";
import { poseidon4 } from "poseidon-lite";
import { PLACE_CONTRACT, FILL_CONTRACT, CANCEL_CONTRACT,MAIN_CONTRACT, SEPOLIA_RPC } from "./constants";
import {
    getContract,
    PrivateKeyAccount,
    PublicClient,
    WalletClient,
} from "viem";
import UnyfyDevABI from "./artifacts/UnyfyDev.json";
import * as Utils from "./utils";
import { RawOrder, Order } from "./types";
import { W1_PRIV_KEY, W2_PRIV_KEY, publicClient} from "./constants";
import { privatekeySetup } from "./utils";
import { parseGwei } from "viem";

/*
 * Config for dev endpoint.
 */
const SEISMIC_CONFIG = {
    ip: "44.201.111.37",
    port: "8000",
    encalvePubaddr: "0xa2c03BbE8Ce76d0c93D428A0f913F10b7acCfa9F",
};
const SEISMIC_URL = `${SEISMIC_CONFIG.ip}:${SEISMIC_CONFIG.port}`;
/*
 * Orders for wallet 1 (trader) and wallet 2 (counterparty). Orderbook currently
 * set up for a single pair, ETH<>DEFAULT_TOKEN.
 */
const W1_ORDERS = "wallet1_orders.json";
const W2_ORDERS = "wallet2_orders.json";
const DEFAULT_TOKEN =
    "92bf259f558808106e4840e2642352b156a31bc41e5b4283df2937278f0a7a65";
const ETH_DENOMINATION = "0x1";

/*
 * First step of authenticating a socket is requesting a challenge value from
 * Seismic. Must sign the returned challenge to prove to Seismic that they are
 * the owner of a particular Ethereum address.
 */
async function requestChallenge(wallet: WalletClient): Promise<string> {
    let res, err;
    [res, err] = await Utils.handleAsync(
        axios.post(`http://${SEISMIC_URL}/request_challenge`),
    );
    if (!res || err) {
        console.error("- Error requesting challenge:", err);
        process.exit(1);
    }
    const challenge = res.data;
    console.log("- Received challenge:", challenge);
    return challenge;
}

/*
 * Send the signed challenge value back to the server.
 */
async function sendChallenge(
    account: PrivateKeyAccount,
    challenge: string,
    signedChallenge: string,
): Promise<string> {
    let res, err;
    [res, err] = await Utils.handleAsync(
        axios.post(`http://${SEISMIC_URL}/submit_response`, {
            challenge_id: challenge,
            signature: signedChallenge,
            pub_key: account.address,
        }),
    );
    if (!res || err) {
        console.error("- Error sending in challenge:", err);
        process.exit(1);
    }
    const jwt = res.data;
    console.log("- Received JWT:", jwt);
    return jwt;
}

/*
 * Fill all orders that cross with the order sent in getcrossedorders. Should
 * receive a message back from Seismic with "status": "success".
 */
async function fillOrder(
    ws: WebSocket,
    orderCommit: any,
    counterOrders: any[],
) {
    const ownHash = orderCommit["shielded"];
    const ownSide = orderCommit["transparent"]["side"];
    const counterHashes = counterOrders.map(
        (counterOrder) => counterOrder["raw_order_commitment"]["private"],
    );

    ws.send(
        JSON.stringify({
            action: "fillorders",
            data: {
                side: ownSide,
                hash_own: ownHash,
                hash_matched: counterHashes,
            },
        }),
        (error) => {
            if (error) {
                console.error("Error attempting to fill order:", error);
            }
        },
    );
}

/*
 * Consult API docs for the full list of messages Seismic will send to clients.
 * This demo has special handling for 1) enclave signatures, and 2) crossed
 * orders.
 */
async function handleServerMsg(ws: WebSocket, msg: string, wallet: WalletClient, account: PrivateKeyAccount, publicClient: PublicClient) {
    console.log("- Received message:", msg.toString());
    try {
        const msgJson = JSON.parse(msg);
        if (msgJson["action"] == "sendorder") {
            await Utils.sanityCheckSignature(
                msgJson["enclaveSignature"],
                SEISMIC_CONFIG.encalvePubaddr,
            );
        }
        if (msgJson["action"] == "getcrossedorders") {
            let orderhashes =[];
            orderhashes.push(msgJson["orderCommitment"]["shielded"]);
            msgJson["data"]["orders"].forEach((order:any) => {
                orderhashes.push(order["raw_order_commitment"]["private"]);
            });
            sendFillProof(publicClient, wallet, account, orderhashes);
        }
    } catch {
        return;
    }
}

/*
 * Open a socket with Seismic and authenticates it with wallet keypair.
 */
async function openAuthSocket(
    wallet: WalletClient,
    account: PrivateKeyAccount,
    publicClient: PublicClient,
): Promise<WebSocket> {
    const challenge = await requestChallenge(wallet);

    const signedChallenge = await Utils.signMsg(wallet, account, challenge);
    const jwt = await sendChallenge(account, challenge, signedChallenge);

    return new Promise((resolve, _) => {
        const ws = new WebSocket(`ws://${SEISMIC_URL}/ws`, {
            headers: { Authorization: `Bearer ${jwt}` },
        });
        ws.on("message", (msg: string) => {
            handleServerMsg(ws, msg, wallet, account, publicClient);
        });
        ws.on("error", (err: Error) => {
            console.error("- WebSocket error:", err);
        });
        ws.on("close", () => {
            console.log("- WebSocket connection closed");
        });
        ws.on("open", () => {
            resolve(ws);
        });
    });
}

/*
 * Reset the order book. For development only.
 */
function clearBook(ws: WebSocket) {
    ws.send(
        JSON.stringify({
            action: "clearorderbook",
        }),
        (err: Error | undefined) => {
            if (err) {
                console.error("- Error clearing book:", err);
            }
        },
    );
}

/*
 * Construct an Order object from the RawOrder provided by the user by adding
 * an access key + hiding commitment and organizing into formal structure.
 */
function constructOrder(raw: RawOrder): Order {
    const accessKey = Utils.uniformBN128Scalar();
    const scaledPrice = raw.price * 10 ** 9;
    const scaledVol = raw.volume * 10 ** 9;
    let orderHash = poseidon4([
        scaledPrice.toString(),
        scaledVol.toString(),
        raw.side.toString(),
        accessKey.toString(),
    ]);

    return {
        data: {
            transparent: {
                side: raw.side.toString(),
                token: DEFAULT_TOKEN,
                denomination: ETH_DENOMINATION,
            },
            shielded: {
                price: scaledPrice.toString(),
                volume: scaledVol.toString(),
                accessKey: accessKey.toString(16),
            },
        },
        hash: orderHash.toString(16),
    };
}

/*
 * Submit orders to book.
 */
function submitOrders(ws: WebSocket, ordersFile: string): Order[] {
    const rawOrders: RawOrder[] = JSON.parse(
        fs.readFileSync(ordersFile, "utf8"),
    );
    const orders: Order[] = rawOrders.map((raw) => constructOrder(raw));
    orders.forEach((order) => {
        ws.send(
            JSON.stringify({
                action: "sendorder",
                data: order.data,
                hash: order.hash,
            }),
            (error) => {
                if (error) {
                    console.error("- Error submitting order:", error);
                }
            },
        );
    });
    return orders;
}
/*
 * Sends the place proof to the contract for verification
 */
async function sendPlaceProof(
    publicClient: PublicClient,
    walletClient: WalletClient,
    account: PrivateKeyAccount,
    ordersFile: string,
): Promise<Order[]> {
    const rawOrders: RawOrder[] = JSON.parse(
        fs.readFileSync(ordersFile, "utf8"),
    );
    const orders: Order[] = rawOrders.map((raw) => constructOrder(raw));
    for (const order of orders) {
        const placeProof = await Utils.provePlace(order.hash, "1");
        const { request } = await publicClient.simulateContract({
            address: `0x${MAIN_CONTRACT}`,
            abi: UnyfyDevABI.abi,
            functionName: "verifyPlaceProof",
            args: [
                PLACE_CONTRACT,
                placeProof.a,
                placeProof.b,
                placeProof.c,
                placeProof.input,
            ],
            gasPrice: parseGwei('60')
        });
        await walletClient.writeContract({ ...request, account: account });
    }
    return orders;
}

/*
 * Sends the cancel proof to the contract for verification
 */
async function sendCancelProof(
    publicClient: PublicClient,
    walletClient: WalletClient,
    account: PrivateKeyAccount,
    orderhash: string,
): Promise<string> {
        const cancelProof = await Utils.proveCancel(orderhash, "1");
        const { request } = await publicClient.simulateContract({
            address: `0x${MAIN_CONTRACT}`,
            abi: UnyfyDevABI.abi,
            functionName: "verifyPlaceProof",
            args: [
                CANCEL_CONTRACT,
                cancelProof.a,
                cancelProof.b,
                cancelProof.c,
                cancelProof.input,
            ],
            gasPrice: parseGwei('60')
        });
        await walletClient.writeContract({ ...request, account: account });
        return orderhash;
    }

/*
 * Sends the fill proof to the contract for verification
 */
async function sendFillProof(
    publicClient: PublicClient,
    walletClient: WalletClient,
    account: PrivateKeyAccount,
    orderhashes: string[],
): Promise<string[]> {
    const fillProofs = [];
    for (let i = 0; i < Math.min(orderhashes.length, 11); i++) {
        fillProofs.push(orderhashes[i]);
    }
    while (fillProofs.length < 11) {
        fillProofs.push("0");
    }
    fillProofs.push("1");
    const fillProof = await Utils.proveFill(fillProofs, "1");
    const { request } = await publicClient.simulateContract({
        address: `0x${MAIN_CONTRACT}`,
        abi: UnyfyDevABI.abi,
        functionName: "verifyPlaceProof",
        args: [
            FILL_CONTRACT,
            fillProof.a,
            fillProof.b,
            fillProof.c,
            fillProof.input,
        ],
        gasPrice: parseGwei('60')
    });
    await walletClient.writeContract({ ...request, account: account });
    return orderhashes;
}


/*
 * Ask Seismic for the pre-images of all open orders associated with the wallet
 * that authenticated ws.
 */
function getOpenOrders(ws: WebSocket) {
    ws.send(
        JSON.stringify({
            action: "openorders",
        }),
        (error) => {
            if (error) {
                console.error("- Error getting open orders:", error);
            }
        },
    );
}

/*
 * Ask Seismic's matching engine to look up all orders that cross with an
 * input order.
 */
function getCrossedOrders(ws1: WebSocket, order: Order) {
    ws1.send(
        JSON.stringify({
            action: "getcrossedorders",
            data: order.data,
            hash: order.hash,
        }),
        (error) => {
            if (error) {
                console.error(
                    "Error sending get crossed orders message:",
                    error,
                );
            }
        },
    );
}

(async () => {
    // Initialize a public client for Sepolia
    

    // Create contract instance
    const contract = getContract({
        address: '0x3C3EF8652c104f57acd42D077F060cf00cFc53B5',
        abi: UnyfyDevABI.abi,
        publicClient: publicClient,
    });

    // Need at least two wallets to emulate a typical Unyfy interaction.

    const [wallet1, w1client] = privatekeySetup(W1_PRIV_KEY);
    const ws1 = await openAuthSocket(w1client, wallet1, publicClient);
    const [wallet2, w2client] = privatekeySetup(W2_PRIV_KEY);
    const ws2 = await openAuthSocket(w2client, wallet2, publicClient);

    // Reset the order book so we have a blank slate.
    clearBook(ws1);
    await Utils.sleep(1);

    // Send the orders to the book, at which point they are still in the staging queue
    const ordersW1 = submitOrders(ws1, W1_ORDERS);
    const ordersW2 = submitOrders(ws2, W2_ORDERS);
    if (ordersW1.length === 0 || ordersW2.length === 0) {
        console.error("- Wallet 1 or 2 order file couldn't be parsed");
        process.exit(1);
    }
    await Utils.sleep(1);

    const placeProofsW1 = await sendPlaceProof(
        publicClient,
        w1client,
        wallet1,
        W1_ORDERS,
    );
    const placeProofsW2 = await sendPlaceProof(
        publicClient,
        w2client,
        wallet2,
        W2_ORDERS,
    );

    if (ordersW1.length === 0 || ordersW2.length === 0) {
        console.error("- Wallet 1 or 2 order file couldn't be parsed");
        process.exit(1);
    }
    await Utils.sleep(1);
    // Confirm that these orders were logged in the book.
    getOpenOrders(ws1);
    await Utils.sleep(1);
    getOpenOrders(ws2);
    await Utils.sleep(1);

    // Gets crossed orders.
    getCrossedOrders(ws1, ordersW1[0]);



})();
