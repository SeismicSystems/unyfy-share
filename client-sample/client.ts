import axios from "axios";
import fs from "fs";
import WebSocket from "ws";
import { ethers } from "ethers";
import * as crypto from "crypto";
import { Order, EnclaveSignature } from "./types";

const SEISMIC_CONFIG = {
    ip: "44.201.111.37",
    port: "8000",
};
const SEISMIC_URL = `${SEISMIC_CONFIG.ip}:${SEISMIC_CONFIG.port}`;
const ENCLAVE_PUBADDR = "0xa2c03BbE8Ce76d0c93D428A0f913F10b7acCfa9F";
const SAMPLE_ORDERS_FILE = "sample-orders.json";

const SAMPLE_ORDER_DATA = {
    transparent: {
        side: "1",
        token: "92bf259f558808106e4840e2642352b156a31bc41e5b4283df2937278f0a7a65",
        denomination: "0x1",
    },
    shielded: {
        price: "99331421600",
        volume: "3000000000",
        accessKey: "1",
    },
};
const SAMPLE_ORDER_HASH =
    "1303177350543915549821791317173867930338436297750196254712378410446088378";

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

function constructOrderReq(order: Order): Object {
    const accessKey = parseInt(crypto.randomBytes(5).toString("hex"), 16);
    const hash = crypto.createHash("sha256");
    hash.update(order.price.toString());
    hash.update(order.volume.toString());
    hash.update(accessKey.toString());

    return {
        action: "sendorder",
        data: {
            transparent: {
                side: order.side.toString(),
                token: "92bf259f558808106e4840e2642352b156a31bc41e5b4283df2937278f0a7a65",
                denomination: "0x1",
            },
            shielded: {
                price: (order.price * 10 ** 9).toString(),
                volume: (order.volume * 10 ** 9).toString(),
                accessKey: accessKey.toString(),
            },
        },
        hash: hash.digest("hex").slice(0, 30),
    };
}

function submitOrders(ws: WebSocket) {
    const orders: Order[] = JSON.parse(
        fs.readFileSync(SAMPLE_ORDERS_FILE, "utf8")
    );
    orders.forEach((order) => {
        const orderReq = constructOrderReq(order);
        ws.send(JSON.stringify(orderReq), (error) => {
            if (error) {
                console.error("- Error submitting order:", error);
            }
        });
    });
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

let ws: WebSocket;
(async () => {
    const wallet = await createWallet();
    ws = await openAuthSocket(wallet);

    ws.on("close", () => {
        console.log(`WebSocket closed.`);
    });

    ws.on("error", (err) => {
        console.error("WebSocket error:", err);
    });

    process.on("uncaughtException", (err) => {
        console.error("Uncaught exception:", err);
    });

    clearBook(ws);
    await sleep(1);
    submitOrders(ws);
    getOpenOrders(ws);
})();
