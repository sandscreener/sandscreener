#!/bin/bash

if [ -f ./powers-of-tau/powersOfTau28_hez_final_16.ptau ]; then
    echo "powersOfTau28_hez_final_16.ptau already exists. Skipping."
else
    mkdir powers-of-tau
    cd powers-of-tau
    echo 'Downloading powersOfTau28_hez_final_16.ptau'
    curl https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_16.ptau -O
    cd ..
fi

echo "Compiling the circuit..."
name=`basename $circuit .circom`
# compile circuit
mkdir build
circom ./src/withdraw.circom --r1cs --wasm --sym --output build
snarkjs r1cs info build/withdraw.r1cs
# cp build/withdraw_js/withdraw.wasm ./../frontend/src/zk/witdhraw.wasm
# Create and export the zkey
snarkjs groth16 setup build/withdraw.r1cs powers-of-tau/powersOfTau28_hez_final_16.ptau build/withdraw_0000.zkey
snarkjs zkey contribute build/withdraw_0000.zkey build/withdraw_final.zkey --name="1st Contributor Name" -v
cp build/withdraw_js/withdraw.wasm ./../frontend/public/zk/withdraw.wasm
cp build/withdraw_final.zkey ./../frontend/public/zk/withdraw.zkey
cd build/
snarkjs zkey export verificationkey withdraw_final.zkey withdraw_verification_key.json
# generate solidity contract
snarkjs zkey export solidityverifier withdraw_final.zkey ./../../repository/contracts/withdraw.sol
cd ..