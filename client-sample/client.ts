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
import { ethers } from "ethers";
import { poseidon4 } from "poseidon-lite";
import { JsonRpcProvider } from "@ethersproject/providers";
import { BigNumberish } from "ethers";

import * as Utils from "./utils";
import { RawOrder, Order } from "./types";

/*
 * Config for dev endpoint.
 */
const SEISMIC_CONFIG = {
    ip: "127.0.0.1",
    port: "8000",
    encalvePubaddr: "0xa2c03BbE8Ce76d0c93D428A0f913F10b7acCfa9F",
};
const SEISMIC_URL = `${SEISMIC_CONFIG.ip}:${SEISMIC_CONFIG.port}`;
const contractAddress = "0xe7f1725e7734ce288f8367e1bb143e90bb3f0512";
const provider= new ethers.JsonRpcProvider("http://localhost:8545");
const contractABI = 
    [{"type":"function","name":"cancel","inputs":[{"name":"_orderhash","type":"uint256","internalType":"uint256"}],"outputs":[],"stateMutability":"nonpayable"},{"type":"function","name":"deleteOrderFromTree","inputs":[{"name":"_orderhash","type":"uint256","internalType":"uint256"}],"outputs":[],"stateMutability":"nonpayable"},{"type":"function","name":"fill","inputs":[{"name":"_orderhash","type":"uint256","internalType":"uint256"},{"name":"_filledorderhashes","type":"uint256[]","internalType":"uint256[]"}],"outputs":[],"stateMutability":"nonpayable"},{"type":"function","name":"place","inputs":[{"name":"_orderhash","type":"uint256","internalType":"uint256"}],"outputs":[],"stateMutability":"nonpayable"},{"type":"event","name":"orderCancelled","inputs":[{"name":"pubaddr","type":"address","indexed":true,"internalType":"address"},{"name":"orderhash","type":"uint256","indexed":true,"internalType":"uint256"}],"anonymous":false},{"type":"event","name":"orderDelete","inputs":[{"name":"orderhash","type":"uint256","indexed":true,"internalType":"uint256"}],"anonymous":false},{"type":"event","name":"orderFilled","inputs":[{"name":"pubaddr","type":"address","indexed":true,"internalType":"address"},{"name":"orderhash","type":"uint256","indexed":true,"internalType":"uint256"},{"name":"filledorderhashes","type":"uint256[]","indexed":true,"internalType":"uint256[]"}],"anonymous":false},{"type":"event","name":"orderPlaced","inputs":[{"name":"pubaddr","type":"address","indexed":true,"internalType":"address"},{"name":"orderhash","type":"uint256","indexed":true,"internalType":"uint256"}],"anonymous":false}];

    const contract = new ethers.Contract(contractAddress, contractABI, provider);    
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
async function requestChallenge(wallet: ethers.Wallet): Promise<string> {
    let res, err;
    [res, err] = await Utils.handleAsync(
        axios.post(`http://${SEISMIC_URL}/request_challenge`)
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
    wallet: ethers.Wallet,
    challenge: string,
    signedChallenge: string
): Promise<string> {
    let res, err;
    [res, err] = await Utils.handleAsync(
        axios.post(`http://${SEISMIC_URL}/submit_response`, {
            challenge_id: challenge,
            signature: signedChallenge,
            pub_key: wallet.address,
        })
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
    counterOrders: any[]
) {
    const ownHash = orderCommit["shielded"];
    const ownSide = orderCommit["transparent"]["side"];
    const counterHashes = counterOrders.map(
        (counterOrder) => counterOrder["raw_order_commitment"]["private"]
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
        }
    );
}

/*
 * Consult API docs for the full list of messages Seismic will send to clients.
 * This demo has special handling for 1) enclave signatures, and 2) crossed
 * orders.
 */
function handleServerMsg(ws: WebSocket, msg: string) {
    console.log("- Received message:", msg.toString());
    try {
        const msgJson = JSON.parse(msg);
        if (msgJson["action"] == "sendorder") {
            Utils.sanityCheckSignature(
                msgJson["enclaveSignature"],
                SEISMIC_CONFIG.encalvePubaddr
            );
        }
        if (msgJson["action"] == "getcrossedorders") {
            fillOrder(
                ws,
                msgJson["orderCommitment"],
                msgJson["data"]["orders"]
            );
        }
    } catch {
        return;
    }
}

/*
 * Open a socket with Seismic and authenticates it with wallet keypair.
 */
async function openAuthSocket(wallet: ethers.Wallet): Promise<WebSocket> {
    const challenge = await requestChallenge(wallet);
    const signedChallenge = await Utils.signMsg(wallet, challenge);
    const jwt = await sendChallenge(wallet, challenge, signedChallenge);

    return new Promise((resolve, _) => {
        const ws = new WebSocket(`ws://${SEISMIC_URL}/ws`, {
            headers: { Authorization: `Bearer ${jwt}` },
        });
        ws.on("message", (msg: string) => {
            handleServerMsg(ws, msg);
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
        }
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
function submitOrders(ws: WebSocket, ordersFile: string, privkey: string): Order[] {
    const rawOrders: RawOrder[] = JSON.parse(
        fs.readFileSync(ordersFile, "utf8")
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
            }
        );
        const signer = new ethers.Wallet(privkey, provider);
        const decimalOrderHash = BigInt(parseInt(order.hash, 16)).toString();
        let maxFeePerGas = ethers.toBigInt(ethers.parseUnits('1000', 'gwei')); // Set to 1000 gwei
        let maxPriorityFeePerGas = ethers.toBigInt(ethers.parseUnits('1000', 'gwei')); // Set to 1000 gwei

const tx = signer.sendTransaction({
    to: contractAddress,
    data: contract.interface.encodeFunctionData("place", [decimalOrderHash]),
    gasPrice: 3614626451,
    gasLimit: 30000000, 
});
        console.log(tx);
    });
    return orders;
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
        }
    );
}

/*
 * Ask Seismic's matching engine to look up all orders that cross with an
 * input order.
 */

function upgradeListeningContract(ws: WebSocket) {
    ws.on('open', function open() {
        console.log('Connected to the server!');

        const upgradeRequestJson = {
            "action": "upgradelisteningcontract",
            "data": {
                "newAddress": "0xe7f1725e7734ce288f8367e1bb143e90bb3f0512"
            }
        };

        console.log(upgradeRequestJson);

        ws.send(JSON.stringify(upgradeRequestJson), (error) => {
            if (error) {
                console.error('Error sending message:', error);
            }
        });
    });

    ws.on('message', function message(data) {
        console.log('Received message:', data.toString());
    });

    ws.on('error', function error(err) {
        console.error('WebSocket error:', err);
    });

    ws.on('close', function close() {
        console.log('WebSocket connection closed');
    });
}


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
                    error
                );
            }
        }
    );
}

(async () => {
    // Need at least two wallets to emulate a typical Unyfy interaction.
    const wallet1 = await Utils.createWallet(1);
    const ws1 = await openAuthSocket(wallet1);
    const privkey1 = wallet1.privateKey;

    const wallet2 = await Utils.createWallet(2);
    const ws2 = await openAuthSocket(wallet2);
    const privkey2 = wallet2.privateKey;



    //upgrade the listening contract
    upgradeListeningContract(ws1);

    // Reset the order book so we have a blank slate.
    clearBook(ws1);
    await Utils.sleep(1);

    // We provide a sample set of orders for each wallet that includes crosses.
    const ordersW1 = submitOrders(ws1, W1_ORDERS, privkey1);
    const ordersW2 = submitOrders(ws2, W2_ORDERS, privkey2);
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

    // Gets crossed orders and automatically fills upon response.
    getCrossedOrders(ws1, ordersW1[0]);
})();
