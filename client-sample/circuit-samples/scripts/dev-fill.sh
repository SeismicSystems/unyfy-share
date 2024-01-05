#! /bin/bash

: '
  This script performs the following operations:
  1. Compiles the fill circuit
  2. Computes a fill.zkey
  3. Exports a solidity verifier to ../../contracts/Verifier.sol
'
source ../.env

PTAU=$1

# 1. Compile the fill circuit
circom fill.circom --r1cs --wasm

# 2. Move the fill.wasm to the client-sample/circuit-samples/ directory
mv fill_js/fill.wasm fill.wasm

# 3. Remove unnecessary folder
rm -rf fill_js

# 3. Compute the fill.zkey
snarkjs groth16 setup fill.r1cs \
 $PTAU \
 fill.zkey 

# 4. Remove the .r1cs file
rm fill.r1cs

# 3. Export the solidity verifier to ../../contracts/FillVerifier.sol
snarkjs zkey export solidityverifier fill.zkey \
  ../contracts/src/FillVerifier.sol 

sed -i '' 's/Groth16/Fill/g' ../contracts/src/FillVerifier.sol


#4. Deploy the verifier to Sepolia using Foundry
cd ../contracts

source ../.env

forge create --rpc-url https://sepolia.infura.io/v3/${INFURA_API_KEY} --private-key\
 $W1_PRIV_KEY \
 src/FillVerifier.sol:FillVerifier --json > FillVerifierInfo.json

mv FillVerifierInfo.json ../artifacts




