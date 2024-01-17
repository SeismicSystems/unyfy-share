pragma circom  2.1.6; 

template Cancel () {

    signal input orderhash;
    signal input dummy;

    signal output out;

    out <== orderhash*dummy;

    orderhash*(out-orderhash)===0;
    
}

component main{ public [ orderhash ] }= Cancel();

