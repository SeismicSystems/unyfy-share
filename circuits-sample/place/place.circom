pragma circom  2.1.7;

template Place () {

    signal input orderhash;
    signal input dummy;

    signal output out;

    out <== orderhash*dummy;

    orderhash*(out-orderhash)===0;


}

component main{ public [ orderhash ] }= Place();

