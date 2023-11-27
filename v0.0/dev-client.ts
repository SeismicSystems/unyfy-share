import axios from "axios";
import WebSocket from "ws";
import { ethers } from "ethers";

const SEISMIC_CONFIG = {
    ip: "44.201.111.37",
    port: "8000",
};
const SEISMIC_URL = `${SEISMIC_CONFIG.ip}:${SEISMIC_CONFIG.port}`;

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
    signature: string
): Promise<string> {
    let res, err;
    [res, err] = await handleAsync(
        axios.post(`http://${SEISMIC_URL}/submit_response`, {
            challenge_id: challenge,
            signature: signature,
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

async function setupWebSocket(jwt: string): Promise<WebSocket> {
    const ws = new WebSocket(`ws://${SEISMIC_URL}/ws`, {
        headers: { Authorization: `Bearer ${jwt}` },
    });
    ws.on("open", () => {
        ws.send(
            JSON.stringify({
                action: "clearorderbook",
            }),
            (err: Error | undefined) => {
                if (err) {
                    console.error("- Error clearing:", err);
                }
            }
        );
    });
    ws.on("message", (data: string) => {
        console.log("- Received message:", data.toString());
    });
    ws.on("error", (err: Error) => {
        console.error("- WebSocket error:", err);
    });
    ws.on("close", () => {
        console.log("- WebSocket connection closed");
    });
    return ws;
}

(async () => {
    const wallet = await createWallet();
    const challenge = await requestChallenge(wallet);
    const signature = await signChallenge(wallet, challenge);
    const jwt = await submitResponse(wallet, challenge, signature);
    const ws = await setupWebSocket(jwt);
})();
