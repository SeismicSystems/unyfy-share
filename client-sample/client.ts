/*
 * A sample client for Unyfy that interfaces with Seismic's dev endpoint. Runs
 * through submitting, crossing, and filling orders. Uses two separate wallets
 * and sockets to emulate a trader and their counterparty.
 *
 * We deploy our contracts on Sepolia
 *
 */
import axios from "axios";
import fs from "fs";
import WebSocket from "ws";
import { poseidon4 } from "poseidon-lite";
import {
    getContract,
    PrivateKeyAccount,
    PublicClient,
    WalletClient,
} from "viem";
import UnyfyDevABI from "./artifacts/UnyfyDev.json";
import * as Utils from "./utils";
import { RawOrder, Order } from "./types";
import { W1_PRIV_KEY, W2_PRIV_KEY, MAIN_CONTRACT } from "./constants";
import { privatekeySetup } from "./utils";
import { parseGwei } from "viem";
import { createPublicClient, http } from "viem";
import { sepolia, foundry } from "viem/chains";
import { SEPOLIA_RPC } from "./constants";

/*
 * Config for dev endpoint.
 */
const SEISMIC_CONFIG = {
    serverip: "35.153.255.21",
    localip: "127.0.0.1",
    port: "8000",
    encalvePubaddr: "0xa2c03BbE8Ce76d0c93D428A0f913F10b7acCfa9F",
};
const SEISMIC_SERVER_URL = `${SEISMIC_CONFIG.serverip}:${SEISMIC_CONFIG.port}`;
const SEISMIC_LOCAL_URL = `${SEISMIC_CONFIG.localip}:${SEISMIC_CONFIG.port}`;
/*
 * Orders for wallet 1 (trader) and wallet 2 (counterparty). Orderbook currently
 * set up for a single pair, ETH<>DEFAULT_TOKEN.
 */
const W1_ORDERS = "wallet1_orders.json";
const W2_ORDERS = "wallet2_orders.json";
const W1_CONSTRUCTED_ORDERS = "wallet1_constructed_orders.json";
const W2_CONSTRUCTED_ORDERS = "wallet2_constructed_orders.json";
const DEFAULT_TOKEN =
    "92bf259f558808106e4840e2642352b156a31bc41e5b4283df2937278f0a7a65";
const ETH_DENOMINATION = "0x1";

/*
 * First step of authenticating a socket is requesting a challenge value from
 * Seismic. Must sign the returned challenge to prove to Seismic that they are
 * the owner of a particular Ethereum address.
 */
async function requestChallenge(
    wallet: WalletClient,
    localorserver: string,
): Promise<string> {
    let res, err;
    if (localorserver === "local") {
        [res, err] = await Utils.handleAsync(
            axios.post(`http://${SEISMIC_LOCAL_URL}/request_challenge`),
        );
    } else {
        [res, err] = await Utils.handleAsync(
            axios.post(`http://${SEISMIC_SERVER_URL}/request_challenge`),
        );
    }
    if (!res || err) {
        console.error("- Error requesting challenge:", err);
        process.exit(1);
    }
    const challenge = res.data;
    console.debug("- Received challenge:", challenge);
    return challenge;
}

/*
 * Send the signed challenge value back to the server.
 */
async function sendChallenge(
    localorserver: string,
    account: PrivateKeyAccount,
    challenge: string,
    signedChallenge: string,
): Promise<string> {
    let res, err;
    if (localorserver === "local") {
        [res, err] = await Utils.handleAsync(
            axios.post(`http://${SEISMIC_LOCAL_URL}/submit_response`, {
                challenge_id: challenge,
                signature: signedChallenge,
                pub_key: account.address,
            }),
        );
    } else {
        [res, err] = await Utils.handleAsync(
            axios.post(`http://${SEISMIC_SERVER_URL}/submit_response`, {
                challenge_id: challenge,
                signature: signedChallenge,
                pub_key: account.address,
            }),
        );
    }
    if (!res || err) {
        console.error("- Error sending in challenge:", err);
        process.exit(1);
    }
    const jwt = res.data;
    console.debug("- Received JWT:", jwt);
    return jwt;
}

/*
 * Consult API docs for the full list of messages Seismic will send to clients.
 * This demo has special handling for 1) enclave signatures, and 2) crossed
 * orders.
 */
async function handleServerMsg(
    ws: WebSocket,
    msg: string,
    wallet1: WalletClient,
    wallet2: WalletClient,
    account1: PrivateKeyAccount,
    account2: PrivateKeyAccount,
    publicClient: PublicClient,
) {
    console.debug("- Received message:", msg.toString());
    try {
        const msgJson = JSON.parse(msg);
        // If the message is an enclave signature, check it and call place() on the contract to send the place proof for verification.
        if (msgJson["action"] == "sendorder") {
            if (
                await Utils.sanityCheckSignature(
                    msgJson["enclaveSignature"],
                    SEISMIC_CONFIG.encalvePubaddr,
                )
            ) {
                console.debug("- Sanity check passed");
                const enclavesig =
                    msgJson["enclaveSignature"]["signatureValue"];
                let wallet1Orders = JSON.parse(
                    fs.readFileSync("wallet1_constructed_orders.json", "utf8"),
                );
                let wallet2Orders = JSON.parse(
                    fs.readFileSync("wallet2_constructed_orders.json", "utf8"),
                );
                let shieldedKey =
                    msgJson["enclaveSignature"]["orderCommitment"]["shielded"];
                if (wallet1Orders.hasOwnProperty(shieldedKey)) {
                    console.debug("Key found in wallet1 orders");
                    placeOrder(
                        enclavesig,
                        wallet1Orders[shieldedKey],
                        wallet1,
                        account1,
                        publicClient,
                    ).catch(console.error);
                } else if (wallet2Orders.hasOwnProperty(shieldedKey)) {
                    console.debug("Key found in wallet2 orders");
                    placeOrder(
                        enclavesig,
                        wallet2Orders[shieldedKey],
                        wallet2,
                        account2,
                        publicClient,
                    ).catch(console.error);
                } else {
                    console.debug(
                        "Key not found in either wallet1 or wallet2 orders",
                    );
                }
            }
        }
        if (msgJson["action"] == "getcrossedorders") {
            let orderhashes = [];
            orderhashes.push(msgJson["orderCommitment"]["shielded"]);
            msgJson["data"]["orders"].forEach((order: any) => {
                orderhashes.push(order["raw_order_commitment"]["private"]);
            });
            let shieldedKey = msgJson["orderCommitment"]["shielded"];
            let wallet1Orders = JSON.parse(
                fs.readFileSync("wallet1_constructed_orders.json", "utf8"),
            );
            let wallet2Orders = JSON.parse(
                fs.readFileSync("wallet2_constructed_orders.json", "utf8"),
            );
            if (wallet1Orders.hasOwnProperty(shieldedKey)) {
                console.debug("Key found in wallet1 orders");
                sendFillProof(
                    publicClient,
                    wallet1,
                    account1,
                    orderhashes,
                ).catch(console.error);
            } else if (wallet2Orders.hasOwnProperty(shieldedKey)) {
                console.debug("Key found in wallet2 orders");
            } else {
                console.debug(
                    "Key not found in either wallet1 or wallet2 orders",
                );
            }
        }
    } catch {
        return;
    }
}

/*
 * Open a socket with Seismic and authenticates it with wallet keypair.
 */
async function openAuthSocket(
    localorserver: string,
    clientnum: number,
    wallet1: WalletClient,
    wallet2: WalletClient,
    account1: PrivateKeyAccount,
    account2: PrivateKeyAccount,
    publicClient: PublicClient,
): Promise<WebSocket> {
    if (clientnum == 1) {
        const challenge = await requestChallenge(wallet1, localorserver);

        const signedChallenge = await Utils.signMsg(
            wallet1,
            account1,
            challenge,
        );
        const jwt = await sendChallenge(
            localorserver,
            account1,
            challenge,
            signedChallenge,
        );
        let ws: WebSocket;
        return new Promise((resolve, _) => {
            if (localorserver == "local") {
                ws = new WebSocket(`ws://${SEISMIC_LOCAL_URL}/ws`, {
                    headers: { Authorization: `Bearer ${jwt}` },
                });
            } else {
                ws = new WebSocket(`ws://${SEISMIC_SERVER_URL}/ws`, {
                    headers: { Authorization: `Bearer ${jwt}` },
                });
            }
            ws.on("message", (msg: string) => {
                handleServerMsg(
                    ws,
                    msg,
                    wallet1,
                    wallet2,
                    account1,
                    account2,
                    publicClient,
                );
            });
            ws.on("error", (err: Error) => {
                console.error("- WebSocket error:", err);
            });
            ws.on("close", () => {
                console.debug("- WebSocket connection closed");
            });
            ws.on("open", () => {
                resolve(ws);
            });
        });
    } else {
        const challenge = await requestChallenge(wallet2, localorserver);

        const signedChallenge = await Utils.signMsg(
            wallet2,
            account2,
            challenge,
        );
        const jwt = await sendChallenge(
            localorserver,
            account2,
            challenge,
            signedChallenge,
        );
        let ws: WebSocket;
        return new Promise((resolve, _) => {
            if (localorserver == "local") {
                ws = new WebSocket(`ws://${SEISMIC_LOCAL_URL}/ws`, {
                    headers: { Authorization: `Bearer ${jwt}` },
                });
            } else {
                ws = new WebSocket(`ws://${SEISMIC_SERVER_URL}/ws`, {
                    headers: { Authorization: `Bearer ${jwt}` },
                });
            }
            ws.on("message", (msg: string) => {
                handleServerMsg(
                    ws,
                    msg,
                    wallet1,
                    wallet2,
                    account1,
                    account2,
                    publicClient,
                );
            });
            ws.on("error", (err: Error) => {
                console.error("- WebSocket error:", err);
            });
            ws.on("close", () => {
                console.debug("- WebSocket connection closed");
            });
            ws.on("open", () => {
                resolve(ws);
            });
        });
    }
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
async function submitOrders(
    ws: WebSocket,
    ordersFile: string,
    ordersDictionary: string,
    publicClient: PublicClient,
    walletClient: WalletClient,
    account: PrivateKeyAccount,
): Promise<Order[]> {
    const rawOrders: RawOrder[] = JSON.parse(
        fs.readFileSync(ordersFile, "utf8"),
    );
    const orders: Order[] = rawOrders.map((raw) => constructOrder(raw));
    for (const order of orders) {
        console.debug("The sent order hash is", order.hash);
        const orderDictionary = JSON.parse(
            fs.readFileSync(ordersDictionary, "utf8"),
        );
        orderDictionary[order.hash] = order;
        fs.writeFileSync(ordersDictionary, JSON.stringify(orderDictionary));
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
        await Utils.sleep(5);
    }

    return orders;
}

/*
 * Sends the place proof to the contract for verification.
 */
async function placeOrder(
    enclavesig: string,
    order: Order,
    walletClient: WalletClient,
    account: PrivateKeyAccount,
    publicClient: PublicClient,
) {
    console.debug("The order hash debug is", order.hash);
    console.debug(
        `Hex string of order.hash: ${BigInt(`0x${order.hash}`).toString(16)}`,
    );
    const placeProof = await Utils.provePlace(order.hash, "1");
    console.debug(
        `Hex string of placeProof.input[0]: ${BigInt(
            placeProof.input[0],
        ).toString(16)}`,
    );
    console.debug("The main contract is", MAIN_CONTRACT);
    const hexPlaceProofInput = BigInt(placeProof.input[0]).toString(16);
    console.debug("The hex place proof input is", hexPlaceProofInput);

    const { request } = await publicClient.simulateContract({
        address: `0x${MAIN_CONTRACT}`,
        abi: UnyfyDevABI.abi,
        functionName: "place",
        args: [
            hexPlaceProofInput,
            `0x${enclavesig}`,
            placeProof.a,
            placeProof.b,
            placeProof.c,
            placeProof.input,
        ],
        gasPrice: parseGwei("100"),
        gas: BigInt(500000),
    });
    await walletClient.writeContract({ ...request, account: account });
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
        functionName: "cancel",
        args: [cancelProof.a, cancelProof.b, cancelProof.c, cancelProof.input],
        gasPrice: parseGwei("100"),
        gas: BigInt(500000),
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
        functionName: "fill",
        args: [fillProof.a, fillProof.b, fillProof.c, fillProof.input],
        gasPrice: parseGwei("100"),
        gas: BigInt(500000),
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

/*
 * Send an "upgradelisteningcontract" message with the new contract address
 */
function upgradeListeningContract(ws: WebSocket, newAddress: string) {
    ws.send(
        JSON.stringify({
            action: "upgradelisteningcontract",
            data: {
                newAddress: newAddress,
            },
        }),
        (error) => {
            if (error) {
                console.error(
                    "Error sending upgrade listening contract message:",
                    error,
                );
            }
        },
    );
}

(async () => {
    // Clean up W1_CONSTRUCTED_ORDERS and W2_CONSTRUCTED_ORDERS
    fs.writeFileSync(W1_CONSTRUCTED_ORDERS, JSON.stringify({}));
    fs.writeFileSync(W2_CONSTRUCTED_ORDERS, JSON.stringify({}));

    let localorserver: string;
    const arg = process.argv[2];
    if (arg === "local") {
        localorserver = "local";
    } else if (arg === "server") {
        localorserver = "server";
    } else {
        console.error(
            "Invalid argument. Please provide either 'local' or 'server'.",
        );
        process.exit(1);
    }
    // Initialize a public client for Sepolia
    const publicClient: PublicClient = createPublicClient({
        chain: sepolia,
        transport: http(SEPOLIA_RPC),
    });

    // Need at least two wallets to emulate a typical Unyfy interaction.
    const [wallet1, w1client] = privatekeySetup(W1_PRIV_KEY);
    const [wallet2, w2client] = privatekeySetup(W2_PRIV_KEY);
    const ws1 = await openAuthSocket(
        localorserver,
        1,
        w1client,
        w2client,
        wallet1,
        wallet2,
        publicClient,
    );
    const ws2 = await openAuthSocket(
        localorserver,
        2,
        w1client,
        w2client,
        wallet1,
        wallet2,
        publicClient,
    );

    upgradeListeningContract(ws1, "0x" + MAIN_CONTRACT);

    Utils.sleep(5);
    // Reset the order book so we have a blank slate.
    clearBook(ws1);
    Utils.sleep(1);

    // Send the orders to the book, at which point they are still in the staging queue
    const ordersW1 = await submitOrders(
        ws1,
        W1_ORDERS,
        W1_CONSTRUCTED_ORDERS,
        publicClient,
        w1client,
        wallet1,
    );
    const ordersW2 = await submitOrders(
        ws2,
        W2_ORDERS,
        W2_CONSTRUCTED_ORDERS,
        publicClient,
        w2client,
        wallet2,
    );
    if (ordersW1.length === 0 || ordersW2.length === 0) {
        console.error("- Wallet 1 or 2 order file couldn't be parsed");
        process.exit(1);
    }
    await Utils.sleep(20);

    // Confirm that these orders were logged in the book.
    getOpenOrders(ws1);
    await Utils.sleep(1);
    getOpenOrders(ws2);

    // Cancel the third order sent by client 2
    const ordersData = fs.readFileSync(W2_CONSTRUCTED_ORDERS, "utf8");
    const orders = JSON.parse(ordersData);
    const orderKey = Object.keys(orders)[2];
    console.log("The order key is {}", orderKey);
    await sendCancelProof(publicClient, w2client, wallet2, orderKey);

    await Utils.sleep(20);

    getOpenOrders(ws2);

    await Utils.sleep(5);
    // Gets crossed orders and immediately sends a fill() call to the verifier contract
    getCrossedOrders(ws1, ordersW1[0]);
})();
