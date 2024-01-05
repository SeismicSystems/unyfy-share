# #! /bin/bash

: '
  This script performs the following operations:
  1. Compiles the cancel circuit
  2. Computes a cancel.zkey
  3. Exports a solidity verifier to ../../contracts/Verifier.sol
'
source ../.env

PTAU=$1

# 1. Compile the cancel circuit
circom cancel.circom --r1cs --wasm

# 2. Move the cancel.wasm to the client-sample/circuit-samples/ directory
mv cancel_js/cancel.wasm cancel.wasm

# 3. Remove unnecessary folder
rm -rf cancel_js

# 3. Compute the cancel.zkey
snarkjs groth16 setup cancel.r1cs \
 $PTAU \
 cancel.zkey 

# 4. Remove the .r1cs file
rm cancel.r1cs

# 3. Export the solidity verifier to ../../contracts/CancelVerifier.sol
snarkjs zkey export solidityverifier cancel.zkey \
  ../contracts/src/CancelVerifier.sol 

sed -i '' 's/Groth16/Cancel/g' ../contracts/src/CancelVerifier.sol


#4. Deploy the verifier to Sepolia using Foundry
cd ../contracts

source ../.env

forge create --rpc-url https://sepolia.infura.io/v3/${INFURA_API_KEY} --private-key\
 $W1_PRIV_KEY \
 src/CancelVerifier.sol:CancelVerifier --json > CancelVerifierInfo.json

mv CancelVerifierInfo.json ../artifacts




