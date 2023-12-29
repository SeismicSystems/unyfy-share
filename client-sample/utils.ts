import * as crypto from "crypto";
import { groth16 } from "snarkjs";
import { recoverMessageAddress } from "viem";

import {
    Groth16Proof,
    Groth16ProofCalldata,
    Groth16FullProveResult,
} from "./types";
import {
    Address,
    PrivateKeyAccount,
    PublicClient,
    WalletClient,
    createPublicClient,
    createWalletClient,
    getContract,
    http,
    parseAbiItem,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import { SEPOLIA_RPC } from "./constants";
import { EnclaveSignature } from "./types";
// import UnyfyDevABI from "./artifacts/UnyfyDev.json" assert { type: "json" };
import { PLACE_WASM, PLACE_ZKEY, CANCEL_WASM, CANCEL_ZKEY, FILL_WASM, FILL_ZKEY } from "./constants";

const BN128_SCALAR_MOD =
    BigInt(
        21888242871839275222246405745257275088548364400416034343698204186575808495617,
    );

/*
 * Wrapper for error handling for promises.
 */
export async function handleAsync<T>(
    promise: Promise<T>,
): Promise<[T, null] | [null, any]> {
    try {
        const data = await promise;
        return [data, null];
    } catch (error) {
        return [null, error];
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
export async function sanityCheckSignature(
    encSig: EnclaveSignature,
    encalvePubAddr: string,
) {
    const signature = `0x${encSig.signatureValue}`;
    const shieldedCommit = encSig.orderCommitment.shielded;
    const recoveredAddr = await recoverMessageAddress({message: shieldedCommit, signature: `0x${encSig.signatureValue}`});
    if (recoveredAddr.toLowerCase() !== encalvePubAddr.toLowerCase()) {
        console.error("- CAUTION: Received invalid enclave signature");
    }
}

/*
 * Signs message with wallet's privkey.
 */
export async function signMsg(
    wallet: WalletClient,
    account: PrivateKeyAccount,
    msg: string,
): Promise<string> {
    let res, err;
    [res, err] = await handleAsync(
        wallet.signMessage({ message: msg, account }),
    );
    if (!res || err) {
        console.error("- Error signing message:", err);
        process.exit(1);
    }
    const signature = res;
    console.log("- Signed message:", signature);
    return signature;
}

/*
 * Rearrange a raw Groth16 proof into the format the Solidity verifier expects.
 */
export async function exportCallDataGroth16(
    prf: Groth16Proof,
    pubSigs: any,
): Promise<Groth16ProofCalldata> {
    const proofCalldata: string = await groth16.exportSolidityCallData(
        prf,
        pubSigs,
    );
    const argv: string[] = proofCalldata
        .replace(/["[\]\s]/g, "")
        .split(",")
        .map((x: string) => BigInt(x).toString());
    return {
        a: argv.slice(0, 2) as [string, string],
        b: [
            argv.slice(2, 4) as [string, string],
            argv.slice(4, 6) as [string, string],
        ],
        c: argv.slice(6, 8) as [string, string],
        input: argv.slice(8),
    };
}

/*
 * Sets up a contract interface with Viem.
 */
export function privatekeySetup(privKey: string | undefined): [any, any] {
    console.log("Private key: ", privKey);
    if (!privKey) {
        console.error("Private key is undefined");
        return [null, null];
    }
    const account = privateKeyToAccount(`0x${privKey}`);
    const walletClient = createWalletClient({
        chain: sepolia,
        transport: http(SEPOLIA_RPC),
    });
    return [account, walletClient];
}

export async function provePlace(
    orderhash: string,
    z: string,
): Promise<Groth16ProofCalldata> {
    const orderhashBigInt = BigInt(`0x${orderhash}`);
    const zBigInt = BigInt(z);
    const fillProofInputs = {
        orderhash: orderhashBigInt,
        z: zBigInt,
    };

    let [proverRes, proverErr]: [Groth16FullProveResult | null, any] =
        await handleAsync(
            groth16.fullProve(fillProofInputs, PLACE_WASM, PLACE_ZKEY),
        );

    if (!proverRes || proverErr) {
        console.error(
            "ERROR: Could not generate draw ZKP for input signals:",
            fillProofInputs,
        );
        process.exit(1);
    }

    let exportRes, exportErr;
    [exportRes, exportErr] = await handleAsync(
        exportCallDataGroth16(proverRes.proof, proverRes.publicSignals),
    );
    if (!exportRes || exportErr) {
        console.error("ERROR: Could not format proof:", proverRes);
        process.exit(1);
    }
    console.log(exportRes);
    return exportRes;
}

export async function proveCancel(
    orderhash: string,
    z: string,
): Promise<Groth16ProofCalldata> {
    const orderhashBigInt = BigInt(`0x${orderhash}`);
    const zBigInt = BigInt(z);
    const cancelProofInputs = {
        orderhash: orderhashBigInt,
        z: zBigInt,
    };

    let [proverRes, proverErr]: [Groth16FullProveResult | null, any] =
        await handleAsync(
            groth16.fullProve(cancelProofInputs, CANCEL_WASM, CANCEL_ZKEY),
        );

    if (!proverRes || proverErr) {
        console.error(
            "ERROR: Could not generate draw ZKP for input signals:",
            cancelProofInputs,
        );
        process.exit(1);
    }

    let exportRes, exportErr;
    [exportRes, exportErr] = await handleAsync(
        exportCallDataGroth16(proverRes.proof, proverRes.publicSignals),
    );
    if (!exportRes || exportErr) {
        console.error("ERROR: Could not format proof:", proverRes);
        process.exit(1);
    }
    console.log(exportRes);
    return exportRes;
}

export async function proveFill(
    orderhashes: string[],
    z: string,
): Promise<Groth16ProofCalldata> {
    const orderhashBigInts = orderhashes.map(orderhash => BigInt(`0x${orderhash}`));
    const zBigInt = BigInt(z);
    const fillProofInputs = {
        orderhash_own: orderhashBigInts[0],
        orderhash_filled: orderhashBigInts.slice(1, 11),
        z: zBigInt,
    };

    let [proverRes, proverErr]: [Groth16FullProveResult | null, any] =
        await handleAsync(
            groth16.fullProve(fillProofInputs, FILL_WASM, FILL_ZKEY),
        );

    if (!proverRes || proverErr) {
        console.error(
            "ERROR: Could not generate draw ZKP for input signals:",
            fillProofInputs,
        );
        process.exit(1);
    }

    let exportRes, exportErr;
    [exportRes, exportErr] = await handleAsync(
        exportCallDataGroth16(proverRes.proof, proverRes.publicSignals),
    );
    if (!exportRes || exportErr) {
        console.error("ERROR: Could not format proof:", proverRes);
        process.exit(1);
    }
    console.log(exportRes);
    return exportRes;
}

