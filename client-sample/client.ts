/*
 * A sample client for Unyfy that interfaces with Seismic's dev endpoint. Runs
 * through submitting, crossing, and filling orders. Uses two separate wallets
 * and sockets to emulate a trader and their counterparty.
 *
 * We deploy our contracts on Sepolia
 *
 */

/*
 * External imports.
 */
import axios from "axios";
import fs from "fs";
import WebSocket from "ws";
import { poseidon4 } from "poseidon-lite";
import { PrivateKeyAccount, PublicClient, WalletClient } from "viem";
import { parseGwei } from "viem";
import { createPublicClient, http } from "viem";
import { sepolia } from "viem/chains";

/*
 * Internal imports
 */
import UnyfyDevABI from "./artifacts/UnyfyDev.json";
import * as Utils from "./utils";
import { RawOrder, Order } from "./types";
import { W1_PRIV_KEY, W2_PRIV_KEY, MAIN_CONTRACT } from "./constants";
import { privatekeySetup } from "./utils";
import { SEPOLIA_RPC } from "./constants";
import * as Config from "./config";

let ordersW1: { [orderhash: string]: Order } = {};
let ordersW2: { [orderhash: string]: Order } = {};

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
            axios.post(
                `http://${Config.SEISMIC_CONFIG.localUrl}/request_challenge`,
            ),
        );
    } else {
        [res, err] = await Utils.handleAsync(
            axios.post(
                `http://${Config.SEISMIC_CONFIG.serverUrl}/request_challenge`,
            ),
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
            axios.post(
                `http://${Config.SEISMIC_CONFIG.localUrl}/submit_response`,
                {
                    challenge_id: challenge,
                    signature: signedChallenge,
                    pub_key: account.address,
                },
            ),
        );
    } else {
        [res, err] = await Utils.handleAsync(
            axios.post(
                `http://${Config.SEISMIC_CONFIG.serverUrl}/submit_response`,
                {
                    challenge_id: challenge,
                    signature: signedChallenge,
                    pub_key: account.address,
                },
            ),
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
 * Sends the place proof to the contract for verification.
 */
async function placeOrder(
    enclavesig: string,
    order: Order,
    walletClient: WalletClient,
    account: PrivateKeyAccount,
    publicClient: PublicClient,
) {
    const placeProof = await Utils.provePlace(order.hash, "1");
    const hexPlaceProofInput = BigInt(placeProof.input[0]).toString(16);

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
 * Handles enclave signature and places order if order hash is found in wallet orders.
 */
async function handleEnclaveSignature(
    enclavesig: string,
    orderHash: string,
    wallet1: WalletClient,
    wallet2: WalletClient,
    account1: PrivateKeyAccount,
    account2: PrivateKeyAccount,
    publicClient: PublicClient,
) {
    let wallet = ordersW1[orderHash]
        ? wallet1
        : ordersW2[orderHash]
          ? wallet2
          : null;
    let account = ordersW1[orderHash]
        ? account1
        : ordersW2[orderHash]
          ? account2
          : null;
    let order = ordersW1[orderHash] || ordersW2[orderHash];
    while (!order) {
        await Utils.sleep(5);
        wallet = ordersW1[orderHash]
            ? wallet1
            : ordersW2[orderHash]
              ? wallet2
              : null;
        account = ordersW1[orderHash]
            ? account1
            : ordersW2[orderHash]
              ? account2
              : null;
        order = ordersW1[orderHash] || ordersW2[orderHash];
    }
    if (wallet && account && order) {
        await placeOrder(
            enclavesig,
            order,
            wallet,
            account,
            publicClient,
        ).catch(console.error);
    } else {
    }
}

async function handleGetCrossedOrders(
    orderhash_own: string,
    orders_crossed: any[],
    publicClient: PublicClient,
    wallet1: WalletClient,
    wallet2: WalletClient,
    account1: PrivateKeyAccount,
    account2: PrivateKeyAccount,
) {
    let orderhashes = [];
    orderhashes.push(orderhash_own);
    orders_crossed.forEach((order: any) => {
        orderhashes.push(order["raw_order_commitment"]["private"]);
    });

    const wallet = ordersW1.hasOwnProperty(orderhash_own)
        ? wallet1
        : ordersW2.hasOwnProperty(orderhash_own)
          ? wallet2
          : null;
    const account = ordersW1.hasOwnProperty(orderhash_own)
        ? account1
        : ordersW2.hasOwnProperty(orderhash_own)
          ? account2
          : null;

    if (wallet && account) {
        await sendFillProof(publicClient, wallet, account, orderhashes).catch(
            console.error,
        );
    } else {
    }
}

function isJsonString(str: string): boolean {
    try {
        JSON.parse(str);
    } catch (e) {
        return false;
    }
    return true;
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
    if (isJsonString(msg)) {
        const msgJson = JSON.parse(msg);
        // If the message is an enclave signature, check it and call place() on the contract to send the place proof for verification.
        if (msgJson["action"] == "sendorder") {
            await Utils.sleep(15);
            const sanityCheck = await Utils.sanityCheckSignature(
                msgJson["enclaveSignature"],
                Config.SEISMIC_CONFIG.enclavePubaddr,
            );
            if (sanityCheck) {
                console.debug("- Sanity check passed");
                const enclavesig =
                    msgJson["enclaveSignature"]["signatureValue"];
                await handleEnclaveSignature(
                    enclavesig,
                    msgJson["enclaveSignature"]["orderCommitment"]["shielded"],
                    wallet1,
                    wallet2,
                    account1,
                    account2,
                    publicClient,
                ).catch(console.error);
            }
        } else if (msgJson["action"] == "getcrossedorders") {
            await Utils.sleep(10);
            let orderhash_own = msgJson["orderCommitment"]["shielded"];
            let orders_crossed = msgJson["data"]["orders"];
            await handleGetCrossedOrders(
                orderhash_own,
                orders_crossed,
                publicClient,
                wallet1,
                wallet2,
                account1,
                account2,
            ).catch(console.error);
        }
    } else {
        console.error("Received a non-JSON message:", msg);
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
    const wallet = clientnum == 1 ? wallet1 : wallet2;
    const account = clientnum == 1 ? account1 : account2;
    const challenge = await requestChallenge(wallet, localorserver);

    const signedChallenge = await Utils.signMsg(wallet, account, challenge);
    const jwt = await sendChallenge(
        localorserver,
        account,
        challenge,
        signedChallenge,
    );
    let ws: WebSocket;
    return new Promise((resolve, _) => {
        const url =
            localorserver == "local"
                ? `ws://${Config.SEISMIC_CONFIG.localUrl}/ws`
                : `ws://${Config.SEISMIC_CONFIG.serverUrl}/ws`;
        ws = new WebSocket(url, {
            headers: { Authorization: `Bearer ${jwt}` },
        });
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
                token: Config.default_token,
                denomination: Config.eth_denomination,
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
): Promise<{ [orderhash: string]: Order }> {
    let ordersDictionary: { [orderhash: string]: Order } = {};
    const rawOrders: RawOrder[] = JSON.parse(
        fs.readFileSync(ordersFile, "utf8"),
    );
    const orders: Order[] = rawOrders.map((raw) => constructOrder(raw));
    for (const order of orders) {
        console.debug("The sent order hash is", order.hash);
        ordersDictionary[order.hash] = order;
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

    return ordersDictionary;
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
    await Utils.sleep(5);

    // Reset the order book so we have a blank slate.
    clearBook(ws1);
    await Utils.sleep(5);

    // Send the orders to the book, at which point they are still in the staging queue
    ordersW1 = await submitOrders(ws1, Config.w1_orders);
    await Utils.sleep(5);

    ordersW2 = await submitOrders(ws2, Config.w2_orders);
    await Utils.sleep(5);

    if (
        Object.keys(ordersW1).length === 0 ||
        Object.keys(ordersW2).length === 0
    ) {
        console.error("- Wallet 1 or 2 order file couldn't be parsed");
        process.exit(1);
    }
    await Utils.sleep(20);

    // Confirm that these orders were logged in the book.
    getOpenOrders(ws1);
    await Utils.sleep(1);
    getOpenOrders(ws2);

    // Cancel the third order sent by client 2
    await sendCancelProof(
        publicClient,
        w2client,
        wallet2,
        Object.keys(ordersW2)[2],
    );

    await Utils.sleep(20);

    getOpenOrders(ws2);

    await Utils.sleep(5);
    // Gets crossed orders and immediately sends a fill() call to the verifier contract
    let firstOrderKey = Object.keys(ordersW1)[0];
    let firstOrder = ordersW1[firstOrderKey];
    getCrossedOrders(ws1, firstOrder);
})();
