import { CreateWalletClientErrorType, createWalletClient, custom } from "viem";
import { privateKeyToAccount } from "viem/accounts";
export type RawOrder = {
    price: number;
    volume: number;
    side: number;
};

export type TransparentStructure = {
    denomination: string;
    side: string;
    token: string;
};

export type ShieldedStructure = {
    price: string;
    volume: string;
    accessKey: string;
};

export type Order = {
    data: {
        transparent: TransparentStructure;
        shielded: ShieldedStructure;
    };
    hash: string;
};

export type OrderCommitment = {
    transparent: TransparentStructure;
    shielded: string; // equal to Order.hash
};

export type EnclaveSignature = {
    enclavePublicAddress: string;
    orderCommitment: OrderCommitment;
    signatureValue: string;
};

export type Groth16FullProveResult = {
    proof: Groth16Proof;
    publicSignals: any;
};

export type Groth16Proof = {
    pi_a: string[];
    pi_b: string[][];
    pi_c: string[];
    protocol: string;
    curve: string;
};

export type Groth16ProofCalldata = {
    a: [string, string];
    b: [[string, string], [string, string]];
    c: [string, string];
    input: string[];
};
