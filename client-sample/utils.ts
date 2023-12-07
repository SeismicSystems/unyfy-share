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
export async function createWallet(): Promise<ethers.Wallet> {
    let privateKey = ethers.Wallet.createRandom().privateKey;
    let wallet = new ethers.Wallet(privateKey);
    let address = wallet.address;
    console.log("- Sample wallet address:", address);
    return wallet;
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
