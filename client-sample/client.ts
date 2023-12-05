import axios from "axios";
import fs from "fs";
import WebSocket from "ws";
import { ethers } from "ethers";
import * as crypto from "crypto";
import { poseidon4 } from "poseidon-lite";
import { RawOrder, Order, EnclaveSignature } from "./types";

const SEISMIC_CONFIG = {
    ip: "44.201.111.37",
    port: "8000",
};
const SEISMIC_URL = `${SEISMIC_CONFIG.ip}:${SEISMIC_CONFIG.port}`;
const ENCLAVE_PUBADDR = "0xa2c03BbE8Ce76d0c93D428A0f913F10b7acCfa9F";

const W1_ORDERS = "wallet1_orders.json";
const W2_ORDERS = "wallet2_orders.json";
const DEFAULT_TOKEN =
    "92bf259f558808106e4840e2642352b156a31bc41e5b4283df2937278f0a7a65";

const BN128_SCALAR_MOD = BigInt(21888242871839275222246405745257275088548364400416034343698204186575808495617);

async function handleAsync<T>(
    promise: Promise<T>
): Promise<[T, null] | [null, any]> {
    try {
        const data = await promise;
        return [data, null];
    } catch (error) {
        return [null, error];
    }
}

async function createWallet(): Promise<ethers.Wallet> {
    let privateKey = ethers.Wallet.createRandom().privateKey;
    let wallet = new ethers.Wallet(privateKey);
    let address = wallet.address;
    console.log("- Sample wallet address:", address);
    return wallet;
}

async function requestChallenge(wallet: ethers.Wallet): Promise<string> {
    let res, err;
    [res, err] = await handleAsync(
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

async function signChallenge(
    wallet: ethers.Wallet,
    challenge: string
): Promise<string> {
    let res, err;
    [res, err] = await handleAsync(wallet.signMessage(challenge));
    if (!res || err) {
        console.error("- Error signing challenge:", err);
        process.exit(1);
    }
    const signature = res;
    console.log("- Signed challenge:", signature);
    return signature;
}

async function submitResponse(
    wallet: ethers.Wallet,
    challenge: string,
    signedChallenge: string
): Promise<string> {
    let res, err;
    [res, err] = await handleAsync(
        axios.post(`http://${SEISMIC_URL}/submit_response`, {
            challenge_id: challenge,
            signature: signedChallenge,
            pub_key: wallet.address,
        })
    );
    if (!res || err) {
        console.error("- Error sending in challenge & receiving JWT:", err);
        process.exit(1);
    }
    const jwt = res.data;
    console.log("- Received JWT:", jwt);
    return jwt;
}

function handleServerMsg(msg: string) {
    console.log("- Received message:", msg.toString());
    try {
        const msgJson = JSON.parse(msg);
        if (msgJson["action"] == "sendorder") {
            sanityCheckSignature(msgJson["enclaveSignature"]);
        }
    } catch {
        return;
    }
}

function sanityCheckSignature(encSig: EnclaveSignature) {
    const signature = `0x${encSig.signatureValue}`;
    const shieldedCommit = encSig.orderCommitment.shielded;
    const hashedCommit = ethers.hashMessage(shieldedCommit);
    const recoveredAddr = ethers.recoverAddress(hashedCommit, signature);

    if (recoveredAddr.toLowerCase() !== ENCLAVE_PUBADDR.toLowerCase()) {
        console.error("- CAUTION: Received invalid enclave signature");
    }
}

async function openAuthSocket(wallet: ethers.Wallet): Promise<WebSocket> {
    const challenge = await requestChallenge(wallet);
    const signedChallenge = await signChallenge(wallet, challenge);
    const jwt = await submitResponse(wallet, challenge, signedChallenge);

    return new Promise((resolve, _) => {
        const ws = new WebSocket(`ws://${SEISMIC_URL}/ws`, {
            headers: { Authorization: `Bearer ${jwt}` },
        });
        ws.on("message", (msg: string) => {
            handleServerMsg(msg);
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

function uniformBN128Scalar(): BigInt {
    let sample;
    do {
        sample = BigInt(`0x${crypto.randomBytes(32).toString("hex")}`);
    } while (sample >= BN128_SCALAR_MOD);
    return sample;
}

function constructOrder(raw: RawOrder): Order {
    const accessKey = uniformBN128Scalar();
    const scaledPrice = (raw.price * 10 ** 9);
    const scaledVol = (raw.volume * 10 ** 9);
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
                denomination: "0x1",
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

function submitOrders(ws: WebSocket, ordersFile: string): Order[] {
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
    });
    return orders;
}

function sleep(seconds: number) {
    return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
}

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

function getCrossedOrders(ws1: WebSocket, order: Order) {
    console.log(
        JSON.stringify({
            action: "getcrossedorders",
            data: order.data,
            hash: order.hash,
        })
    );
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
    const wallet1 = await createWallet();
    const ws1 = await openAuthSocket(wallet1);

    const wallet2 = await createWallet();
    const ws2 = await openAuthSocket(wallet2);

    clearBook(ws1);
    await sleep(1);

    const ordersW1 = submitOrders(ws1, W1_ORDERS);
    const ordersW2 = submitOrders(ws2, W2_ORDERS);
    if (ordersW1.length === 0 || ordersW2.length === 0) {
        console.error("- Wallet 1 (or wallet 2) order file couldn't be parsed");
        process.exit(1);
    }
    await sleep(1);

    getOpenOrders(ws1);
    await sleep(1);
    getOpenOrders(ws2);
    await sleep(1);

    // getCrossedOrders(ws1, ordersW1[0]);
})();
