#! /bin/bash

: '
  This script performs the following operations:
  1. Compiles the circuit
  2. Computes a .zkey
  3. Exports a solidity verifier to ../contracts-sample/{Circuit_Name}Verifier.sol
'
source ../client-sample/.env

CIRCUIT_NAME=$1
PTAU=$2
CAP_CIRCUIT_NAME=$(echo $CIRCUIT_NAME | awk '{print toupper(substr($0,1,1))substr($0,2)}')

cd ${CIRCUIT_NAME}

# 1. Compile the circuit
circom ${CIRCUIT_NAME}.circom --r1cs --wasm

# 2. Move the .wasm to the current directory
mv ${CIRCUIT_NAME}_js/${CIRCUIT_NAME}.wasm ${CIRCUIT_NAME}.wasm

# 3. Remove unnecessary folder
rm -rf ${CIRCUIT_NAME}_js

# 3. Compute the .zkey
snarkjs groth16 setup ${CIRCUIT_NAME}.r1cs \
 ../$PTAU \
 ${CIRCUIT_NAME}.zkey 

# 4. Remove the .r1cs file
rm ${CIRCUIT_NAME}.r1cs


# 3. Export the solidity verifier to ../contracts-sample/${CAP_CIRCUIT_NAME}Verifier.sol
snarkjs zkey export solidityverifier ${CIRCUIT_NAME}.zkey \
  ../../contracts-sample/src/${CAP_CIRCUIT_NAME}Verifier.sol 

sed -i '' "s/Groth16/${CAP_CIRCUIT_NAME}/g" ../../contracts-sample/src/${CAP_CIRCUIT_NAME}Verifier.sol


#4. Deploy the verifier to Sepolia using Foundry
cd ../../contracts-sample

forge build

forge create --rpc-url https://sepolia.infura.io/v3/${INFURA_API_KEY} --private-key \
  $W1_PRIV_KEY \
 --json src/${CAP_CIRCUIT_NAME}Verifier.sol:${CAP_CIRCUIT_NAME}Verifier > ${CAP_CIRCUIT_NAME}VerifierInfo.json

mv ${CAP_CIRCUIT_NAME}VerifierInfo.json ../client-sample/artifacts

forge clean






