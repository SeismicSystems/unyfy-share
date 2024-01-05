#! /bin/bash

: '
  This script performs the following operations:
  1. Compiles the place circuit
  2. Computes a place.zkey
  3. Exports a solidity verifier to ../../contracts/Verifier.sol
'
source ../.env

PTAU=$1

# 1. Compile the place circuit
circom place.circom --r1cs --wasm

# 2. Move the place.wasm to the client-sample/circuit-samples/ directory
mv place_js/place.wasm place.wasm

# 3. Remove unnecessary folder
rm -rf place_js

# 3. Compute the place.zkey
snarkjs groth16 setup place.r1cs \
 $PTAU \
 place.zkey 

# 4. Remove the .r1cs file
rm place.r1cs

# 3. Export the solidity verifier to ../../contracts/PlaceVerifier.sol
snarkjs zkey export solidityverifier place.zkey \
  ../contracts/src/PlaceVerifier.sol 

sed -i '' 's/Groth16/Place/g' ../contracts/src/PlaceVerifier.sol


#4. Deploy the verifier to Sepolia using Foundry
cd ../contracts

source ../.env

forge create --rpc-url https://sepolia.infura.io/v3/${INFURA_API_KEY} --private-key\
 $W1_PRIV_KEY \
 src/PlaceVerifier.sol:PlaceVerifier --json > PlaceVerifierInfo.json

mv PlaceVerifierInfo.json ../artifacts




