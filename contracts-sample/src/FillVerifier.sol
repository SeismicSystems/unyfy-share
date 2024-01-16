// SPDX-License-Identifier: GPL-3.0
/*
    Copyright 2021 0KIMS association.

    This file is generated with [snarkJS](https://github.com/iden3/snarkjs).

    snarkJS is a free software: you can redistribute it and/or modify it
    under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    snarkJS is distributed in the hope that it will be useful, but WITHOUT
    ANY WARRANTY; without even the implied warranty of MERCHANTABILITY
    or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public
    License for more details.

    You should have received a copy of the GNU General Public License
    along with snarkJS. If not, see <https://www.gnu.org/licenses/>.
*/

pragma solidity >=0.7.0 <0.9.0;

contract FillVerifier {
    // Scalar field size
    uint256 constant r    = 21888242871839275222246405745257275088548364400416034343698204186575808495617;
    // Base field size
    uint256 constant q   = 21888242871839275222246405745257275088696311157297823662689037894645226208583;

    // Verification Key data
    uint256 constant alphax  = 20491192805390485299153009773594534940189261866228447918068658471970481763042;
    uint256 constant alphay  = 9383485363053290200918347156157836566562967994039712273449902621266178545958;
    uint256 constant betax1  = 4252822878758300859123897981450591353533073413197771768651442665752259397132;
    uint256 constant betax2  = 6375614351688725206403948262868962793625744043794305715222011528459656738731;
    uint256 constant betay1  = 21847035105528745403288232691147584728191162732299865338377159692350059136679;
    uint256 constant betay2  = 10505242626370262277552901082094356697409835680220590971873171140371331206856;
    uint256 constant gammax1 = 11559732032986387107991004021392285783925812861821192530917403151452391805634;
    uint256 constant gammax2 = 10857046999023057135944570762232829481370756359578518086990519993285655852781;
    uint256 constant gammay1 = 4082367875863433681332203403145435568316851327593401208105741076214120093531;
    uint256 constant gammay2 = 8495653923123431417604973247489272438418190587263600148770280649306958101930;
    uint256 constant deltax1 = 11559732032986387107991004021392285783925812861821192530917403151452391805634;
    uint256 constant deltax2 = 10857046999023057135944570762232829481370756359578518086990519993285655852781;
    uint256 constant deltay1 = 4082367875863433681332203403145435568316851327593401208105741076214120093531;
    uint256 constant deltay2 = 8495653923123431417604973247489272438418190587263600148770280649306958101930;

    
    uint256 constant IC0x = 18698405777993035655114243189643214197343650388352867754948419685575455808319;
    uint256 constant IC0y = 14502819442492322120989607627277497551678578574132863462831161552680093330815;
    
    uint256 constant IC1x = 15923482818594019915654918351243454041891824562624288621683607983997716181148;
    uint256 constant IC1y = 2519032141233819147735834237580708798480103454292250281968014861808671242629;
    
    uint256 constant IC2x = 19790145214902396046696507875145351907178363894168023119639985615119423762363;
    uint256 constant IC2y = 11983699720981940927074071839996002519450617594252386938893295331787133101286;
    
    uint256 constant IC3x = 19810335345125044671506894259748159063449234499501245770222640888179764577716;
    uint256 constant IC3y = 5228293166363660730862831942273813880020857193366339231968005337196811366781;
    
    uint256 constant IC4x = 5279656966325175497745331403956482035689573833668472449986174338051183244806;
    uint256 constant IC4y = 2008624575256522988352298305274514273736983973930199721342952869262713701572;
    
    uint256 constant IC5x = 15124108956637230982127032938644892099746099076162242469698257563775525121713;
    uint256 constant IC5y = 8621092694048541906095763272095059316823995568649884127081667565716856452214;
    
    uint256 constant IC6x = 3200027977162242459350218067738888864356648982112428952638901065551601072726;
    uint256 constant IC6y = 8390078497851657874301349110524254190087360951518770367283759725535121553906;
    
    uint256 constant IC7x = 14956184480190391801212535020744970251817202174575052089338155274586281478649;
    uint256 constant IC7y = 20693901545501789597755962083092883994555098264813926363113629213062583561447;
    
    uint256 constant IC8x = 14672549423656038404678843207338694947678516482875393635759378045585729551820;
    uint256 constant IC8y = 17066513381303147921448213471769894459133609205191191392262225048182115864751;
    
    uint256 constant IC9x = 10173325962667380311759155659122157297006214396125467958466128953295493854168;
    uint256 constant IC9y = 4900485014842356992527304685789243682190733684918437725946750910338087034700;
    
    uint256 constant IC10x = 8014466832047151025674871887175744781261805973817644223184606562386346257706;
    uint256 constant IC10y = 6122417932833285248141400214871304043783234049824841594926077248342769794613;
    
    uint256 constant IC11x = 8795863228703183863627204672866925108144448087523963519880905260890278754102;
    uint256 constant IC11y = 21003531421451394953154779193172512032793183842791851665561551237466525086011;
    
    uint256 constant IC12x = 607017487363084655165748647212809777858706854843002614601316993448545510904;
    uint256 constant IC12y = 13780342432945201663441597294315844980118525342003966500283454457316466027427;
    
    uint256 constant IC13x = 525943336254783346240407475580136311980776108323680632046542526716528704246;
    uint256 constant IC13y = 2196518852353869041750688004036212299922529360664804120304219954367950308789;
    
    uint256 constant IC14x = 6770414576191340256685975900733655157113004332030363348392625217954931034756;
    uint256 constant IC14y = 7525651194100322379275615522143619018256228698931734487846583562282379173011;
    
    uint256 constant IC15x = 8472638020705611868190377893624923292954889307170391105458612832599095131469;
    uint256 constant IC15y = 3428654173010681928327454989755733146204480917198040431493780887178763784915;
    
    uint256 constant IC16x = 9999796741808388311482164628493632228317080948668768393228562109435492906832;
    uint256 constant IC16y = 9038425183062000266022182780742526615149541967189260458702186539596812027380;
    
    uint256 constant IC17x = 7794318679177010639804421593010687001139190344517489660160600302209055216800;
    uint256 constant IC17y = 9933069563434595700231679355579124013828139065379972586780304403609417207357;
    
    uint256 constant IC18x = 6744705951670434308259854019527052205436177108164557927520859065998483862260;
    uint256 constant IC18y = 5946347525529292421979262698218667351943165208332345949170094149303671530066;
    
    uint256 constant IC19x = 14270383327421381743112545788383059948751314437879370533877865036202042573778;
    uint256 constant IC19y = 598907108070342604137926769245524697733116033246123623075116954138144850968;
    
    uint256 constant IC20x = 6509069461278515539437088595832486194796013708576313208512163723977087163315;
    uint256 constant IC20y = 8172225737273424696332310760437975985959024141966013289119601065233594240190;
    
    uint256 constant IC21x = 539994386267906894633290927800917310831498815156332360127871469279015795233;
    uint256 constant IC21y = 3892936840635329301119248782708263981073557915329583492918492946557964911153;
    
    uint256 constant IC22x = 15442871087652989349550717775318065038133828659308221053993602477074968395984;
    uint256 constant IC22y = 15709976851925479814428718926374945585010384295666712374235483976361123242744;
    
 
    // Memory data
    uint16 constant pVk = 0;
    uint16 constant pPairing = 128;

    uint16 constant pLastMem = 896;

    function verifyProof(uint[2] calldata _pA, uint[2][2] calldata _pB, uint[2] calldata _pC, uint[22] calldata _pubSignals) public view returns (bool) {
        assembly {
            function checkField(v) {
                if iszero(lt(v, q)) {
                    mstore(0, 0)
                    return(0, 0x20)
                }
            }
            
            // G1 function to multiply a G1 value(x,y) to value in an address
            function g1_mulAccC(pR, x, y, s) {
                let success
                let mIn := mload(0x40)
                mstore(mIn, x)
                mstore(add(mIn, 32), y)
                mstore(add(mIn, 64), s)

                success := staticcall(sub(gas(), 2000), 7, mIn, 96, mIn, 64)

                if iszero(success) {
                    mstore(0, 0)
                    return(0, 0x20)
                }

                mstore(add(mIn, 64), mload(pR))
                mstore(add(mIn, 96), mload(add(pR, 32)))

                success := staticcall(sub(gas(), 2000), 6, mIn, 128, pR, 64)

                if iszero(success) {
                    mstore(0, 0)
                    return(0, 0x20)
                }
            }

            function checkPairing(pA, pB, pC, pubSignals, pMem) -> isOk {
                let _pPairing := add(pMem, pPairing)
                let _pVk := add(pMem, pVk)

                mstore(_pVk, IC0x)
                mstore(add(_pVk, 32), IC0y)

                // Compute the linear combination vk_x
                
                g1_mulAccC(_pVk, IC1x, IC1y, calldataload(add(pubSignals, 0)))
                
                g1_mulAccC(_pVk, IC2x, IC2y, calldataload(add(pubSignals, 32)))
                
                g1_mulAccC(_pVk, IC3x, IC3y, calldataload(add(pubSignals, 64)))
                
                g1_mulAccC(_pVk, IC4x, IC4y, calldataload(add(pubSignals, 96)))
                
                g1_mulAccC(_pVk, IC5x, IC5y, calldataload(add(pubSignals, 128)))
                
                g1_mulAccC(_pVk, IC6x, IC6y, calldataload(add(pubSignals, 160)))
                
                g1_mulAccC(_pVk, IC7x, IC7y, calldataload(add(pubSignals, 192)))
                
                g1_mulAccC(_pVk, IC8x, IC8y, calldataload(add(pubSignals, 224)))
                
                g1_mulAccC(_pVk, IC9x, IC9y, calldataload(add(pubSignals, 256)))
                
                g1_mulAccC(_pVk, IC10x, IC10y, calldataload(add(pubSignals, 288)))
                
                g1_mulAccC(_pVk, IC11x, IC11y, calldataload(add(pubSignals, 320)))
                
                g1_mulAccC(_pVk, IC12x, IC12y, calldataload(add(pubSignals, 352)))
                
                g1_mulAccC(_pVk, IC13x, IC13y, calldataload(add(pubSignals, 384)))
                
                g1_mulAccC(_pVk, IC14x, IC14y, calldataload(add(pubSignals, 416)))
                
                g1_mulAccC(_pVk, IC15x, IC15y, calldataload(add(pubSignals, 448)))
                
                g1_mulAccC(_pVk, IC16x, IC16y, calldataload(add(pubSignals, 480)))
                
                g1_mulAccC(_pVk, IC17x, IC17y, calldataload(add(pubSignals, 512)))
                
                g1_mulAccC(_pVk, IC18x, IC18y, calldataload(add(pubSignals, 544)))
                
                g1_mulAccC(_pVk, IC19x, IC19y, calldataload(add(pubSignals, 576)))
                
                g1_mulAccC(_pVk, IC20x, IC20y, calldataload(add(pubSignals, 608)))
                
                g1_mulAccC(_pVk, IC21x, IC21y, calldataload(add(pubSignals, 640)))
                
                g1_mulAccC(_pVk, IC22x, IC22y, calldataload(add(pubSignals, 672)))
                

                // -A
                mstore(_pPairing, calldataload(pA))
                mstore(add(_pPairing, 32), mod(sub(q, calldataload(add(pA, 32))), q))

                // B
                mstore(add(_pPairing, 64), calldataload(pB))
                mstore(add(_pPairing, 96), calldataload(add(pB, 32)))
                mstore(add(_pPairing, 128), calldataload(add(pB, 64)))
                mstore(add(_pPairing, 160), calldataload(add(pB, 96)))

                // alpha1
                mstore(add(_pPairing, 192), alphax)
                mstore(add(_pPairing, 224), alphay)

                // beta2
                mstore(add(_pPairing, 256), betax1)
                mstore(add(_pPairing, 288), betax2)
                mstore(add(_pPairing, 320), betay1)
                mstore(add(_pPairing, 352), betay2)

                // vk_x
                mstore(add(_pPairing, 384), mload(add(pMem, pVk)))
                mstore(add(_pPairing, 416), mload(add(pMem, add(pVk, 32))))


                // gamma2
                mstore(add(_pPairing, 448), gammax1)
                mstore(add(_pPairing, 480), gammax2)
                mstore(add(_pPairing, 512), gammay1)
                mstore(add(_pPairing, 544), gammay2)

                // C
                mstore(add(_pPairing, 576), calldataload(pC))
                mstore(add(_pPairing, 608), calldataload(add(pC, 32)))

                // delta2
                mstore(add(_pPairing, 640), deltax1)
                mstore(add(_pPairing, 672), deltax2)
                mstore(add(_pPairing, 704), deltay1)
                mstore(add(_pPairing, 736), deltay2)


                let success := staticcall(sub(gas(), 2000), 8, _pPairing, 768, _pPairing, 0x20)

                isOk := and(success, mload(_pPairing))
            }

            let pMem := mload(0x40)
            mstore(0x40, add(pMem, pLastMem))

            // Validate that all evaluations ∈ F
            
            checkField(calldataload(add(_pubSignals, 0)))
            
            checkField(calldataload(add(_pubSignals, 32)))
            
            checkField(calldataload(add(_pubSignals, 64)))
            
            checkField(calldataload(add(_pubSignals, 96)))
            
            checkField(calldataload(add(_pubSignals, 128)))
            
            checkField(calldataload(add(_pubSignals, 160)))
            
            checkField(calldataload(add(_pubSignals, 192)))
            
            checkField(calldataload(add(_pubSignals, 224)))
            
            checkField(calldataload(add(_pubSignals, 256)))
            
            checkField(calldataload(add(_pubSignals, 288)))
            
            checkField(calldataload(add(_pubSignals, 320)))
            
            checkField(calldataload(add(_pubSignals, 352)))
            
            checkField(calldataload(add(_pubSignals, 384)))
            
            checkField(calldataload(add(_pubSignals, 416)))
            
            checkField(calldataload(add(_pubSignals, 448)))
            
            checkField(calldataload(add(_pubSignals, 480)))
            
            checkField(calldataload(add(_pubSignals, 512)))
            
            checkField(calldataload(add(_pubSignals, 544)))
            
            checkField(calldataload(add(_pubSignals, 576)))
            
            checkField(calldataload(add(_pubSignals, 608)))
            
            checkField(calldataload(add(_pubSignals, 640)))
            
            checkField(calldataload(add(_pubSignals, 672)))
            
            checkField(calldataload(add(_pubSignals, 704)))
            

            // Validate all evaluations
            let isValid := checkPairing(_pA, _pB, _pC, _pubSignals, pMem)

            mstore(0, isValid)
             return(0, 0x20)
         }
     }
 }
