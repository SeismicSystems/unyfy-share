import { ethers } from "ethers";

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

