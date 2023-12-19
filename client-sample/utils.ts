import * as crypto from "crypto";
import { ethers } from "ethers";

import { EnclaveSignature } from "./types";

const BN128_SCALAR_MOD =
    BigInt(
        21888242871839275222246405745257275088548364400416034343698204186575808495617
    );

/*
 * Wrapper for error handling for promises.
 */
export async function handleAsync<T>(
    promise: Promise<T>
): Promise<[T, null] | [null, any]> {
    try {
        const data = await promise;
        return [data, null];
    } catch (error) {
        return [null, error];
    }
}

/*
 * Spins up a fresh Ethereum wallet.
 */
export async function createWallet(wallet_num: number): Promise<ethers.Wallet> {
    if(wallet_num == 1){
    let privateKey = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"
    let wallet = new ethers.Wallet(privateKey);
    let address = wallet.address;
    console.log("- Sample wallet address:", address);
    return wallet;
    }
    else{
    let privateKey = "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a"
    let wallet = new ethers.Wallet(privateKey);
    let address = wallet.address;
    console.log("- Sample wallet address:", address);
    return wallet;
}
}

/*
 * Samples a uniformly random value in BN128's scalar field.
 */
export function uniformBN128Scalar(): BigInt {
    let sample;
    do {
        sample = BigInt(`0x${crypto.randomBytes(32).toString("hex")}`);
    } while (sample >= BN128_SCALAR_MOD);
    return sample;
}

/*
 * Call await on the returned promise to sleep for N seconds.
 */
export function sleep(N: number) {
    return new Promise((resolve) => setTimeout(resolve, N * 1000));
}

/*
 * Check the signature that Seismic returns to acknowledge reception of an
 * order. Ensures it verifies with the enclave's public key (address) so it will
 * be accepted by the contract.
 */
export function sanityCheckSignature(
    encSig: EnclaveSignature,
    encalvePubAddr: string
) {
    const signature = `0x${encSig.signatureValue}`;
    const shieldedCommit = encSig.orderCommitment.shielded;
    const hashedCommit = ethers.hashMessage(shieldedCommit);
    const recoveredAddr = ethers.recoverAddress(hashedCommit, signature);

    if (recoveredAddr.toLowerCase() !== encalvePubAddr.toLowerCase()) {
        console.error("- CAUTION: Received invalid enclave signature");
    }
}

/*
 * Signs message with wallet's privkey.
 */
export async function signMsg(
    wallet: ethers.Wallet,
    msg: string
): Promise<string> {
    let res, err;
    [res, err] = await handleAsync(wallet.signMessage(msg));
    if (!res || err) {
        console.error("- Error signing message:", err);
        process.exit(1);
    }
    const signature = res;
    console.log("- Signed message:", signature);
    return signature;
}
