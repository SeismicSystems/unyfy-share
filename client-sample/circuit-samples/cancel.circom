pragma circom  2.1.7; 

template Cancel () {

    // Declaration of signals.
    signal input orderhash;
    signal input z;
    signal output out;

    out <== orderhash*z;

    orderhash*(out-orderhash)===0;


}

component main{ public [orderhash] }= Cancel();

