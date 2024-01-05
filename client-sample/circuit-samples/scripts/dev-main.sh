# Deploy the main verifier to Sepolia using Foundry
cd ../contracts

source ../.env

PLACE_CONTRACT_ADDRESS=$(cat ../artifacts/PlaceVerifierInfo.json | jq -r '.deployedTo')
CANCEL_CONTRACT_ADDRESS=$(cat ../artifacts/CancelVerifierInfo.json | jq -r '.deployedTo')
FILL_CONTRACT_ADDRESS=$(cat ../artifacts/FillVerifierInfo.json | jq -r '.deployedTo')
ENCLAVE_ADDRESS="0xa2c03BbE8Ce76d0c93D428A0f913F10b7acCfa9F"

forge create --rpc-url https://sepolia.infura.io/v3/${INFURA_API_KEY} \
    --constructor-args "$PLACE_CONTRACT_ADDRESS" "$CANCEL_CONTRACT_ADDRESS" "$FILL_CONTRACT_ADDRESS" "$ENCLAVE_ADDRESS" \
    --private-key $W1_PRIV_KEY\
    src/UnyfyDev.sol:UnyfyDev --json > UnyfyDevInfo.json

mv UnyfyDevInfo.json ../artifacts

cp out/UnyfyDev.sol/UnyfyDev.json ../artifacts

forge clean
