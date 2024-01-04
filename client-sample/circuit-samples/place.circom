pragma circom  2.1.7;

template Place () {

    // Declaration of signals.
    signal input orderhash;
    signal input z;
    signal output out;

    out <== orderhash*z;

    orderhash*(out-orderhash)===0;


}

component main{ public [orderhash] }= Place();

