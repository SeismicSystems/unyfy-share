export type Order = {
    price: number;
    volume: number;
    side: number;
};

export type OrderCommitment = {
    shielded: string;
    transparent: {
        denomination: string;
        side: string;
        token: string;
    };
};

export type EnclaveSignature = {
    enclavePublicAddress: string;
    orderCommitment: OrderCommitment;
    signatureValue: string;
};
