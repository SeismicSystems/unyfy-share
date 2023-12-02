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
