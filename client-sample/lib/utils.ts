import * as crypto from "crypto";
import { groth16 } from "snarkjs";
import {
    recoverMessageAddress,
    createPublicClient,
    createWalletClient,
    getContract,
    http,
    parseAbiItem,
    Address,
    WalletClient,
    PrivateKeyAccount,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";

import {
    Groth16Proof,
    Groth16ProofCalldata,
    Groth16FullProveResult,
} from "./types";
import { EnclaveSignature } from "./types";
import {
    PLACE_WASM,
    PLACE_ZKEY,
    CANCEL_WASM,
    CANCEL_ZKEY,
    FILL_WASM,
    FILL_ZKEY,
    SEPOLIA_RPC,
} from "./constants";
import UnyfyDevABI from "../artifacts/UnyfyDev.json";
import deployment from "../artifacts/UnyfyDevInfo.json";

const BN128_SCALAR_MOD =
    BigInt(
        21888242871839275222246405745257275088548364400416034343698204186575808495617,
    );

export const EventABIs = {
    OrderPlaced: parseAbiItem(
        "event orderPlaced(address indexed pubaddr, uint256 indexed orderhash)",
    ),
    OrderCancelled: parseAbiItem(
        "event orderCancelled(address indexed pubaddr, uint256 indexed orderhash)",
    ),
    OrderDeleted: parseAbiItem("event orderDelete(uint256 indexed orderhash)"),
    OrderFilled: parseAbiItem(
        "event orderFilled(address indexed pubaddr, uint256 indexed orderhash, uint256[] indexed filledorderhashes)",
    ),
};

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
    const recoveredAddr = await recoverMessageAddress({
        message: shieldedCommit,
        signature: `0x${encSig.signatureValue}`,
    });
    if (recoveredAddr.toLowerCase() !== encalvePubAddr.toLowerCase()) {
        console.error("- CAUTION: Received invalid enclave signature");
        return false;
    }
    return true;
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

/*
 * Generates a proof for the place circuit.
 */
export async function provePlace(
    orderhash: string,
    dummy: string,
): Promise<Groth16ProofCalldata> {
    const orderhashBigInt = BigInt(`0x${orderhash}`);
    const dummyBigInt = BigInt(dummy);
    const proofInputs = {
        orderhash: orderhashBigInt,
        dummy: dummyBigInt,
    };

    let [proverRes, proverErr]: [Groth16FullProveResult | null, any] =
        await handleAsync(
            groth16.fullProve(proofInputs, PLACE_WASM, PLACE_ZKEY),
        );

    if (!proverRes || proverErr) {
        console.error(
            "ERROR: Could not generate place ZKP for input signals:",
            proofInputs,
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
    return exportRes;
}

/*
 * Generates a proof for the cancel circuit.
 */
export async function proveCancel(
    orderhash: string,
    dummy: string,
): Promise<Groth16ProofCalldata> {
    const orderhashBigInt = BigInt(`0x${orderhash}`);
    const dummyBigInt = BigInt(dummy);
    const cancelProofInputs = {
        orderhash: orderhashBigInt,
        dummy: dummyBigInt,
    };

    let [proverRes, proverErr]: [Groth16FullProveResult | null, any] =
        await handleAsync(
            groth16.fullProve(cancelProofInputs, CANCEL_WASM, CANCEL_ZKEY),
        );

    if (!proverRes || proverErr) {
        console.error(
            "ERROR: Could not generate cancel ZKP for input signals:",
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
    return exportRes;
}

/*
 * Generates a proof for the fill circuit.
 */
export async function proveFill(
    orderhashes: string[],
    dummy: string,
): Promise<Groth16ProofCalldata> {
    const orderhashBigInts = orderhashes.map((orderhash) =>
        BigInt(`0x${orderhash}`),
    );
    const dummyBigInt = BigInt(dummy);
    const fillProofInputs = {
        orderhash_own: orderhashBigInts[0],
        orderhash_filled: orderhashBigInts.slice(1, 11),
        dummy: dummyBigInt,
    };

    let [proverRes, proverErr]: [Groth16FullProveResult | null, any] =
        await handleAsync(
            groth16.fullProve(fillProofInputs, FILL_WASM, FILL_ZKEY),
        );

    if (!proverRes || proverErr) {
        console.error(
            "ERROR: Could not generate prove ZKP for input signals:",
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
    return exportRes;
}

/*
 * Sets up a contract interface with Viem.
 */
export function contractInterfaceSetup(privKey: string): [any, any] {
    const account = privateKeyToAccount(`0x${privKey}`);
    const walletClient = createWalletClient({
        account,
        chain: sepolia,
        transport: http(SEPOLIA_RPC),
    });
    const publicClient = createPublicClient({
        chain: sepolia,
        transport: http(SEPOLIA_RPC),
    });
    const contract = getContract({
        abi: UnyfyDevABI.abi,
        address: deployment.deployedTo as Address,
        walletClient,
        publicClient,
    });
    return [publicClient, contract];
}
