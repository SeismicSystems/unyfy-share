import axios from "axios";
import { ethers } from "ethers";

const SEISMIC_CONFIG = {
    ip: "44.201.111.37",
    port: "8000",
};
const SEISMIC_URL = `http://${SEISMIC_CONFIG.ip}:${SEISMIC_CONFIG.port}`;

const SAMPLE_ORDER_DATA = {
    transparent: {
        side: "1",
        token: "92bf259f558808106e4840e2642352b156a31bc41e5b4283df2937278f0a7a65",
        denomination: "0x1",
    },
    shielded: {
        price: "99331421600",
        volume: "3000000000",
        accessKey: "1",
    },
};
const SAMPLE_ORDER_HASH =
    "1303177350543915549821791317173867930338436297750196254712378410446088378";

async function handleAsync<T>(
    promise: Promise<T>
): Promise<[T, null] | [null, any]> {
    try {
        const data = await promise;
        return [data, null];
    } catch (error) {
        return [null, error];
    }
}

(async () => {
    console.log("===== Creating sample wallet");
    let privateKey = ethers.Wallet.createRandom().privateKey;
    let wallet = new ethers.Wallet(privateKey);
    let address = wallet.address;
    console.log("- Address:", address);
    console.log("=====");


    console.log("===== Authenticating socket");
    let result, error;
    [result, error] = await handleAsync(axios.post(
        `${SEISMIC_URL}/request_challenge`
    ));
    if (!result || error) {
        console.error('- Error requesting challenge:', error);
        process.exit(1);
    }
    const challenge = result.data;
    console.log("- Received challenge:", challenge);

    [result, error] = await handleAsync(wallet.signMessage(challenge));
    if (!result || error) {
        console.error('- Error signing challenge:', error);
        process.exit(1);
    }
    const signature = result;
    console.log("- Signed challenge:", signature);

    [result, error] = await handleAsync(axios.post(
        `${SEISMIC_URL}/submit_response`
    ));

    // wallet.signMessage(challenge).then(signature => {
    //     axios.post('http://localhost:8000/submit_response', {
    //       challenge_id: challenge,
    //       signature: signature,
    //       pub_key: wallet.address
    //     })
    //     .then(response => {
    //       fs.writeFileSync('jwt.txt', response.data);
    //       console.log('JWT received and stored in jwt.txt');
    //     })
    //     .catch(error => console.error(error));
    //   });

    console.log("=====");
})();
