pragma circom  2.1.6; 

template Fill (N) {

    signal input orderhash_own;
    signal input orderhash_filled[N];
    signal input dummy;

    signal output out[N+1];

    out[0] <== orderhash_own*dummy;

    for(var i=1;i<N+1;i++){
        out[i] <== orderhash_filled[i-1]*dummy;
    }

    orderhash_own*(out[0]-orderhash_own)===0;
    
    for(var i=1;i<N+1;i++){
        orderhash_filled[i-1]*(out[i]-orderhash_filled[i-1]) === 0;
    }

}

component main{ public [ orderhash_own, orderhash_filled ] }= Fill(10);

